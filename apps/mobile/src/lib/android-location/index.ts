import { Linking, PermissionsAndroid, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  sanitizeLocationSamplesForUpload,
  upsertLocationSamples,
} from "@/lib/supabase/services/location-samples";
import { supabase } from "@/lib/supabase/client";
import { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from "./task-names";
import {
  clearPendingAndroidLocationSamplesAsync,
  peekPendingAndroidLocationSamplesAsync,
  removePendingAndroidLocationSamplesByKeyAsync,
  enqueueAndroidLocationSamplesForUserAsync,
} from "./queue";
import { getLastTaskHeartbeat } from "./task-heartbeat";
import type { TaskHeartbeat } from "./task-heartbeat";
import { getAndroidLocationTaskMetadata } from "./task-metadata";
import { getAndroidApiLevel } from "./android-version";
import type {
  AndroidLocationSupportStatus,
  AndroidLocationSample,
} from "./types";
import { ErrorCategory, logError } from "./error-logger";

/** Mirror of MAX_PENDING_SAMPLES_PER_USER in queue.ts — used for diagnostics peek. */
const MAX_PENDING_SAMPLES_PER_USER = 10_000;

export type {
  AndroidLocationSupportStatus,
  AndroidLocationSample,
} from "./types";
export { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from "./task-names";
export {
  clearPendingAndroidLocationSamplesAsync,
  peekPendingAndroidLocationSamplesAsync,
} from "./queue";
export { isAndroid14Plus, getAndroidApiLevel } from "./android-version";
export {
  ErrorCategory,
  logError,
  getRecentErrors,
  clearErrors,
} from "./error-logger";
export type { ErrorLogEntry } from "./error-logger";
export { recordTaskHeartbeat, getLastTaskHeartbeat } from "./task-heartbeat";
export type { TaskHeartbeat } from "./task-heartbeat";
export { calculateDistance } from "./distance";
export type { Coordinate } from "./distance";
export { getMovementState, setMovementState } from "./movement-state";
export type {
  MovementState,
  MovementReason,
  MovementStateData,
} from "./movement-state";
export { classifyMovementByDistance } from "./movement-detector";
export type {
  LocationSampleInput,
  MovementClassification,
} from "./movement-detector";
export { recordLastSyncTime, getLastSyncTime } from "./sync-timing";

export function getAndroidLocationSupportStatus(): AndroidLocationSupportStatus {
  if (Platform.OS !== "android") return "notAndroid";
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return "expoGo";
  return "available";
}

async function loadExpoLocationAsync(): Promise<
  typeof import("expo-location") | null
> {
  if (!requireOptionalNativeModule("ExpoLocation")) return null;
  try {
    return await import("expo-location");
  } catch {
    return null;
  }
}

async function getBackgroundPermissionsSafeAsync(
  Location: typeof import("expo-location"),
): Promise<import("expo-location").PermissionResponse> {
  try {
    return await Location.getBackgroundPermissionsAsync();
  } catch (error) {
    if (__DEV__) {
      console.warn("📍 Android background permission check failed:", error);
    }
    return {
      status: "denied",
      granted: false,
      canAskAgain: false,
      expires: "never",
    };
  }
}

type AndroidPermissionStatus = "granted" | "denied" | "undetermined";

const ANDROID_NOTIFICATION_PERMISSION_API_LEVEL = 33;

async function getAndroidNotificationPermissionStatusAsync(
  options: { requestIfNeeded?: boolean } = {},
): Promise<{
  status: AndroidPermissionStatus;
  canAskAgain: boolean;
  required: boolean;
  apiLevel: number | null;
}> {
  const { requestIfNeeded = false } = options;
  const apiLevel = getAndroidApiLevel();
  const required =
    Platform.OS === "android" &&
    typeof apiLevel === "number" &&
    apiLevel >= ANDROID_NOTIFICATION_PERMISSION_API_LEVEL;

  if (!required) {
    return {
      status: "granted",
      canAskAgain: true,
      required: false,
      apiLevel,
    };
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  const hasPermission = await PermissionsAndroid.check(permission);
  if (hasPermission) {
    return {
      status: "granted",
      canAskAgain: true,
      required: true,
      apiLevel,
    };
  }

  if (!requestIfNeeded) {
    return {
      status: "denied",
      canAskAgain: true,
      required: true,
      apiLevel,
    };
  }

  const result = await PermissionsAndroid.request(permission);
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return {
      status: "granted",
      canAskAgain: true,
      required: true,
      apiLevel,
    };
  }
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return {
      status: "denied",
      canAskAgain: false,
      required: true,
      apiLevel,
    };
  }

  return {
    status: "denied",
    canAskAgain: true,
    required: true,
    apiLevel,
  };
}

export async function requestAndroidLocationPermissionsAsync(): Promise<{
  foreground: "granted" | "denied" | "undetermined";
  background: "granted" | "denied" | "undetermined";
  canAskAgainForeground: boolean;
  canAskAgainBackground: boolean;
  notifications: AndroidPermissionStatus;
  canAskAgainNotifications: boolean;
  notificationsRequired: boolean;
  androidApiLevel: number | null;
  hasNativeModule: boolean;
}> {
  if (Platform.OS !== "android") {
    return {
      foreground: "denied",
      background: "denied",
      canAskAgainForeground: false,
      canAskAgainBackground: false,
      notifications: "denied",
      canAskAgainNotifications: false,
      notificationsRequired: false,
      androidApiLevel: null,
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
      notifications: "denied",
      canAskAgainNotifications: false,
      notificationsRequired: false,
      androidApiLevel: getAndroidApiLevel(),
      hasNativeModule: false,
    };
  }

  const fgBefore = await Location.getForegroundPermissionsAsync();
  const bgBefore = await getBackgroundPermissionsSafeAsync(Location);

  let foreground = fgBefore;
  if (foreground.status !== "granted") {
    foreground = await Location.requestForegroundPermissionsAsync();
  }

  let background = bgBefore;
  if (foreground.status === "granted" && background.status !== "granted") {
    try {
      background = await Location.requestBackgroundPermissionsAsync();
    } catch (error) {
      if (__DEV__) {
        console.warn("📍 Android background permission request failed:", error);
      }
      background = {
        status: "denied",
        granted: false,
        canAskAgain: false,
        expires: "never",
      };
    }
  }

  const notificationsStatus = await getAndroidNotificationPermissionStatusAsync({
    requestIfNeeded: true,
  });

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
    notifications: notificationsStatus.status,
    canAskAgainNotifications: notificationsStatus.canAskAgain,
    notificationsRequired: notificationsStatus.required,
    androidApiLevel: notificationsStatus.apiLevel,
    hasNativeModule: true,
  };
}

