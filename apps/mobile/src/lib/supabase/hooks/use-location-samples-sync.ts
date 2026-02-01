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
  peekPendingAndroidLocationSamplesAsync,
  enqueueAndroidLocationSamplesForUserAsync,
  ErrorCategory,
  logError,
  getMovementState,
  recordLastSyncTime,
  captureAndroidLocationSampleNowAsync,
} from "@/lib/android-location";
import type { MovementState } from "@/lib/android-location";
// Supabase config for native uploads
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabase } from "@/lib/supabase/client";

// Native WorkManager implementation for reliable background location
// These imports are wrapped to prevent crashes if the native module isn't available
let BackgroundLocation: typeof import("expo-background-location") | null = null;
let drainPendingSamples: typeof import("expo-background-location").drainPendingSamples | null = null;
let configureSupabase: typeof import("expo-background-location").configureSupabase | null = null;
let updateJwtToken: typeof import("expo-background-location").updateJwtToken | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("expo-background-location");
  BackgroundLocation = mod;
  drainPendingSamples = mod.drainPendingSamples;
  configureSupabase = mod.configureSupabase;
  updateJwtToken = mod.updateJwtToken;
} catch (e) {
  console.warn("📍 [native] expo-background-location not available, background tracking disabled");
}

/** Max consecutive start failures before backing off until next app foreground. */
const MAX_RETRY_ATTEMPTS = 3;

/** Foreground location collection interval (fallback when background task fails). */
const FOREGROUND_LOCATION_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

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
        // Configure Supabase for native direct uploads (enables background sync when app is killed)
        const configureNativeSupabase = async () => {
          if (!configureSupabase) {
            console.warn("📍 [native] configureSupabase not available, skipping");
            return;
          }
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await configureSupabase(
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
                session.access_token,
                userId
              );
              console.log("📍 [native] Supabase configured for direct uploads");
            } else {
              console.warn("📍 [native] No session token available for Supabase config");
            }
          } catch (e) {
            console.error("📍 [native] Failed to configure Supabase:", e);
          }
        };

        // Configure Supabase first, then start tracking
        configureNativeSupabase().then(() => {
          // Foreground service (expo-location) for continuous background updates.
          // Falls back to WorkManager if foreground service cannot start.
          startAndroidBackgroundLocationAsync()
            .then((result) => {
              if (result.ok) {
                console.log(
                  `📍 [android] Foreground service location started (${result.reason})`,
                );
                return;
              }
              console.warn(
                `📍 [android] Foreground service start failed: ${result.reason}`,
              );
              if (!BackgroundLocation) {
                console.warn("📍 [native] BackgroundLocation not available");
                return;
              }
              return BackgroundLocation.startLocationTracking(userId, 15).then(
                () => {
                  console.log("📍 [native] WorkManager location tracking started");
                },
              );
            })
            .catch((e) => {
              console.error(
                "📍 [android] Foreground service start failed:",
                e,
              );
              if (BackgroundLocation) {
                BackgroundLocation.startLocationTracking(userId, 15).catch((err) => {
                  console.error("📍 [native] WorkManager start failed:", err);
                });
              }
            });
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
      // Stop both old and new implementations
      stopAndroidBackgroundLocationAsync().catch((e) => {
        if (__DEV__)
          console.error("📍 Failed to stop Android background location:", e);
      });
      if (BackgroundLocation) {
        BackgroundLocation.stopLocationTracking().catch((e) => {
          if (__DEV__)
            console.error("📍 [native] Failed to stop WorkManager:", e);
        });
      }
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

  // Android: Listen for token refresh and update native Supabase config
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!isAuthenticated || !userId) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED" && session?.access_token && updateJwtToken) {
          try {
            await updateJwtToken(session.access_token);
            if (__DEV__) {
              console.log("📍 [native] JWT token updated after refresh");
            }
          } catch (e) {
            if (__DEV__) {
              console.error("📍 [native] Failed to update JWT token:", e);
            }
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthenticated, userId]);

  // Android foreground location collection: Uses the SAME approach as "Capture Location Now"
  // which we know WORKS. Background task is still registered but not reliable, so we collect
  // location in foreground as a fallback. This runs when app is open.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;

    const collectAndSaveLocation = async () => {
      if (isCancelled) return;
      
      try {
        // Use the EXACT same approach as "Capture Location Now" button
        const result = await captureAndroidLocationSampleNowAsync(userId, {
          flushToSupabase: true, // Immediately upload to Supabase
        });
        
        if (result.ok && __DEV__) {
          console.log(
            `📍 [foreground] Location collected: enqueued=${result.enqueued}, uploaded=${result.uploaded ?? 0}`,
          );
        } else if (!result.ok && __DEV__) {
          console.warn(
            `📍 [foreground] Location collection failed: ${result.reason}`,
          );
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("📍 [foreground] Location collection error:", error);
        }
      }
    };

    // Collect location immediately on mount
    collectAndSaveLocation();

    // Then collect every 2 minutes while app is open
    const intervalId = setInterval(collectAndSaveLocation, FOREGROUND_LOCATION_INTERVAL_MS);

    // Also collect when app comes to foreground
    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          collectAndSaveLocation();
        }
      },
    );

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
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
        if (drainPendingSamples) {
          const nativeSamples = await drainPendingSamples(userId, 500);
          if (nativeSamples.length > 0) {
            await enqueueAndroidLocationSamplesForUserAsync(userId, nativeSamples);
            if (__DEV__) {
              console.log(
                `📍 drained ${nativeSamples.length} background samples from native store`,
              );
            }
          }
        }
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
