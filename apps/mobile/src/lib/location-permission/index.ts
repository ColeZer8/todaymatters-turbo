/**
 * Location Permission Utilities
 *
 * Provides functions for checking location permission status without requesting,
 * tracking when users were last prompted to enable location, and determining
 * if location data is available for ingestion.
 *
 * Used by US-027 to handle location permission denied gracefully.
 */

import { Platform, Linking } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================================
// Constants
// ============================================================================

/** AsyncStorage key for tracking when user was last prompted */
const LAST_PROMPT_KEY = "tm:locationPermission:lastPromptDate";

/** Minimum time between prompts (1 week in milliseconds) */
const MIN_PROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface LocationPermissionStatus {
  /** Whether foreground location is granted */
  foregroundGranted: boolean;
  /** Whether background location is granted (needed for ingestion) */
  backgroundGranted: boolean;
  /** Whether location services are enabled on the device */
  servicesEnabled: boolean;
  /** Whether the expo-location module is available */
  hasModule: boolean;
  /** Whether we can ask the user again (haven't permanently denied) */
  canAskAgain: boolean;
  /** Detailed status for foreground permission */
  foregroundStatus: "granted" | "denied" | "undetermined";
  /** Detailed status for background permission */
  backgroundStatus: "granted" | "denied" | "undetermined";
}

export interface LocationPromptState {
  /** Date of the last prompt shown to the user (ISO string) */
  lastPromptDate: string | null;
  /** Whether enough time has passed to show another prompt */
  canShowPrompt: boolean;
  /** Days until next prompt can be shown (0 if canShowPrompt is true) */
  daysUntilNextPrompt: number;
}

// ============================================================================
// Module loading (matches iOS/Android location patterns)
// ============================================================================

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

// ============================================================================
// Permission Status
// ============================================================================

/**
 * Get the current location permission status without requesting permissions.
 * This is a read-only check that won't trigger any permission dialogs.
 */
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  const defaultStatus: LocationPermissionStatus = {
    foregroundGranted: false,
    backgroundGranted: false,
    servicesEnabled: false,
    hasModule: false,
    canAskAgain: true,
    foregroundStatus: "undetermined",
    backgroundStatus: "undetermined",
  };

  // Only run on iOS/Android
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return defaultStatus;
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    return { ...defaultStatus, hasModule: false };
  }

  // Check if location services are enabled
  let servicesEnabled = false;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    servicesEnabled = false;
  }

  // Get foreground permission status (doesn't request)
  let foreground;
  try {
    foreground = await Location.getForegroundPermissionsAsync();
  } catch {
    foreground = { status: "denied" as const, canAskAgain: false };
  }

  // Get background permission status (doesn't request)
  let background;
  try {
    background = await Location.getBackgroundPermissionsAsync();
  } catch {
    background = { status: "denied" as const, canAskAgain: false };
  }

  return {
    foregroundGranted: foreground.status === "granted",
    backgroundGranted: background.status === "granted",
    servicesEnabled,
    hasModule: true,
    canAskAgain:
      (typeof foreground.canAskAgain === "boolean"
        ? foreground.canAskAgain
        : true) ||
      (typeof background.canAskAgain === "boolean"
        ? background.canAskAgain
        : true),
    foregroundStatus: foreground.status,
    backgroundStatus: background.status,
  };
}

/**
 * Check if location data is available for ingestion.
 * Returns true if both foreground and background permissions are granted.
 */
export async function isLocationAvailableForIngestion(): Promise<boolean> {
  const status = await getLocationPermissionStatus();
  return (
    status.hasModule &&
    status.servicesEnabled &&
    status.foregroundGranted &&
    status.backgroundGranted
  );
}

/**
 * Check if location permission is completely denied (not just not-yet-requested).
 * Returns true if the user has explicitly denied permission.
 */
export async function isLocationPermissionDenied(): Promise<boolean> {
  const status = await getLocationPermissionStatus();
  // Denied = not granted AND can't ask again (or explicitly denied)
  return (
    !status.backgroundGranted &&
    (status.backgroundStatus === "denied" || !status.canAskAgain)
  );
}

// ============================================================================
// Prompt Tracking
// ============================================================================

/**
 * Get the current state of the location permission prompt.
 * Tracks when the user was last shown the prompt and whether it's time to show again.
 */
export async function getLocationPromptState(): Promise<LocationPromptState> {
  try {
    const lastPromptDate = await AsyncStorage.getItem(LAST_PROMPT_KEY);

    if (!lastPromptDate) {
      return {
        lastPromptDate: null,
        canShowPrompt: true,
        daysUntilNextPrompt: 0,
      };
    }

    const lastPromptTime = new Date(lastPromptDate).getTime();
    const now = Date.now();
    const timeSincePrompt = now - lastPromptTime;
    const timeUntilNextPrompt = MIN_PROMPT_INTERVAL_MS - timeSincePrompt;

    if (timeUntilNextPrompt <= 0) {
      return {
        lastPromptDate,
        canShowPrompt: true,
        daysUntilNextPrompt: 0,
      };
    }

    const daysUntilNextPrompt = Math.ceil(
      timeUntilNextPrompt / (24 * 60 * 60 * 1000)
    );

    return {
      lastPromptDate,
      canShowPrompt: false,
      daysUntilNextPrompt,
    };
  } catch {
    // If we can't read storage, allow showing prompt
    return {
      lastPromptDate: null,
      canShowPrompt: true,
      daysUntilNextPrompt: 0,
    };
  }
}

/**
 * Record that we showed the location permission prompt.
 * Should be called when the prompt is dismissed (either way).
 */
export async function recordLocationPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_PROMPT_KEY, new Date().toISOString());
  } catch {
    // Ignore storage errors - worst case we show prompt again sooner
    if (__DEV__) {
      console.warn(
        "[LocationPermission] Failed to record prompt shown date"
      );
    }
  }
}

/**
 * Clear the prompt tracking (for testing or reset scenarios).
 */
export async function clearLocationPromptTracking(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_PROMPT_KEY);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Open the device settings so the user can enable location permissions.
 */
export function openLocationSettings(): void {
  Linking.openSettings();
}

// ============================================================================
// Combined Check for Showing Prompt
// ============================================================================

/**
 * Determine if we should show the location permission prompt.
 * Returns true if:
 * 1. Location permission is not granted
 * 2. Enough time has passed since the last prompt (1 week)
 * 3. We might be able to ask again (not permanently denied with no recourse)
 */
export async function shouldShowLocationPrompt(): Promise<{
  shouldShow: boolean;
  reason: string;
  permissionStatus: LocationPermissionStatus;
  promptState: LocationPromptState;
}> {
  const [permissionStatus, promptState] = await Promise.all([
    getLocationPermissionStatus(),
    getLocationPromptState(),
  ]);

  // If location is already available, no need for prompt
  if (
    permissionStatus.foregroundGranted &&
    permissionStatus.backgroundGranted
  ) {
    return {
      shouldShow: false,
      reason: "location_already_granted",
      permissionStatus,
      promptState,
    };
  }

  // If not enough time has passed, don't show
  if (!promptState.canShowPrompt) {
    return {
      shouldShow: false,
      reason: `wait_${promptState.daysUntilNextPrompt}_more_days`,
      permissionStatus,
      promptState,
    };
  }

  // Show the prompt - user can go to settings even if canAskAgain is false
  return {
    shouldShow: true,
    reason: "eligible_for_prompt",
    permissionStatus,
    promptState,
  };
}
