import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Types inlined to avoid Metro resolving native module at bundle time
type Location = { coords: any; timestamp: any; uuid?: string; age?: number; is_moving?: boolean; event?: string; activity?: any; provider?: any; mock?: boolean };
type Subscription = { remove: () => void };
type AuthorizationStatus = number;
import {
  requestIosLocationPermissionsAsync as requestLegacyIosLocationPermissionsAsync,
  startIosBackgroundLocationAsync as startLegacyIosBackgroundLocationAsync,
  stopIosBackgroundLocationAsync as stopLegacyIosBackgroundLocationAsync,
  captureIosLocationSampleNowAsync as captureLegacyIosLocationSampleNowAsync,
  flushPendingLocationSamplesToSupabaseAsync,
} from "@/lib/ios-location";
import { enqueueLocationSamplesForUserAsync } from "@/lib/ios-location/queue";
import type { IosLocationSample } from "@/lib/ios-location/types";
import { useAuthStore } from "@/stores";

const SHOULD_USE_TRANSISTOR_LOCATION =
  process.env.EXPO_PUBLIC_USE_TRANSISTOR_LOCATION === "true";

let transistorReady = false;
let transistorLocationSubscription: Subscription | null = null;
let transistorFallbackActivated = false;
let transistorInitLogPrinted = false;

type TransistorInitStep =
  | "module_load"
  | "ready"
  | "request_permission"
  | "start"
  | "stop"
  | "capture_now";

type TransistorErrorKind =
  | "license_or_token_invalid"
  | "native_module_unavailable"
  | "permission_error"
  | "configuration_error"
  | "runtime_error";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return error.name || "Unknown error";
  }

  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : "Unknown error";
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function classifyTransistorError(
  step: TransistorInitStep,
  error: unknown,
): TransistorErrorKind {
  const rawCode =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? ((error as { code: string }).code ?? "")
      : "";
  const haystack = `${rawCode} ${errorMessage(error)}`.toLowerCase();

  if (
    /license|licen[cs]e|token|unauthori[sz]ed|not authorized|forbidden|invalid key|invalid api key|401|403/.test(
      haystack,
    )
  ) {
    return "license_or_token_invalid";
  }

  if (
    /native module|module not found|cannot find module|null is not an object|unimplemented/.test(
      haystack,
    )
  ) {
    return "native_module_unavailable";
  }

  if (/permission|denied|restricted|not allowed/.test(haystack)) {
    return "permission_error";
  }

  if (
    step === "module_load" ||
    step === "ready" ||
    /config|configuration|missing|invalid/.test(haystack)
  ) {
    return "configuration_error";
  }

  return "runtime_error";
}

function logTransistorDiagnostic(
  step: TransistorInitStep,
  error: unknown,
  fallbackActivated: boolean,
): void {
  const kind = classifyTransistorError(step, error);
  const message = errorMessage(error);

  console.warn(
    `📍 [ios-transistor] ${step} failed (${kind}): ${message}; fallbackActivated=${fallbackActivated}`,
  );
}

