import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Types inlined to avoid Metro resolving native module at bundle time
type Location = { coords: any; timestamp: any; uuid?: string; age?: number; is_moving?: boolean; event?: string; activity?: any; provider?: any; mock?: boolean };
type Subscription = { remove: () => void };
type AuthorizationStatus = number;
import {
  requestAndroidLocationPermissionsAsync as requestLegacyAndroidLocationPermissionsAsync,
  startAndroidBackgroundLocationAsync as startLegacyAndroidBackgroundLocationAsync,
  stopAndroidBackgroundLocationAsync as stopLegacyAndroidBackgroundLocationAsync,
  isAndroidBackgroundLocationRunningAsync as isLegacyAndroidBackgroundLocationRunningAsync,
  captureAndroidLocationSampleNowAsync as captureLegacyAndroidLocationSampleNowAsync,
  getAndroidLocationDiagnostics as getLegacyAndroidLocationDiagnostics,
  enqueueAndroidLocationSamplesForUserAsync,
} from "@/lib/android-location";
import type {
  StartAndroidLocationResult,
  AndroidLocationSample,
  TaskHeartbeat,
} from "@/lib/android-location";
import { useAuthStore } from "@/stores";

const SHOULD_USE_TRANSISTOR_LOCATION =
  process.env.EXPO_PUBLIC_USE_TRANSISTOR_LOCATION === "true";

let transistorReady = false;
let transistorLocationSubscription: Subscription | null = null;
let transistorActivitySubscription: Subscription | null = null;
let lastTransistorSampleAt: string | null = null;
let lastTransistorActivity: string | null = null;

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

function normalizeRaw(value: unknown): AndroidLocationSample["raw"] {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as AndroidLocationSample["raw"];
  } catch {
    return null;
  }
}

function toRecordedAt(value: unknown): string | null {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (isFiniteNumber(value)) {
    return new Date(value).toISOString();
  }
  return null;
}

