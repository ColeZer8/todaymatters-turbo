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
} from "@/lib/android-location";

/** Max consecutive start failures before backing off until next app foreground. */
const MAX_RETRY_ATTEMPTS = 3;

/** How often to check if the Android background task is still alive (ms). */
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

const LAST_AUTHED_USER_ID_KEY = "tm:lastAuthedUserId";

interface UseLocationSamplesSyncOptions {
  flushIntervalMs?: number;
}

export function useLocationSamplesSync(
  options: UseLocationSamplesSyncOptions = {},
): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const flushIntervalMs = options.flushIntervalMs ?? 2 * 60 * 1000; // 2 min

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

      const running = await isAndroidBackgroundLocationRunningAsync();
      if (running) {
        // Task is alive — reset retry counter.
        retryAttemptsRef.current = 0;
        return;
      }

      // Task is not running — attempt restart.
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

  // Periodically flush queued samples while authenticated.
  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    if (!isAuthenticated || !userId) return;

    let isCancelled = false;

    const tick = async () => {
      if (isCancelled) return;
      if (isFlushingRef.current) return;
      isFlushingRef.current = true;
      try {
        if (Platform.OS === "ios") {
          const result =
            await flushPendingLocationSamplesToSupabaseAsync(userId);
          if (__DEV__ && result.uploaded > 0) {
            console.log(
              `📍 uploaded ${result.uploaded} iOS location samples (remaining=${result.remaining})`,
            );
          }
        } else {
          const result =
            await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
          if (__DEV__ && result.uploaded > 0) {
            console.log(
              `📍 uploaded ${result.uploaded} Android location samples (remaining=${result.remaining})`,
            );
          }
        }
      } catch (e) {
        if (__DEV__) console.error("📍 Failed to flush location samples:", e);
      } finally {
        isFlushingRef.current = false;
      }
    };

    // Immediate flush on mount, then interval.
    tick();
    const id = setInterval(tick, flushIntervalMs);
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
  }, [flushIntervalMs, isAuthenticated, userId]);
}
