import { Platform } from 'react-native';
import {
  getScreenTimeAuthorizationStatusAsync,
  getStepCountSumAsync,
  isHealthDataAvailableAsync,
  requestHealthAuthorizationAsync,
  requestScreenTimeAuthorizationAsync,
  type ScreenTimeAuthorizationStatus,
  type StepCountSumOptions,
} from 'ios-insights';

export { type ScreenTimeAuthorizationStatus, type StepCountSumOptions };

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
  return await getScreenTimeAuthorizationStatusAsync();
}

export async function requestScreenTimeAuthorizationSafeAsync(): Promise<ScreenTimeAuthorizationStatus> {
  if (Platform.OS !== 'ios') return 'unsupported';
  return await requestScreenTimeAuthorizationAsync();
}


