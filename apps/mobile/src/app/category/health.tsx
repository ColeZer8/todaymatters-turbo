import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { CategoryHealthTemplate } from '@/components/templates';
import {
  getHealthSummarySafeAsync,
  getIosInsightsSupportStatus,
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

  const onLiveUpdatesPress = useCallback(async () => {
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
      <CategoryHealthTemplate
        categoryId="health"
        range={range}
        onChangeRange={setRange}
        healthSummary={summary}
        onPressLiveUpdates={onLiveUpdatesPress}
        isRefreshingHealth={isRefreshing}
        healthErrorMessage={errorMessage}
      />
    </>
  );
}

