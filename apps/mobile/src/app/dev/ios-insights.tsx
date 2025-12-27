import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GradientButton } from '@/components/atoms/GradientButton';
import {
  getScreenTimeAuthorizationStatusSafeAsync,
  getTodayStepCountAsync,
  isHealthKitAvailableAsync,
  requestHealthKitAuthorizationAsync,
  requestScreenTimeAuthorizationSafeAsync,
  type ScreenTimeAuthorizationStatus,
} from '@/lib/ios-insights';

export default function IosInsightsDevScreen() {
  const [healthKitAvailable, setHealthKitAvailable] = useState<boolean | null>(null);
  const [healthKitAuthorized, setHealthKitAuthorized] = useState<boolean | null>(null);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);

  const [screenTimeStatus, setScreenTimeStatus] = useState<ScreenTimeAuthorizationStatus>('unsupported');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const healthSummary = useMemo(() => {
    const available = healthKitAvailable === null ? '—' : healthKitAvailable ? 'yes' : 'no';
    const authorized = healthKitAuthorized === null ? '—' : healthKitAuthorized ? 'yes' : 'no';
    const steps = todaySteps === null ? '—' : String(Math.round(todaySteps));
    return { available, authorized, steps };
  }, [healthKitAvailable, healthKitAuthorized, todaySteps]);

  const onCheckHealthKit = useCallback(async () => {
    setErrorMessage(null);
    try {
      const available = await isHealthKitAvailableAsync();
      setHealthKitAvailable(available);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onRequestHealthKit = useCallback(async () => {
    setErrorMessage(null);
    try {
      const authorized = await requestHealthKitAuthorizationAsync();
      setHealthKitAuthorized(authorized);
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

  const onGetScreenTimeStatus = useCallback(async () => {
    setErrorMessage(null);
    try {
      const status = await getScreenTimeAuthorizationStatusSafeAsync();
      setScreenTimeStatus(status);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onRequestScreenTime = useCallback(async () => {
    setErrorMessage(null);
    try {
      const status = await requestScreenTimeAuthorizationSafeAsync();
      setScreenTimeStatus(status);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'iOS Insights (Dev)', headerShown: true }} />
      <ScrollView className="flex-1 bg-slate-950">
        <View className="flex-1 px-5 py-6">
          <Text className="text-2xl font-semibold text-white">iOS Insights (Dev)</Text>
          <Text className="mt-2 text-sm text-slate-300">
            This screen is for validating native permissions and data access. It is not linked from the app UI.
          </Text>

          <View className="mt-6 rounded-2xl bg-slate-900 p-4">
            <Text className="text-lg font-semibold text-white">HealthKit</Text>

            <Text className="mt-3 text-sm text-slate-300">Available: {healthSummary.available}</Text>
            <Text className="mt-1 text-sm text-slate-300">Authorized: {healthSummary.authorized}</Text>
            <Text className="mt-1 text-sm text-slate-300">Today steps (sum): {healthSummary.steps}</Text>

            <View className="mt-4 gap-3">
              <GradientButton label="Check availability" onPress={onCheckHealthKit} />
              <GradientButton label="Request authorization" onPress={onRequestHealthKit} />
              <GradientButton label="Fetch today's steps" onPress={onGetTodaySteps} />
            </View>
          </View>

          <View className="mt-6 rounded-2xl bg-slate-900 p-4">
            <Text className="text-lg font-semibold text-white">Screen Time (FamilyControls)</Text>
            <Text className="mt-3 text-sm text-slate-300">Authorization status: {screenTimeStatus}</Text>

            <View className="mt-4 gap-3">
              <GradientButton label="Get status" onPress={onGetScreenTimeStatus} />
              <GradientButton label="Request authorization" onPress={onRequestScreenTime} />
            </View>

            <Text className="mt-4 text-xs text-slate-400">
              Note: Showing per-app usage totals requires a DeviceActivity report extension; we’ll add that next after we
              confirm authorization works end-to-end.
            </Text>
          </View>

          {errorMessage ? (
            <View className="mt-6 rounded-2xl border border-red-500/30 bg-red-950/40 p-4">
              <Text className="text-sm font-semibold text-red-200">Error</Text>
              <Text className="mt-2 text-sm text-red-100">{errorMessage}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}


