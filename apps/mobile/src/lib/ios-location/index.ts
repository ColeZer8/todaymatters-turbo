import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { IOS_BACKGROUND_LOCATION_TASK_NAME } from './location-task';
import { peekPendingLocationSamplesAsync, removePendingLocationSamplesByKeyAsync } from './queue';
import type { IosLocationSupportStatus, IosLocationSample } from './types';
import { upsertLocationSamples } from '@/lib/supabase/services/location-samples';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type { IosLocationSupportStatus, IosLocationSample } from './types';
export { IOS_BACKGROUND_LOCATION_TASK_NAME } from './location-task';
export { clearPendingLocationSamplesAsync } from './queue';

export function getIosLocationSupportStatus(): IosLocationSupportStatus {
  if (Platform.OS !== 'ios') return 'notIos';
  // Background tasks aren’t reliably supported in Expo Go; require a dev client / production build.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expoGo';
  return 'available';
}

async function loadExpoLocationAsync(): Promise<typeof import('expo-location') | null> {
  // Avoid hard-crashing the app if the native module isn't compiled into this build.
  if (!requireOptionalNativeModule('ExpoLocation')) return null;
  try {
    return await import('expo-location');
  } catch {
    return null;
  }
}

export async function requestIosLocationPermissionsAsync(): Promise<{
  foreground: 'granted' | 'denied' | 'undetermined';
  background: 'granted' | 'denied' | 'undetermined';
}> {
  if (Platform.OS !== 'ios') {
    return { foreground: 'denied', background: 'denied' };
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) return { foreground: 'denied', background: 'denied' };

  const foreground = await Location.requestForegroundPermissionsAsync();
  const background =
    foreground.status === 'granted'
      ? await Location.requestBackgroundPermissionsAsync()
      : { status: 'denied' as const };

  return { foreground: foreground.status, background: background.status };
}

export async function startIosBackgroundLocationAsync(): Promise<void> {
  const support = getIosLocationSupportStatus();
  if (support !== 'available') return;

  const Location = await loadExpoLocationAsync();
  if (!Location) return;

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return;

  // IMPORTANT: Don't auto-request permissions here. Onboarding should drive the permission prompts.
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  if (fg.status !== 'granted') return;
  if (bg.status !== 'granted') return;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(IOS_BACKGROUND_LOCATION_TASK_NAME);
  if (alreadyStarted) return;

  // Production defaults: venue-level tracking with reasonable battery usage.
  await Location.startLocationUpdatesAsync(IOS_BACKGROUND_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 75, // meters
    pausesUpdatesAutomatically: true,
    // iOS-only: allow batching for efficiency.
    deferredUpdatesInterval: 5 * 60 * 1000, // 5 min
    deferredUpdatesDistance: 250, // meters
    showsBackgroundLocationIndicator: false,
    activityType: Location.ActivityType.Other,
  });
}

export async function stopIosBackgroundLocationAsync(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const Location = await loadExpoLocationAsync();
  if (!Location) return;
  const started = await Location.hasStartedLocationUpdatesAsync(IOS_BACKGROUND_LOCATION_TASK_NAME);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(IOS_BACKGROUND_LOCATION_TASK_NAME);
}

export async function flushPendingLocationSamplesToSupabaseAsync(userId: string): Promise<{
  uploaded: number;
  remaining: number;
}> {
  if (Platform.OS !== 'ios') return { uploaded: 0, remaining: 0 };

  const BATCH_SIZE = 250;
  let uploaded = 0;

  while (true) {
    const batch = await peekPendingLocationSamplesAsync(userId, BATCH_SIZE);
    if (batch.length === 0) break;

    await upsertLocationSamples(userId, batch);
    await removePendingLocationSamplesByKeyAsync(
      userId,
      batch.map((s) => s.dedupe_key)
    );

    uploaded += batch.length;
  }

  const remaining = (await peekPendingLocationSamplesAsync(userId, Number.MAX_SAFE_INTEGER)).length;
  return { uploaded, remaining };
}


