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

export async function requestAndroidLocationPermissionsAsync(): Promise<{
  foreground: 'granted' | 'denied' | 'undetermined';
  background: 'granted' | 'denied' | 'undetermined';
}> {
  if (Platform.OS !== 'android') return { foreground: 'denied', background: 'denied' };
  const Location = await loadExpoLocationAsync();
  if (!Location) return { foreground: 'denied', background: 'denied' };

  const foreground = await Location.requestForegroundPermissionsAsync();
  const background =
    foreground.status === 'granted'
      ? await Location.requestBackgroundPermissionsAsync()
      : { status: 'denied' as const };

  return { foreground: foreground.status, background: background.status };
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
  const bg = await Location.getBackgroundPermissionsAsync();
  if (fg.status !== 'granted') return;
  if (bg.status !== 'granted') return;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 75,
    // Android-specific: control update cadence.
    timeInterval: 5 * 60 * 1000,
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

