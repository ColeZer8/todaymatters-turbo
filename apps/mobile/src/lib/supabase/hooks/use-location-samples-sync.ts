import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/stores";
import {
  flushPendingLocationSamplesToSupabaseAsync,
  startIosBackgroundLocationAsync,
  stopIosBackgroundLocationAsync,
  clearPendingLocationSamplesAsync,
} from "@/lib/ios-location";
import {
  flushPendingAndroidLocationSamplesToSupabaseAsync,
  startAndroidBackgroundLocationAsync,
  stopAndroidBackgroundLocationAsync,
  clearPendingAndroidLocationSamplesAsync,
  isAndroidBackgroundLocationRunningAsync,
  peekPendingAndroidLocationSamplesAsync,
  ErrorCategory,
  logError,
  getMovementState,
  getLastTaskHeartbeat,
  recordLastSyncTime,
} from "@/lib/android-location";
import type { MovementState } from "@/lib/android-location";

/** Max consecutive start failures before backing off until next app foreground. */
const MAX_RETRY_ATTEMPTS = 3;

/** How often to check if the Android background task is still alive (ms). */
const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 min (more aggressive)

/** Consider the task stale if it hasn't fired in this window. */
const TASK_HEARTBEAT_STALE_MS = 8 * 60 * 1000; // 8 min (considering 5min deferred batching)

const LAST_AUTHED_USER_ID_KEY = "tm:lastAuthedUserId";

// ---------------------------------------------------------------------------
// Adaptive sync configuration
// ---------------------------------------------------------------------------

/** Sync interval when user is stationary (15 minutes). */
const STATIONARY_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/** Sync interval when user is moving or state is unknown (5 minutes). */
const MOVING_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Queue threshold to trigger sync when stationary. */
const STATIONARY_QUEUE_THRESHOLD = 6;

/** Queue threshold to trigger sync when moving or unknown. */
const MOVING_QUEUE_THRESHOLD = 12;

/** Polling interval to check queue size on Android (60 seconds). */
const QUEUE_CHECK_INTERVAL_MS = 60 * 1000;


function getSyncIntervalForState(state: MovementState): number {
  return state === "stationary"
    ? STATIONARY_SYNC_INTERVAL_MS
    : MOVING_SYNC_INTERVAL_MS;
}

function getQueueThresholdForState(state: MovementState): number {
  return state === "stationary"
    ? STATIONARY_QUEUE_THRESHOLD
    : MOVING_QUEUE_THRESHOLD;
}

interface UseLocationSamplesSyncOptions {
  flushIntervalMs?: number;
}