function toSample(
  location: Location,
  sourceMeta: {
    collected_via: "transistor_event" | "transistor_foreground_poll";
  },
): Omit<AndroidLocationSample, "dedupe_key"> | null {
  const latitude = location.coords.latitude;
  const longitude = location.coords.longitude;
  const recorded_at = toRecordedAt(location.timestamp);

  if (!recorded_at) return null;
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) return null;
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180)
    return null;

  return {
    recorded_at,
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

async function loadTransistorAsync(): Promise<
  typeof import("react-native-background-geolocation") | null
> {
  if (Platform.OS !== "android") return null;
  if (!SHOULD_USE_TRANSISTOR_LOCATION) return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return null;

  try {
    const mod = await import("react-native-background-geolocation");
    // Dynamic import returns module wrapper — .default has the actual API
    const resolved = (mod as any).default ?? mod;
    console.log("📍 [transistor] Module loaded successfully, has ready:", typeof resolved.ready);
    return resolved;
  } catch (e) {
    console.warn("📍 [transistor] Failed to load module:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function ensureTransistorReadyAsync(
  BackgroundGeolocation: typeof import("react-native-background-geolocation"),
): Promise<void> {
  if (transistorReady) return;

  const BG = BackgroundGeolocation as any;
  console.log("📍 [transistor] Calling ready()... has ready:", typeof BG.ready);
  try {
    await BG.ready({
      reset: false,
      desiredAccuracy: BG.DesiredAccuracy?.Medium ?? 10,
      distanceFilter: 50,
      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      preventSuspend: true,
      debug: true,
      notification: {
        title: "TodayMatters is tracking your day",
        text: "Used to build an hour-by-hour view of your day for schedule comparison.",
        color: "#2563EB",
      },
    });
    console.log("📍 [transistor] ready() succeeded ✅");
  } catch (readyErr) {
    console.error("📍 [transistor] ready() FAILED:", readyErr instanceof Error ? readyErr.message : String(readyErr));
    throw readyErr;
  }

  transistorReady = true;
}

function mapTransistorAuthorizationStatus(status: AuthorizationStatus): {
  foreground: "granted" | "denied" | "undetermined";
  background: "granted" | "denied" | "undetermined";
  canAskAgainForeground: boolean;
  canAskAgainBackground: boolean;
} {
  const value = status as number;
  const NotDetermined = 0;
  const Restricted = 1;
  const Denied = 2;
  const Always = 3;
  const WhenInUse = 4;

  if (value === Always) {
    return {
      foreground: "granted",
      background: "granted",
      canAskAgainForeground: true,
      canAskAgainBackground: true,
    };
  }

  if (value === WhenInUse) {
    return {
      foreground: "granted",
      background: "denied",
      canAskAgainForeground: true,
      canAskAgainBackground: true,
    };
  }

  if (value === NotDetermined) {
    return {
      foreground: "undetermined",
      background: "undetermined",
      canAskAgainForeground: true,
      canAskAgainBackground: true,
    };
  }

  if (value === Restricted || value === Denied) {
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

function summarizeActivity(event: { activity?: unknown; confidence?: unknown }): string {
  const activity = typeof event.activity === "string" ? event.activity : "unknown";
  const confidence =
    typeof event.confidence === "number" ? ` (${event.confidence})` : "";
  return `${activity}${confidence}`;
}

export function isUsingTransistorLocationProviderOnAndroid(): boolean {
  return SHOULD_USE_TRANSISTOR_LOCATION && Platform.OS === "android";
}

export async function requestAndroidLocationPermissionsWithProviderAsync() {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return requestLegacyAndroidLocationPermissionsAsync();
  }

  try {
    await ensureTransistorReadyAsync(BackgroundGeolocation);
    const BG = BackgroundGeolocation as any;
    const status = (await BG.requestPermission()) as AuthorizationStatus;
    const mapped = mapTransistorAuthorizationStatus(status);

    return {
      ...mapped,
      notifications: "granted" as const,
      canAskAgainNotifications: true,
      notificationsRequired: false,
      hasNativeModule: true,
    };
  } catch {
    return requestLegacyAndroidLocationPermissionsAsync();
  }
}

export async function startAndroidBackgroundLocationWithProviderAsync(): Promise<StartAndroidLocationResult> {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return startLegacyAndroidBackgroundLocationAsync();
  }

  try {
    await ensureTransistorReadyAsync(BackgroundGeolocation);
    const BG = BackgroundGeolocation as any;

    if (!transistorLocationSubscription) {
      console.log("📍 [transistor] Setting up onLocation listener...");
      transistorLocationSubscription = BG.onLocation((location: Location) => {
        console.log("📍 [transistor] 🔥 onLocation fired!", JSON.stringify({ lat: location?.coords?.latitude, lng: location?.coords?.longitude, ts: location?.timestamp }));
        const userId = useAuthStore.getState().user?.id ?? null;
        if (!userId) { console.warn("📍 [transistor] No userId, skipping"); return; }
        const sample = toSample(location, { collected_via: "transistor_event" });
        if (!sample) { console.warn("📍 [transistor] toSample returned null"); return; }

        lastTransistorSampleAt = sample.recorded_at;
        if ((location as any).activity?.type) {
          lastTransistorActivity = String((location as any).activity.type);
        }
        console.log("📍 [transistor] Enqueuing sample:", sample.recorded_at);
        void enqueueAndroidLocationSamplesForUserAsync(userId, [sample]);
      });
    }

    if (!transistorActivitySubscription) {
      transistorActivitySubscription = BG.onActivityChange((event: unknown) => {
        console.log("📍 [transistor] Activity changed:", JSON.stringify(event));
        lastTransistorActivity = summarizeActivity((event ?? {}) as { activity?: unknown; confidence?: unknown });
      });
    }

    const state = await BG.getState();
    console.log("📍 [transistor] State:", JSON.stringify({ enabled: state.enabled, isMoving: state.isMoving, trackingMode: state.trackingMode }));
    if (!state.enabled) {
      await BG.start();
      console.log("📍 [transistor] ✅ start() called successfully");
      return { ok: true, reason: "started" };
    }

    console.log("📍 [transistor] Already running, skipping start()");
    return { ok: true, reason: "already_running" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("📍 [transistor] start FAILED, falling back to legacy:", detail);
    return startLegacyAndroidBackgroundLocationAsync();
  }
}

export async function stopAndroidBackgroundLocationWithProviderAsync(): Promise<void> {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    await stopLegacyAndroidBackgroundLocationAsync();
    return;
  }

  try {
    const BG = BackgroundGeolocation as any;
    transistorLocationSubscription?.remove();
    transistorLocationSubscription = null;
    transistorActivitySubscription?.remove();
    transistorActivitySubscription = null;
    await BG.stop();
  } catch {
    await stopLegacyAndroidBackgroundLocationAsync();
  }
}

export async function isAndroidBackgroundLocationRunningWithProviderAsync(): Promise<boolean> {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return isLegacyAndroidBackgroundLocationRunningAsync();
  }

  try {
    const BG = BackgroundGeolocation as any;
    const state = await BG.getState();
    return !!state.enabled;
  } catch {
    return false;
  }
}

export async function captureAndroidLocationSampleNowWithProviderAsync(
  userId: string,
  options: { flushToSupabase?: boolean } = {},
) {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return captureLegacyAndroidLocationSampleNowAsync(userId, options);
  }

  try {
    await ensureTransistorReadyAsync(BackgroundGeolocation);
    const BG = BackgroundGeolocation as any;

    const location = (await BG.getCurrentPosition({
      timeout: 30,
      persist: false,
      samples: 1,
      desiredAccuracy: BG.DesiredAccuracy.High,
      maximumAge: 10_000,
    })) as Location;

    const sample = toSample(location, {
      collected_via: "transistor_foreground_poll",
    });
    if (!sample) return { ok: false as const, reason: "capture_failed" as const };

    lastTransistorSampleAt = sample.recorded_at;
    if (location.activity?.type) {
      lastTransistorActivity = String(location.activity.type);
    }

    const enqueueResult = await enqueueAndroidLocationSamplesForUserAsync(userId, [sample]);

    if (options.flushToSupabase) {
      const {
        flushPendingAndroidLocationSamplesToSupabaseAsync,
      } = await import("@/lib/android-location");
      const flushed = await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
      return {
        ok: true as const,
        enqueued: enqueueResult.enqueued,
        pendingAfterEnqueue: enqueueResult.pendingCount,
        uploaded: flushed.uploaded,
        remainingAfterFlush: flushed.remaining,
      };
    }

    return {
      ok: true as const,
      enqueued: enqueueResult.enqueued,
      pendingAfterEnqueue: enqueueResult.pendingCount,
    };
  } catch {
    return captureLegacyAndroidLocationSampleNowAsync(userId, options);
  }
}

export async function getAndroidLocationDiagnosticsWithProviderAsync(): Promise<{
  support: string;
  androidApiLevel: number | null;
  locationModule: boolean;
  servicesEnabled: boolean;
  foregroundPermission: string;
  backgroundPermission: string;
  notificationsPermission: "granted" | "denied" | "undetermined";
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
  activeProvider: "transistor" | "legacy_expo";
  transistorEnabledByFlag: boolean;
  lastProviderSampleAt: string | null;
  lastProviderActivity: string | null;
}> {
  const legacy = await getLegacyAndroidLocationDiagnostics();
  const usingTransistor = isUsingTransistorLocationProviderOnAndroid();

  if (!usingTransistor) {
    return {
      ...legacy,
      activeProvider: "legacy_expo",
      transistorEnabledByFlag: false,
      lastProviderSampleAt: legacy.lastSampleTimestamp,
      lastProviderActivity: null,
    };
  }

  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return {
      ...legacy,
      activeProvider: "legacy_expo",
      transistorEnabledByFlag: true,
      lastProviderSampleAt: legacy.lastSampleTimestamp,
      lastProviderActivity: null,
    };
  }

  try {
    await ensureTransistorReadyAsync(BackgroundGeolocation);
    const BG = BackgroundGeolocation as any;
    const state = await BG.getState();

    return {
      ...legacy,
      taskStarted: !!state.enabled,
      canStart: legacy.errors.length === 0 && !state.enabled,
      activeProvider: "transistor",
      transistorEnabledByFlag: true,
      lastProviderSampleAt: lastTransistorSampleAt ?? legacy.lastSampleTimestamp,
      lastProviderActivity:
        lastTransistorActivity ?? (state.isMoving ? "moving" : "stationary"),
    };
  } catch {
    return {
      ...legacy,
      activeProvider: "legacy_expo",
      transistorEnabledByFlag: true,
      lastProviderSampleAt: legacy.lastSampleTimestamp,
      lastProviderActivity: lastTransistorActivity,
    };
  }
}

export {
  flushPendingAndroidLocationSamplesToSupabaseAsync,
  clearPendingAndroidLocationSamplesAsync,
} from "@/lib/android-location";
