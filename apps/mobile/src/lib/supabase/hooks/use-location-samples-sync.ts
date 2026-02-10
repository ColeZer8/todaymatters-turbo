import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/stores";
import { isLocationAvailableForIngestion } from "@/lib/location-permission";
import {
  captureIosLocationSampleNowWithProviderAsync as captureIosLocationSampleNowAsync,
  flushPendingLocationSamplesToSupabaseAsync,
  startIosBackgroundLocationWithProviderAsync as startIosBackgroundLocationAsync,
  stopIosBackgroundLocationWithProviderAsync as stopIosBackgroundLocationAsync,
  clearPendingLocationSamplesAsync,
  IOS_DEFAULT_TRACKING_PROFILE,
} from "@/lib/location-provider/ios";
import {
  flushPendingAndroidLocationSamplesToSupabaseAsync,
  clearPendingAndroidLocationSamplesAsync,
  peekPendingAndroidLocationSamplesAsync,
  enqueueAndroidLocationSamplesForUserAsync,
  ErrorCategory,
  logError,
  getMovementState,
  recordLastSyncTime,
  getAndroidNotificationPermissionStatusAsync,
} from "@/lib/android-location";
import {
  startAndroidBackgroundLocationWithProviderAsync as startAndroidBackgroundLocationAsync,
  stopAndroidBackgroundLocationWithProviderAsync as stopAndroidBackgroundLocationAsync,
  captureAndroidLocationSampleNowWithProviderAsync as captureAndroidLocationSampleNowAsync,
  isAndroidBackgroundLocationRunningWithProviderAsync as isAndroidBackgroundLocationRunningAsync,
} from "@/lib/location-provider/android";
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

/** Foreground location collection interval (fallback when background isn't running). */
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

