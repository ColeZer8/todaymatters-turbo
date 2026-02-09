import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { PermissionsTemplate } from "@/components/templates";
import {
  SETUP_SCREENS_STEPS,
  SETUP_SCREENS_TOTAL_STEPS,
} from "@/constants/setup-screens";
import {
  useOnboardingStore,
  type PermissionKey,
} from "@/stores/onboarding-store";
import { useOnboardingSync } from "@/lib/supabase/hooks";
import { requestIosLocationPermissionsAsync } from "@/lib/ios-location";
import {
  getAndroidNotificationPermissionStatusAsync,
  openAndroidNotificationSettingsAsync,
  requestAndroidNotificationPermissionsAsync,
  openAndroidBatteryOptimizationSettingsAsync,
} from "@/lib/android-location";
import { startIosBackgroundLocationAsync } from "@/lib/ios-location";
import {
  requestAndroidLocationPermissionsWithProviderAsync as requestAndroidLocationPermissionsAsync,
  startAndroidBackgroundLocationWithProviderAsync as startAndroidBackgroundLocationAsync,
} from "@/lib/location-provider/android";
import { useAuthStore } from "@/stores";
import {
  getAndroidInsightsSupportStatus,
  getUsageAccessAuthorizationStatusSafeAsync,
  openUsageAccessSettingsSafeAsync,
} from "@/lib/android-insights";
import {
  getIosInsightsSupportStatus,
  getScreenTimeAuthorizationStatusSafeAsync,
  requestScreenTimeAuthorizationSafeAsync,
  presentScreenTimeReportSafeAsync,
  getCachedScreenTimeSummarySafeAsync,
} from "@/lib/ios-insights";
import { syncIosScreenTimeSummary } from "@/lib/supabase/services/screen-time-sync";

