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
} from '@/lib/android-location';

interface UseLocationSamplesSyncOptions {
  flushIntervalMs?: number;
}

export function useLocationSamplesSync(options: UseLocationSamplesSyncOptions = {}): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const flushIntervalMs = options.flushIntervalMs ?? 2 * 60 * 1000; // 2 min

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

  // Periodically flush queued samples while authenticated.
  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;

    const tick = async () => {
      if (isCancelled) return;
      if (isFlushingRef.current) return;
      isFlushingRef.current = true;
      try {
        if (Platform.OS === 'ios') {
          const result = await flushPendingLocationSamplesToSupabaseAsync(userId);
          if (__DEV__ && result.uploaded > 0) {
            console.log(`📍 uploaded ${result.uploaded} iOS location samples (remaining=${result.remaining})`);
          }
        } else {
          const result = await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
          if (__DEV__ && result.uploaded > 0) {
            console.log(`📍 uploaded ${result.uploaded} Android location samples (remaining=${result.remaining})`);
          }
        }
      } catch (e) {
        if (__DEV__) console.error('📍 Failed to flush location samples:', e);
      } finally {
        isFlushingRef.current = false;
      }
    };

    // Immediate flush on mount, then interval.
    tick();
    const id = setInterval(tick, flushIntervalMs);
    const appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      tick();
    });

    return () => {
      isCancelled = true;
      clearInterval(id);
      appStateListener.remove();
    };
  }, [flushIntervalMs, isAuthenticated, userId]);
}


