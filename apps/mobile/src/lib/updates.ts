/**
 * EAS Update utilities for checking and applying updates
 *
 * Note: Updates only work in EAS-built apps, not in local dev builds (expo run:android/ios)
 */

import * as Updates from "expo-updates";
import Constants from "expo-constants";

/**
 * Checks if updates are enabled in this build
 */
export function isUpdateEnabled(): boolean {
  // Updates are disabled in development mode
  if (__DEV__) {
    return false;
  }

  // Check if Updates is available and enabled
  return Updates.isEnabled;
}

/**
 * Get detailed update diagnostics
 */
export function getUpdateDiagnostics() {
  const isDev = __DEV__;
  const updatesEnabled = Updates.isEnabled;
  const updateId = Updates.updateId;
  const channel = Updates.channel;
  const runtimeVersion = Updates.runtimeVersion;
  const isEmbeddedLaunch = Updates.isEmbeddedLaunch;

  // Check if this is an EAS build
  const isEasBuild = Constants.executionEnvironment === "standalone" && !isDev;

  // Get update URL from config
  const updateUrl = Constants.expoConfig?.updates?.url || "Not configured";

  return {
    isDev,
    updatesEnabled,
    isEasBuild,
    updateId: updateId || "None",
    channel: channel || "None",
    runtimeVersion: runtimeVersion || "None",
    isEmbeddedLaunch,
    updateUrl,
    executionEnvironment: Constants.executionEnvironment,
  };
}

/**
 * Manually check for and apply updates
 * Returns true if an update was applied, false otherwise
 */
export async function checkAndApplyUpdate(): Promise<{
  applied: boolean;
  error?: string;
}> {
  // Updates don't work in dev mode
  if (__DEV__) {
    return {
      applied: false,
      error: "Updates are disabled in development mode",
    };
  }

  // Check if updates are enabled
  if (!Updates.isEnabled) {
    return { applied: false, error: "Updates are not enabled in this build" };
  }

  try {
    // Check for available update
    const update = await Updates.checkForUpdateAsync();

    if (!update.isAvailable) {
      return { applied: false };
    }

    // Download and apply the update
    await Updates.fetchUpdateAsync();

    // Reload the app to apply the update
    await Updates.reloadAsync();

    return { applied: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to check/apply update:", errorMessage);
    return { applied: false, error: errorMessage };
  }
}

/**
 * Get update information (channel, runtime version, etc.)
 */
export function getUpdateInfo() {
  if (__DEV__ || !Updates.isEnabled) {
    return null;
  }

  return {
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
}