function activateTransistorFallback(step: TransistorInitStep, error: unknown): void {
  transistorReady = false;
  transistorFallbackActivated = true;

  transistorLocationSubscription?.remove();
  transistorLocationSubscription = null;

  logTransistorDiagnostic(step, error, true);
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
  if (value < 0) return null;
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

function toSample(
  location: Location,
  sourceMeta: { collected_via: "transistor_event" | "transistor_foreground_poll" },
): Omit<IosLocationSample, "dedupe_key"> | null {
  const latitude = location.coords.latitude;
  const longitude = location.coords.longitude;

  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) return null;
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180)
    return null;

  // Extract activity data from Transistorsoft location object
  // Fix #1: Activity Type Extraction - enables walking detection at places like dog parks
  const activity = location.activity as { type?: string; confidence?: number } | undefined;
  let activityType: string | null = null;
  let activityConfidence: number | null = null;

  if (activity && typeof activity === "object") {
    // Transistorsoft activity format: { type: 'walking', confidence: 75 }
    if (typeof activity.type === "string" && activity.type.length > 0) {
      activityType = activity.type;
    }
    if (
      typeof activity.confidence === "number" &&
      Number.isFinite(activity.confidence)
    ) {
      activityConfidence = Math.round(
        Math.min(100, Math.max(0, activity.confidence)),
      );
    }
  }

  return {
    recorded_at: location.timestamp,
    latitude,
    longitude,
    accuracy_m: normalizeNonNegative(location.coords.accuracy),
    altitude_m: isFiniteNumber(location.coords.altitude)
      ? location.coords.altitude
      : null,
    speed_mps: normalizeNonNegative(location.coords.speed),
    heading_deg: normalizeHeadingDeg(location.coords.heading),
    is_mocked: typeof location.mock === "boolean" ? location.mock : null,
    source: "background",
    // Activity detection fields (Fix #1)
    activity_type: activityType,
    activity_confidence: activityConfidence,
    is_moving: typeof location.is_moving === "boolean" ? location.is_moving : null,
    raw: normalizeRaw({
      ...sourceMeta,
      uuid: location.uuid,
      age: location.age,
      is_moving: location.is_moving,
      event: location.event,
      coords: location.coords,
      activity: location.activity,
      provider: location.provider,
    }),
  };
}

async function loadTransistorAsync(): Promise<typeof import("react-native-background-geolocation") | null> {
  if (Platform.OS !== "ios") return null;
  if (!SHOULD_USE_TRANSISTOR_LOCATION) return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return null;
  if (transistorFallbackActivated) return null;

  try {
    const mod = await import("react-native-background-geolocation");
    // Dynamic import returns module wrapper — .default has the actual API
    return (mod as any).default ?? mod;
  } catch (error) {
    activateTransistorFallback("module_load", error);
    return null;
  }
}

async function ensureTransistorReadyAsync(
  BackgroundGeolocation: typeof import("react-native-background-geolocation"),
): Promise<boolean> {
  if (transistorReady) return true;
  if (transistorFallbackActivated) return false;

  if (!transistorInitLogPrinted) {
    transistorInitLogPrinted = true;
    console.log(
      `📍 [ios-transistor] init: appVersion=${Constants.nativeAppVersion ?? "unknown"} build=${Constants.nativeBuildVersion ?? "unknown"} useTransistor=${SHOULD_USE_TRANSISTOR_LOCATION}`,
    );
  }

  try {
    await BackgroundGeolocation.ready({
      geolocation: {
        desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.Medium,
        distanceFilter: 75,
        stopTimeout: 5,
        locationAuthorizationRequest: "Always",
        pausesLocationUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: false,
        activityType: BackgroundGeolocation.ActivityType.Other,
      },
      app: {
        stopOnTerminate: false,
        startOnBoot: true,
        preventSuspend: true,
      },
    });

    transistorReady = true;
    console.log("📍 [ios-transistor] ready: success");
    return true;
  } catch (error) {
    activateTransistorFallback("ready", error);
    return false;
  }
}

function mapTransistorAuthorizationStatus(status: AuthorizationStatus): {
  foreground: "granted" | "denied" | "undetermined";
  background: "granted" | "denied" | "undetermined";
  canAskAgainForeground: boolean;
  canAskAgainBackground: boolean;
} {
  const moduleAny = status as number;
  const NotDetermined = 0;
  const Restricted = 1;
  const Denied = 2;
  const Always = 3;
  const WhenInUse = 4;

  if (moduleAny === Always) {
    return {
      foreground: "granted",
      background: "granted",
      canAskAgainForeground: true,
      canAskAgainBackground: true,
    };
  }

  if (moduleAny === WhenInUse) {
    return {
      foreground: "granted",
      background: "denied",
      canAskAgainForeground: true,
      canAskAgainBackground: true,
    };
  }

  if (moduleAny === NotDetermined) {
    return {
      foreground: "undetermined",
      background: "undetermined",
      canAskAgainForeground: true,
      canAskAgainBackground: true,
    };
  }

  if (moduleAny === Restricted || moduleAny === Denied) {
    return {
      foreground: "denied",
      background: "denied",
      canAskAgainForeground: false,
      canAskAgainBackground: false,
    };
  }

  return {
    foreground: "denied",
    background: "denied",
    canAskAgainForeground: false,
    canAskAgainBackground: false,
  };
}