export type StartAndroidLocationResult =
  | { ok: true; reason: "started" | "already_running" }
  | {
      ok: false;
      reason:
        | "not_available"
        | "no_module"
        | "services_disabled"
        | "fg_denied"
        | "bg_denied"
        | "notifications_denied"
        | "start_failed";
      detail?: string;
    };

export async function startAndroidBackgroundLocationAsync(): Promise<StartAndroidLocationResult> {
  const support = getAndroidLocationSupportStatus();
  if (support !== "available") {
    console.log(`📍 [start] Skipped: support=${support}`);
    return { ok: false, reason: "not_available" };
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    console.log("📍 [start] Skipped: expo-location module not available");
    return { ok: false, reason: "no_module" };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    console.log("📍 [start] Skipped: location services disabled");
    logError(ErrorCategory.PERMISSION_DENIED, "Location services disabled");
    return { ok: false, reason: "services_disabled" };
  }

  // IMPORTANT: Do not auto-request permissions here; onboarding should drive prompts.
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await getBackgroundPermissionsSafeAsync(Location);
  if (fg.status !== "granted") {
    console.log(`📍 [start] Skipped: foreground permission=${fg.status}`);
    logError(ErrorCategory.PERMISSION_DENIED, "Foreground location denied", {
      status: fg.status,
    });
    return { ok: false, reason: "fg_denied" };
  }
  if (bg.status !== "granted") {
    console.log(`📍 [start] Skipped: background permission=${bg.status}`);
    logError(ErrorCategory.PERMISSION_DENIED, "Background location denied", {
      status: bg.status,
    });
    return { ok: false, reason: "bg_denied" };
  }

  const notifications = await getAndroidNotificationPermissionStatusAsync();
  if (notifications.required && notifications.status !== "granted") {
    console.log(
      "📍 [start] Skipped: notifications permission required for foreground service",
    );
    logError(
      ErrorCategory.PERMISSION_DENIED,
      "Notifications permission denied (Android 13+)",
      {
        apiLevel: notifications.apiLevel,
        status: notifications.status,
      },
    );
    return { ok: false, reason: "notifications_denied" };
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    ANDROID_BACKGROUND_LOCATION_TASK_NAME,
  );
  if (alreadyStarted) {
    return { ok: true, reason: "already_running" };
  }

  try {
    await Location.startLocationUpdatesAsync(
      ANDROID_BACKGROUND_LOCATION_TASK_NAME,
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 40,
        // Android-specific: control update cadence.
        timeInterval: 2 * 60 * 1000,
        // Foreground service is required for background reliability.
        foregroundService: {
          notificationTitle: "TodayMatters is tracking your day",
          notificationBody:
            "Used to build an hour-by-hour view of your day for schedule comparison.",
          notificationColor: "#2563EB",
        },
      },
    );
    console.log("📍 [start] Background location task started successfully");
    return { ok: true, reason: "started" };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(
      "📍 [start] Failed to start background location task:",
      detail,
    );
    logError(ErrorCategory.TASK_START_FAILED, "Failed to start location task", {
      detail,
    });
    return { ok: false, reason: "start_failed", detail };
  }
}

