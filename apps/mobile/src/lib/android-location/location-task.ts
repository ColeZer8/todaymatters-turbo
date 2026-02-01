import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { enqueueAndroidLocationSamplesForUserAsync } from "./queue";
import { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from "./task-names";
import { recordTaskHeartbeat } from "./task-heartbeat";
import { ANDROID_LOCATION_TASK_METADATA_KEYS } from "./task-metadata";
import type { AndroidLocationSample } from "./types";

const TASK_ERROR_LOG_THROTTLE_MS = 60_000;
let lastTaskErrorLogAtMs = 0;

const LAST_AUTHED_USER_ID_KEY = "tm:lastAuthedUserId";
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
  return typeof value === "number" && Number.isFinite(value);
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

function toSample(
  location: RawLocationObject,
): Omit<AndroidLocationSample, "dedupe_key"> | null {
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
    source: "background",
    raw: normalizeRaw({
      timestamp: location.timestamp,
      coords,
    }),
  };
}

// IMPORTANT: Task definitions must live at module scope (per Expo docs).
if (
  Platform.OS === "android" &&
  requireOptionalNativeModule("ExpoTaskManager")
) {
  console.log("📍 [init] Defining Android location background task...");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager =
    require("expo-task-manager") as typeof import("expo-task-manager");
  TaskManager.defineTask(
    ANDROID_BACKGROUND_LOCATION_TASK_NAME,
    async ({ data, error }) => {
      console.log("📍 [task] ========== TASK CALLBACK FIRED ==========");
      try {
        const firedAtIso = new Date().toISOString();
        AsyncStorage.setItem(
          ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskFiredAt,
          firedAtIso,
        ).catch(() => undefined);
        if (__DEV__) {
          console.log(
            `📍 [task] Background location task fired at ${firedAtIso}`,
          );
        }

        if (error) {
          AsyncStorage.setItem(
            ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskError,
            JSON.stringify({ at: firedAtIso, error: String(error) }),
          ).catch(() => undefined);
          recordTaskHeartbeat(0).catch(() => undefined);
          const now = Date.now();
          if (now - lastTaskErrorLogAtMs >= TASK_ERROR_LOG_THROTTLE_MS) {
            lastTaskErrorLogAtMs = now;
            console.warn(
              "📍 [task] Android background location task warning:",
              error,
            );
          }
          return;
        }

        const locations =
          (
            data as unknown as
              | { locations?: RawLocationObject[] }
              | null
              | undefined
          )?.locations ?? [];
        recordTaskHeartbeat(locations.length).catch(() => undefined);
        if (__DEV__) {
          console.log(`📍 [task] Received ${locations.length} raw location(s)`);
        }
        if (locations.length === 0) return;

        const sessionResult = await supabase.auth.getSession();
        const sessionUserId = sessionResult.data.session?.user?.id ?? null;
        const cachedUserId = await AsyncStorage.getItem(
          LAST_AUTHED_USER_ID_KEY,
        ).catch(() => null);
        const userId = sessionUserId ?? cachedUserId ?? null;
        if (!userId) {
          if (__DEV__)
            console.log("📍 [task] No authenticated user — dropping locations");
          return;
        }

        const samples = locations
          .map(toSample)
          .filter(
            (s): s is Omit<AndroidLocationSample, "dedupe_key"> => s != null,
          );
        if (__DEV__) {
          console.log(
            `📍 [task] Converted to ${samples.length} valid sample(s) from ${locations.length} raw`,
          );
        }
        if (samples.length === 0) return;
        const { pendingCount } =
          await enqueueAndroidLocationSamplesForUserAsync(userId, samples);
        AsyncStorage.setItem(
          ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskQueuedCount,
          String(samples.length),
        ).catch(() => undefined);
        AsyncStorage.removeItem(
          ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskError,
        ).catch(() => undefined);

        if (__DEV__) {
          console.log(
            `📍 [task] Queued ${samples.length} Android location samples (pending=${pendingCount})`,
          );
        }
      } catch (e) {
        AsyncStorage.setItem(
          ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskError,
          JSON.stringify({
            at: new Date().toISOString(),
            error: e instanceof Error ? e.message : String(e),
          }),
        ).catch(() => undefined);
        recordTaskHeartbeat(0).catch(() => undefined);
        console.error("📍 [task] Android background location task failed:", e);
      }
    },
  );
  console.log("📍 [init] Android location background task defined successfully");
}
