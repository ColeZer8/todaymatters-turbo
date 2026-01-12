import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import { enqueueAndroidLocationSamplesForUserAsync } from './queue';
import type { AndroidLocationSample } from './types';

export const ANDROID_BACKGROUND_LOCATION_TASK_NAME = 'tm-android-background-location-task';

type RawLocationObject = {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    speed?: number | null;
    heading?: number | null;
  };
  mocked?: boolean;
};

function normalizeRaw(value: unknown): Json | null {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

function toSample(location: RawLocationObject): Omit<AndroidLocationSample, 'dedupe_key'> {
  const recorded_at = new Date(location.timestamp).toISOString();
  const coords = location.coords;
  return {
    recorded_at,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy_m: coords.accuracy ?? null,
    altitude_m: coords.altitude ?? null,
    speed_mps: coords.speed ?? null,
    heading_deg: coords.heading ?? null,
    is_mocked: location.mocked ?? null,
    source: 'background',
    raw: normalizeRaw({
      timestamp: location.timestamp,
      coords,
    }),
  };
}

// IMPORTANT: Task definitions must live at module scope (per Expo docs).
if (Platform.OS === 'android') {
  TaskManager.defineTask(ANDROID_BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
    try {
      if (error) {
        if (__DEV__) console.error('📍 Android background location task error:', error);
        return;
      }

      const locations = (data as unknown as { locations?: RawLocationObject[] } | null | undefined)?.locations ?? [];
      if (locations.length === 0) return;

      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id ?? null;
      if (!userId) return;

      const samples = locations.map(toSample);
      const { pendingCount } = await enqueueAndroidLocationSamplesForUserAsync(userId, samples);

      if (__DEV__) {
        console.log(`📍 queued ${samples.length} Android location samples (pending=${pendingCount})`);
      }
    } catch (e) {
      if (__DEV__) console.error('📍 Android background location task failed:', e);
    }
  });
}