export default function PermissionsScreen() {
  const router = useRouter();
  const [showIndividual, setShowIndividual] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<{
    status: "granted" | "denied" | "undetermined";
    required: boolean;
  }>({ status: "undetermined", required: false });

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const permissions = useOnboardingStore((state) => state.permissions);
  const togglePermission = useOnboardingStore(
    (state) => state.togglePermission,
  );
  const setAllPermissions = useOnboardingStore(
    (state) => state.setAllPermissions,
  );
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const { savePermissions } = useOnboardingSync({
    autoLoad: false,
    autoSave: false,
  });

  const ensureLocationPermissionIfNeeded =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== "ios" && Platform.OS !== "android") return true;

      try {
        const result =
          Platform.OS === "ios"
            ? await requestIosLocationPermissionsAsync()
            : await requestAndroidLocationPermissionsAsync();

        if (result.foreground === "granted" && result.background === "granted")
          return true;

        if (!result.hasNativeModule) {
          Alert.alert(
            "Location not available in this build",
            Platform.OS === "android"
              ? "This Android build is missing the native location module.\n\nThis usually means you only restarted Metro (expo start) and did not reinstall the native app.\n\nFix:\n- Delete the app from your device/emulator\n- Run: pnpm --filter mobile android:dev\n- Then run: pnpm dev -- --filter=mobile"
              : "This iOS dev build is missing the native location module.\n\nThis usually means you only restarted Metro (expo start) and did not reinstall the native app.\n\nFix:\n- Delete the app from your device/simulator\n- Run: pnpm --filter mobile ios:dev\n- Then run: pnpm dev -- --filter=mobile",
          );
          return false;
        }

        const canAskAgain =
          result.canAskAgainForeground || result.canAskAgainBackground;

        Alert.alert(
          "Location permission needed",
          Platform.OS === "android"
            ? "To compare your planned day to your actual day, please allow Location (including background). On some Android versions you may need to enable background location in Settings after granting while-in-use."
            : "To compare your planned day to your actual day, please allow Location (Always). If iOS won't re-prompt, open Settings and set Location to 'Always'.",
          canAskAgain
            ? [{ text: "OK" }]
            : [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Open Settings",
                  onPress: () => {
                    void Linking.openSettings();
                  },
                },
              ],
        );
        return false;
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[Permissions] ensureLocationPermissionIfNeeded failed:",
            error,
          );
        }
        // Return false to indicate failure, but don't crash
        Alert.alert(
          "Permission Error",
          "Unable to request location permission. Please try again or enable location in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return false;
      }
    }, []);

  const ensureIosScreenTimePermissionIfNeeded =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== "ios") return true;

      try {
        const support = getIosInsightsSupportStatus();
        if (support !== "available") {
          Alert.alert(
            "Screen Time not available in this build",
            support === "expoGo"
              ? "Screen Time requires a custom dev client or production build (not Expo Go)."
              : "This iOS build is missing the native insights module. Reinstall the native app and try again.",
          );
          return false;
        }

        const status = await getScreenTimeAuthorizationStatusSafeAsync();
        if (status === "approved") return true;

        const next = await requestScreenTimeAuthorizationSafeAsync();
        if (next !== "approved") {
          Alert.alert(
            "Screen Time permission needed",
            "Please allow Screen Time access, then retry.",
          );
          return false;
        }

        // Prime the cache so the background sync has something to upload.
        // On iOS, we rely on the system report to populate our cached summary.
        try {
          await presentScreenTimeReportSafeAsync("today");
          const summary = await getCachedScreenTimeSummarySafeAsync("today");
          if (summary && userId) {
            const timezone =
              Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
            await syncIosScreenTimeSummary(userId, summary, timezone);
          }
        } catch (error) {
          if (__DEV__) {
            console.warn(
              "[Permissions] Failed to prime Screen Time cache:",
              error,
            );
          }
          // Non-fatal - permission was granted, cache priming is optional
        }

        return true;
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[Permissions] ensureIosScreenTimePermissionIfNeeded failed:",
            error,
          );
        }
        // Return false to indicate failure, but don't crash
        return false;
      }
    }, [userId]);

  const ensureAndroidUsageAccessIfNeeded =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== "android") return true;

      try {
        const support = getAndroidInsightsSupportStatus();
        if (support !== "available") {
          Alert.alert(
            "Screen Time not available in this build",
            "Screen Time access requires the custom Android dev client. Rebuild the app, then try again.",
          );
          return false;
        }

        const status = await getUsageAccessAuthorizationStatusSafeAsync();
        if (status === "authorized") return true;

        // Open the specific Usage Access settings screen (not general Settings)
        await openUsageAccessSettingsSafeAsync();
        Alert.alert(
          "Screen Time access required",
          'Enable "Usage access" for TodayMatters in the settings screen that just opened, then return to the app.',
        );
        return false;
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[Permissions] ensureAndroidUsageAccessIfNeeded failed:",
            error,
          );
        }
        // Return false to indicate failure, but don't crash
        return false;
      }
    }, []);

  const ensureAndroidNotificationsPermissionIfNeeded =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== "android") return true;

      try {
        const result = await requestAndroidNotificationPermissionsAsync();
        if (!result.required) return true;
        if (result.status === "granted") return true;

        const opened = await openAndroidNotificationSettingsAsync();
        if (!opened) {
          Alert.alert(
            "Notifications permission needed",
            "Please allow notifications so the background location service can keep running reliably.",
            result.canAskAgain
              ? [{ text: "OK" }]
              : [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Open Settings",
                    onPress: () => {
                      void Linking.openSettings();
                    },
                  },
                ],
          );
        }
        return false;
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[Permissions] ensureAndroidNotificationsPermissionIfNeeded failed:",
            error,
          );
        }
        // Return false to indicate failure, but don't crash
        return false;
      }
    }, []);

  const promptBatteryOptimizationIfNeeded = useCallback(async (): Promise<void> => {
    if (Platform.OS !== "android") return;
    
    try {
      // Show a dialog explaining why battery optimization should be disabled
      Alert.alert(
        "Improve Background Tracking",
        "For reliable all-day location tracking, please disable battery optimization for TodayMatters.\n\nThis ensures the app can track your location even when running in the background.",
        [
          { text: "Skip", style: "cancel" },
          {
            text: "Open Settings",
            onPress: async () => {
              try {
                await openAndroidBatteryOptimizationSettingsAsync();
              } catch (e) {
                if (__DEV__) console.warn("[Permissions] Failed to open battery settings:", e);
              }
            },
          },
        ],
      );
    } catch (error) {
      if (__DEV__) {
        console.warn(
          "[Permissions] promptBatteryOptimizationIfNeeded failed:",
          error,
        );
      }
      // Non-fatal - battery optimization is optional
    }
  }, []);

  const refreshNotificationStatus = useCallback(async () => {
    if (Platform.OS !== "android") return;
    try {
      const status = await getAndroidNotificationPermissionStatusAsync();
      setNotificationStatus(status);
    } catch (error) {
      if (__DEV__) {
        console.warn("[Permissions] refreshNotificationStatus failed:", error);
      }
      // Keep existing status if refresh fails
    }
  }, []);

  useEffect(() => {
    void refreshNotificationStatus();
  }, [refreshNotificationStatus]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = (state: AppStateStatus) => {
      if (state !== "active") return;
      void refreshNotificationStatus();
    };
    const subscription = AppState.addEventListener("change", handler);
    return () => subscription.remove();
  }, [refreshNotificationStatus]);

  // Derived: all permissions enabled = allowAll is on
  const allEnabled = useMemo(
    () => Object.values(permissions).every(Boolean),
    [permissions],
  );

  const handleAllowAllToggle = useCallback(() => {
    void (async () => {
      try {
        const nextValue = !allEnabled;
        setAllPermissions(nextValue);

        // If enabling all, ensure iOS location permission is actually granted.
        if (nextValue) {
          try {
            const ok = await ensureLocationPermissionIfNeeded();
            if (!ok) {
              // Revert just the location toggle (others can remain enabled).
              togglePermission("location");
            } else {
              // Start tracking immediately after permission is granted.
              if (Platform.OS === "ios") {
                void startIosBackgroundLocationAsync().catch((e) => {
                  if (__DEV__) console.warn("[Permissions] Failed to start iOS background location:", e);
                });
              } else if (Platform.OS === "android") {
                void startAndroidBackgroundLocationAsync().catch((e) => {
                  if (__DEV__) console.warn("[Permissions] Failed to start Android background location:", e);
                });
                // Prompt for battery optimization after location tracking starts
                try {
                  await promptBatteryOptimizationIfNeeded();
                } catch (e) {
                  if (__DEV__) console.warn("[Permissions] Battery optimization prompt failed:", e);
                }
              }
            }
          } catch (e) {
            if (__DEV__) console.warn("[Permissions] Location permission check failed:", e);
            togglePermission("location");
          }

          if (Platform.OS === "android") {
            try {
              const notificationsOk =
                await ensureAndroidNotificationsPermissionIfNeeded();
              if (!notificationsOk) {
                togglePermission("notifications");
              }
            } catch (e) {
              if (__DEV__) console.warn("[Permissions] Notifications permission check failed:", e);
              togglePermission("notifications");
            }
          }

          if (Platform.OS === "ios") {
            try {
              const appUsageOk = await ensureIosScreenTimePermissionIfNeeded();
              if (!appUsageOk) togglePermission("appUsage");
            } catch (e) {
              if (__DEV__) console.warn("[Permissions] iOS Screen Time permission check failed:", e);
              togglePermission("appUsage");
            }
          } else if (Platform.OS === "android") {
            try {
              const usageOk = await ensureAndroidUsageAccessIfNeeded();
              if (!usageOk) {
                togglePermission("appUsage");
              }
            } catch (e) {
              if (__DEV__) console.warn("[Permissions] Android usage access check failed:", e);
              togglePermission("appUsage");
            }
          }
        }
      } catch (e) {
        if (__DEV__) console.error("[Permissions] handleAllowAllToggle failed:", e);
        // Don't crash - user can still proceed with manually toggling permissions
      }
    })();
  }, [
    allEnabled,
    ensureAndroidNotificationsPermissionIfNeeded,
    ensureIosScreenTimePermissionIfNeeded,
    ensureAndroidUsageAccessIfNeeded,
    ensureLocationPermissionIfNeeded,
    promptBatteryOptimizationIfNeeded,
    setAllPermissions,
    togglePermission,
  ]);

  const handleTogglePermission = useCallback(
    (key: PermissionKey) => {
      void (async () => {
        try {
          const currentlyEnabled = permissions[key];
          const nextEnabled = !currentlyEnabled;

          if (key === "location" && nextEnabled) {
            try {
              const ok = await ensureLocationPermissionIfNeeded();
              if (!ok) return;
              if (Platform.OS === "ios") {
                void startIosBackgroundLocationAsync().catch((e) => {
                  if (__DEV__) console.warn("[Permissions] Failed to start iOS background location:", e);
                });
              } else if (Platform.OS === "android") {
                void startAndroidBackgroundLocationAsync().catch((e) => {
                  if (__DEV__) console.warn("[Permissions] Failed to start Android background location:", e);
                });
                // Prompt for battery optimization after location tracking starts
                try {
                  await promptBatteryOptimizationIfNeeded();
                } catch (e) {
                  if (__DEV__) console.warn("[Permissions] Battery optimization prompt failed:", e);
                }
              }
            } catch (e) {
              if (__DEV__) console.warn("[Permissions] Location toggle failed:", e);
              return;
            }
          }

          if (key === "notifications" && nextEnabled) {
            try {
              const ok = await ensureAndroidNotificationsPermissionIfNeeded();
              if (!ok) return;
              await refreshNotificationStatus();
            } catch (e) {
              if (__DEV__) console.warn("[Permissions] Notifications toggle failed:", e);
              return;
            }
          }

          if (key === "appUsage" && nextEnabled) {
            try {
              if (Platform.OS === "ios") {
                const ok = await ensureIosScreenTimePermissionIfNeeded();
                if (!ok) return;
              } else {
                const ok = await ensureAndroidUsageAccessIfNeeded();
                if (!ok) return;
              }
            } catch (e) {
              if (__DEV__) console.warn("[Permissions] App usage toggle failed:", e);
              return;
            }
          }

          togglePermission(key);
        } catch (e) {
          if (__DEV__) console.error("[Permissions] handleTogglePermission failed:", e);
          // Don't crash - just don't toggle the permission
        }
      })();
    },
    [
      ensureAndroidNotificationsPermissionIfNeeded,
      ensureIosScreenTimePermissionIfNeeded,
      ensureAndroidUsageAccessIfNeeded,
      ensureLocationPermissionIfNeeded,
      promptBatteryOptimizationIfNeeded,
      refreshNotificationStatus,
      permissions,
      togglePermission,
    ],
  );

  const handleToggleShowIndividual = useCallback(() => {
    setShowIndividual((prev) => !prev);
  }, []);

  const handleContinue = () => {
    void (async () => {
      try {
        // If user kept Location enabled, make sure we actually have system permissions before proceeding.
        if (permissions.location) {
          try {
            const ok = await ensureLocationPermissionIfNeeded();
            if (!ok) {
              // Keep the UI consistent: flip off the toggle if we couldn't obtain permission.
              togglePermission("location");
              // Don't block continue - user can proceed without location
            }
          } catch (e) {
            if (__DEV__) console.warn("[Permissions] Location check on continue failed:", e);
            togglePermission("location");
            // Don't block continue - user can proceed without location
          }
        }

        if (permissions.notifications && Platform.OS === "android") {
          try {
            const ok = await ensureAndroidNotificationsPermissionIfNeeded();
            if (!ok) {
              togglePermission("notifications");
              // Don't block continue - user can proceed without notifications
            } else {
              await refreshNotificationStatus();
            }
          } catch (e) {
            if (__DEV__) console.warn("[Permissions] Notifications check on continue failed:", e);
            togglePermission("notifications");
            // Don't block continue
          }
        }

        if (Platform.OS === "android" && permissions.appUsage) {
          try {
            const ok = await ensureAndroidUsageAccessIfNeeded();
            if (!ok) {
              togglePermission("appUsage");
              // Don't block continue - user can proceed without app usage
            }
          } catch (e) {
            if (__DEV__) console.warn("[Permissions] App usage check on continue failed:", e);
            togglePermission("appUsage");
            // Don't block continue
          }
        }

        try {
          await savePermissions(permissions);
        } catch (e) {
          if (__DEV__) console.warn("[Permissions] Failed to save permissions:", e);
          // Continue anyway - permissions are saved locally
        }

        router.replace("/connect-google-services");
      } catch (e) {
        if (__DEV__) console.error("[Permissions] handleContinue failed:", e);
        // Still navigate to avoid user being stuck
        router.replace("/connect-google-services");
      }
    })();
  };

  if (!hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <PermissionsTemplate
      allowAllEnabled={allEnabled}
      onToggleAllowAll={handleAllowAllToggle}
      showIndividual={showIndividual}
      onToggleShowIndividual={handleToggleShowIndividual}
      permissions={permissions}
      onTogglePermission={handleTogglePermission}
      onContinue={handleContinue}
      notificationSettingsAction={
        Platform.OS === "android" &&
        notificationStatus.required &&
        notificationStatus.status !== "granted"
          ? {
              label: "Open notification settings",
              helperText:
                "Notifications are required to keep background tracking reliable.",
              onPress: () => {
                void openAndroidNotificationSettingsAsync();
              },
            }
          : undefined
      }
      onBack={() => router.replace("/explainer-video")}
      step={SETUP_SCREENS_STEPS.permissions}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
    />
  );
}
