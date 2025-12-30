import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ScreenTimeAnalyticsTemplate } from '@/components/templates';
import {
  getIosInsightsSupportStatus,
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  presentTodayScreenTimeReportSafeAsync,
  requestScreenTimeAuthorizationSafeAsync,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeSummary,
} from '@/lib/ios-insights';

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function DemoScreenTimeScreen() {
  const [status, setStatus] = useState<ScreenTimeAuthorizationStatus>('unsupported');
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supportStatus = useMemo(() => getIosInsightsSupportStatus(), []);
  const canUseNative = supportStatus === 'available' && status !== 'unsupported';

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'ios') return 'iOS only.';
    if (supportStatus === 'expoGo') {
      return 'You are running in Expo Go. Screen Time requires a custom iOS dev client. Build it (pnpm --filter mobile ios) and open the installed “mobile” app (not Expo Go).';
    }
    if (supportStatus === 'missingNativeModule') {
      return 'IosInsights native module is not present in this build. This usually means your iOS dev client is stale—rebuild it (pnpm --filter mobile ios) and reopen the app.';
    }
    if (errorMessage) {
      return `Error: ${errorMessage}`;
    }
    if (status === 'unsupported') return 'Screen Time is not available.';
    if (status === 'approved') return 'Screen Time access approved. Tap Refresh to generate today’s report.';
    if (status === 'denied') return 'Screen Time access denied. Tap Allow Screen Time and approve in the prompt.';
    if (status === 'notDetermined') return 'Screen Time not authorized yet. Tap Allow Screen Time.';
    return 'Screen Time unavailable.';
  }, [errorMessage, status, supportStatus]);

  const totalLabel = useMemo(() => {
    if (!summary) return '—';
    return formatDuration(summary.totalSeconds);
  }, [summary]);

  const topApps = useMemo(() => {
    if (!summary) return [];
    return summary.topApps.map((app) => ({
      id: app.bundleIdentifier,
      name: app.displayName,
      durationLabel: formatDuration(app.durationSeconds),
      durationSeconds: app.durationSeconds,
    }));
  }, [summary]);

  const refreshStatusAndCache = useCallback(async () => {
    setErrorMessage(null);

    const support = getIosInsightsSupportStatus();
    if (support !== 'available') {
      setStatus('unsupported');
      setSummary(null);
      return;
    }

    try {
      const [nextStatus, nextSummary] = await Promise.all([
        getScreenTimeAuthorizationStatusSafeAsync(),
        getCachedScreenTimeSummarySafeAsync(),
      ]);
      setStatus(nextStatus);
      setSummary(nextSummary);
    } catch (e) {
      setStatus('unknown');
      setSummary(null);
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshStatusAndCache();
  }, [refreshStatusAndCache]);

  const onRequestAuthorization = useCallback(async () => {
    setErrorMessage(null);
    try {
      const nextStatus = await requestScreenTimeAuthorizationSafeAsync();
      setStatus(nextStatus);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStatus('unknown');
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      // This presents a native report UI (Apple-supported). When closed, the extension will
      // have persisted a summary to the shared app group for us to read.
      await presentTodayScreenTimeReportSafeAsync();
      await refreshStatusAndCache();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshStatusAndCache]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTimeAnalyticsTemplate
        totalLabel={totalLabel}
        topApps={topApps}
        statusLabel={statusLabel}
        canRequestAuthorization={canUseNative && (status === 'notDetermined' || status === 'denied' || status === 'approved' || status === 'unknown')}
        canRefresh={canUseNative && status === 'approved'}
        onRequestAuthorization={onRequestAuthorization}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </>
  );
}


