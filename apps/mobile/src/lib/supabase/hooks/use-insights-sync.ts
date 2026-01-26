import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuthStore } from '@/stores';
import { getDeviceTimezone } from '@/lib/dates/local-date';
import {
  getIosInsightsSupportStatus,
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  getHealthAuthorizationStatusSafeAsync,
  getHealthSummarySafeAsync,
  getTodayActivityRingsSummarySafeAsync,
  getLatestWorkoutSummarySafeAsync,
} from '@/lib/ios-insights';
import {
  getAndroidInsightsSupportStatus,
  getUsageAccessAuthorizationStatusSafeAsync,
  getUsageSummarySafeAsync,
  getHealthAuthorizationStatusSafeAsync as getAndroidHealthAuthorizationStatusSafeAsync,
  getHealthSummarySafeAsync as getAndroidHealthSummarySafeAsync,
  getLatestWorkoutSummarySafeAsync as getAndroidLatestWorkoutSummarySafeAsync,
  type UsageSummary,
} from '@/lib/android-insights';
import { fetchDataSyncState, upsertDataSyncState } from '@/lib/supabase/services/data-sync-state';
import { syncIosScreenTimeSummary, syncAndroidUsageSummary } from '@/lib/supabase/services/screen-time-sync';
import { syncIosHealthSummary, syncAndroidHealthSummary } from '@/lib/supabase/services/health-sync';
import { updateProfile } from '@/lib/supabase/services/profiles';

const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function shouldSyncDataset(userId: string, dataset: 'health' | 'screen_time', platform: 'ios' | 'android', provider: string, minIntervalMs: number): Promise<boolean> {
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
  const lastTimezoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    let isCancelled = false;

    const tick = async () => {
      if (isCancelled || isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        const timezone = getDeviceTimezone();
        if (lastTimezoneRef.current !== timezone) {
          lastTimezoneRef.current = timezone;
          try {
            await updateProfile(userId, { timezone });
          } catch (error) {
            console.warn('[InsightsSync] Failed to sync profile timezone:', error instanceof Error ? error.message : String(error));
          }
        }

        if (Platform.OS === 'ios') {
          const support = getIosInsightsSupportStatus();
          if (support === 'available') {
            const screenTimeStatus = await getScreenTimeAuthorizationStatusSafeAsync();
            if (screenTimeStatus === 'approved') {
              const canSync = await shouldSyncDataset(userId, 'screen_time', 'ios', 'ios_screentime', intervalMs);
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: 'screen_time',
                  platform: 'ios',
                  provider: 'ios_screentime',
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const summary = await getCachedScreenTimeSummarySafeAsync('today');
                if (summary) {
                  await syncIosScreenTimeSummary(userId, summary, timezone);
                }
              }
            }

            const healthStatus = await getHealthAuthorizationStatusSafeAsync();
            if (healthStatus === 'authorized') {
              const canSync = await shouldSyncDataset(userId, 'health', 'ios', 'apple_health', intervalMs);
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: 'health',
                  platform: 'ios',
                  provider: 'apple_health',
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const [summary, rings, workout] = await Promise.all([
                  getHealthSummarySafeAsync('today'),
                  getTodayActivityRingsSummarySafeAsync(),
                  getLatestWorkoutSummarySafeAsync('today'),
                ]);
                if (summary) {
                  await syncIosHealthSummary(userId, summary, timezone, rings, workout);
                }
              }
            }
          }
        }

        if (Platform.OS === 'android') {
          const support = getAndroidInsightsSupportStatus();
          console.log(`[InsightsSync] Android support status: ${support}`);
          if (support === 'available') {
            const usageStatus = await getUsageAccessAuthorizationStatusSafeAsync();
            console.log(`[InsightsSync] Android usage access status: ${usageStatus}`);
            if (usageStatus === 'authorized') {
              const canSync = await shouldSyncDataset(
                userId,
                'screen_time',
                'android',
                'android_digital_wellbeing',
                intervalMs
              );
              console.log(`[InsightsSync] Android screen time canSync: ${canSync}`);
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: 'screen_time',
                  platform: 'android',
                  provider: 'android_digital_wellbeing',
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const summary: UsageSummary | null = await getUsageSummarySafeAsync('today');
                console.log(`[InsightsSync] Android usage summary: totalSeconds=${summary?.totalSeconds ?? 'null'}, topApps=${summary?.topApps?.length ?? 0}, sessions=${summary?.sessions?.length ?? 0}`);
                if (summary) {
                  await syncAndroidUsageSummary(userId, summary, timezone);
                } else {
                  console.log(`[InsightsSync] Android usage summary is null - no data to sync`);
                  // Record that we tried but got no data (use 'partial' since we succeeded at checking but found nothing)
                  await upsertDataSyncState({
                    userId,
                    dataset: 'screen_time',
                    platform: 'android',
                    provider: 'android_digital_wellbeing',
                    lastSyncFinishedAt: new Date().toISOString(),
                    lastSyncStatus: 'partial',
                    lastSyncError: 'getUsageSummarySafeAsync returned null - no usage data available',
                  });
                }
              }
            } else {
              console.log(`[InsightsSync] Android usage access not authorized (${usageStatus}) - skipping screen time sync`);
            }

            const healthStatus = await getAndroidHealthAuthorizationStatusSafeAsync();
            if (healthStatus === 'authorized') {
              const canSync = await shouldSyncDataset(userId, 'health', 'android', 'health_connect', intervalMs);
              if (canSync) {
                await upsertDataSyncState({
                  userId,
                  dataset: 'health',
                  platform: 'android',
                  provider: 'health_connect',
                  lastSyncStartedAt: new Date().toISOString(),
                  lastSyncStatus: null,
                  lastSyncError: null,
                });
                const [summary, workout] = await Promise.all([
                  getAndroidHealthSummarySafeAsync('today'),
                  getAndroidLatestWorkoutSummarySafeAsync('today'),
                ]);
                if (summary) {
                  await syncAndroidHealthSummary(userId, summary, timezone, workout);
                }
              }
            }
          }
        }
      } catch (error) {
        // Log in production too for debugging physical device issues
        console.error('[InsightsSync] Sync failed:', error instanceof Error ? error.message : String(error));
        if (__DEV__) {
          console.error('📊 Insights sync failed (full error):', error);
        }
      } finally {
        isSyncingRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    const appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      tick();
    });
    return () => {
      isCancelled = true;
      clearInterval(id);
      appStateListener.remove();
    };
  }, [intervalMs, isAuthenticated, userId]);
}
