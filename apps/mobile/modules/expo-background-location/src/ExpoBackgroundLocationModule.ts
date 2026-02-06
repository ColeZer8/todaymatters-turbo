import { NativeModule, requireNativeModule } from 'expo';

export interface SuccessResult {
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

export interface ConfiguredResult {
  configured: boolean;
}

export interface BatteryOptimizationResult {
  isDisabled: boolean;
}

declare class ExpoBackgroundLocationModule extends NativeModule {
  // Supabase configuration
  configureSupabase(
    supabaseUrl: string,
    anonKey: string,
    jwtToken: string,
    userId: string
  ): Promise<SuccessResult>;
  updateJwtToken(jwtToken: string): Promise<SuccessResult>;
  isSupabaseConfigured(): Promise<ConfiguredResult>;

  // Location tracking
  startLocationTracking(userId: string, intervalMinutes: number): Promise<SuccessResult>;
  stopLocationTracking(): Promise<SuccessResult>;
  runOneTimeLocationWorker(userId: string): Promise<SuccessResult>;
  isTracking(): Promise<TrackingStatus>;

  // Pending samples
  drainPendingSamples(userId: string, limit: number): Promise<DrainResult>;
  peekPendingSamples(userId: string, limit: number): Promise<DrainResult>;
  getPendingCount(userId: string): Promise<CountResult>;

  // Battery optimization (Android only)
  isBatteryOptimizationDisabled(): Promise<BatteryOptimizationResult>;
  requestBatteryOptimizationExemption(): Promise<SuccessResult>;
}

// Load the native module
export default requireNativeModule<ExpoBackgroundLocationModule>('ExpoBackgroundLocation');