export function isUsingTransistorLocationProvider(): boolean {
  return (
    SHOULD_USE_TRANSISTOR_LOCATION &&
    Platform.OS === "ios" &&
    !transistorFallbackActivated
  );
}

export async function requestIosLocationPermissionsWithProviderAsync() {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return requestLegacyIosLocationPermissionsAsync();
  }

  const ready = await ensureTransistorReadyAsync(BackgroundGeolocation);
  if (!ready) {
    return requestLegacyIosLocationPermissionsAsync();
  }

  try {
    const status = await BackgroundGeolocation.requestPermission();
    const mapped = mapTransistorAuthorizationStatus(status);

    return {
      ...mapped,
      notifications: "granted" as const,
      canAskAgainNotifications: true,
      notificationsRequired: false,
      hasNativeModule: true,
    };
  } catch (error) {
    activateTransistorFallback("request_permission", error);
    return requestLegacyIosLocationPermissionsAsync();
  }
}

export async function startIosBackgroundLocationWithProviderAsync(): Promise<void> {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    await startLegacyIosBackgroundLocationAsync();
    return;
  }

  const ready = await ensureTransistorReadyAsync(BackgroundGeolocation);
  if (!ready) {
    await startLegacyIosBackgroundLocationAsync();
    return;
  }

  try {
    if (!transistorLocationSubscription) {
      transistorLocationSubscription = BackgroundGeolocation.onLocation(
        (location) => {
          const userId = useAuthStore.getState().user?.id ?? null;
          if (!userId) return;
          const sample = toSample(location, { collected_via: "transistor_event" });
          if (!sample) return;
          void enqueueLocationSamplesForUserAsync(userId, [sample]);
        },
      );
    }

    const state = await BackgroundGeolocation.getState();
    if (!state.enabled) {
      await BackgroundGeolocation.start();
    }
  } catch (error) {
    activateTransistorFallback("start", error);
    await startLegacyIosBackgroundLocationAsync();
  }
}

export async function stopIosBackgroundLocationWithProviderAsync(): Promise<void> {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    await stopLegacyIosBackgroundLocationAsync();
    return;
  }

  try {
    transistorLocationSubscription?.remove();
    transistorLocationSubscription = null;
    await BackgroundGeolocation.stop();
  } catch (error) {
    logTransistorDiagnostic("stop", error, transistorFallbackActivated);
    await stopLegacyIosBackgroundLocationAsync();
  }
}

export async function captureIosLocationSampleNowWithProviderAsync(
  userId: string,
  options: { flushToSupabase?: boolean } = {},
) {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return captureLegacyIosLocationSampleNowAsync(userId, options);
  }

  const ready = await ensureTransistorReadyAsync(BackgroundGeolocation);
  if (!ready) {
    return captureLegacyIosLocationSampleNowAsync(userId, options);
  }

  try {
    const location = await BackgroundGeolocation.getCurrentPosition({
      samples: 1,
      persist: false,
      timeout: 30,
    });

    const sample = toSample(location, {
      collected_via: "transistor_foreground_poll",
    });
    if (!sample) return { ok: false as const, reason: "error" as const };

    const enqueueResult = await enqueueLocationSamplesForUserAsync(userId, [sample]);

    if (options.flushToSupabase) {
      const flush = await flushPendingLocationSamplesToSupabaseAsync(userId);
      return {
        ok: true as const,
        enqueued: enqueueResult.enqueued,
        uploaded: flush.uploaded,
        remaining: flush.remaining,
      };
    }

    return { ok: true as const, enqueued: enqueueResult.enqueued };
  } catch (error) {
    logTransistorDiagnostic("capture_now", error, transistorFallbackActivated);
    return captureLegacyIosLocationSampleNowAsync(userId, options);
  }
}

export { flushPendingLocationSamplesToSupabaseAsync };

export {
  clearPendingLocationSamplesAsync,
  IOS_DEFAULT_TRACKING_PROFILE,
} from "@/lib/ios-location";
export type { IosLocationSample } from "@/lib/ios-location";
