import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { IOS_BACKGROUND_LOCATION_TASK_NAME } from "./task-names";
import {
  enqueueLocationSamplesForUserAsync,
  peekPendingLocationSamplesAsync,
  removePendingLocationSamplesByKeyAsync,
} from "./queue";
import type { IosLocationSupportStatus, IosLocationSample } from "./types";
import {
  sanitizeLocationSamplesForUpload,
  upsertLocationSamples,
} from "@/lib/supabase/services/location-samples";
import { requireOptionalNativeModule } from "expo-modules-core";

export type { IosLocationSupportStatus, IosLocationSample } from "./types";
export { IOS_BACKGROUND_LOCATION_TASK_NAME } from "./task-names";
export { clearPendingLocationSamplesAsync } from "./queue";

export interface IosTrackingProfile {
  desiredAccuracy: "balanced" | "high";
  distanceFilterM: number;
  /** Soft stop timeout for low-motion periods (mapped to deferred batching on iOS). */
  stopTimeoutMs: number;
  /** Foreground heartbeat cadence while app is active. */
  heartbeatIntervalMs: number;
  /** Upload/sync cadence for queued samples. */
  syncFlushIntervalMs: number;
}

export const IOS_TRACKING_PROFILES: Record<string, IosTrackingProfile> = {
  /** Default profile tuned for timeline-quality segmentation without excessive battery cost. */
  timelineBalanced: {
    desiredAccuracy: "balanced",
    distanceFilterM: 50,
    stopTimeoutMs: 5 * 60 * 1000,
    heartbeatIntervalMs: 2 * 60 * 1000,
    syncFlushIntervalMs: 2 * 60 * 1000,
  },
  /** Optional profile for denser traces (debug/high-mobility days). */
  timelineDense: {
    desiredAccuracy: "high",
    distanceFilterM: 25,
    stopTimeoutMs: 2 * 60 * 1000,
    heartbeatIntervalMs: 60 * 1000,
    syncFlushIntervalMs: 60 * 1000,
  },
};

export const IOS_DEFAULT_TRACKING_PROFILE = IOS_TRACKING_PROFILES.timelineBalanced;

export function getIosLocationSupportStatus(): IosLocationSupportStatus {
  if (Platform.OS !== "ios") return "notIos";
  // Background tasks aren’t reliably supported in Expo Go; require a dev client / production build.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return "expoGo";
  return "available";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeNonNegative(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  return value >= 0 ? value : null;
}

function normalizeHeadingDeg(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value < 0) return null; // iOS commonly uses -1 for "unknown"
  const normalized = value % 360;
  return normalized >= 360 ? 0 : normalized;
}

function normalizeRaw(value: unknown): IosLocationSample["raw"] {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as IosLocationSample["raw"];
  } catch {
    return null;
  }
}

type IosTelemetryMeta = {
  provider: string | null;
  activity: string | null;
  battery_level: number | null;
  battery_state: string | null;
  is_simulator: boolean | null;
  is_mocked: boolean | null;
};

function normalizeBatteryLevel(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function normalizeShortString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 64) : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function extractIosTelemetryMeta(
  location: RawLocationObject & Record<string, unknown>,
): IosTelemetryMeta {
  const provider =
    normalizeShortString(location.provider) ??
    normalizeShortString((location as { coords?: { provider?: unknown } }).coords?.provider) ??
    "corelocation";

  const activity =
    normalizeShortString(location.activity) ??
    normalizeShortString((location as { activityType?: unknown }).activityType) ??
    normalizeShortString(
      (location as { motion?: { activity?: unknown } }).motion?.activity,
    );

  const batteryLevel =
    normalizeBatteryLevel(location.battery_level) ??
    normalizeBatteryLevel(location.batteryLevel) ??
    normalizeBatteryLevel(
      (location as { battery?: { level?: unknown } }).battery?.level,
    );

  const batteryState =
    normalizeShortString(location.battery_state) ??
    normalizeShortString(location.batteryState) ??
    normalizeShortString(
      (location as { battery?: { state?: unknown } }).battery?.state,
    );

  return {
    provider,
    activity,
    battery_level: batteryLevel,
    battery_state: batteryState,
    is_simulator:
      typeof Constants.isDevice === "boolean" ? !Constants.isDevice : null,
    is_mocked: normalizeBoolean(location.mocked),
  };
}

