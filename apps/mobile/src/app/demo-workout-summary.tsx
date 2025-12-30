import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { DemoWorkoutSummary, type DemoWorkoutSummaryData } from '@/components/organisms';
import {
  getIosInsightsSupportStatus,
  getHealthAuthorizationStatusSafeAsync,
  getHealthSummarySafeAsync,
  getLatestWorkoutSummarySafeAsync,
  getTodayActivityRingsSummarySafeAsync,
  requestHealthKitAuthorizationAsync,
  type ActivityRingsSummary,
  type HealthAuthorizationStatus,
  type HealthSummary,
  type WorkoutSummary,
} from '@/lib/ios-insights';

/**
 * Demo Workout Summary Screen
 *
 * Shows Apple-style fitness analytics and workout summary for demos.
 * Only accessible in demo mode.
 */
export default function DemoWorkoutSummaryScreen() {
  const support = useMemo(() => getIosInsightsSupportStatus(), []);
  const canUseNative = Platform.OS === 'ios' && support === 'available';

  const [authStatus, setAuthStatus] = useState<HealthAuthorizationStatus>('notDetermined');
  const [hasConnectedHealth, setHasConnectedHealth] = useState(false);
  const [rings, setRings] = useState<ActivityRingsSummary | null>(null);
  const [workout, setWorkout] = useState<WorkoutSummary | null>(null);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!canUseNative) return;
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const [nextAuth, nextRings, nextWorkout, nextSummary] = await Promise.all([
        getHealthAuthorizationStatusSafeAsync(),
        getTodayActivityRingsSummarySafeAsync(),
        getLatestWorkoutSummarySafeAsync('month'),
        getHealthSummarySafeAsync('today'),
      ]);
      setAuthStatus(nextAuth);
      setRings(nextRings);
      setWorkout(nextWorkout);
      setSummary(nextSummary);

      // Simulator (and some device configurations) can report "denied" even after a successful auth prompt,
      // while still allowing reads to return empty/null (no data) without throwing.
      // If we ever successfully connected OR we can read any health payload, treat the UI as connected.
      const hasAnyPayload = Boolean(nextRings || nextWorkout || nextSummary);
      if (hasAnyPayload) setHasConnectedHealth(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRefreshing(false);
    }
  }, [canUseNative]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConnectHealth = useCallback(async () => {
    if (!canUseNative) return;
    setErrorMessage(null);
    try {
      const ok = await requestHealthKitAuthorizationAsync();
      if (ok) setHasConnectedHealth(true);
      await refresh();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [canUseNative, refresh]);

  const isConnected = useMemo(() => {
    if (!canUseNative) return false;
    if (hasConnectedHealth) return true;
    if (authStatus === 'authorized') return true;
    // If we ever received any HealthKit payload, we’re effectively connected for UX purposes.
    if (rings || workout || summary) return true;
    return false;
  }, [authStatus, canUseNative, hasConnectedHealth, rings, summary, workout]);

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'ios') return 'iOS only.';
    if (support === 'expoGo') return 'Apple Health requires a custom iOS dev client (not Expo Go).';
    if (support === 'missingNativeModule') return 'Native module missing in this build. Rebuild the iOS dev client.';
    if (errorMessage) return `Error: ${errorMessage}`;
    if (isConnected) return 'Apple Health connected. Tap Refresh to pull the latest metrics.';
    if (authStatus === 'notDetermined') return 'Tap “Connect Health” to grant access to Apple Health data.';
    if (authStatus === 'denied')
      return 'Apple Health access is denied. Enable permissions in the Health app → your profile → Apps → TodayMatters.';
    return 'Tap “Connect Health” to grant access to Apple Health data.';
  }, [authStatus, errorMessage, isConnected, support]);

  const data: DemoWorkoutSummaryData = useMemo(() => {
    const moveCurrent = rings?.moveKcal ?? summary?.activeEnergyKcal ?? 0;
    const moveGoal = rings?.moveGoalKcal ?? 600;
    const workoutDurationMinutes =
      workout?.durationSeconds !== undefined && workout?.durationSeconds !== null ? Math.round(workout.durationSeconds / 60) : null;

    const workoutDurationFromSummaryMinutes =
      summary?.workoutsDurationSeconds !== undefined && summary?.workoutsDurationSeconds !== null
        ? Math.round(summary.workoutsDurationSeconds / 60)
        : null;

    const exerciseCurrent = rings?.exerciseMinutes ?? workoutDurationFromSummaryMinutes ?? workoutDurationMinutes ?? 0;
    const exerciseGoal = rings?.exerciseGoalMinutes ?? 45;
    const standCurrent = rings?.standHours ?? 0;
    const standGoal = rings?.standGoalHours ?? 12;

    const workoutCaloriesKcal = workout?.totalEnergyBurnedKcal ?? summary?.activeEnergyKcal ?? null;

    return {
      userName: 'Paul',
      move: { currentKcal: moveCurrent, goalKcal: moveGoal || 600 },
      exercise: { currentMinutes: exerciseCurrent, goalMinutes: exerciseGoal || 45 },
      stand: { currentHours: standCurrent, goalHours: standGoal || 12 },
      workout: {
        caloriesKcal: workoutCaloriesKcal,
        durationMinutes: workoutDurationMinutes,
        avgHeartBpm: workout?.avgHeartRateBpm ?? summary?.heartRateAvgBpm ?? null,
        peakHeartBpm: workout?.maxHeartRateBpm ?? null,
      },
      steps: { current: summary?.steps ?? null, goal: 10000 },
    };
  }, [rings, summary, workout]);

  return (
    <DemoWorkoutSummary
      data={data}
      statusLabel={statusLabel}
      isHealthConnected={isConnected}
      canConnectHealth={canUseNative && !isConnected}
      canRefresh={canUseNative}
      isRefreshing={isRefreshing}
      onConnectHealth={onConnectHealth}
      onRefresh={refresh}
    />
  );
}






