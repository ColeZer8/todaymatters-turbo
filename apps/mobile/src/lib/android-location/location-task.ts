import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import { enqueueAndroidLocationSamplesForUserAsync } from './queue';
import { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from './task-names';
import type { AndroidLocationSample } from './types';
import { ErrorCategory, logError } from './error-logger';
import { getAndroidApiLevel } from './android-version';

const TASK_ERROR_LOG_THROTTLE_MS = 60_000;
let lastTaskErrorLogAtMs = 0;

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeNonNegative(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  return value >= 0 ? value : null;
}

function normalizeHeadingDeg(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value < 0) return null;
  const normalized = value % 360;
  // Ensure result is strictly < 360 (handle edge cases where modulo might return exactly 360)
  return normalized >= 360 ? 0 : normalized;
}

function normalizeRaw(value: unknown): Json | null {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

function toSample(location: RawLocationObject): Omit<AndroidLocationSample, 'dedupe_key'> | null {
  if (!isFiniteNumber(location.timestamp)) return null;
  if (!isFiniteNumber(location.coords.latitude)) return null;
  if (!isFiniteNumber(location.coords.longitude)) return null;

  const lat = location.coords.latitude;
  const lng = location.coords.longitude;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  const recorded_at = new Date(location.timestamp).toISOString();
  const coords = location.coords;
  return {
    recorded_at,
    latitude: lat,
    longitude: lng,
    accuracy_m: normalizeNonNegative(coords.accuracy),
    altitude_m: isFiniteNumber(coords.altitude) ? coords.altitude : null,
    speed_mps: normalizeNonNegative(coords.speed),
    heading_deg: normalizeHeadingDeg(coords.heading),
    is_mocked: location.mocked ?? null,
    source: 'background',
    raw: normalizeRaw({
      timestamp: location.timestamp,
      coords,
    }),
  };
}

// IMPORTANT: Task definitions must live at module scope (per Expo docs).
if (Platform.OS === 'android' && requireOptionalNativeModule('ExpoTaskManager')) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
  TaskManager.defineTask(ANDROID_BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
    try {
      if (error) {
        if (__DEV__) {
          const now = Date.now();
          if (now - lastTaskErrorLogAtMs >= TASK_ERROR_LOG_THROTTLE_MS) {
            lastTaskErrorLogAtMs = now;
            console.warn('📍 Android background location task warning:', error);
          }
        }
        logError(ErrorCategory.TASK_EXECUTION_FAILED, 'Background location task received error callback', {
          error: error instanceof Error ? error.message : String(error),
          androidApiLevel: getAndroidApiLevel(),
        });
        return;
      }

      const locations = (data as unknown as { locations?: RawLocationObject[] } | null | undefined)?.locations ?? [];
      if (locations.length === 0) {
        logError(ErrorCategory.LOCATION_UNAVAILABLE, 'Background location task received empty locations array', {
          androidApiLevel: getAndroidApiLevel(),
        });
        return;
      }

      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id ?? null;
      if (!userId) {
        logError(ErrorCategory.TASK_EXECUTION_FAILED, 'No authenticated user session during location task', {
          androidApiLevel: getAndroidApiLevel(),
          locationCount: locations.length,
        });
        return;
      }

      const samples = locations.map(toSample).filter((s): s is Omit<AndroidLocationSample, 'dedupe_key'> => s != null);
      if (samples.length === 0) {
        logError(ErrorCategory.LOCATION_UNAVAILABLE, 'All location samples failed validation', {
          androidApiLevel: getAndroidApiLevel(),
          rawLocationCount: locations.length,
        });
        return;
      }
      const { pendingCount } = await enqueueAndroidLocationSamplesForUserAsync(userId, samples);

      if (__DEV__) {
        console.log(`📍 queued ${samples.length} Android location samples (pending=${pendingCount})`);
      }
    } catch (e) {
      if (__DEV__) console.error('📍 Android background location task failed:', e);
      logError(ErrorCategory.TASK_EXECUTION_FAILED, 'Background location task threw an exception', {
        error: e instanceof Error ? e.message : String(e),
        androidApiLevel: getAndroidApiLevel(),
      });
    }
  });
}


