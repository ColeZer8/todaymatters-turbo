import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ScreenTimeAnalyticsTemplate } from '@/components/templates';
import {
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  getIosInsightsSupportStatus,
  getScreenTimeReportSupportStatus,
  getScreenTimeNativeMethodAvailabilityStatus,
  presentScreenTimeReportSafeAsync,
  requestScreenTimeAuthorizationSafeAsync,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeRangeKey,
  type ScreenTimeSummary,
} from '@/lib/ios-insights';
import {
  getAndroidInsightsSupportStatus,
  getUsageAccessAuthorizationStatusSafeAsync,
  getUsageSummarySafeAsync,
  openUsageAccessSettingsSafeAsync,
  type UsageAccessAuthorizationStatus,
  type UsageRangeKey,
  type UsageSummary,
} from '@/lib/android-insights';
import { syncAndroidUsageSummary, syncIosScreenTimeSummary } from '@/lib/supabase/services';
import { useAuthStore } from '@/stores';

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function DevScreenTimeScreen() {
  if (Platform.OS === 'android') {
    return <AndroidScreenTimeDashboard />;
  }
  return <IosScreenTimeDashboard />;
}

function IosScreenTimeDashboard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [status, setStatus] = useState<ScreenTimeAuthorizationStatus>('unsupported');
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);
  const [range, setRange] = useState<ScreenTimeRangeKey>('today');

  const supportStatus = useMemo(() => getIosInsightsSupportStatus(), []);
  const canUseNative = supportStatus === 'available' && status !== 'unsupported';
  const { supportsRange } = useMemo(() => getScreenTimeReportSupportStatus(), []);
  const nativeMethods = useMemo(() => getScreenTimeNativeMethodAvailabilityStatus(), []);
  const showAuthorizationCta = canUseNative && (status === 'notDetermined' || status === 'denied');

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'ios') return 'iOS only.';
    if (supportStatus === 'expoGo') {
      return 'You are running in Expo Go. Screen Time requires a custom iOS dev client.';
    }
    if (supportStatus === 'missingNativeModule') {
      return 'IosInsights native module is missing. Rebuild the iOS dev client.';
    }
    if (errorMessage) {
      return `Error: ${errorMessage}\n\nNative methods:\n- presentScreenTimeReport: ${
        nativeMethods.hasPresentScreenTimeReport ? 'yes' : 'no'
      }\n- presentTodayScreenTimeReport: ${
        nativeMethods.hasPresentTodayScreenTimeReport ? 'yes' : 'no'
      }\n- getCachedScreenTimeSummaryJson: ${nativeMethods.hasGetCachedScreenTimeSummaryJson ? 'yes' : 'no'}`;
    }
    if (status === 'unsupported') return 'Screen Time is not available.';
    if (status === 'denied') return 'Screen Time access is off. Enable it once to see today’s totals here.';
    if (status === 'notDetermined') return 'Enable Screen Time once to see today’s totals here.';
    if (!summary) return 'No cached Screen Time yet. Tap the sliders icon to refresh.';
    return 'Screen Time ready.';
  }, [errorMessage, nativeMethods, status, summary, supportStatus]);

  const totalLabel = useMemo(() => {
    if (!summary) return '—';
    return formatDuration(summary.totalSeconds);
  }, [summary]);

  const score = useMemo(() => {
    if (!summary) return null;
    const minutes = Math.round(summary.totalSeconds / 60);
    const pickups = summary.topApps.reduce((acc, app) => acc + (app.pickups ?? 0), 0);
    const minutesPenalty = Math.min(70, Math.round(minutes / 6));
    const pickupsPenalty = Math.min(30, Math.round(pickups / 8));
    return Math.max(0, Math.min(100, 100 - minutesPenalty - pickupsPenalty));
  }, [summary]);

  const scoreLabel = useMemo(() => {
    if (score === null) return '—';
    if (score >= 80) return 'Balanced';
    if (score >= 60) return 'Steady';
    return 'Overloaded';
  }, [score]);

  const scoreTrendLabel = useMemo(() => {
    if (score === null) return null;
    return score >= 80 ? 'Improving' : score >= 60 ? 'Stable' : 'Needs focus';
  }, [score]);

  const topApps = useMemo(() => {
    if (!summary) return [];
    return summary.topApps.map((app) => ({
      id: app.bundleIdentifier,
      name: app.displayName,
      durationLabel: formatDuration(app.durationSeconds),
      durationSeconds: app.durationSeconds,
      categoryLabel: 'App',
      categoryAccent: '#2F7BFF',
    }));
  }, [summary]);

  const refreshStatusAndCache = useCallback(async (): Promise<ScreenTimeSummary | null> => {
    setErrorMessage(null);
    try {
      const [nextStatus, nextSummary] = await Promise.all([
        getScreenTimeAuthorizationStatusSafeAsync(),
        getCachedScreenTimeSummarySafeAsync(range),
      ]);
      setStatus(nextStatus);
      setSummary(nextSummary);
      if (nextSummary && userId) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
        try {
          await syncIosScreenTimeSummary(userId, nextSummary, timezone);
        } catch (error) {
          if (__DEV__) {
            console.warn('📊 iOS Screen Time sync skipped:', error);
          }
          setSupabaseWarning('Supabase tables are missing — showing local Screen Time data only.');
        }
      }
      return nextSummary;
    } catch (e) {
      setStatus('unknown');
      setSummary(null);
      setErrorMessage(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [range, userId]);

  useEffect(() => {
    if (Platform.OS === 'ios') void refreshStatusAndCache();
  }, [refreshStatusAndCache]);

  const onRequestAuthorization = useCallback(async () => {
    setErrorMessage(null);
    try {
      const nextStatus = await requestScreenTimeAuthorizationSafeAsync();
      setStatus(nextStatus);
      if (nextStatus === 'approved') {
        await refreshStatusAndCache();
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStatus('unknown');
    }
  }, [refreshStatusAndCache]);

  const onRefresh = useCallback(async () => {
    if (!(supportStatus === 'available' && status === 'approved')) return;
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      await presentScreenTimeReportSafeAsync(range);
      let nextSummary: ScreenTimeSummary | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await refreshStatusAndCache();
        if (result) {
          nextSummary = result;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (!nextSummary) {
        setErrorMessage(
          'Screen Time synced, but no data was returned. The report extension might not be writing to the app group yet.',
        );
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
    }
  }, [range, refreshStatusAndCache, status, supportStatus]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTimeAnalyticsTemplate
        range={range}
        onChangeRange={setRange}
        canChangeRange={supportsRange}
        totalLabel={totalLabel}
        deltaLabel={null}
        score={score}
        scoreLabel={scoreLabel}
        scoreTrendLabel={scoreTrendLabel}
        insightBody={null}
        suggestionBody={null}
        hourlyBuckets={summary?.hourlyBucketsSeconds ?? null}
        topApps={topApps}
        onPressBack={() => router.back()}
        onPressSettings={onRefresh}
        statusLabel={statusLabel}
        onRequestAuthorization={onRequestAuthorization}
        showAuthorizationCta={showAuthorizationCta}
        isSyncing={isSyncing}
        bannerText={supabaseWarning}
        bannerTone="warning"
      />
    </>
  );
}

function AndroidScreenTimeDashboard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [status, setStatus] = useState<UsageAccessAuthorizationStatus>('unsupported');
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);
  const [range, setRange] = useState<UsageRangeKey>('today');

  const supportStatus = useMemo(() => getAndroidInsightsSupportStatus(), []);
  const canUseNative = supportStatus === 'available';
  const showAuthorizationCta = canUseNative && status !== 'authorized';

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'android') return 'Android only.';
    if (supportStatus === 'expoGo') {
      return 'You are running in Expo Go. Android usage requires a custom dev client.';
    }
    if (supportStatus === 'missingNativeModule') {
      return 'AndroidInsights native module is missing. Rebuild the Android dev client.';
    }
    if (errorMessage) return `Error: ${errorMessage}`;
    if (status === 'unsupported') return 'Usage access is not available.';
    if (status === 'denied') return 'Usage access is off. Enable it to see totals here.';
    if (status === 'notDetermined') return 'Enable usage access to see totals here.';
    if (!summary) return 'No usage data yet. Tap the sliders icon to refresh.';
    return 'Usage data ready.';
  }, [errorMessage, status, summary, supportStatus]);

  const totalLabel = useMemo(() => {
    if (!summary) return '—';
    return formatDuration(summary.totalSeconds);
  }, [summary]);

  const score = useMemo(() => {
    if (!summary) return null;
    const minutes = Math.round(summary.totalSeconds / 60);
    const minutesPenalty = Math.min(70, Math.round(minutes / 6));
    return Math.max(0, Math.min(100, 100 - minutesPenalty));
  }, [summary]);

  const scoreLabel = useMemo(() => {
    if (score === null) return '—';
    if (score >= 80) return 'Balanced';
    if (score >= 60) return 'Steady';
    return 'Overloaded';
  }, [score]);

  const scoreTrendLabel = useMemo(() => {
    if (score === null) return null;
    return score >= 80 ? 'Improving' : score >= 60 ? 'Stable' : 'Needs focus';
  }, [score]);

  const topApps = useMemo(() => {
    if (!summary) return [];
    return summary.topApps.map((app) => ({
      id: app.packageName,
      name: app.displayName,
      durationLabel: formatDuration(app.durationSeconds),
      durationSeconds: app.durationSeconds,
      categoryLabel: 'App',
      categoryAccent: '#2F7BFF',
    }));
  }, [summary]);

  const hourlyAppBreakdown = useMemo(() => {
    if (!summary?.hourlyByApp) {
      return Array.from({ length: 24 }, (_, hour) => ({ hour, apps: [] }));
    }

    const nameLookup = new Map(summary.topApps.map((app) => [app.packageName, app.displayName]));
    const hourToApps = Array.from({ length: 24 }, () => new Map<string, number>());

    for (const [packageName, hourMap] of Object.entries(summary.hourlyByApp)) {
      for (const [hourKey, seconds] of Object.entries(hourMap)) {
        const hour = Number(hourKey);
        if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
        if (!seconds || seconds <= 0) continue;
        const current = hourToApps[hour].get(packageName) ?? 0;
        hourToApps[hour].set(packageName, current + seconds);
      }
    }

    return hourToApps.map((apps, hour) => {
      const items = Array.from(apps.entries())
        .map(([packageName, seconds]) => ({
          id: packageName,
          name: nameLookup.get(packageName) ?? packageName,
          durationSeconds: seconds,
          durationLabel: formatDuration(seconds),
        }))
        .sort((a, b) => b.durationSeconds - a.durationSeconds);
      return { hour, apps: items };
    });
  }, [summary]);

  const hourlyStatus = useMemo(() => {
    if (!summary) return null;
    const hasHourlyApps = hourlyAppBreakdown.some((bucket) => bucket.apps.length > 0);
    if (hasHourlyApps) return null;
    if (summary.totalSeconds > 0) {
      return 'Hourly breakdown is unavailable on this emulator. Usage events can be limited; try a physical device or reopen the app after enabling Usage Access.';
    }
    return 'No hourly usage yet. Use the device and refresh to populate the timeline.';
  }, [hourlyAppBreakdown, summary]);

  const refreshStatusAndCache = useCallback(async (): Promise<UsageSummary | null> => {
    setErrorMessage(null);
    try {
      const [nextStatus, nextSummary] = await Promise.all([
        getUsageAccessAuthorizationStatusSafeAsync(),
        getUsageSummarySafeAsync(range),
      ]);
      setStatus(nextStatus);
      setSummary(nextSummary);
      if (nextSummary && userId) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
        try {
          await syncAndroidUsageSummary(userId, nextSummary, timezone);
        } catch (error) {
          if (__DEV__) {
            console.warn('📊 Android usage sync skipped:', error);
          }
          setSupabaseWarning('Supabase tables are missing — showing local usage data only.');
        }
      }
      return nextSummary;
    } catch (e) {
      setStatus('unknown');
      setSummary(null);
      setErrorMessage(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [range, userId]);

  useEffect(() => {
    if (Platform.OS === 'android') void refreshStatusAndCache();
  }, [refreshStatusAndCache]);

  const onRequestAuthorization = useCallback(async () => {
    setErrorMessage(null);
    try {
      await openUsageAccessSettingsSafeAsync();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await refreshStatusAndCache();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStatus('unknown');
    }
  }, [refreshStatusAndCache]);

  const onRefresh = useCallback(async () => {
    if (!(supportStatus === 'available' && status === 'authorized')) return;
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      await refreshStatusAndCache();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
    }
  }, [refreshStatusAndCache, status, supportStatus]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTimeAnalyticsTemplate
        range={range}
        onChangeRange={setRange}
        canChangeRange
        totalLabel={totalLabel}
        deltaLabel={null}
        score={score}
        scoreLabel={scoreLabel}
        scoreTrendLabel={scoreTrendLabel}
        insightBody={null}
        suggestionBody={null}
        hourlyBuckets={summary?.hourlyBucketsSeconds ?? null}
        hourlyAppBreakdown={hourlyAppBreakdown}
        showHourlyChart={false}
        topApps={topApps}
        showTopApps={false}
        onPressBack={() => router.back()}
        onPressSettings={onRefresh}
        statusLabel={statusLabel}
        onRequestAuthorization={onRequestAuthorization}
        showAuthorizationCta={showAuthorizationCta}
        isSyncing={isSyncing}
        bannerText={hourlyStatus ?? supabaseWarning}
        bannerTone={hourlyStatus ? 'info' : 'warning'}
      />
    </>
  );
}
