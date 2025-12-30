import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { HealthKitDashboardTemplate } from '@/components/templates';
import {
  getIosInsightsSupportStatus,
  getHealthSummarySafeAsync,
  requestHealthKitAuthorizationAsync,
  type HealthRangeKey,
  type HealthSummary,
} from '@/lib/ios-insights';

export default function HealthHealthScreen() {
  const [range, setRange] = useState<HealthRangeKey>('today');
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const support = useMemo(() => getIosInsightsSupportStatus(), []);
  const canUseNative = Platform.OS === 'ios' && support === 'available';

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'ios') return 'iOS only.';
    if (support === 'expoGo') return 'Apple Health requires a custom iOS dev client (not Expo Go).';
    if (support === 'missingNativeModule') return 'Native module missing in this build. Rebuild the iOS dev client.';
    if (errorMessage) return `Error: ${errorMessage}`;
    return 'Connect Apple Health, then refresh to load your metrics.';
  }, [errorMessage, support]);

  const refresh = useCallback(async () => {
    if (!canUseNative) return;
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const next = await getHealthSummarySafeAsync(range);
      setSummary(next);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRefreshing(false);
    }
  }, [canUseNative, range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRequestAuthorization = useCallback(async () => {
    if (!canUseNative) return;
    setErrorMessage(null);
    try {
      await requestHealthKitAuthorizationAsync();
      await refresh();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [canUseNative, refresh]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HealthKitDashboardTemplate
        range={range}
        onChangeRange={setRange}
        summary={summary}
        statusLabel={statusLabel}
        canRequestAuthorization={canUseNative}
        canRefresh={canUseNative}
        onRequestAuthorization={onRequestAuthorization}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />
    </>
  );
}

