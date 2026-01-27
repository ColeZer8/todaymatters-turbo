import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuthStore } from '@/stores';
import {
  flushPendingLocationSamplesToSupabaseAsync,
  startIosBackgroundLocationAsync,
  stopIosBackgroundLocationAsync,
  clearPendingLocationSamplesAsync,
} from '@/lib/ios-location';
import {
  flushPendingAndroidLocationSamplesToSupabaseAsync,
  startAndroidBackgroundLocationAsync,
  stopAndroidBackgroundLocationAsync,
  clearPendingAndroidLocationSamplesAsync,
  peekPendingAndroidLocationSamplesAsync,
  ErrorCategory,
  logError,
  getMovementState,
  recordLastSyncTime,
} from '@/lib/android-location';
import type { MovementState } from '@/lib/android-location';

// ---------------------------------------------------------------------------
// Adaptive sync configuration
// ---------------------------------------------------------------------------

/** Sync interval when user is stationary (30 minutes). */
const STATIONARY_SYNC_INTERVAL_MS = 30 * 60 * 1000;

/** Sync interval when user is moving or state is unknown (15 minutes). */
const MOVING_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/** Queue threshold to trigger sync when stationary. */
const STATIONARY_QUEUE_THRESHOLD = 10;

/** Queue threshold to trigger sync when moving or unknown. */
const MOVING_QUEUE_THRESHOLD = 20;

/** Polling interval to check queue size on Android (60 seconds). */
const QUEUE_CHECK_INTERVAL_MS = 60 * 1000;

function getSyncIntervalForState(state: MovementState): number {
  return state === 'stationary' ? STATIONARY_SYNC_INTERVAL_MS : MOVING_SYNC_INTERVAL_MS;
}

