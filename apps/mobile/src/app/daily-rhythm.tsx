import { useEffect, useMemo } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { DailyRhythmTemplate } from "@/components/templates";
import { useAuthStore } from "@/stores";
import {
  SETUP_SCREENS_STEPS,
  SETUP_SCREENS_TOTAL_STEPS,
} from "@/constants/setup-screens";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useOnboardingSync } from "@/lib/supabase/hooks";

export default function DailyRhythmScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const wakeTimeStr = useOnboardingStore((state) => state.wakeTime);
  const sleepTimeStr = useOnboardingStore((state) => state.sleepTime);
  const setWakeTime = useOnboardingStore((state) => state.setWakeTime);
  const setSleepTime = useOnboardingStore((state) => state.setSleepTime);

  const wakeTime = useMemo(() => new Date(wakeTimeStr), [wakeTimeStr]);
  const sleepTime = useMemo(() => new Date(sleepTimeStr), [sleepTimeStr]);

  // Supabase sync
  const { saveDailyRhythm } = useOnboardingSync({
    autoLoad: false,
    autoSave: false,
  });

  // Save to Supabase when times change (debounced)
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      const timeoutId = setTimeout(() => {
        saveDailyRhythm(wakeTime, sleepTime);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [wakeTime, sleepTime, hasHydrated, isAuthenticated, saveDailyRhythm]);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace("/");
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <DailyRhythmTemplate
      step={SETUP_SCREENS_STEPS.dailyRhythm}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      wakeTime={wakeTime}
      sleepTime={sleepTime}
      onSelectWakeTime={setWakeTime}
      onSelectSleepTime={setSleepTime}
      onContinue={() => router.replace("/my-church")}
      onBack={() => router.replace("/ideal-day")}
    />
  );
}
