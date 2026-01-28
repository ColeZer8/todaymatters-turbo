import "react-native-gesture-handler";
import "../global.css";
import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import {
  AppState,
  AppStateStatus,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { handleAuthCallback, refreshSession } from "@/lib/supabase";
import { handleGoogleServicesOAuthCallback } from "@/lib/google-services-oauth";
import {
  useAuthStore,
  useGoogleServicesOAuthStore,
  useUserPreferencesStore,
} from "@/stores";
import { fetchUserDataPreferences } from "@/lib/supabase/services/user-preferences";
import { DemoOverlay } from "@/components/organisms";
import { verifyAuthAndData } from "@/lib/supabase/services";
import {
  useInsightsSync,
  useLocationSamplesSync,
  useOnboardingSync,
} from "@/lib/supabase/hooks";
import { registerIosLocationBackgroundTaskAsync } from "@/lib/ios-location/register";
import { registerAndroidLocationBackgroundTaskAsync } from "@/lib/android-location/register";
import {
  checkAndApplyUpdate,
  isUpdateEnabled,
  getUpdateInfo,
} from "@/lib/updates";
import { installGlobalErrorHandlers, logger } from "@/lib/logger";

// Register background task only if the native modules exist (prevents hard-crash on stale dev clients).
void registerIosLocationBackgroundTaskAsync();
void registerAndroidLocationBackgroundTaskAsync();

export default function Layout() {
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { loadOnboardingData } = useOnboardingSync({
    autoLoad: false,
    autoSave: false,
  });
  const didLoadOnboardingForUserRef = useRef<string | null>(null);
  const setGoogleOAuthProcessing = useGoogleServicesOAuthStore(
    (state) => state.setProcessing,
  );
  const setGoogleOAuthResult = useGoogleServicesOAuthStore(
    (state) => state.setResult,
  );
  const isAndroid = Platform.OS === "android";

  // iOS-only: start background location collection when authenticated, and periodically flush queued samples.
  useLocationSamplesSync();
  useInsightsSync();

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const run = async () => {
      unsubscribeAuth = await initialize();
    };

    installGlobalErrorHandlers();

    run();
    const cleanupLinks = handleAuthCallback();
    const cleanupGoogleOAuth = handleGoogleServicesOAuthCallback({
      onStart: () => setGoogleOAuthProcessing(true),
      onResult: (result) => {
        setGoogleOAuthResult(result);
        logger.debug("Google services OAuth result", result);
      },
    });

    // Load onboarding state from Supabase once after auth is ready.
    // This makes onboarding truly "server-backed" (app can be reinstalled and state restored).
    logger.debug("Onboarding sync: waiting for authentication...");

    // Verify auth and data after initialization (for debugging)
    setTimeout(() => {
      verifyAuthAndData().catch((error) =>
        logger.error("verifyAuthAndData failed", error),
      );
    }, 2000); // Wait 2 seconds for auth to initialize

    return () => {
      cleanupLinks();
      cleanupGoogleOAuth();
      unsubscribeAuth?.();
    };
  }, [initialize, setGoogleOAuthProcessing, setGoogleOAuthResult]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (didLoadOnboardingForUserRef.current === userId) return;
    didLoadOnboardingForUserRef.current = userId;
    (async () => {
      try {
        await loadOnboardingData();
        // Hydrate user preferences (e.g. big3_enabled) from Supabase so the store reflects DB state
        const preferences = await fetchUserDataPreferences(userId);
        useUserPreferencesStore.getState().setPreferences(preferences);
      } catch (error) {
        if (__DEV__) {
          console.log(
            "⚠️ Failed to load onboarding data from Supabase:",
            error,
          );
        }
      }
    })();
    return () => {};
  }, [isAuthenticated, userId, loadOnboardingData]);

  // Refresh session and check for updates when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          // Avoid refreshing auth while an in-app OAuth flow is in progress (Android custom tabs / iOS auth sessions).
          // Some devices will background/foreground during OAuth, and an aggressive refresh can sign the user out unexpectedly.
          const isGoogleOAuthProcessing =
            useGoogleServicesOAuthStore.getState().isProcessing;
          if (isGoogleOAuthProcessing) {
            if (__DEV__) {
              console.log(
                "⏭️ Skipping session refresh (Google OAuth in progress)",
              );
            }
            return;
          }

          // App came to foreground - refresh session if needed
          const session = useAuthStore.getState().session;
          if (session) {
            try {
              logger.debug("App returned to foreground, refreshing session...");
              await refreshSession();
            } catch (error) {
              logger.warn("Failed to refresh session on foreground", error);
              // Error handling is done in refreshSession - user will be signed out if needed
            }
          }

          // Check for EAS updates (only in production builds)
          if (isUpdateEnabled()) {
            try {
              logger.debug("Checking for EAS updates...");
              const updateInfo = getUpdateInfo();
              if (updateInfo) logger.debug("Update info", updateInfo);
              // Note: Automatic checking is handled by expo-updates with checkAutomatically: 'ON_LOAD'
              // This is just for manual checking if needed
            } catch (error) {
              logger.warn("Failed to check for updates", error);
            }
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const stackContent = (
    <Stack screenOptions={{ animation: "none" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="confirm-email" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="permissions" options={{ headerShown: false }} />
      <Stack.Screen
        name="connect-google-services"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="core-values" options={{ headerShown: false }} />
      <Stack.Screen name="core-categories" options={{ headerShown: false }} />
      <Stack.Screen name="sub-categories" options={{ headerShown: false }} />
      <Stack.Screen name="values-scores" options={{ headerShown: false }} />
      <Stack.Screen name="vip-contacts" options={{ headerShown: false }} />
      <Stack.Screen name="my-church" options={{ headerShown: false }} />
      <Stack.Screen name="setup-questions" options={{ headerShown: false }} />
      <Stack.Screen name="big3-opt-in" options={{ headerShown: false }} />
      <Stack.Screen name="name" options={{ headerShown: false }} />
      <Stack.Screen name="daily-rhythm" options={{ headerShown: false }} />
      <Stack.Screen name="joy" options={{ headerShown: false }} />
      <Stack.Screen name="drains" options={{ headerShown: false }} />
      <Stack.Screen name="your-why" options={{ headerShown: false }} />
      <Stack.Screen name="focus-style" options={{ headerShown: false }} />
      <Stack.Screen name="coach-persona" options={{ headerShown: false }} />
      <Stack.Screen name="morning-mindset" options={{ headerShown: false }} />
      <Stack.Screen name="goals" options={{ headerShown: false }} />
      <Stack.Screen name="goal-whys" options={{ headerShown: false }} />
      <Stack.Screen name="build-routine" options={{ headerShown: false }} />
      <Stack.Screen name="ideal-day" options={{ headerShown: false }} />
      <Stack.Screen name="ai-summary" options={{ headerShown: false }} />
      <Stack.Screen name="explainer-video" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="calendar" options={{ headerShown: false }} />
      <Stack.Screen
        name="comprehensive-calendar"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="actual-adjust"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen name="analytics" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen
        name="communication"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="add-event"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen name="demo-meeting" options={{ headerShown: false }} />
      <Stack.Screen name="demo-traffic" options={{ headerShown: false }} />
      <Stack.Screen name="demo-prayer" options={{ headerShown: false }} />
      <Stack.Screen name="demo-screen-time" options={{ headerShown: false }} />
      <Stack.Screen
        name="demo-workout-interruption"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="demo-workout-summary"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="demo-traffic-accident"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="demo-overview-goals"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="demo-overview-initiatives"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="demo-overview-values"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="demo-prayer-rate" options={{ headerShown: false }} />
      <Stack.Screen name="demo-meeting-rate" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );

  const appContent = (
    <SafeAreaProvider>
      {isAndroid ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="height"
          keyboardVerticalOffset={0}
        >
          {stackContent}
        </KeyboardAvoidingView>
      ) : (
        stackContent
      )}
      {/* Demo Mode Overlay - only renders when demo is active */}
      <DemoOverlay />
    </SafeAreaProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {appContent}
    </GestureHandlerRootView>
  );
}
