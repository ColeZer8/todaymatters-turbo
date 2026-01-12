import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import { enqueueLocationSamplesForUserAsync } from './queue';
import type { IosLocationSample } from './types';

export const IOS_BACKGROUND_LOCATION_TASK_NAME = 'tm-ios-background-location-task';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function normalizeRaw(value: unknown): Json | null {
  // Keep raw payload minimal and JSON-safe for storage.
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

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

function toSample(location: RawLocationObject): Omit<IosLocationSample, 'dedupe_key'> {
  const recorded_at = new Date(location.timestamp).toISOString();
  const coords = location.coords;

  // `mocked` is optional on some platforms/builds; keep it nullable.
  const is_mocked = isBoolean((location as { mocked?: unknown }).mocked) ? (location.mocked ?? null) : null;

  return {
    recorded_at,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy_m: coords.accuracy ?? null,
    altitude_m: coords.altitude ?? null,
    speed_mps: coords.speed ?? null,
    heading_deg: coords.heading ?? null,
    is_mocked,
    source: 'background',
    raw: normalizeRaw({
      // Only store what’s useful for debugging/analytics; avoid very large payloads.
      timestamp: location.timestamp,
      coords,
    }),
  };
}

// IMPORTANT: Task definitions must live at module scope (per Expo docs).
if (Platform.OS === 'ios') {
  TaskManager.defineTask(IOS_BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
    try {
      if (error) {
        if (__DEV__) console.error('📍 iOS background location task error:', error);
        return;
      }

      const locations = (data as unknown as { locations?: RawLocationObject[] } | null | undefined)?.locations ?? [];
      if (locations.length === 0) return;

      // Associate samples to the authenticated user.
      // Background tasks may run without a session (e.g., after sign-out) — in that case we drop samples.
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id ?? null;
      if (!userId) return;

      const samples = locations.map(toSample);
      const { pendingCount } = await enqueueLocationSamplesForUserAsync(userId, samples);

      if (__DEV__) {
        console.log(`📍 queued ${samples.length} iOS location samples (pending=${pendingCount})`);
      }
    } catch (e) {
      if (__DEV__) {
        console.error('📍 iOS background location task failed:', e);
      }
    }
  });
}


