import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { CategoryHealthTemplate } from '@/components/templates';
import {
  getHealthSummarySafeAsync,
  requestHealthAuthorizationSafeAsync,
  type HealthRangeKey,
  type HealthSummary,
} from '@/lib/insights';
import { getIosInsightsSupportStatus } from '@/lib/ios-insights';
import { getAndroidInsightsSupportStatus } from '@/lib/android-insights';

export default function HealthHealthScreen() {
  const [range, setRange] = useState<HealthRangeKey>('today');
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const iosSupport = useMemo(() => getIosInsightsSupportStatus(), []);
  const androidSupport = useMemo(() => getAndroidInsightsSupportStatus(), []);
  const canUseNative =
    (Platform.OS === 'ios' && iosSupport === 'available') || (Platform.OS === 'android' && androidSupport === 'available');

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
      await requestHealthAuthorizationSafeAsync();
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

