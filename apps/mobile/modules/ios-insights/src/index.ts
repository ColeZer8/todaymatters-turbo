import { requireOptionalNativeModule } from "expo-modules-core";

export type ScreenTimeAuthorizationStatus =
  | "notDetermined"
  | "denied"
  | "approved"
  | "unknown"
  | "unsupported";

export type ScreenTimeRangeKey = "today" | "week" | "month" | "year";

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

export interface ScreenTimeAppUsage {
  bundleIdentifier: string;
  displayName: string;
  durationSeconds: number;
  pickups: number;
}

export interface ScreenTimeAppSession {
  bundleIdentifier: string;
  displayName: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  pickups: number;
}

export interface ScreenTimeSummary {
  generatedAtIso: string;
  dayStartIso: string;
  dayEndIso: string;
  totalSeconds: number;
  topApps: ScreenTimeAppUsage[];
  hourlyBucketsSeconds?: number[] | null;
  // Per-app hourly breakdown: { [appId: string]: { [hour: number]: seconds } }
  hourlyByApp?: Record<string, Record<number, number>> | null;
  // Per-app time intervals (sessions)
  appSessions?: ScreenTimeAppSession[] | null;
}

interface IosInsightsNativeModule {
  // HealthKit
  isHealthDataAvailable(): Promise<boolean>;
  requestHealthAuthorization(): Promise<boolean>;
  getHealthAuthorizationStatus(): Promise<
    "notDetermined" | "denied" | "authorized"
  >;
  getStepCountSum(options: StepCountSumOptions): Promise<number>;
  getHealthSummaryJson(options: StepCountSumOptions): Promise<string | null>;
  getTodayActivityRingsSummaryJson(): Promise<string | null>;
  getLatestWorkoutSummaryJson(
    options: StepCountSumOptions,
  ): Promise<string | null>;

  // Screen Time (FamilyControls)
  getScreenTimeAuthorizationStatus(): Promise<ScreenTimeAuthorizationStatus>;
  requestScreenTimeAuthorization(): Promise<ScreenTimeAuthorizationStatus>;

  // Screen Time report (DeviceActivityReport)
  getCachedScreenTimeSummaryJson(
    range: ScreenTimeRangeKey,
  ): Promise<string | null>;
  presentScreenTimeReport(range: ScreenTimeRangeKey): Promise<void>;
}

const NativeModule =
  requireOptionalNativeModule<IosInsightsNativeModule>("IosInsights");

export function isIosInsightsNativeModuleAvailable(): boolean {
  return Boolean(NativeModule);
}

function requireIosInsights(): IosInsightsNativeModule {
  if (!NativeModule) {
    throw new Error(
      "IosInsights native module not available (are you running on iOS dev build?)",
    );
  }
  return NativeModule;
}

function requireIosInsightsMethod<K extends keyof IosInsightsNativeModule>(
  key: K,
): IosInsightsNativeModule[K] {
  const mod = requireIosInsights() as unknown as Record<string, unknown>;
  const value = mod[String(key)];
  if (typeof value !== "function") {
    throw new Error(
      `IosInsights native module missing method "${String(key)}". This usually means your iOS dev client is out of date—rebuild it (pnpm --filter mobile ios) and reopen the app.`,
    );
  }
  return value as IosInsightsNativeModule[K];
}

function getOptionalIosInsightsMethod(
  key: string,
): ((...args: unknown[]) => Promise<unknown>) | null {
  if (!NativeModule) return null;
  const mod = NativeModule as unknown as Record<string, unknown>;
  const value = mod[key];
  return typeof value === "function"
    ? (...args: unknown[]) =>
        (value as (...a: unknown[]) => Promise<unknown>)(...args)
    : null;
}

export function getScreenTimeReportSupport(): { supportsRange: boolean } {
  if (!NativeModule) return { supportsRange: false };
  const mod = NativeModule as unknown as Record<string, unknown>;
  return { supportsRange: typeof mod.presentScreenTimeReport === "function" };
}

