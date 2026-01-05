import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  getCachedScreenTimeSummaryAsync,
  getScreenTimeAuthorizationStatusAsync,
  getHealthSummaryAsync,
  getHealthAuthorizationStatusAsync,
  getTodayActivityRingsSummaryAsync,
  getLatestWorkoutSummaryAsync,
  getStepCountSumAsync,
  isHealthDataAvailableAsync,
  requestHealthAuthorizationAsync,
  presentScreenTimeReportAsync,
  requestScreenTimeAuthorizationAsync,
  isIosInsightsNativeModuleAvailable,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeRangeKey,
  type ScreenTimeSummary,
  type ScreenTimeAppUsage,
  type ScreenTimeAppSession,
  type HealthAuthorizationStatus,
  type ActivityRingsSummary,
  type WorkoutSummary,
  type HealthSummary,
  type StepCountSumOptions,
  getScreenTimeReportSupport,
  getScreenTimeNativeMethodAvailability,
} from 'ios-insights';

export {
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeRangeKey,
  type ScreenTimeSummary,
  type ScreenTimeAppUsage,
  type ScreenTimeAppSession,
  type StepCountSumOptions,
  type HealthSummary,
  type HealthAuthorizationStatus,
  type ActivityRingsSummary,
  type WorkoutSummary,
};

export function getScreenTimeReportSupportStatus(): { supportsRange: boolean } {
  return getScreenTimeReportSupport();
}

export function getScreenTimeNativeMethodAvailabilityStatus(): {
  hasPresentScreenTimeReport: boolean;
  hasPresentTodayScreenTimeReport: boolean;
  hasGetCachedScreenTimeSummaryJson: boolean;
} {
  return getScreenTimeNativeMethodAvailability();
}

export type IosInsightsSupportStatus = 'notIos' | 'expoGo' | 'missingNativeModule' | 'available';

export function getIosInsightsSupportStatus(): IosInsightsSupportStatus {
  if (Platform.OS !== 'ios') return 'notIos';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expoGo';
  if (!isIosInsightsNativeModuleAvailable()) return 'missingNativeModule';
  return 'available';
}

export async function isIosInsightsSupportedAsync(): Promise<boolean> {
  return Platform.OS === 'ios';
}

export async function isHealthKitAvailableAsync(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return await isHealthDataAvailableAsync();
}

export async function requestHealthKitAuthorizationAsync(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return await requestHealthAuthorizationAsync();
}

export async function getHealthAuthorizationStatusSafeAsync(): Promise<HealthAuthorizationStatus> {
  const support = getIosInsightsSupportStatus();
  if (support !== 'available') return 'denied';
  if (Platform.OS !== 'ios') return 'denied';
  return await getHealthAuthorizationStatusAsync();
}

export type HealthRangeKey = 'today' | 'week' | 'month' | 'year';

function getRangeDates(range: HealthRangeKey): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);

  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }

  if (range === 'week') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }

  if (range === 'month') {
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }

  // year
  start.setDate(now.getDate() - 364);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

export async function getHealthSummarySafeAsync(range: HealthRangeKey): Promise<HealthSummary | null> {
  const support = getIosInsightsSupportStatus();
  if (support !== 'available') return null;
  if (Platform.OS !== 'ios') return null;

  const { start, end } = getRangeDates(range);
  const options: StepCountSumOptions = {
    startDateMs: start.getTime(),
    endDateMs: end.getTime(),
  };

  return await getHealthSummaryAsync(options);
}

export async function getTodayActivityRingsSummarySafeAsync(): Promise<ActivityRingsSummary | null> {
  const support = getIosInsightsSupportStatus();
  if (support !== 'available') return null;
  if (Platform.OS !== 'ios') return null;
  return await getTodayActivityRingsSummaryAsync();
}

export async function getLatestWorkoutSummarySafeAsync(range: HealthRangeKey): Promise<WorkoutSummary | null> {
  const support = getIosInsightsSupportStatus();
  if (support !== 'available') return null;
  if (Platform.OS !== 'ios') return null;

  const { start, end } = getRangeDates(range);
  const options: StepCountSumOptions = {
    startDateMs: start.getTime(),
    endDateMs: end.getTime(),
  };
  return await getLatestWorkoutSummaryAsync(options);
}

export async function getTodayStepCountAsync(): Promise<number> {
  if (Platform.OS !== 'ios') return 0;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const options: StepCountSumOptions = {
    startDateMs: startOfDay.getTime(),
    endDateMs: now.getTime(),
  };

  return await getStepCountSumAsync(options);
}

export async function getScreenTimeAuthorizationStatusSafeAsync(): Promise<ScreenTimeAuthorizationStatus> {
  try {
    const support = getIosInsightsSupportStatus();
    if (support !== 'available') return 'unsupported';
    return await getScreenTimeAuthorizationStatusAsync();
  } catch (e) {
    // Important: do NOT collapse native errors to "unsupported" (it hides stale dev-client/method mismatch issues).
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function requestScreenTimeAuthorizationSafeAsync(): Promise<ScreenTimeAuthorizationStatus> {
  try {
    const support = getIosInsightsSupportStatus();
    if (support !== 'available') return 'unsupported';
    return await requestScreenTimeAuthorizationAsync();
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function getCachedScreenTimeSummarySafeAsync(range: ScreenTimeRangeKey): Promise<ScreenTimeSummary | null> {
  try {
    const support = getIosInsightsSupportStatus();
    if (support !== 'available') return null;
    return await getCachedScreenTimeSummaryAsync(range);
  } catch {
    return null;
  }
}

export async function presentScreenTimeReportSafeAsync(range: ScreenTimeRangeKey): Promise<void> {
  try {
    const support = getIosInsightsSupportStatus();
    if (support !== 'available') return;
    await presentScreenTimeReportAsync(range);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}


