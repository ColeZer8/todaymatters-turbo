import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useAuthStore } from "@/stores";
import {
  getIosInsightsSupportStatus,
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  getHealthAuthorizationStatusSafeAsync,
  getHealthSummarySafeAsync,
  getTodayActivityRingsSummarySafeAsync,
  getLatestWorkoutSummarySafeAsync,
} from "@/lib/ios-insights";
import {
  getAndroidInsightsSupportStatus,
  getUsageAccessAuthorizationStatusSafeAsync,
  getUsageSummarySafeAsync,
  getHealthAuthorizationStatusSafeAsync as getAndroidHealthAuthorizationStatusSafeAsync,
  getHealthSummarySafeAsync as getAndroidHealthSummarySafeAsync,
  getLatestWorkoutSummarySafeAsync as getAndroidLatestWorkoutSummarySafeAsync,
  type UsageSummary,
} from "@/lib/android-insights";
import {
  fetchDataSyncState,
  upsertDataSyncState,
} from "@/lib/supabase/services/data-sync-state";
import {
  syncIosScreenTimeSummary,
  syncAndroidUsageSummary,
} from "@/lib/supabase/services/screen-time-sync";
import {
  syncIosHealthSummary,
  syncAndroidHealthSummary,
} from "@/lib/supabase/services/health-sync";

const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}

async function shouldSyncDataset(
  userId: string,
  dataset: "health" | "screen_time",
  platform: "ios" | "android",
  provider: string,
  minIntervalMs: number,
): Promise<boolean> {
  const state = await fetchDataSyncState(userId, dataset, platform, provider);
  if (!state?.lastSyncFinishedAt) return true;
  const last = new Date(state.lastSyncFinishedAt).getTime();
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= minIntervalMs;
}

export function useInsightsSync(options: { intervalMs?: number } = {}): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const intervalMs = options.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS;
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;

    let isCancelled = false;
    const timezone = getDeviceTimezone();

    const tick = async () => {
      if (isCancelled || isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        if (Platform.OS === "ios") {
          const support = getIosInsightsSupportStatus();
          if (support === "available") {
            const screenTimeStatus =
              await getScreenTimeAuthorizationStatusSafeAsync();
            if (screenTimeStatus === "approved") {
              const canSync = await shouldSyncDataset(
                userId,
                "screen_time",
                "ios",
                "ios_screentime",
                intervalMs,
              );
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: "screen_time",
                  platform: "ios",
                  provider: "ios_screentime",
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const summary =
                  await getCachedScreenTimeSummarySafeAsync("today");
                if (summary) {
                  await syncIosScreenTimeSummary(userId, summary, timezone);
                }
              }
            }

            const healthStatus = await getHealthAuthorizationStatusSafeAsync();
            if (healthStatus === "authorized") {
              const canSync = await shouldSyncDataset(
                userId,
                "health",
                "ios",
                "apple_health",
                intervalMs,
              );
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: "health",
                  platform: "ios",
                  provider: "apple_health",
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const [summary, rings, workout] = await Promise.all([
                  getHealthSummarySafeAsync("today"),
                  getTodayActivityRingsSummarySafeAsync(),
                  getLatestWorkoutSummarySafeAsync("today"),
                ]);
                if (summary) {
                  await syncIosHealthSummary(
                    userId,
                    summary,
                    timezone,
                    rings,
                    workout,
                  );
                }
              }
            }
          }
        }

        if (Platform.OS === "android") {
          const support = getAndroidInsightsSupportStatus();
          if (support === "available") {
            const usageStatus =
              await getUsageAccessAuthorizationStatusSafeAsync();
            if (usageStatus === "authorized") {
              const canSync = await shouldSyncDataset(
                userId,
                "screen_time",
                "android",
                "android_digital_wellbeing",
                intervalMs,
              );
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: "screen_time",
                  platform: "android",
                  provider: "android_digital_wellbeing",
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const summary: UsageSummary | null =
                  await getUsageSummarySafeAsync("today");
                if (summary) {
                  console.log(
                    `[insights-sync] Android usage: totalSeconds=${summary.totalSeconds} topApps=${summary.topApps.length} sessions=${summary.sessions?.length ?? 0} hourlyByAppKeys=${summary.hourlyByApp ? Object.keys(summary.hourlyByApp).length : 0}`,
                  );
                  await syncAndroidUsageSummary(userId, summary, timezone);
                }
              }
            }

            const healthStatus =
              await getAndroidHealthAuthorizationStatusSafeAsync();
            if (healthStatus === "authorized") {
              const canSync = await shouldSyncDataset(
                userId,
                "health",
                "android",
                "health_connect",
                intervalMs,
              );
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: "health",
                  platform: "android",
                  provider: "health_connect",
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const [summary, workout] = await Promise.all([
                  getAndroidHealthSummarySafeAsync("today"),
                  getAndroidLatestWorkoutSummarySafeAsync("today"),
                ]);
                if (summary) {
                  await syncAndroidHealthSummary(
                    userId,
                    summary,
                    timezone,
                    workout,
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error("📊 Insights sync failed:", error);
        }
      } finally {
        isSyncingRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
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
  }, [intervalMs, isAuthenticated, userId]);
}
