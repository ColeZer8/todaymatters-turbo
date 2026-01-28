import { useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  openAndroidBatteryOptimizationSettingsAsync,
  requestAndroidLocationPermissionsAsync,
} from "@/lib/android-location";
import { startIosBackgroundLocationAsync } from "@/lib/ios-location";
import { startAndroidBackgroundLocationAsync } from "@/lib/android-location";
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

      const result =
        Platform.OS === "ios"
          ? await requestIosLocationPermissionsAsync()
          : await requestAndroidLocationPermissionsAsync();

      const notificationsOk =
        !result.notificationsRequired || result.notifications === "granted";
      if (
        result.foreground === "granted" &&
        result.background === "granted" &&
        notificationsOk
      ) {
        if (Platform.OS === "android") {
          const promptKey = "tm:androidLocation:promptedBatteryOptimization";
          const prompted = await AsyncStorage.getItem(promptKey).catch(
            () => null,
          );
          if (!prompted) {
            AsyncStorage.setItem(promptKey, "true").catch(() => undefined);
            Alert.alert(
              "Improve background tracking reliability",
              "Android can stop background work to save battery. For reliable background location, disable battery optimization for TodayMatters.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Open Settings",
                  onPress: () => {
                    void openAndroidBatteryOptimizationSettingsAsync();
                  },
                },
              ],
            );
          }
        }
        return true;
      }

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
        result.canAskAgainForeground ||
        result.canAskAgainBackground ||
        result.canAskAgainNotifications;

      Alert.alert(
        "Location permission needed",
        Platform.OS === "android"
          ? "To compare your planned day to your actual day, please allow Location (including background). On Android 13+ you also need notification permission so the background tracker can run with a foreground service. You may need to enable background location in Settings after granting while-in-use."
          : "To compare your planned day to your actual day, please allow Location (Always). If iOS won’t re-prompt, open Settings and set Location to “Always”.",
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
    }, []);

  const ensureIosScreenTimePermissionIfNeeded =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== "ios") return true;
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
      }

      return true;
    }, [userId]);

  const ensureAndroidUsageAccessIfNeeded =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== "android") return true;
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
    }, []);

  // Derived: all permissions enabled = allowAll is on
  const allEnabled = useMemo(
    () => Object.values(permissions).every(Boolean),
    [permissions],
  );

  const handleAllowAllToggle = useCallback(() => {
    void (async () => {
      const nextValue = !allEnabled;
      setAllPermissions(nextValue);

      // If enabling all, ensure iOS location permission is actually granted.
      if (nextValue) {
        const ok = await ensureLocationPermissionIfNeeded();
        if (!ok) {
          // Revert just the location toggle (others can remain enabled).
          togglePermission("location");
        } else {
          // Start tracking immediately after permission is granted.
          if (Platform.OS === "ios") {
            void startIosBackgroundLocationAsync();
          } else if (Platform.OS === "android") {
            void startAndroidBackgroundLocationAsync();
          }
        }

        if (Platform.OS === "ios") {
          const appUsageOk = await ensureIosScreenTimePermissionIfNeeded();
          if (!appUsageOk) togglePermission("appUsage");
        } else if (Platform.OS === "android") {
          const usageOk = await ensureAndroidUsageAccessIfNeeded();
          if (!usageOk) {
            togglePermission("appUsage");
          }
        }
      }
    })();
  }, [
    allEnabled,
    ensureIosScreenTimePermissionIfNeeded,
    ensureAndroidUsageAccessIfNeeded,
    ensureLocationPermissionIfNeeded,
    setAllPermissions,
    togglePermission,
  ]);

  const handleTogglePermission = useCallback(
    (key: PermissionKey) => {
      void (async () => {
        const currentlyEnabled = permissions[key];
        const nextEnabled = !currentlyEnabled;

        if (key === "location" && nextEnabled) {
          const ok = await ensureLocationPermissionIfNeeded();
          if (!ok) return;
          if (Platform.OS === "ios") {
            void startIosBackgroundLocationAsync();
          } else if (Platform.OS === "android") {
            void startAndroidBackgroundLocationAsync();
          }
        }

        if (key === "appUsage" && nextEnabled) {
          if (Platform.OS === "ios") {
            const ok = await ensureIosScreenTimePermissionIfNeeded();
            if (!ok) return;
          } else {
            const ok = await ensureAndroidUsageAccessIfNeeded();
            if (!ok) return;
          }
        }

        togglePermission(key);
      })();
    },
    [
      ensureIosScreenTimePermissionIfNeeded,
      ensureAndroidUsageAccessIfNeeded,
      ensureLocationPermissionIfNeeded,
      permissions,
      togglePermission,
    ],
  );

  const handleToggleShowIndividual = useCallback(() => {
    setShowIndividual((prev) => !prev);
  }, []);

  const handleContinue = () => {
    void (async () => {
      // If user kept Location enabled, make sure we actually have system permissions before proceeding.
      if (permissions.location) {
        const ok = await ensureLocationPermissionIfNeeded();
        if (!ok) {
          // Keep the UI consistent: flip off the toggle if we couldn't obtain permission.
          togglePermission("location");
          return;
        }
      }

      if (Platform.OS === "android" && permissions.appUsage) {
        const ok = await ensureAndroidUsageAccessIfNeeded();
        if (!ok) {
          togglePermission("appUsage");
          return;
        }
      }

      await savePermissions(permissions);
      router.replace("/connect-google-services");
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
      onBack={() => router.replace("/explainer-video")}
      step={SETUP_SCREENS_STEPS.permissions}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
    />
  );
}
