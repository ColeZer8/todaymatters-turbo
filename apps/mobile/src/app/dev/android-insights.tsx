import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/atoms/GradientButton';
import {
  getAndroidInsightsSupportStatus,
  getHealthSummarySafeAsync,
  getTodayStepCountAsync,
  getUsageAccessAuthorizationStatusSafeAsync,
  getUsageSummarySafeAsync,
  getUsageStatsDiagnosticsSafeAsync,
  openHealthConnectSettingsSafeAsync,
  openUsageAccessSettingsSafeAsync,
  requestHealthConnectAuthorizationSafeAsync,
  type HealthRangeKey,
  type HealthSummary,
  type UsageAccessAuthorizationStatus,
  type UsageRangeKey,
  type UsageSummary,
  type UsageStatsDiagnostics,
} from '@/lib/android-insights';

export default function AndroidInsightsDevScreen() {
  const support = useMemo(() => getAndroidInsightsSupportStatus(), []);
  const canUseNative = Platform.OS === 'android' && support === 'available';

  const [healthConnectAvailable, setHealthConnectAvailable] = useState<boolean | null>(null);
  const [healthAuthorized, setHealthAuthorized] = useState<boolean | null>(null);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [healthRange, setHealthRange] = useState<HealthRangeKey>('today');

  const [usageStatus, setUsageStatus] = useState<UsageAccessAuthorizationStatus>('unsupported');
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [usageRange, setUsageRange] = useState<UsageRangeKey>('today');
  const [usageDiagnostics, setUsageDiagnostics] = useState<UsageStatsDiagnostics | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'android') return 'Android only.';
    if (support === 'expoGo')
      return 'You are running in Expo Go. Android insights require a custom dev build (pnpm --filter mobile android).';
    if (support === 'missingNativeModule')
      return 'AndroidInsights native module is missing in this build. Rebuild the Android dev client.';
    if (errorMessage) return `Error: ${errorMessage}`;
    return 'Use this screen to validate Health Connect + Usage Stats on a real Android device.';
  }, [errorMessage, support]);

  const onOpenHealthConnectSettings = useCallback(async () => {
    setErrorMessage(null);
    try {
      await openHealthConnectSettingsSafeAsync();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onRequestHealth = useCallback(async () => {
    setErrorMessage(null);
    try {
      const ok = await requestHealthConnectAuthorizationSafeAsync();
      setHealthAuthorized(ok);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onGetTodaySteps = useCallback(async () => {
    setErrorMessage(null);
    try {
      const steps = await getTodayStepCountAsync();
      setTodaySteps(steps);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onFetchHealthSummary = useCallback(async () => {
    setErrorMessage(null);
    try {
      const summary = await getHealthSummarySafeAsync(healthRange);
      setHealthSummary(summary);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [healthRange]);

  const onGetUsageStatus = useCallback(async () => {
    setErrorMessage(null);
    try {
      const s = await getUsageAccessAuthorizationStatusSafeAsync();
      setUsageStatus(s);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onOpenUsageSettings = useCallback(async () => {
    setErrorMessage(null);
    try {
      await openUsageAccessSettingsSafeAsync();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onFetchUsageSummary = useCallback(async () => {
    setErrorMessage(null);
    try {
      const summary = await getUsageSummarySafeAsync(usageRange);
      setUsageSummary(summary);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [usageRange]);

  const onRunDiagnostics = useCallback(async () => {
    setErrorMessage(null);
    try {
      const diagnostics = await getUsageStatsDiagnosticsSafeAsync();
      setUsageDiagnostics(diagnostics);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Android Insights (Dev)', headerShown: true }} />
      <SafeAreaView className="flex-1 bg-slate-950" edges={['bottom']}>
        <ScrollView className="flex-1">
          <View className="flex-1 px-5 py-6">
          <Text className="text-2xl font-semibold text-white">Android Insights (Dev)</Text>
          <Text className="mt-2 text-sm text-slate-300">{statusLabel}</Text>

          <View className="mt-6 rounded-2xl bg-slate-900 p-4">
            <Text className="text-lg font-semibold text-white">Health Connect</Text>
            <Text className="mt-3 text-sm text-slate-300">
              Available: {healthConnectAvailable === null ? '—' : healthConnectAvailable ? 'yes' : 'no'} · Authorized:{' '}
              {healthAuthorized === null ? '—' : healthAuthorized ? 'yes' : 'no'} · Today steps: {todaySteps === null ? '—' : String(Math.round(todaySteps))}
            </Text>

            <View className="mt-4 gap-3">
              <GradientButton
                label="Open Health Connect settings"
                onPress={onOpenHealthConnectSettings}
                disabled={!canUseNative}
              />
              <GradientButton label="Request steps permission (opens settings if needed)" onPress={onRequestHealth} disabled={!canUseNative} />
              <GradientButton label="Fetch today's steps" onPress={onGetTodaySteps} disabled={!canUseNative} />
            </View>

            <View className="mt-6 rounded-2xl bg-slate-950/60 p-4">
              <Text className="text-sm font-semibold text-white">Health Summary</Text>
              <Text className="mt-1 text-xs text-slate-400">Range: {healthRange}</Text>
              <View className="mt-3 gap-2">
                <GradientButton label="Range: today" onPress={() => setHealthRange('today')} />
                <GradientButton label="Range: week" onPress={() => setHealthRange('week')} />
                <GradientButton label="Range: month" onPress={() => setHealthRange('month')} />
                <GradientButton label="Range: year" onPress={() => setHealthRange('year')} />
                <GradientButton label="Fetch health summary" onPress={onFetchHealthSummary} disabled={!canUseNative} />
              </View>
              <View className="mt-4">
                <Text className="text-xs text-slate-400">Steps: {healthSummary?.steps ?? '—'}</Text>
                <Text className="mt-1 text-xs text-slate-400">Avg HR (bpm): {healthSummary?.heartRateAvgBpm ?? '—'}</Text>
                <Text className="mt-1 text-xs text-slate-400">
                  Sleep (seconds): {healthSummary?.sleepAsleepSeconds ?? '—'}
                </Text>
                <Text className="mt-1 text-xs text-slate-400">
                  Workouts: {healthSummary?.workoutsCount ?? '—'} · Workout duration (seconds): {healthSummary?.workoutsDurationSeconds ?? '—'}
                </Text>
                {healthSummary?.errors?.length ? (
                  <Text className="mt-2 text-xs text-amber-200">Errors: {healthSummary.errors.join(' · ')}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View className="mt-6 rounded-2xl bg-slate-900 p-4">
            <Text className="text-lg font-semibold text-white">Usage Stats (Screen Time-ish)</Text>
            <Text className="mt-3 text-sm text-slate-300">Usage access: {usageStatus}</Text>
            <View className="mt-4 gap-3">
              <GradientButton label="Get usage access status" onPress={onGetUsageStatus} disabled={!canUseNative} />
              <GradientButton label="Open usage access settings" onPress={onOpenUsageSettings} disabled={!canUseNative} />
            </View>

            <View className="mt-6 rounded-2xl bg-slate-950/60 p-4">
              <Text className="text-sm font-semibold text-white">Usage Summary</Text>
              <Text className="mt-1 text-xs text-slate-400">Range: {usageRange}</Text>
              <View className="mt-3 gap-2">
                <GradientButton label="Range: today" onPress={() => setUsageRange('today')} />
                <GradientButton label="Range: week" onPress={() => setUsageRange('week')} />
                <GradientButton label="Range: month" onPress={() => setUsageRange('month')} />
                <GradientButton label="Range: year" onPress={() => setUsageRange('year')} />
                <GradientButton label="Fetch usage summary" onPress={onFetchUsageSummary} disabled={!canUseNative} />
              </View>

              <View className="mt-4">
                <Text className="text-xs text-slate-400">
                  Total seconds: {usageSummary?.totalSeconds ?? '—'} · Top apps: {usageSummary?.topApps?.length ?? 0}
                </Text>
              </View>
            </View>

            <View className="mt-6 rounded-2xl bg-slate-950/60 p-4">
              <Text className="text-sm font-semibold text-white">Production Diagnostics</Text>
              <Text className="mt-1 text-xs text-slate-400">
                Comprehensive diagnostics for debugging production issues.
                Also logs to Android logcat with tag "AndroidInsights".
              </Text>
              <View className="mt-3 gap-2">
                <GradientButton label="Run diagnostics" onPress={onRunDiagnostics} disabled={!canUseNative} />
              </View>

              {usageDiagnostics ? (
                <View className="mt-4">
                  <Text className="text-xs text-slate-400">
                    Device: {usageDiagnostics.buildManufacturer} {usageDiagnostics.buildModel}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-400">
                    Android {usageDiagnostics.buildRelease} (SDK {usageDiagnostics.buildSdkInt})
                  </Text>
                  <Text className="mt-1 text-xs text-slate-400">
                    Package: {usageDiagnostics.packageName ?? '—'}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-400">
                    Usage access granted: {usageDiagnostics.usageAccessGranted ? 'YES' : 'NO'} ({usageDiagnostics.appOpsModeString ?? '—'})
                  </Text>
                  <Text className="mt-1 text-xs text-slate-400">
                    Daily stats: {usageDiagnostics.dailyStatsCount ?? '—'} · Events: {usageDiagnostics.usageEventsCount ?? '—'}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-400">
                    Apps with foreground time: {usageDiagnostics.appsWithForegroundTime ?? '—'}
                  </Text>
                  {usageDiagnostics.topAppPackage ? (
                    <Text className="mt-1 text-xs text-slate-400">
                      Top app: {usageDiagnostics.topAppPackage} ({Math.round((usageDiagnostics.topAppForegroundMs ?? 0) / 60000)}m)
                    </Text>
                  ) : null}
                  {usageDiagnostics.errors && usageDiagnostics.errors.length > 0 ? (
                    <Text className="mt-2 text-xs text-amber-200">
                      Issues: {usageDiagnostics.errors.join(' · ')}
                    </Text>
                  ) : (
                    <Text className="mt-2 text-xs text-green-300">No issues detected</Text>
                  )}
                </View>
              ) : null}
            </View>
          </View>

          {errorMessage ? (
            <View className="mt-6 rounded-2xl border border-red-500/30 bg-red-950/40 p-4">
              <Text className="text-sm font-semibold text-red-200">Error</Text>
              <Text className="mt-2 text-sm text-red-100">{errorMessage}</Text>
            </View>
          ) : null}
        </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}


