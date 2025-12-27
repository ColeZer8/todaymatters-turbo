import { requireOptionalNativeModule } from 'expo-modules-core';

export type ScreenTimeAuthorizationStatus =
  | 'notDetermined'
  | 'denied'
  | 'approved'
  | 'unknown'
  | 'unsupported';

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

interface IosInsightsNativeModule {
  // HealthKit
  isHealthDataAvailable(): Promise<boolean>;
  requestHealthAuthorization(): Promise<boolean>;
  getStepCountSum(options: StepCountSumOptions): Promise<number>;

  // Screen Time (FamilyControls)
  getScreenTimeAuthorizationStatus(): Promise<ScreenTimeAuthorizationStatus>;
  requestScreenTimeAuthorization(): Promise<ScreenTimeAuthorizationStatus>;
}

const NativeModule = requireOptionalNativeModule<IosInsightsNativeModule>('IosInsights');

function requireIosInsights(): IosInsightsNativeModule {
  if (!NativeModule) {
    throw new Error('IosInsights native module not available (are you running on iOS dev build?)');
  }
  return NativeModule;
}

export async function isHealthDataAvailableAsync(): Promise<boolean> {
  return await requireIosInsights().isHealthDataAvailable();
}

export async function requestHealthAuthorizationAsync(): Promise<boolean> {
  return await requireIosInsights().requestHealthAuthorization();
}

export async function getStepCountSumAsync(options: StepCountSumOptions): Promise<number> {
  return await requireIosInsights().getStepCountSum(options);
}

export async function getScreenTimeAuthorizationStatusAsync(): Promise<ScreenTimeAuthorizationStatus> {
  // If we're not on iOS or no native module exists, normalize to "unsupported".
  if (!NativeModule) return 'unsupported';
  return await NativeModule.getScreenTimeAuthorizationStatus();
}

export async function requestScreenTimeAuthorizationAsync(): Promise<ScreenTimeAuthorizationStatus> {
  return await requireIosInsights().requestScreenTimeAuthorization();
}