export function useLocationSamplesSync(
  options: UseLocationSamplesSyncOptions = {},
): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // iOS still uses the simple fixed interval.
  const iosFlushIntervalMs = options.flushIntervalMs ?? 2 * 60 * 1000; // 2 min

  const lastAuthedUserIdRef = useRef<string | null>(null);
  const isFlushingRef = useRef(false);
  const retryAttemptsRef = useRef(0);

  // Start/stop background tracking based on authentication.
  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;

    if (isAuthenticated && userId) {
      lastAuthedUserIdRef.current = userId;
      retryAttemptsRef.current = 0;
      AsyncStorage.setItem(LAST_AUTHED_USER_ID_KEY, userId).catch((e) => {
        if (__DEV__)
          console.error(
            "📍 Failed to persist last authed user id for location tasks:",
            e,
          );
      });
      if (Platform.OS === "ios") {
        startIosBackgroundLocationAsync().catch((e) => {
          if (__DEV__)
            console.error("📍 Failed to start iOS background location:", e);
        });
      } else {
        startAndroidBackgroundLocationAsync()
          .then((result) => {
            if (!result.ok) {
              const detail = "detail" in result ? result.detail : undefined;
              console.warn(
                `📍 [sync] Android location start failed: ${result.reason}${detail ? ` — ${detail}` : ""}`,
              );
            }
          })
          .catch((e) => {
            console.error("📍 [sync] Android location start threw:", e);
          });
      }
      return;
    }

    // Signed out (or missing user) — stop tracking and clear pending queue for the last user.
    if (Platform.OS === "ios") {
      stopIosBackgroundLocationAsync().catch((e) => {
        if (__DEV__)
          console.error("📍 Failed to stop iOS background location:", e);
      });
    } else {
      stopAndroidBackgroundLocationAsync().catch((e) => {
        if (__DEV__)
          console.error("📍 Failed to stop Android background location:", e);
      });
    }

    const previousUserId = lastAuthedUserIdRef.current;
    if (previousUserId) {
      AsyncStorage.removeItem(LAST_AUTHED_USER_ID_KEY).catch((e) => {
        if (__DEV__)
          console.error(
            "📍 Failed to clear last authed user id for location tasks:",
            e,
          );
      });
      if (Platform.OS === "ios") {
        clearPendingLocationSamplesAsync(previousUserId).catch((e) => {
          if (__DEV__)
            console.error(
              "📍 Failed to clear pending iOS location samples:",
              e,
            );
        });
      } else {
        clearPendingAndroidLocationSamplesAsync(previousUserId).catch((e) => {
          if (__DEV__)
            console.error(
              "📍 Failed to clear pending Android location samples:",
              e,
            );
        });
      }
      lastAuthedUserIdRef.current = null;
    }
  }, [isAuthenticated, userId]);

  // Android health check: periodically verify background task is alive and restart if needed.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;

    const healthCheck = async () => {
      if (isCancelled) return;
      if (retryAttemptsRef.current >= MAX_RETRY_ATTEMPTS) {
        console.log(
          `📍 [health] Skipping — retry limit reached (${MAX_RETRY_ATTEMPTS}), waiting for next foreground event`,
        );
        return;
      }

      const [running, heartbeat] = await Promise.all([
        isAndroidBackgroundLocationRunningAsync(),
        getLastTaskHeartbeat(),
      ]);
      const heartbeatAgeMs = heartbeat
        ? Date.now() - new Date(heartbeat.timestamp).getTime()
        : null;
      const heartbeatStale =
        heartbeatAgeMs != null && heartbeatAgeMs > TASK_HEARTBEAT_STALE_MS;

      if (running && !heartbeatStale) {
        // Task is alive — reset retry counter.
        retryAttemptsRef.current = 0;
        return;
      }

      if (running && heartbeatStale) {
        console.warn(
          `📍 [health] Task running but stale heartbeat (${Math.round(heartbeatAgeMs / 60000)}m) — restarting`,
        );
        await stopAndroidBackgroundLocationAsync();
      }

      // Task is not running (or stale) — attempt restart.
      retryAttemptsRef.current += 1;
      console.log(
        `📍 [health] Background task not running — restarting (attempt ${retryAttemptsRef.current}/${MAX_RETRY_ATTEMPTS})`,
      );
      const result = await startAndroidBackgroundLocationAsync();
      if (result.ok) {
        console.log(`📍 [health] Restart successful: ${result.reason}`);
        retryAttemptsRef.current = 0;
      } else {
        const detail = "detail" in result ? result.detail : undefined;
        console.warn(
          `📍 [health] Restart failed: ${result.reason}${detail ? ` — ${detail}` : ""}`,
        );
      }
    };

    // Run health check on a slower interval than flush.
    const id = setInterval(healthCheck, HEALTH_CHECK_INTERVAL_MS);

    // Also health-check when app comes to foreground (resets retry counter first).
    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state !== "active") return;
        retryAttemptsRef.current = 0; // Reset on foreground — user is present.
        healthCheck().catch((e) => {
          console.error("📍 [health] Foreground health check failed:", e);
        });
      },
    );

    return () => {
      isCancelled = true;
      clearInterval(id);
      appStateListener.remove();
    };
  }, [isAuthenticated, userId]);

  // iOS: simple fixed-interval flush.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;

    const tick = async () => {
      if (isCancelled) return;
      if (isFlushingRef.current) return;
      isFlushingRef.current = true;
      try {
        const result = await flushPendingLocationSamplesToSupabaseAsync(userId);
        if (__DEV__ && result.uploaded > 0) {
          console.log(
            `📍 uploaded ${result.uploaded} iOS location samples (remaining=${result.remaining})`,
          );
        }
      } catch (e) {
        if (__DEV__) console.error("📍 Failed to flush iOS location samples:", e);
      } finally {
        isFlushingRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, iosFlushIntervalMs);
    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state !== "active") return;
        tick();
      },
    );

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
    if (Platform.OS !== "android") return;
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
        const result =
          await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
        if (result.uploaded > 0) {
          lastSyncTimeMs = Date.now();
          recordLastSyncTime();
          if (__DEV__) {
            console.log(
              `📍 uploaded ${result.uploaded} Android location samples (remaining=${result.remaining})`,
            );
          }
        }
      } catch (e) {
        if (__DEV__)
          console.error("📍 Failed to flush Android location samples:", e);
        logError(
          ErrorCategory.SYNC_FAILED,
          "Failed to flush location samples in sync hook",
          {
            error: e instanceof Error ? e.message : String(e),
          },
        );
      } finally {
        isFlushingRef.current = false;
      }
    };

    const scheduleNextSync = async () => {
      if (isCancelled) return;
      // Determine interval from current movement state.
      let movementState: MovementState = "unknown";
      try {
        const stateData = await getMovementState();
        movementState = stateData.state;
      } catch {
        // Default to unknown (uses moving intervals – conservative)
      }
      const intervalMs = getSyncIntervalForState(movementState);

      // Calculate time until next sync, accounting for time already elapsed.
      const elapsed =
        lastSyncTimeMs > 0 ? Date.now() - lastSyncTimeMs : intervalMs;
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
        let movementState: MovementState = "unknown";
        try {
          const stateData = await getMovementState();
          movementState = stateData.state;
        } catch {
          // Default to unknown
        }

        const threshold = getQueueThresholdForState(movementState);
        const pending = await peekPendingAndroidLocationSamplesAsync(
          userId,
          threshold + 1,
        );

        if (pending.length >= threshold) {
          if (__DEV__) {
            console.log(
              `📍 Queue threshold reached (${pending.length}>=${threshold}, state=${movementState}), flushing`,
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
    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state !== "active") return;
        flushAndroid();
      },
    );

    return () => {
      isCancelled = true;
      if (syncIntervalId !== null) clearTimeout(syncIntervalId);
      if (queueCheckIntervalId !== null) clearInterval(queueCheckIntervalId);
      appStateListener.remove();
    };
  }, [isAuthenticated, userId]);
}