function getQueueThresholdForState(state: MovementState): number {
  return state === 'stationary' ? STATIONARY_QUEUE_THRESHOLD : MOVING_QUEUE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseLocationSamplesSyncOptions {
  flushIntervalMs?: number;
}

export function useLocationSamplesSync(options: UseLocationSamplesSyncOptions = {}): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // iOS still uses the simple fixed interval.
  const iosFlushIntervalMs = options.flushIntervalMs ?? 2 * 60 * 1000; // 2 min

  const lastAuthedUserIdRef = useRef<string | null>(null);
  const isFlushingRef = useRef(false);

  // Start/stop background tracking based on authentication.
  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    if (isAuthenticated && userId) {
      lastAuthedUserIdRef.current = userId;
      if (Platform.OS === 'ios') {
        startIosBackgroundLocationAsync().catch((e) => {
          if (__DEV__) console.error('📍 Failed to start iOS background location:', e);
        });
      } else {
        startAndroidBackgroundLocationAsync().catch((e) => {
          if (__DEV__) console.error('📍 Failed to start Android background location:', e);
          logError(ErrorCategory.TASK_START_FAILED, 'Failed to start Android background location from sync hook', {
            error: e instanceof Error ? e.message : String(e),
          });
        });
      }
      return;
    }

    // Signed out (or missing user) — stop tracking and clear pending queue for the last user.
    if (Platform.OS === 'ios') {
      stopIosBackgroundLocationAsync().catch((e) => {
        if (__DEV__) console.error('📍 Failed to stop iOS background location:', e);
      });
    } else {
      stopAndroidBackgroundLocationAsync().catch((e) => {
        if (__DEV__) console.error('📍 Failed to stop Android background location:', e);
      });
    }

    const previousUserId = lastAuthedUserIdRef.current;
    if (previousUserId) {
      if (Platform.OS === 'ios') {
        clearPendingLocationSamplesAsync(previousUserId).catch((e) => {
          if (__DEV__) console.error('📍 Failed to clear pending iOS location samples:', e);
        });
      } else {
        clearPendingAndroidLocationSamplesAsync(previousUserId).catch((e) => {
          if (__DEV__) console.error('📍 Failed to clear pending Android location samples:', e);
        });
      }
      lastAuthedUserIdRef.current = null;
    }
  }, [isAuthenticated, userId]);

  // iOS: simple fixed-interval flush.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;

    const tick = async () => {
      if (isCancelled) return;
      if (isFlushingRef.current) return;
      isFlushingRef.current = true;
      try {
        const result = await flushPendingLocationSamplesToSupabaseAsync(userId);
        if (__DEV__ && result.uploaded > 0) {
          console.log(`📍 uploaded ${result.uploaded} iOS location samples (remaining=${result.remaining})`);
        }
      } catch (e) {
        if (__DEV__) console.error('📍 Failed to flush iOS location samples:', e);
      } finally {
        isFlushingRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, iosFlushIntervalMs);
    const appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      tick();
    });

    return () => {
      isCancelled = true;
      clearInterval(id);
      appStateListener.remove();
    };
  }, [iosFlushIntervalMs, isAuthenticated, userId]);

  // Android: adaptive sync based on movement state.
  // Uses two mechanisms:
  //   1. Time-based: sync interval varies by movement state (15 min moving, 30 min stationary)
  //   2. Queue-based: sync when queue size exceeds threshold (20 moving, 10 stationary)
  // On app foreground: always sync immediately.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;
    let syncIntervalId: ReturnType<typeof setTimeout> | null = null;
    let queueCheckIntervalId: ReturnType<typeof setInterval> | null = null;
    let lastSyncTimeMs = 0;

    const flushAndroid = async () => {
      if (isCancelled) return;
      if (isFlushingRef.current) return;
      isFlushingRef.current = true;
      try {
        const result = await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
        if (result.uploaded > 0) {
          lastSyncTimeMs = Date.now();
          recordLastSyncTime();
          if (__DEV__) {
            console.log(`📍 uploaded ${result.uploaded} Android location samples (remaining=${result.remaining})`);
          }
        }
      } catch (e) {
        if (__DEV__) console.error('📍 Failed to flush Android location samples:', e);
        logError(ErrorCategory.SYNC_FAILED, 'Failed to flush location samples in sync hook', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        isFlushingRef.current = false;
      }
    };

    const scheduleNextSync = async () => {
      if (isCancelled) return;
      // Determine interval from current movement state.
      let movementState: MovementState = 'unknown';
      try {
        const stateData = await getMovementState();
        movementState = stateData.state;
      } catch {
        // Default to unknown (uses moving intervals – conservative)
      }
      const intervalMs = getSyncIntervalForState(movementState);

      // Calculate time until next sync, accounting for time already elapsed.
      const elapsed = lastSyncTimeMs > 0 ? Date.now() - lastSyncTimeMs : intervalMs;
      const remaining = Math.max(0, intervalMs - elapsed);

      syncIntervalId = setTimeout(async () => {
        await flushAndroid();
        if (!isCancelled) {
          scheduleNextSync();
        }
      }, remaining);
    };

    const checkQueueAndFlush = async () => {
      if (isCancelled) return;
      if (isFlushingRef.current) return;

      try {
        let movementState: MovementState = 'unknown';
        try {
          const stateData = await getMovementState();
          movementState = stateData.state;
        } catch {
          // Default to unknown
        }

        const threshold = getQueueThresholdForState(movementState);
        const pending = await peekPendingAndroidLocationSamplesAsync(userId, threshold + 1);

        if (pending.length >= threshold) {
          if (__DEV__) {
            console.log(
              `📍 Queue threshold reached (${pending.length}>=${threshold}, state=${movementState}), flushing`
            );
          }
          await flushAndroid();
        }
      } catch {
        // Queue check failure is non-critical, skip this cycle
      }
    };

    // Immediate flush on mount.
    flushAndroid().then(() => {
      if (!isCancelled) {
        lastSyncTimeMs = Date.now();
        scheduleNextSync();
      }
    });

    // Periodic queue-size check.
    queueCheckIntervalId = setInterval(checkQueueAndFlush, QUEUE_CHECK_INTERVAL_MS);

    // App foreground: immediate sync regardless of interval.
    const appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      flushAndroid();
    });

    return () => {
      isCancelled = true;
      if (syncIntervalId !== null) clearTimeout(syncIntervalId);
      if (queueCheckIntervalId !== null) clearInterval(queueCheckIntervalId);
      appStateListener.remove();
    };
  }, [isAuthenticated, userId]);
}


