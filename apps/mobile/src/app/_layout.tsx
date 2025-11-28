import "../global.css";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { handleAuthCallback } from "@/lib/supabase";
import { useAuthStore } from "@/stores";

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

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ animation: 'none' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="confirm-email" options={{ headerShown: false }} />
        <Stack.Screen name="permissions" options={{ headerShown: false }} />
        <Stack.Screen name="setup-questions" options={{ headerShown: false }} />
        <Stack.Screen name="daily-rhythm" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="calendar" options={{ headerShown: false }} />
        <Stack.Screen name="communication" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