/** Watchdog interval while app is open/active (3 minutes). */
const ANDROID_WATCHDOG_INTERVAL_MS = 3 * 60 * 1000;


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
  // iOS uses the default tracking profile cadence unless explicitly overridden.
  const iosFlushIntervalMs =
    options.flushIntervalMs ?? IOS_DEFAULT_TRACKING_PROFILE.syncFlushIntervalMs;

  const lastAuthedUserIdRef = useRef<string | null>(null);
  const isFlushingRef = useRef(false);
  const retryAttemptsRef = useRef(0);
  const isWatchdogRunningRef = useRef(false);

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
        configureNativeSupabase().then(async () => {
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

              // If permissions/services are denied/disabled, do NOT fall back to WorkManager.
              // WorkManager uses a location foreground service too and can crash when denied.
              if (result.reason === "fg_denied" || result.reason === "bg_denied" || result.reason === "services_disabled") {
                return;
              }

              // Skip legacy WorkManager fallback when Transistor is the active provider
              if (process.env.EXPO_PUBLIC_USE_TRANSISTOR_LOCATION === "true") {
                console.log("📍 [native] Skipping WorkManager fallback (Transistor active)");
                return;
              }

              if (!BackgroundLocation) {
                console.warn("📍 [native] BackgroundLocation not available");
                return;
              }

              return isLocationAvailableForIngestion().then((canStart) => {
                if (!canStart) {
                  console.warn(
                    "📍 [native] Skipping WorkManager fallback: location not available for ingestion",
                  );
                  return;
                }
                return BackgroundLocation.startLocationTracking(userId, 15).then(
                  () => {
                    console.log(
                      "📍 [native] WorkManager location tracking started",
                    );
                  },
                );
              });
            })
            .catch((e) => {
              console.error(
                "📍 [android] Foreground service start failed:",
                e,
              );
              // Don't blindly fall back on unexpected errors; require permissions first.
              if (!BackgroundLocation) return;
              isLocationAvailableForIngestion()
                .then((canStart) => {
                  if (!canStart) return;
                  return BackgroundLocation.startLocationTracking(userId, 15);
                })
                .catch((err) => {
                  console.error("📍 [native] WorkManager start failed:", err);
                });
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

  // Android watchdog: if the OS kills background updates, restart when app becomes active.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;

    const tick = async (trigger: "init" | "foreground" | "interval") => {
      if (isCancelled) return;
      if (isWatchdogRunningRef.current) return;
      isWatchdogRunningRef.current = true;
      try {
        const running = await isAndroidBackgroundLocationRunningAsync().catch(
          () => false,
        );
        if (running) return;

        // Only attempt restart when we *should* be able to run background ingestion.
        // This avoids churn when permissions/services were revoked.
        const canIngest = await isLocationAvailableForIngestion().catch(
          () => false,
        );
        if (!canIngest) {
          await logError(
            ErrorCategory.PERMISSION_DENIED,
            "Android watchdog: background task not running (cannot ingest)",
            { trigger },
          );
          return;
        }

        const notifications = await getAndroidNotificationPermissionStatusAsync()
          .catch(() => ({ status: "undetermined" as const, required: false }));

        const startResult = await startAndroidBackgroundLocationAsync();
        if (startResult.ok) {
          if (__DEV__) {
            console.log(
              `📍 [watchdog] Restarted Android background location (${trigger})`,
            );
          }
          return;
        }

        await logError(
          ErrorCategory.TASK_START_FAILED,
          "Android watchdog: failed to restart background location task",
          {
            trigger,
            reason: startResult.reason,
            detail: startResult.detail,
            notificationsStatus: notifications.status,
            notificationsRequired: notifications.required,
          },
        );

        // Skip legacy WorkManager fallback when Transistor is the active provider
        if (process.env.EXPO_PUBLIC_USE_TRANSISTOR_LOCATION === "true") {
          return;
        }

        // If the foreground-service task can't start for non-permission reasons,
        // ensure the native WorkManager fallback is scheduled (best-effort).
        if (
          startResult.reason !== "fg_denied" &&
          startResult.reason !== "bg_denied" &&
          startResult.reason !== "services_disabled" &&
          BackgroundLocation
        ) {
          try {
            const tracking = await BackgroundLocation.isTracking().catch(
              () => ({ isTracking: false as const }),
            );
            if (!tracking.isTracking) {
              await BackgroundLocation.startLocationTracking(userId, 15);
              if (__DEV__) {
                console.log(
                  `📍 [watchdog] Scheduled WorkManager fallback (${trigger})`,
                );
              }
            }
          } catch (e) {
            await logError(
              ErrorCategory.TASK_START_FAILED,
              "Android watchdog: failed to schedule WorkManager fallback",
              {
                trigger,
                error: e instanceof Error ? e.message : String(e),
              },
            );
          }
        }
      } finally {
        isWatchdogRunningRef.current = false;
      }
    };

    // Run once on mount (while authenticated).
    tick("init");

    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          tick("foreground");
        }
      },
    );

    // Periodic checks while app is open. This doesn't help when the app is killed,
    // but it does prevent long "stuck off" periods during active use.
    const intervalId = setInterval(() => {
      if (AppState.currentState !== "active") return;
      tick("interval");
    }, ANDROID_WATCHDOG_INTERVAL_MS);

    return () => {
      isCancelled = true;
      appStateListener.remove();
      clearInterval(intervalId);
    };
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
  // Skip when Transistor is active — it handles both foreground and background collection.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!isAuthenticated || !userId) return;
    if (process.env.EXPO_PUBLIC_USE_TRANSISTOR_LOCATION === "true") {
      console.log("📍 [foreground] Skipping legacy foreground polling (Transistor active)");
      return;
    }

    let isCancelled = false;

    const collectAndSaveLocation = async () => {
      if (isCancelled) return;
      
      try {
        // Use the EXACT same approach as "Capture Location Now" button
        const result = await captureAndroidLocationSampleNowAsync(userId, {
          flushToSupabase: true, // Immediately upload to Supabase
        });

        if (__DEV__) {
          if (result.ok) {
            console.log(
              `📍 [foreground] Location collected: enqueued=${result.enqueued}, uploaded=${result.uploaded ?? 0}`,
            );
          } else {
            const reason = "reason" in result ? result.reason : "unknown";
            console.warn(
              `📍 [foreground] Location collection failed: ${reason}`,
            );
          }
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
  // iOS: foreground fallback collection (works in Expo Go and with When-In-Use permission).
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;
    let lastFailureLogAt = 0;
    const FAILURE_LOG_THROTTLE_MS = 60_000;

    const capture = async () => {
      if (isCancelled) return;
      try {
        const result = await captureIosLocationSampleNowAsync(userId);
        if (__DEV__ && result.ok && result.enqueued > 0) {
          console.log(`📍 [ios] captured ${result.enqueued} location sample(s)`);
        }
        if (__DEV__ && "reason" in result) {
          const now = Date.now();
          if (now - lastFailureLogAt >= FAILURE_LOG_THROTTLE_MS) {
            lastFailureLogAt = now;
            console.warn(`📍 [ios] location capture skipped: ${result.reason}`);
          }
        }
      } catch (e) {
        if (__DEV__) {
          console.warn("📍 [ios] foreground location capture failed:", e);
        }
      }
    };

    // Capture immediately, then periodically while app is open.
    capture();
    const intervalId = setInterval(
      capture,
      IOS_DEFAULT_TRACKING_PROFILE.heartbeatIntervalMs,
    );

    // Also capture when app comes back to foreground.
    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          capture();
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
            // Native samples carry `raw: unknown | null`, but our queue expects `Json | null`.
            // TodayMatters doesn't currently use `raw`, so normalize to null for safety.
            const normalizedSamples = nativeSamples.map((s) => ({
              ...s,
              raw: null,
            }));
            await enqueueAndroidLocationSamplesForUserAsync(
              userId,
              normalizedSamples,
            );
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
