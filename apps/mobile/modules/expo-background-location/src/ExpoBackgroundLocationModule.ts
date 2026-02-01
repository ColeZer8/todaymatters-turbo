import { NativeModule, requireNativeModule } from 'expo';

export interface StartResult {
  success: boolean;
}

export interface StopResult {
  success: boolean;
}

export interface OneTimeResult {
  success: boolean;
}

export interface TrackingStatus {
  isTracking: boolean;
}

export interface DrainResult {
  samples: string;
}

export interface CountResult {
  count: number;
}

declare class ExpoBackgroundLocationModule extends NativeModule {
  startLocationTracking(userId: string, intervalMinutes: number): Promise<StartResult>;
  stopLocationTracking(): Promise<StopResult>;
  runOneTimeLocationWorker(userId: string): Promise<OneTimeResult>;
  isTracking(): Promise<TrackingStatus>;
  drainPendingSamples(userId: string, limit: number): Promise<DrainResult>;
  peekPendingSamples(userId: string, limit: number): Promise<DrainResult>;
  getPendingCount(userId: string): Promise<CountResult>;
}

// Load the native module
export default requireNativeModule<ExpoBackgroundLocationModule>('ExpoBackgroundLocation');
