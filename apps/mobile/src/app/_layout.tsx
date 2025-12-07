import "react-native-gesture-handler";
import "../global.css";
import { Stack } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Constants from "expo-constants";
import { handleAuthCallback } from "@/lib/supabase";
import { useAuthStore } from "@/stores";

// TODO: Re-enable ElevenLabs voice coach integration
// Voice features require native modules - only available in dev builds, not Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically load ElevenLabsProvider only in dev builds
// String concatenation tricks Metro's static analysis so it doesn't bundle in Expo Go
// TODO: Re-enable when voice coach is ready for production
let ElevenLabsProvider: React.ComponentType<{ children: ReactNode }> | null = null;
// DISABLED: ElevenLabs integration temporarily disabled
// if (!isExpoGo) {
//   try {
//     const pkg = '@elevenlabs' + '/react-native';
//     ElevenLabsProvider = require(pkg).ElevenLabsProvider;
//   } catch {
//     console.log("[Layout] ElevenLabs not available - voice features disabled");
//   }
// }

export default function Layout() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const run = async () => {
      unsubscribeAuth = await initialize();
    };

    run();
    const cleanupLinks = handleAuthCallback();

    return () => {
      cleanupLinks();
      unsubscribeAuth?.();
    };
  }, [initialize]);

  const appContent = (
    <SafeAreaProvider>
      <Stack screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="confirm-email" options={{ headerShown: false }} />
        <Stack.Screen name="permissions" options={{ headerShown: false }} />
        <Stack.Screen name="setup-questions" options={{ headerShown: false }} />
        <Stack.Screen name="daily-rhythm" options={{ headerShown: false }} />
        <Stack.Screen name="joy" options={{ headerShown: false }} />
        <Stack.Screen name="drains" options={{ headerShown: false }} />
        <Stack.Screen name="your-why" options={{ headerShown: false }} />
        <Stack.Screen name="focus-style" options={{ headerShown: false }} />
        <Stack.Screen name="coach-persona" options={{ headerShown: false }} />
        <Stack.Screen name="morning-mindset" options={{ headerShown: false }} />
        <Stack.Screen name="goals" options={{ headerShown: false }} />
        <Stack.Screen name="build-routine" options={{ headerShown: false }} />
        <Stack.Screen name="ideal-day" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="calendar" options={{ headerShown: false }} />
        <Stack.Screen name="comprehensive-calendar" options={{ headerShown: false }} />
        <Stack.Screen name="analytics" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="communication" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="add-event" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {ElevenLabsProvider ? (
        <ElevenLabsProvider>{appContent}</ElevenLabsProvider>
      ) : (
        appContent
      )}
    </GestureHandlerRootView>
  );
}
