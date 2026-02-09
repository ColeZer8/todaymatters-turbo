import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { Location, Subscription, AuthorizationStatus } from "react-native-background-geolocation";
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

  try {
    return await import("react-native-background-geolocation");
  } catch {
    return null;
  }
}

async function ensureTransistorReadyAsync(
  BackgroundGeolocation: typeof import("react-native-background-geolocation"),
): Promise<void> {
  if (transistorReady) return;

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
  return SHOULD_USE_TRANSISTOR_LOCATION && Platform.OS === "ios";
}

export async function requestIosLocationPermissionsWithProviderAsync() {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    return requestLegacyIosLocationPermissionsAsync();
  }

  try {
    await ensureTransistorReadyAsync(BackgroundGeolocation);
    const status = await BackgroundGeolocation.requestPermission();
    const mapped = mapTransistorAuthorizationStatus(status);

    return {
      ...mapped,
      notifications: "granted" as const,
      canAskAgainNotifications: true,
      notificationsRequired: false,
      hasNativeModule: true,
    };
  } catch {
    return requestLegacyIosLocationPermissionsAsync();
  }
}

export async function startIosBackgroundLocationWithProviderAsync(): Promise<void> {
  const BackgroundGeolocation = await loadTransistorAsync();
  if (!BackgroundGeolocation) {
    await startLegacyIosBackgroundLocationAsync();
    return;
  }

  try {
    await ensureTransistorReadyAsync(BackgroundGeolocation);

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
  } catch {
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
  } catch {
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

  try {
    await ensureTransistorReadyAsync(BackgroundGeolocation);
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
  } catch {
    return captureLegacyIosLocationSampleNowAsync(userId, options);
  }
}

export { flushPendingLocationSamplesToSupabaseAsync };