async function loadExpoLocationAsync(): Promise<
  typeof import("expo-location") | null
> {
  // Avoid hard-crashing the app if the native module isn't compiled into this build.
  if (!requireOptionalNativeModule("ExpoLocation")) return null;
  try {
    return await import("expo-location");
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

function toSample(
  location: RawLocationObject & Record<string, unknown>,
  sourceMeta: { collected_via: "foreground_poll" | "background_task" },
): Omit<IosLocationSample, "dedupe_key"> | null {
  if (!isFiniteNumber(location.timestamp)) return null;
  if (!isFiniteNumber(location.coords.latitude)) return null;
  if (!isFiniteNumber(location.coords.longitude)) return null;

  const lat = location.coords.latitude;
  const lng = location.coords.longitude;

  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  const recorded_at = new Date(location.timestamp).toISOString();
  const coords = location.coords;

  const is_mocked =
    typeof location.mocked === "boolean" ? (location.mocked ?? null) : null;
  const telemetry = extractIosTelemetryMeta(location);

  return {
    recorded_at,
    latitude: lat,
    longitude: lng,
    accuracy_m: normalizeNonNegative(coords.accuracy),
    altitude_m: isFiniteNumber(coords.altitude) ? coords.altitude : null,
    speed_mps: normalizeNonNegative(coords.speed),
    heading_deg: normalizeHeadingDeg(coords.heading),
    is_mocked,
    // IMPORTANT: Supabase currently constrains `source` to "background".
    source: "background",
    raw: normalizeRaw({
      ...sourceMeta,
      timestamp: location.timestamp,
      coords,
      telemetry,
      meta: telemetry,
    }),
  };
}

export async function requestIosLocationPermissionsAsync(): Promise<{
  foreground: "granted" | "denied" | "undetermined";
  background: "granted" | "denied" | "undetermined";
  canAskAgainForeground: boolean;
  canAskAgainBackground: boolean;
  /** iOS doesn't require notification permission for background location */
  notifications: "granted" | "denied" | "undetermined";
  canAskAgainNotifications: boolean;
  notificationsRequired: boolean;
  hasNativeModule: boolean;
}> {
  if (Platform.OS !== "ios") {
    return {
      foreground: "denied",
      background: "denied",
      canAskAgainForeground: false,
      canAskAgainBackground: false,
      notifications: "denied",
      canAskAgainNotifications: false,
      notificationsRequired: false,
      hasNativeModule: false,
    };
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    return {
      foreground: "denied",
      background: "denied",
      canAskAgainForeground: false,
      canAskAgainBackground: false,
      // iOS doesn't require notification permission for location foreground service
      notifications: "granted",
      canAskAgainNotifications: true,
      notificationsRequired: false,
      hasNativeModule: false,
    };
  }

  const fgBefore = await Location.getForegroundPermissionsAsync();
  const bgBefore = await Location.getBackgroundPermissionsAsync();

  let foreground = fgBefore;
  if (foreground.status !== "granted") {
    foreground = await Location.requestForegroundPermissionsAsync();
  }

  let background = bgBefore;
  if (foreground.status === "granted" && background.status !== "granted") {
    background = await Location.requestBackgroundPermissionsAsync();
  }

  return {
    foreground: foreground.status,
    background: background.status,
    canAskAgainForeground:
      typeof foreground.canAskAgain === "boolean"
        ? foreground.canAskAgain
        : true,
    canAskAgainBackground:
      typeof background.canAskAgain === "boolean"
        ? background.canAskAgain
        : true,
    // iOS doesn't require notification permission for background location
    // (unlike Android 13+ which requires it for foreground services)
    notifications: "granted",
    canAskAgainNotifications: true,
    notificationsRequired: false,
    hasNativeModule: true,
  };
}

export async function startIosBackgroundLocationAsync(): Promise<void> {
  const support = getIosLocationSupportStatus();
  if (support !== "available") return;

  const Location = await loadExpoLocationAsync();
  if (!Location) return;

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return;

  // IMPORTANT: Don't auto-request permissions here. Onboarding should drive the permission prompts.
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  if (fg.status !== "granted") return;
  if (bg.status !== "granted") return;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    IOS_BACKGROUND_LOCATION_TASK_NAME,
  );
  if (alreadyStarted) return;

  const profile = IOS_DEFAULT_TRACKING_PROFILE;

  await Location.startLocationUpdatesAsync(IOS_BACKGROUND_LOCATION_TASK_NAME, {
    accuracy:
      profile.desiredAccuracy === "high"
        ? Location.Accuracy.High
        : Location.Accuracy.Balanced,
    distanceInterval: profile.distanceFilterM,
    pausesUpdatesAutomatically: true,
    // iOS-only: allow batching for efficiency when movement is low.
    deferredUpdatesInterval: profile.stopTimeoutMs,
    deferredUpdatesDistance: Math.max(100, profile.distanceFilterM * 4),
    showsBackgroundLocationIndicator: false,
    activityType: Location.ActivityType.Other,
  });
}

export async function stopIosBackgroundLocationAsync(): Promise<void> {
  if (Platform.OS !== "ios") return;
  const Location = await loadExpoLocationAsync();
  if (!Location) return;
  const started = await Location.hasStartedLocationUpdatesAsync(
    IOS_BACKGROUND_LOCATION_TASK_NAME,
  );
  if (!started) return;
  await Location.stopLocationUpdatesAsync(IOS_BACKGROUND_LOCATION_TASK_NAME);
}

/**
 * Foreground fallback: capture a single location sample while app is open.
 *
 * Why: iOS background tasks are unavailable in Expo Go, and many users grant
 * "When In Use" but not "Always". This ensures iOS can still collect samples.
 */
export async function captureIosLocationSampleNowAsync(
  userId: string,
  options: { flushToSupabase?: boolean } = {},
): Promise<
  | { ok: true; enqueued: number; uploaded?: number; remaining?: number }
  | {
      ok: false;
      reason:
        | "not_ios"
        | "no_native_module"
        | "services_disabled"
        | "fg_denied"
        | "error";
    }
> {
  if (Platform.OS !== "ios") return { ok: false, reason: "not_ios" };

  const Location = await loadExpoLocationAsync();
  if (!Location) return { ok: false, reason: "no_native_module" };

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return { ok: false, reason: "services_disabled" };

  // IMPORTANT: Don't auto-request permissions here. Onboarding should drive prompts.
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") return { ok: false, reason: "fg_denied" };

  try {
    const profile = IOS_DEFAULT_TRACKING_PROFILE;
    const location = (await Location.getCurrentPositionAsync({
      accuracy:
        profile.desiredAccuracy === "high"
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced,
    })) as unknown as RawLocationObject;

    const sample = toSample(location, { collected_via: "foreground_poll" });
    if (!sample) return { ok: false, reason: "error" };

    const enqueueResult = await enqueueLocationSamplesForUserAsync(userId, [
      sample,
    ]);

    if (options.flushToSupabase) {
      const flush = await flushPendingLocationSamplesToSupabaseAsync(userId);
      return {
        ok: true,
        enqueued: enqueueResult.enqueued,
        uploaded: flush.uploaded,
        remaining: flush.remaining,
      };
    }

    return { ok: true, enqueued: enqueueResult.enqueued };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function flushPendingLocationSamplesToSupabaseAsync(
  userId: string,
): Promise<{
  uploaded: number;
  remaining: number;
}> {
  if (Platform.OS !== "ios") return { uploaded: 0, remaining: 0 };

  const BATCH_SIZE = 250;
  let uploaded = 0;

  while (true) {
    const batch = await peekPendingLocationSamplesAsync(userId, BATCH_SIZE);
    if (batch.length === 0) break;

    const { validSamples, droppedKeys } =
      sanitizeLocationSamplesForUpload(batch);
    if (droppedKeys.length > 0) {
      if (__DEV__) {
        console.warn(
          `📍 Dropped ${droppedKeys.length} iOS location samples with invalid fields.`,
        );
      }
      await removePendingLocationSamplesByKeyAsync(userId, droppedKeys);
    }

    if (validSamples.length === 0) {
      continue;
    }

    await upsertLocationSamples(userId, validSamples);
    await removePendingLocationSamplesByKeyAsync(
      userId,
      validSamples.map((s) => s.dedupe_key),
    );

    uploaded += validSamples.length;
  }

  const remaining = (
    await peekPendingLocationSamplesAsync(userId, Number.MAX_SAFE_INTEGER)
  ).length;
  return { uploaded, remaining };
}