/**
 * Check if the Android background location task is currently running.
 * Returns false on non-Android or if the check fails.
 */
export async function isAndroidBackgroundLocationRunningAsync(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const Location = await loadExpoLocationAsync();
  if (!Location) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(
      ANDROID_BACKGROUND_LOCATION_TASK_NAME,
    );
  } catch {
    return false;
  }
}

export async function stopAndroidBackgroundLocationAsync(): Promise<void> {
  if (Platform.OS !== "android") return;
  const Location = await loadExpoLocationAsync();
  if (!Location) return;

  const started = await Location.hasStartedLocationUpdatesAsync(
    ANDROID_BACKGROUND_LOCATION_TASK_NAME,
  );
  if (!started) return;
  await Location.stopLocationUpdatesAsync(
    ANDROID_BACKGROUND_LOCATION_TASK_NAME,
  );
}

/**
 * Dev helper: capture one location sample immediately, enqueue it, and optionally flush to Supabase.
 * This bypasses background task delivery so we can confirm queue + Supabase sync works end-to-end.
 */
export async function captureAndroidLocationSampleNowAsync(
  userId: string,
  options: { flushToSupabase?: boolean } = {},
): Promise<
  | {
      ok: true;
      enqueued: number;
      pendingAfterEnqueue: number;
      uploaded?: number;
      remainingAfterFlush?: number;
    }
  | { ok: false; reason: string; detail?: string }
> {
  if (Platform.OS !== "android") return { ok: false, reason: "not_android" };
  const Location = await loadExpoLocationAsync();
  if (!Location) return { ok: false, reason: "no_module" };

  try {
    // First try a last-known fix (fast, no GPS warmup). If unavailable, fall back to a live fix with a generous timeout.
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 10 * 60 * 1000,
      requiredAccuracy: 500,
    }).catch(() => null);
    const pos =
      lastKnown ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 0,
        distanceInterval: 0,
        mayShowUserSettingsDialog: true,
      }));
    const sample: Omit<AndroidLocationSample, "dedupe_key"> = {
      recorded_at: new Date(pos.timestamp).toISOString(),
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy_m:
        typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
      altitude_m:
        typeof pos.coords.altitude === "number" ? pos.coords.altitude : null,
      speed_mps: typeof pos.coords.speed === "number" ? pos.coords.speed : null,
      heading_deg:
        typeof pos.coords.heading === "number" ? pos.coords.heading : null,
      is_mocked: (pos as unknown as { mocked?: boolean }).mocked ?? null,
      // Supabase constraint currently allows only 'background'.
      source: "background",
      raw: null,
    };

    const { enqueued, pendingCount } =
      await enqueueAndroidLocationSamplesForUserAsync(userId, [sample]);
    if (!options.flushToSupabase) {
      return { ok: true, enqueued, pendingAfterEnqueue: pendingCount };
    }

    const flushed =
      await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
    return {
      ok: true,
      enqueued,
      pendingAfterEnqueue: pendingCount,
      uploaded: flushed.uploaded,
      remainingAfterFlush: flushed.remaining,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    // Extra diagnostics: provider status can explain "location unavailable" even when permissions are granted.
    const providerStatus = await Location.getProviderStatusAsync().catch(
      () => null,
    );
    const providerDetail = providerStatus
      ? `providerStatus=${JSON.stringify(providerStatus)}`
      : "providerStatus=unknown";
    return {
      ok: false,
      reason: "capture_failed",
      detail: `${detail}\n\n${providerDetail}`,
    };
  }
}

