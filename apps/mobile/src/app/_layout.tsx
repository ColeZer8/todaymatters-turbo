import "../global.css";
import { Slot } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { handleAuthCallback } from "@/lib/supabase";
import { useAuthStore } from "@/stores";

export default function Layout() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // Initialize authentication state
    initialize();
    // Handle deep linking for OAuth callbacks
    const cleanup = handleAuthCallback();
    // Cleanup listener on unmount
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
