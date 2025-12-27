import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ScreenTimeAnalyticsTemplate } from '@/components/templates';
import {
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

  const canUseNative = Platform.OS === 'ios' && status !== 'unsupported';

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'ios') return 'iOS only.';
    if (status === 'unsupported') {
      return 'Native iOS module not loaded. Rebuild the iOS dev client (pnpm --filter mobile ios) and reopen the app.';
    }
    if (status === 'approved') return 'Screen Time access approved. Tap Refresh to generate today’s report.';
    if (status === 'denied') return 'Screen Time access denied. Tap Allow Screen Time and approve in the prompt.';
    if (status === 'notDetermined') return 'Screen Time not authorized yet. Tap Allow Screen Time.';
    return 'Screen Time unavailable.';
  }, [status]);

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
    const [nextStatus, nextSummary] = await Promise.all([
      getScreenTimeAuthorizationStatusSafeAsync(),
      getCachedScreenTimeSummarySafeAsync(),
    ]);
    setStatus(nextStatus);
    setSummary(nextSummary);
  }, []);

  useEffect(() => {
    void refreshStatusAndCache();
  }, [refreshStatusAndCache]);

  const onRequestAuthorization = useCallback(async () => {
    const nextStatus = await requestScreenTimeAuthorizationSafeAsync();
    setStatus(nextStatus);
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // This presents a native report UI (Apple-supported). When closed, the extension will
      // have persisted a summary to the shared app group for us to read.
      await presentTodayScreenTimeReportSafeAsync();
      await refreshStatusAndCache();
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