export async function flushPendingAndroidLocationSamplesToSupabaseAsync(
  userId: string,
): Promise<{
  uploaded: number;
  remaining: number;
}> {
  if (Platform.OS !== "android") return { uploaded: 0, remaining: 0 };

  const BATCH_SIZE = 250;
  let uploaded = 0;

  while (true) {
    const batch = await peekPendingAndroidLocationSamplesAsync(
      userId,
      BATCH_SIZE,
    );
    if (batch.length === 0) break;

    const { validSamples, droppedKeys } =
      sanitizeLocationSamplesForUpload(batch);
    if (droppedKeys.length > 0) {
      if (__DEV__) {
        console.warn(
          `📍 Dropped ${droppedKeys.length} Android location samples with invalid fields.`,
        );
      }
      await removePendingAndroidLocationSamplesByKeyAsync(userId, droppedKeys);
    }

    if (validSamples.length === 0) {
      continue;
    }

    await upsertLocationSamples(userId, validSamples);
    await removePendingAndroidLocationSamplesByKeyAsync(
      userId,
      validSamples.map((s) => s.dedupe_key),
    );

    uploaded += validSamples.length;
  }

  const remaining = (
    await peekPendingAndroidLocationSamplesAsync(
      userId,
      Number.MAX_SAFE_INTEGER,
    )
  ).length;
  return { uploaded, remaining };
}

/**
 * Diagnostic function to check why Android background location might not be working.
 * Returns detailed status of all prerequisites and identifies blocking issues.
 */
