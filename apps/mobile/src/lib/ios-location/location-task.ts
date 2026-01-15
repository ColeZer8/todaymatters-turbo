import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import { enqueueLocationSamplesForUserAsync } from './queue';
import { IOS_BACKGROUND_LOCATION_TASK_NAME } from './task-names';
import type { IosLocationSample } from './types';

const TASK_ERROR_LOG_THROTTLE_MS = 60_000;
let lastTaskErrorLogAtMs = 0;

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeNonNegative(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  return value >= 0 ? value : null;
}

function normalizeHeadingDeg(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value < 0) return null; // iOS commonly uses -1 for "unknown"
  const normalized = value % 360;
  // Ensure result is strictly < 360 (handle edge cases where modulo might return exactly 360)
  return normalized >= 360 ? 0 : normalized;
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

function toSample(location: RawLocationObject): Omit<IosLocationSample, 'dedupe_key'> | null {
  if (!isFiniteNumber(location.timestamp)) return null;
  if (!isFiniteNumber(location.coords.latitude)) return null;
  if (!isFiniteNumber(location.coords.longitude)) return null;

  const lat = location.coords.latitude;
  const lng = location.coords.longitude;

  // Hard-drop invalid coordinates so we don't poison the upload queue.
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  const recorded_at = new Date(location.timestamp).toISOString();
  const coords = location.coords;

  // `mocked` is optional on some platforms/builds; keep it nullable.
  const is_mocked = isBoolean((location as { mocked?: unknown }).mocked) ? (location.mocked ?? null) : null;

  return {
    recorded_at,
    latitude: lat,
    longitude: lng,
    accuracy_m: normalizeNonNegative(coords.accuracy),
    altitude_m: isFiniteNumber(coords.altitude) ? coords.altitude : null,
    speed_mps: normalizeNonNegative(coords.speed),
    heading_deg: normalizeHeadingDeg(coords.heading),
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
if (Platform.OS === 'ios' && requireOptionalNativeModule('ExpoTaskManager')) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
  TaskManager.defineTask(IOS_BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
    try {
      if (error) {
        if (__DEV__) {
          const now = Date.now();
          if (now - lastTaskErrorLogAtMs >= TASK_ERROR_LOG_THROTTLE_MS) {
            lastTaskErrorLogAtMs = now;
            console.warn('📍 iOS background location task warning:', error);
          }
        }
        return;
      }

      const locations = (data as unknown as { locations?: RawLocationObject[] } | null | undefined)?.locations ?? [];
      if (locations.length === 0) return;

      // Associate samples to the authenticated user.
      // Background tasks may run without a session (e.g., after sign-out) — in that case we drop samples.
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id ?? null;
      if (!userId) return;

      const samples = locations.map(toSample).filter((s): s is Omit<IosLocationSample, 'dedupe_key'> => s != null);
      if (samples.length === 0) return;
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


