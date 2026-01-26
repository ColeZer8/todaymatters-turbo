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

/** Mirror of MAX_PENDING_SAMPLES_PER_USER in queue.ts — used for diagnostics peek. */
const MAX_PENDING_SAMPLES_PER_USER = 10_000;
import { sanitizeLocationSamplesForUpload, upsertLocationSamples } from '@/lib/supabase/services/location-samples';
import { supabase } from '@/lib/supabase/client';

export type { AndroidLocationSupportStatus, AndroidLocationSample } from './types';
export { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from './task-names';
export { clearPendingAndroidLocationSamplesAsync } from './queue';

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
  if (!Location) return;

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return;

  // IMPORTANT: Do not auto-request permissions here; onboarding should drive prompts.
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await getBackgroundPermissionsSafeAsync(Location);
  if (fg.status !== 'granted') return;
  if (bg.status !== 'granted') return;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 40,
    // Android-specific: control update cadence.
    timeInterval: 2 * 60 * 1000,
    // Foreground service is required for background reliability.
    foregroundService: {
      notificationTitle: 'TodayMatters is tracking your day',
      notificationBody: 'Used to build an hour-by-hour view of your day for schedule comparison.',
      notificationColor: '#2563EB',
    },
  });
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
  lastSampleTimestamp: string | null;
  sampleCount24h: number;
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
    lastSampleTimestamp: null as string | null,
    sampleCount24h: 0,
    errors,
    canStart: false,
  };

  if (__DEV__) {
    console.log('📍 [diag] Starting Android location diagnostics...');
    console.log(`📍 [diag] Support status: ${diagnostics.support}`);
  }

  if (diagnostics.support !== 'available') {
    errors.push(`Support status: ${diagnostics.support} (expected: 'available')`);
    return diagnostics;
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    errors.push('Location module not loaded - native module missing or not available');
    if (__DEV__) console.log('📍 [diag] Location module: FAILED to load');
    return diagnostics;
  }
  diagnostics.locationModule = true;
  if (__DEV__) console.log('📍 [diag] Location module: loaded');

  diagnostics.servicesEnabled = await Location.hasServicesEnabledAsync();
  if (__DEV__) console.log(`📍 [diag] Services enabled: ${diagnostics.servicesEnabled}`);
  if (!diagnostics.servicesEnabled) {
    errors.push('Location services disabled on device - enable in Settings > Location');
  }

  const fg = await Location.getForegroundPermissionsAsync();
  diagnostics.foregroundPermission = fg.status;
  if (__DEV__) console.log(`📍 [diag] Foreground permission: ${fg.status}`);
  if (fg.status !== 'granted') {
    errors.push(`Foreground permission: ${fg.status} (required: 'granted')`);
  }

  const bg = await getBackgroundPermissionsSafeAsync(Location);
  diagnostics.backgroundPermission = bg.status;
  if (__DEV__) console.log(`📍 [diag] Background permission: ${bg.status}`);
  if (bg.status !== 'granted') {
    errors.push(`Background permission: ${bg.status} (required: 'granted') - may need to enable in Settings`);
  }

  diagnostics.taskStarted = await Location.hasStartedLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
  if (__DEV__) console.log(`📍 [diag] Task started: ${diagnostics.taskStarted}`);

  // Note: taskStarted=false with no errors is EXPECTED — it means we CAN start.
  // Only warn if task is not started but there are stale pending samples.
  if (!diagnostics.taskStarted && errors.length === 0) {
    if (__DEV__) console.log('📍 [diag] All prerequisites passed, task not yet started — canStart will be true');
  }

  // Check pending samples and gather sample statistics
  try {
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    if (userId) {
      const pending = await peekPendingAndroidLocationSamplesAsync(userId, MAX_PENDING_SAMPLES_PER_USER);
      diagnostics.pendingSamples = pending.length;

      if (pending.length > 0) {
        // Find the most recent sample timestamp
        const sorted = [...pending].sort(
          (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        diagnostics.lastSampleTimestamp = sorted[0].recorded_at;

        // Count samples within last 24 hours
        const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
        diagnostics.sampleCount24h = pending.filter(
          (s) => new Date(s.recorded_at).getTime() >= cutoff24h
        ).length;

        if (__DEV__) {
          console.log(`📍 [diag] Pending samples: ${pending.length}`);
          console.log(`📍 [diag] Last sample at: ${diagnostics.lastSampleTimestamp}`);
          console.log(`📍 [diag] Samples in last 24h: ${diagnostics.sampleCount24h}`);
        }
      } else {
        if (__DEV__) console.log('📍 [diag] Pending samples: 0 (no location data collected)');
      }

      if (pending.length > 0 && !diagnostics.taskStarted) {
        errors.push(`Found ${pending.length} pending samples but task not started - samples may be stale`);
      }
    } else {
      if (__DEV__) console.log('📍 [diag] No authenticated user — cannot check pending samples');
    }
  } catch (error) {
    errors.push(`Failed to check pending samples: ${error instanceof Error ? error.message : String(error)}`);
  }

  // canStart = all prerequisites met AND task not already running
  diagnostics.canStart = errors.length === 0 && !diagnostics.taskStarted;
  if (__DEV__) {
    console.log(`📍 [diag] canStart: ${diagnostics.canStart} (errors=${errors.length}, taskStarted=${diagnostics.taskStarted})`);
    if (errors.length > 0) {
      console.log(`📍 [diag] Blocking errors: ${errors.join('; ')}`);
    }
  }

  return diagnostics;
}

