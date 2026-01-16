import { requireOptionalNativeModule } from 'expo-modules-core';

export type UsageAccessAuthorizationStatus = 'notDetermined' | 'denied' | 'authorized' | 'unknown' | 'unsupported';

export type UsageRangeKey = 'today' | 'week' | 'month' | 'year';

export interface StepCountSumOptions {
  /**
   * Milliseconds since epoch (Date.now()).
   */
  startDateMs: number;
  /**
   * Milliseconds since epoch (Date.now()).
   */
  endDateMs: number;
}

export interface UsageAppUsage {
  packageName: string;
  displayName: string;
  durationSeconds: number;
}

export interface UsageSummary {
  generatedAtIso: string;
  startIso: string;
  endIso: string;
  totalSeconds: number;
  topApps: UsageAppUsage[];
  hourlyBucketsSeconds?: number[];
  hourlyByApp?: Record<string, Record<number, number>>;
}

export interface HealthSummary {
  generatedAtIso: string;
  startIso: string;
  endIso: string;

  steps: number | null;
  activeEnergyKcal: number | null;
  distanceWalkingRunningMeters: number | null;

  heartRateAvgBpm: number | null;
  restingHeartRateAvgBpm: number | null;
  hrvSdnnAvgSeconds: number | null;

  sleepAsleepSeconds: number | null;

  workoutsCount: number | null;
  workoutsDurationSeconds: number | null;

  errors?: string[] | null;
}

export interface WorkoutSummary {
  workoutStartIso: string;
  workoutEndIso: string;
  durationSeconds: number;
  totalEnergyBurnedKcal: number | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  errors?: string[] | null;
}

export type HealthAuthorizationStatus = 'notDetermined' | 'denied' | 'authorized';

interface AndroidInsightsNativeModule {
  // Health Connect (scaffolded; implemented in follow-up)
  isHealthConnectAvailable(): Promise<boolean>;
  openHealthConnectSettings(): Promise<void>;
  requestHealthAuthorization(): Promise<boolean>;
  getHealthAuthorizationStatus(): Promise<HealthAuthorizationStatus>;
  getHealthSummaryJson(options: StepCountSumOptions): Promise<string | null>;
  getStepCountSum(options: StepCountSumOptions): Promise<number>;
  getLatestWorkoutSummaryJson(options: StepCountSumOptions): Promise<string | null>;

  // Usage stats ("Screen Time"-ish)
  getUsageAccessAuthorizationStatus(): Promise<UsageAccessAuthorizationStatus>;
  openUsageAccessSettings(): Promise<void>;
  getUsageSummaryJson(range: UsageRangeKey): Promise<string | null>;
}

const NativeModule = requireOptionalNativeModule<AndroidInsightsNativeModule>('AndroidInsights');

export function isAndroidInsightsNativeModuleAvailable(): boolean {
  return Boolean(NativeModule);
}

function requireAndroidInsights(): AndroidInsightsNativeModule {
  if (!NativeModule) {
    throw new Error('AndroidInsights native module not available (are you running on Android dev build?)');
  }
  return NativeModule;
}

function requireAndroidInsightsMethod<K extends keyof AndroidInsightsNativeModule>(key: K): AndroidInsightsNativeModule[K] {
  const mod = requireAndroidInsights() as unknown as Record<string, unknown>;
  const value = mod[String(key)];
  if (typeof value !== 'function') {
    throw new Error(
      `AndroidInsights native module missing method "${String(key)}". This usually means your Android dev client is out of date—rebuild it (pnpm --filter mobile android) and reopen the app.`,
    );
  }
  return value as AndroidInsightsNativeModule[K];
}

export async function isHealthConnectAvailableAsync(): Promise<boolean> {
  if (!NativeModule) return false;
  return await requireAndroidInsightsMethod('isHealthConnectAvailable')();
}

export async function openHealthConnectSettingsAsync(): Promise<void> {
  if (!NativeModule) return;
  await requireAndroidInsightsMethod('openHealthConnectSettings')();
}

export async function requestHealthAuthorizationAsync(): Promise<boolean> {
  if (!NativeModule) return false;
  return await requireAndroidInsightsMethod('requestHealthAuthorization')();
}

export async function getHealthAuthorizationStatusAsync(): Promise<HealthAuthorizationStatus> {
  if (!NativeModule) return 'denied';
  return await requireAndroidInsightsMethod('getHealthAuthorizationStatus')();
}

export async function getStepCountSumAsync(options: StepCountSumOptions): Promise<number> {
  if (!NativeModule) return 0;
  return await requireAndroidInsightsMethod('getStepCountSum')(options);
}

export async function getHealthSummaryAsync(options: StepCountSumOptions): Promise<HealthSummary | null> {
  if (!NativeModule) return null;
  const json = await requireAndroidInsightsMethod('getHealthSummaryJson')(options);
  if (!json) return null;
  return JSON.parse(json) as HealthSummary;
}

export async function getLatestWorkoutSummaryAsync(options: StepCountSumOptions): Promise<WorkoutSummary | null> {
  if (!NativeModule) return null;
  const json = await requireAndroidInsightsMethod('getLatestWorkoutSummaryJson')(options);
  if (!json) return null;
  return JSON.parse(json) as WorkoutSummary;
}

export async function getUsageAccessAuthorizationStatusAsync(): Promise<UsageAccessAuthorizationStatus> {
  if (!NativeModule) return 'unsupported';
  return await requireAndroidInsightsMethod('getUsageAccessAuthorizationStatus')();
}

export async function openUsageAccessSettingsAsync(): Promise<void> {
  if (!NativeModule) return;
  await requireAndroidInsightsMethod('openUsageAccessSettings')();
}

export async function getUsageSummaryAsync(range: UsageRangeKey): Promise<UsageSummary | null> {
  if (!NativeModule) return null;
  const json = await requireAndroidInsightsMethod('getUsageSummaryJson')(range);
  if (!json) return null;
  return JSON.parse(json) as UsageSummary;
}


