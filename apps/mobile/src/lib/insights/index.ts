import { Platform } from 'react-native';

// iOS
import * as IosInsights from '@/lib/ios-insights';

// Android
import * as AndroidInsights from '@/lib/android-insights';

export type HealthRangeKey = IosInsights.HealthRangeKey;

export type HealthSummary = IosInsights.HealthSummary;

export async function getHealthSummarySafeAsync(range: HealthRangeKey): Promise<HealthSummary | null> {
  if (Platform.OS === 'ios') return await IosInsights.getHealthSummarySafeAsync(range);
  if (Platform.OS === 'android') return await AndroidInsights.getHealthSummarySafeAsync(range);
  return null;
}

export async function requestHealthAuthorizationSafeAsync(): Promise<boolean> {
  if (Platform.OS === 'ios') return await IosInsights.requestHealthKitAuthorizationAsync();
  if (Platform.OS === 'android') return await AndroidInsights.requestHealthConnectAuthorizationSafeAsync();
  return false;
}

// Screen time / usage (normalized)
export type UsageRangeKey = AndroidInsights.UsageRangeKey;
export type UsageSummary = AndroidInsights.UsageSummary;
export type UsageAccessAuthorizationStatus = AndroidInsights.UsageAccessAuthorizationStatus;

export async function getUsageAuthorizationStatusSafeAsync(): Promise<UsageAccessAuthorizationStatus> {
  if (Platform.OS === 'android') return await AndroidInsights.getUsageAccessAuthorizationStatusSafeAsync();
  // On iOS, the equivalent is Screen Time authorization.
  if (Platform.OS === 'ios') {
    const status = await IosInsights.getScreenTimeAuthorizationStatusSafeAsync();
    if (status === 'approved') return 'authorized';
    if (status === 'notDetermined') return 'notDetermined';
    if (status === 'denied') return 'denied';
    if (status === 'unsupported') return 'unsupported';
    return 'unknown';
  }
  return 'unsupported';
}

export async function openUsageSettingsSafeAsync(): Promise<void> {
  if (Platform.OS === 'android') {
    await AndroidInsights.openUsageAccessSettingsSafeAsync();
    return;
  }
  if (Platform.OS === 'ios') {
    // iOS: we request authorization via the Screen Time prompt.
    await IosInsights.requestScreenTimeAuthorizationSafeAsync();
  }
}

export async function getUsageSummarySafeAsync(range: UsageRangeKey): Promise<UsageSummary | null> {
  if (Platform.OS === 'android') return await AndroidInsights.getUsageSummarySafeAsync(range);
  // iOS returns a different type (ScreenTimeSummary). We can add an adapter later when we actually need unified UI.
  return null;
}


