import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from './task-names';
import {
  clearPendingAndroidLocationSamplesAsync,
  peekPendingAndroidLocationSamplesAsync,
  removePendingAndroidLocationSamplesByKeyAsync,
} from './queue';
import type { AndroidLocationSupportStatus, AndroidLocationSample } from './types';
import { sanitizeLocationSamplesForUpload, upsertLocationSamples } from '@/lib/supabase/services/location-samples';
import { supabase } from '@/lib/supabase/client';
import { ErrorCategory, logError } from './error-logger';
import { getAndroidApiLevel } from './android-version';

export type { AndroidLocationSupportStatus, AndroidLocationSample } from './types';
export { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from './task-names';
export { clearPendingAndroidLocationSamplesAsync, peekPendingAndroidLocationSamplesAsync } from './queue';
export { isAndroid14Plus, getAndroidApiLevel } from './android-version';
export { ErrorCategory, logError, getRecentErrors, clearErrors } from './error-logger';
export type { ErrorLogEntry } from './error-logger';
export { recordTaskHeartbeat, getLastTaskHeartbeat } from './task-heartbeat';
export type { TaskHeartbeat } from './task-heartbeat';
export { calculateDistance } from './distance';
export type { Coordinate } from './distance';
export { getMovementState, setMovementState } from './movement-state';
export type { MovementState, MovementReason, MovementStateData } from './movement-state';
export { classifyMovementByDistance } from './movement-detector';
export type { LocationSampleInput, MovementClassification } from './movement-detector';
export { recordLastSyncTime, getLastSyncTime } from './sync-timing';

export function getAndroidLocationSupportStatus(): AndroidLocationSupportStatus {
  if (Platform.OS !== 'android') return 'notAndroid';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expoGo';
  return 'available';
}

async function loadExpoLocationAsync(): Promise<typeof import('expo-location') | null> {
  if (!requireOptionalNativeModule('ExpoLocation')) return null;
  try {
    return await import('expo-location');
  } catch {
    return null;
  }
}

async function getBackgroundPermissionsSafeAsync(
  Location: typeof import('expo-location')
): Promise<import('expo-location').PermissionResponse> {
  try {
    return await Location.getBackgroundPermissionsAsync();
  } catch (error) {
    if (__DEV__) {
      console.warn('📍 Android background permission check failed:', error);
    }
    logError(ErrorCategory.PERMISSION_DENIED, 'Background permission check threw an exception', {
      error: error instanceof Error ? error.message : String(error),
      androidApiLevel: getAndroidApiLevel(),
    });
    return {
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    };
  }
}

export async function requestAndroidLocationPermissionsAsync(): Promise<{
  foreground: 'granted' | 'denied' | 'undetermined';
  background: 'granted' | 'denied' | 'undetermined';
  canAskAgainForeground: boolean;
  canAskAgainBackground: boolean;
  hasNativeModule: boolean;
}> {
  if (Platform.OS !== 'android') {
    return {
      foreground: 'denied',
      background: 'denied',
      canAskAgainForeground: false,
      canAskAgainBackground: false,
      hasNativeModule: false,
    };
  }
  const Location = await loadExpoLocationAsync();
  if (!Location) {
    return {
      foreground: 'denied',
      background: 'denied',
      canAskAgainForeground: false,
      canAskAgainBackground: false,
      hasNativeModule: false,
    };
  }

  const fgBefore = await Location.getForegroundPermissionsAsync();
  const bgBefore = await getBackgroundPermissionsSafeAsync(Location);

  let foreground = fgBefore;
  if (foreground.status !== 'granted') {
    foreground = await Location.requestForegroundPermissionsAsync();
  }

  let background = bgBefore;
  if (foreground.status === 'granted' && background.status !== 'granted') {
    try {
      background = await Location.requestBackgroundPermissionsAsync();
    } catch (error) {
      if (__DEV__) {
        console.warn('📍 Android background permission request failed:', error);
      }
      logError(ErrorCategory.PERMISSION_DENIED, 'Background permission request threw an exception', {
        error: error instanceof Error ? error.message : String(error),
        androidApiLevel: getAndroidApiLevel(),
        foregroundStatus: foreground.status,
      });
      background = {
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      };
    }
  }

  return {
    foreground: foreground.status,
    background: background.status,
    canAskAgainForeground: typeof foreground.canAskAgain === 'boolean' ? foreground.canAskAgain : true,
    canAskAgainBackground: typeof background.canAskAgain === 'boolean' ? background.canAskAgain : true,
    hasNativeModule: true,
  };
}

export async function startAndroidBackgroundLocationAsync(): Promise<void> {
  const support = getAndroidLocationSupportStatus();
  if (support !== 'available') return;

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    logError(ErrorCategory.TASK_START_FAILED, 'Expo Location native module not available', {
      androidApiLevel: getAndroidApiLevel(),
    });
    return;
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    logError(ErrorCategory.LOCATION_UNAVAILABLE, 'Location services disabled on device', {
      androidApiLevel: getAndroidApiLevel(),
    });
    return;
  }

  // IMPORTANT: Do not auto-request permissions here; onboarding should drive prompts.
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await getBackgroundPermissionsSafeAsync(Location);
  if (fg.status !== 'granted') {
    logError(ErrorCategory.PERMISSION_DENIED, 'Foreground location permission not granted at task start', {
      androidApiLevel: getAndroidApiLevel(),
      foregroundStatus: fg.status,
      canAskAgain: fg.canAskAgain,
    });
    return;
  }
  if (bg.status !== 'granted') {
    logError(ErrorCategory.PERMISSION_DENIED, 'Background location permission not granted at task start', {
      androidApiLevel: getAndroidApiLevel(),
      backgroundStatus: bg.status,
      canAskAgain: bg.canAskAgain,
    });
    return;
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
  if (alreadyStarted) return;

  try {
    await Location.startLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 40,
      // Android-specific: request updates every 15 minutes.
      timeInterval: 15 * 60 * 1000,
      // Batch deferred updates to match the 15-minute cadence.
      deferredUpdatesInterval: 15 * 60 * 1000,
      // iOS: show indicator in status bar when using background location.
      showsBackgroundLocationIndicator: true,
      // Foreground service is required for background reliability.
      foregroundService: {
        notificationTitle: 'TodayMatters is tracking your day',
        notificationBody: 'Used to build an hour-by-hour view of your day for schedule comparison.',
        notificationColor: '#2563EB',
      },
    });
  } catch (e) {
    logError(ErrorCategory.TASK_START_FAILED, 'startLocationUpdatesAsync threw an exception', {
      error: e instanceof Error ? e.message : String(e),
      androidApiLevel: getAndroidApiLevel(),
    });
    throw e;
  }
}

export async function stopAndroidBackgroundLocationAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Location = await loadExpoLocationAsync();
  if (!Location) return;

  const started = await Location.hasStartedLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
}

export async function flushPendingAndroidLocationSamplesToSupabaseAsync(userId: string): Promise<{
  uploaded: number;
  remaining: number;
}> {
  if (Platform.OS !== 'android') return { uploaded: 0, remaining: 0 };

  const BATCH_SIZE = 250;
  let uploaded = 0;

  try {
    while (true) {
      const batch = await peekPendingAndroidLocationSamplesAsync(userId, BATCH_SIZE);
      if (batch.length === 0) break;

      const { validSamples, droppedKeys } = sanitizeLocationSamplesForUpload(batch);
      if (droppedKeys.length > 0) {
        if (__DEV__) {
          console.warn(`📍 Dropped ${droppedKeys.length} Android location samples with invalid fields.`);
        }
        await removePendingAndroidLocationSamplesByKeyAsync(userId, droppedKeys);
      }

      if (validSamples.length === 0) {
        continue;
      }

      await upsertLocationSamples(userId, validSamples);
      await removePendingAndroidLocationSamplesByKeyAsync(
        userId,
        validSamples.map((s) => s.dedupe_key)
      );

      uploaded += validSamples.length;
    }
  } catch (e) {
    logError(ErrorCategory.SYNC_FAILED, 'Failed to flush pending location samples to Supabase', {
      error: e instanceof Error ? e.message : String(e),
      androidApiLevel: getAndroidApiLevel(),
      uploadedBeforeFailure: uploaded,
    });
    throw e;
  }

  const remaining = (await peekPendingAndroidLocationSamplesAsync(userId, Number.MAX_SAFE_INTEGER)).length;
  return { uploaded, remaining };
}

/**
 * Diagnostic function to check why Android background location might not be working.
 * Returns detailed status of all prerequisites and identifies blocking issues.
 */
export async function getAndroidLocationDiagnostics(): Promise<{
  support: AndroidLocationSupportStatus;
  locationModule: boolean;
  servicesEnabled: boolean;
  foregroundPermission: string;
  backgroundPermission: string;
  taskStarted: boolean;
  pendingSamples: number;
  errors: string[];
  canStart: boolean;
}> {
  const errors: string[] = [];
  const diagnostics = {
    support: getAndroidLocationSupportStatus(),
    locationModule: false,
    servicesEnabled: false,
    foregroundPermission: 'unknown',
    backgroundPermission: 'unknown',
    taskStarted: false,
    pendingSamples: 0,
    errors,
    canStart: false,
  };

  if (diagnostics.support !== 'available') {
    errors.push(`Support status: ${diagnostics.support} (expected: 'available')`);
    return diagnostics;
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    errors.push('Location module not loaded - native module missing or not available');
    return diagnostics;
  }
  diagnostics.locationModule = true;

  diagnostics.servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!diagnostics.servicesEnabled) {
    errors.push('Location services disabled on device - enable in Settings > Location');
  }

  const fg = await Location.getForegroundPermissionsAsync();
  diagnostics.foregroundPermission = fg.status;
  if (fg.status !== 'granted') {
    errors.push(`Foreground permission: ${fg.status} (required: 'granted')`);
  }

  const bg = await getBackgroundPermissionsSafeAsync(Location);
  diagnostics.backgroundPermission = bg.status;
  if (bg.status !== 'granted') {
    errors.push(`Background permission: ${bg.status} (required: 'granted') - may need to enable in Settings`);
  }

  diagnostics.taskStarted = await Location.hasStartedLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
  if (!diagnostics.taskStarted && errors.length === 0) {
    errors.push('Task not started despite all checks passing - unknown reason');
  }

  // Check pending samples
  try {
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    if (userId) {
      const pending = await peekPendingAndroidLocationSamplesAsync(userId, 1000);
      diagnostics.pendingSamples = pending.length;
      if (pending.length > 0 && !diagnostics.taskStarted) {
        errors.push(`Found ${pending.length} pending samples but task not started - samples may be stale`);
      }
    }
  } catch (error) {
    errors.push(`Failed to check pending samples: ${error instanceof Error ? error.message : String(error)}`);
  }

  diagnostics.canStart = errors.length === 0 && !diagnostics.taskStarted;

  return diagnostics;
}