export async function getAndroidLocationDiagnostics(): Promise<{
  support: AndroidLocationSupportStatus;
  androidApiLevel: number | null;
  locationModule: boolean;
  servicesEnabled: boolean;
  foregroundPermission: string;
  backgroundPermission: string;
  notificationsPermission: AndroidPermissionStatus;
  notificationsRequired: boolean;
  taskStarted: boolean;
  pendingSamples: number;
  lastSampleTimestamp: string | null;
  sampleCount24h: number;
  lastTaskHeartbeat: TaskHeartbeat | null;
  lastTaskFiredAt: string | null;
  lastTaskQueuedCount: number | null;
  lastTaskError: string | null;
  errors: string[];
  canStart: boolean;
}> {
  const errors: string[] = [];
  const diagnostics = {
    support: getAndroidLocationSupportStatus(),
    androidApiLevel: getAndroidApiLevel(),
    locationModule: false,
    servicesEnabled: false,
    foregroundPermission: "unknown",
    backgroundPermission: "unknown",
    notificationsPermission: "undetermined" as AndroidPermissionStatus,
    notificationsRequired: false,
    taskStarted: false,
    pendingSamples: 0,
    lastSampleTimestamp: null as string | null,
    sampleCount24h: 0,
    lastTaskHeartbeat: null as TaskHeartbeat | null,
    lastTaskFiredAt: null as string | null,
    lastTaskQueuedCount: null as number | null,
    lastTaskError: null as string | null,
    errors,
    canStart: false,
  };

  if (__DEV__) {
    console.log("📍 [diag] Starting Android location diagnostics...");
    console.log(`📍 [diag] Support status: ${diagnostics.support}`);
  }

  if (diagnostics.support !== "available") {
    errors.push(
      `Support status: ${diagnostics.support} (expected: 'available')`,
    );
    return diagnostics;
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    errors.push(
      "Location module not loaded - native module missing or not available",
    );
    if (__DEV__) console.log("📍 [diag] Location module: FAILED to load");
    return diagnostics;
  }
  diagnostics.locationModule = true;
  if (__DEV__) console.log("📍 [diag] Location module: loaded");

  diagnostics.servicesEnabled = await Location.hasServicesEnabledAsync();
  if (__DEV__)
    console.log(`📍 [diag] Services enabled: ${diagnostics.servicesEnabled}`);
  if (!diagnostics.servicesEnabled) {
    errors.push(
      "Location services disabled on device - enable in Settings > Location",
    );
  }

  const fg = await Location.getForegroundPermissionsAsync();
  diagnostics.foregroundPermission = fg.status;
  if (__DEV__) console.log(`📍 [diag] Foreground permission: ${fg.status}`);
  if (fg.status !== "granted") {
    errors.push(`Foreground permission: ${fg.status} (required: 'granted')`);
  }

  const bg = await getBackgroundPermissionsSafeAsync(Location);
  diagnostics.backgroundPermission = bg.status;
  if (__DEV__) console.log(`📍 [diag] Background permission: ${bg.status}`);
  if (bg.status !== "granted") {
    errors.push(
      `Background permission: ${bg.status} (required: 'granted') - may need to enable in Settings`,
    );
  }

  const notifications = await getAndroidNotificationPermissionStatusAsync();
  diagnostics.notificationsPermission = notifications.status;
  diagnostics.notificationsRequired = notifications.required;
  if (notifications.required && notifications.status !== "granted") {
    errors.push(
      `Notifications permission: ${notifications.status} (required for foreground service on Android 13+)`,
    );
  }

  diagnostics.taskStarted = await Location.hasStartedLocationUpdatesAsync(
    ANDROID_BACKGROUND_LOCATION_TASK_NAME,
  );
  if (__DEV__)
    console.log(`📍 [diag] Task started: ${diagnostics.taskStarted}`);

  // Note: taskStarted=false with no errors is EXPECTED — it means we CAN start.
  // Only warn if task is not started but there are stale pending samples.
  if (!diagnostics.taskStarted && errors.length === 0) {
    if (__DEV__)
      console.log(
        "📍 [diag] All prerequisites passed, task not yet started — canStart will be true",
      );
  }

  // Check pending samples and gather sample statistics
  try {
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    if (userId) {
      const pending = await peekPendingAndroidLocationSamplesAsync(
        userId,
        MAX_PENDING_SAMPLES_PER_USER,
      );
      diagnostics.pendingSamples = pending.length;

      if (pending.length > 0) {
        // Find the most recent sample timestamp
        const sorted = [...pending].sort(
          (a, b) =>
            new Date(b.recorded_at).getTime() -
            new Date(a.recorded_at).getTime(),
        );
        diagnostics.lastSampleTimestamp = sorted[0].recorded_at;

        // Count samples within last 24 hours
        const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
        diagnostics.sampleCount24h = pending.filter(
          (s) => new Date(s.recorded_at).getTime() >= cutoff24h,
        ).length;

        if (__DEV__) {
          console.log(`📍 [diag] Pending samples: ${pending.length}`);
          console.log(
            `📍 [diag] Last sample at: ${diagnostics.lastSampleTimestamp}`,
          );
          console.log(
            `📍 [diag] Samples in last 24h: ${diagnostics.sampleCount24h}`,
          );
        }
      } else {
        if (__DEV__)
          console.log(
            "📍 [diag] Pending samples: 0 (no location data collected)",
          );
      }

      if (pending.length > 0 && !diagnostics.taskStarted) {
        errors.push(
          `Found ${pending.length} pending samples but task not started - samples may be stale`,
        );
      }
    } else {
      if (__DEV__)
        console.log(
          "📍 [diag] No authenticated user — cannot check pending samples",
        );
    }
  } catch (error) {
    errors.push(
      `Failed to check pending samples: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    diagnostics.lastTaskHeartbeat = await getLastTaskHeartbeat();
  } catch {
    // ignore
  }

  try {
    const metadata = await getAndroidLocationTaskMetadata();
    diagnostics.lastTaskFiredAt = metadata.lastTaskFiredAt;
    diagnostics.lastTaskQueuedCount = metadata.lastTaskQueuedCount;
    diagnostics.lastTaskError = metadata.lastTaskError;
  } catch {
    // ignore
  }

  // canStart = all prerequisites met AND task not already running
  diagnostics.canStart = errors.length === 0 && !diagnostics.taskStarted;
  if (__DEV__) {
    console.log(
      `📍 [diag] canStart: ${diagnostics.canStart} (errors=${errors.length}, taskStarted=${diagnostics.taskStarted})`,
    );
    if (errors.length > 0) {
      console.log(`📍 [diag] Blocking errors: ${errors.join("; ")}`);
    }
  }

  return diagnostics;
}

export async function openAndroidBatteryOptimizationSettingsAsync(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const intentUrls = [
    "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
    "android.settings.BATTERY_SAVER_SETTINGS",
  ];

  for (const url of intentUrls) {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
  }

  await Linking.openSettings();
  return false;
}