export function getScreenTimeNativeMethodAvailability(): {
  hasPresentScreenTimeReport: boolean;
  hasPresentTodayScreenTimeReport: boolean;
  hasGetCachedScreenTimeSummaryJson: boolean;
} {
  if (!NativeModule) {
    return {
      hasPresentScreenTimeReport: false,
      hasPresentTodayScreenTimeReport: false,
      hasGetCachedScreenTimeSummaryJson: false,
    };
  }
  const mod = NativeModule as unknown as Record<string, unknown>;
  return {
    hasPresentScreenTimeReport:
      typeof mod.presentScreenTimeReport === "function",
    hasPresentTodayScreenTimeReport:
      typeof mod.presentTodayScreenTimeReport === "function",
    hasGetCachedScreenTimeSummaryJson:
      typeof mod.getCachedScreenTimeSummaryJson === "function",
  };
}

export async function isHealthDataAvailableAsync(): Promise<boolean> {
  return await requireIosInsightsMethod("isHealthDataAvailable")();
}

export async function requestHealthAuthorizationAsync(): Promise<boolean> {
  return await requireIosInsightsMethod("requestHealthAuthorization")();
}

export async function getStepCountSumAsync(
  options: StepCountSumOptions,
): Promise<number> {
  return await requireIosInsightsMethod("getStepCountSum")(options);
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

export async function getHealthSummaryAsync(
  options: StepCountSumOptions,
): Promise<HealthSummary | null> {
  if (!NativeModule) return null;
  const json = await requireIosInsightsMethod("getHealthSummaryJson")(options);
  if (!json) return null;
  return JSON.parse(json) as HealthSummary;
}

export type HealthAuthorizationStatus =
  | "notDetermined"
  | "denied"
  | "authorized";

export async function getHealthAuthorizationStatusAsync(): Promise<HealthAuthorizationStatus> {
  if (!NativeModule) return "denied";
  return await requireIosInsightsMethod("getHealthAuthorizationStatus")();
}

export interface ActivityRingsSummary {
  generatedAtIso: string;
  dateIso: string;
  moveKcal: number;
  moveGoalKcal: number;
  exerciseMinutes: number;
  exerciseGoalMinutes: number;
  standHours: number;
  standGoalHours: number;
}

export async function getTodayActivityRingsSummaryAsync(): Promise<ActivityRingsSummary | null> {
  if (!NativeModule) return null;
  const json = await requireIosInsightsMethod(
    "getTodayActivityRingsSummaryJson",
  )();
  if (!json) return null;
  return JSON.parse(json) as ActivityRingsSummary;
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

export async function getLatestWorkoutSummaryAsync(
  options: StepCountSumOptions,
): Promise<WorkoutSummary | null> {
  if (!NativeModule) return null;
  const json = await requireIosInsightsMethod("getLatestWorkoutSummaryJson")(
    options,
  );
  if (!json) return null;
  return JSON.parse(json) as WorkoutSummary;
}

export async function getScreenTimeAuthorizationStatusAsync(): Promise<ScreenTimeAuthorizationStatus> {
  // If we're not on iOS or no native module exists, normalize to "unsupported".
  if (!NativeModule) return "unsupported";
  return await requireIosInsightsMethod("getScreenTimeAuthorizationStatus")();
}

export async function requestScreenTimeAuthorizationAsync(): Promise<ScreenTimeAuthorizationStatus> {
  return await requireIosInsightsMethod("requestScreenTimeAuthorization")();
}

export async function getCachedScreenTimeSummaryAsync(
  range: ScreenTimeRangeKey,
): Promise<ScreenTimeSummary | null> {
  if (!NativeModule) return null;
  const fn = requireIosInsightsMethod(
    "getCachedScreenTimeSummaryJson",
  ) as unknown as (...args: unknown[]) => Promise<string | null>;
  let json: string | null = null;
  try {
    json = await fn(range);
  } catch {
    // Back-compat: older dev clients had a no-arg method.
    json = await fn();
  }
  if (!json) return null;
  return JSON.parse(json) as ScreenTimeSummary;
}

export async function presentScreenTimeReportAsync(
  range: ScreenTimeRangeKey,
): Promise<void> {
  const fnNew = getOptionalIosInsightsMethod("presentScreenTimeReport");
  if (fnNew) {
    await fnNew(range);
    return;
  }

  // Back-compat alias: newer native builds expose this as an invisible report host as well.
  const fnLegacyToday = getOptionalIosInsightsMethod(
    "presentTodayScreenTimeReport",
  );
  if (fnLegacyToday) {
    await fnLegacyToday();
    return;
  }

  throw new Error(
    "Screen Time sync requires an updated iOS build. Rebuild the dev client (pnpm --filter mobile ios) and reopen the app.",
  );
}
