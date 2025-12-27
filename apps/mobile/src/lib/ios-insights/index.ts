import { Platform } from 'react-native';
import {
  getCachedScreenTimeSummaryAsync,
  getScreenTimeAuthorizationStatusAsync,
  getStepCountSumAsync,
  isHealthDataAvailableAsync,
  requestHealthAuthorizationAsync,
  presentTodayScreenTimeReportAsync,
  requestScreenTimeAuthorizationAsync,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeSummary,
  type StepCountSumOptions,
} from 'ios-insights';

export { type ScreenTimeAuthorizationStatus, type ScreenTimeSummary, type StepCountSumOptions };

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
  if (Platform.OS !== 'ios') return 'unsupported';
  try {
    return await getScreenTimeAuthorizationStatusAsync();
  } catch {
    return 'unsupported';
  }
}

export async function requestScreenTimeAuthorizationSafeAsync(): Promise<ScreenTimeAuthorizationStatus> {
  if (Platform.OS !== 'ios') return 'unsupported';
  try {
    return await requestScreenTimeAuthorizationAsync();
  } catch {
    return 'unsupported';
  }
}

export async function getCachedScreenTimeSummarySafeAsync(): Promise<ScreenTimeSummary | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    return await getCachedScreenTimeSummaryAsync();
  } catch {
    return null;
  }
}

export async function presentTodayScreenTimeReportSafeAsync(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await presentTodayScreenTimeReportAsync();
  } catch {
    // no-op: if the native module isn't present, keep the demo screen usable
  }
}


