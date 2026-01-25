import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  getUsageAccessAuthorizationStatusAsync,
  getUsageSummaryAsync,
  getUsageStatsDiagnosticsAsync,
  isAndroidInsightsNativeModuleAvailable,
  openUsageAccessSettingsAsync,
  type UsageAccessAuthorizationStatus,
  type UsageRangeKey,
  type UsageSummary,
  type UsageStatsDiagnostics,
  // Health Connect (stubbed for now)
  getHealthAuthorizationStatusAsync,
  getHealthSummaryAsync,
  getLatestWorkoutSummaryAsync,
  getStepCountSumAsync,
  isHealthConnectAvailableAsync,
  openHealthConnectSettingsAsync,
  requestHealthAuthorizationAsync,
  type HealthSummary,
  type HealthAuthorizationStatus,
  type WorkoutSummary,
  type StepCountSumOptions,
} from 'android-insights';

export {
  type UsageAccessAuthorizationStatus,
  type UsageRangeKey,
  type UsageSummary,
  type UsageStatsDiagnostics,
  type HealthSummary,
  type HealthAuthorizationStatus,
  type WorkoutSummary,
  type StepCountSumOptions,
};

export type AndroidInsightsSupportStatus = 'notAndroid' | 'expoGo' | 'missingNativeModule' | 'available';

export function getAndroidInsightsSupportStatus(): AndroidInsightsSupportStatus {
  if (Platform.OS !== 'android') return 'notAndroid';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expoGo';
  if (!isAndroidInsightsNativeModuleAvailable()) return 'missingNativeModule';
  return 'available';
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

// MARK: Health Connect (currently stubbed in native module)

export async function isHealthConnectAvailableSafeAsync(): Promise<boolean> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return false;
  return await isHealthConnectAvailableAsync();
}

export async function openHealthConnectSettingsSafeAsync(): Promise<void> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return;
  await openHealthConnectSettingsAsync();
}

export async function requestHealthConnectAuthorizationSafeAsync(): Promise<boolean> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return false;
  return await requestHealthAuthorizationAsync();
}

export async function getHealthAuthorizationStatusSafeAsync(): Promise<HealthAuthorizationStatus> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return 'denied';
  return await getHealthAuthorizationStatusAsync();
}

export async function getHealthSummarySafeAsync(range: HealthRangeKey): Promise<HealthSummary | null> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return null;

  const { start, end } = getRangeDates(range);
  const options: StepCountSumOptions = {
    startDateMs: start.getTime(),
    endDateMs: end.getTime(),
  };

  return await getHealthSummaryAsync(options);
}

export async function getLatestWorkoutSummarySafeAsync(range: HealthRangeKey): Promise<WorkoutSummary | null> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return null;

  const { start, end } = getRangeDates(range);
  const options: StepCountSumOptions = {
    startDateMs: start.getTime(),
    endDateMs: end.getTime(),
  };

  return await getLatestWorkoutSummaryAsync(options);
}

export async function getTodayStepCountAsync(): Promise<number> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return 0;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const options: StepCountSumOptions = {
    startDateMs: startOfDay.getTime(),
    endDateMs: now.getTime(),
  };

  return await getStepCountSumAsync(options);
}

// MARK: Usage stats ("Screen Time"-ish)

export async function getUsageAccessAuthorizationStatusSafeAsync(): Promise<UsageAccessAuthorizationStatus> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return 'unsupported';
  return await getUsageAccessAuthorizationStatusAsync();
}

export async function openUsageAccessSettingsSafeAsync(): Promise<void> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return;
  await openUsageAccessSettingsAsync();
}

export async function getUsageSummarySafeAsync(range: UsageRangeKey): Promise<UsageSummary | null> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return null;
  return await getUsageSummaryAsync(range);
}

/**
 * Get comprehensive diagnostics for debugging usage stats issues in production.
 * Logs detailed information to Android logcat and returns a structured response.
 */
export async function getUsageStatsDiagnosticsSafeAsync(): Promise<UsageStatsDiagnostics | null> {
  const support = getAndroidInsightsSupportStatus();
  if (support !== 'available') return null;
  return await getUsageStatsDiagnosticsAsync();
}


