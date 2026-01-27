import { useCallback, useEffect } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { RoutineBuilderTemplate } from "@/components/templates/RoutineBuilderTemplate";
import { useAuthStore } from "@/stores";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";
import { useRoutineSync } from "@/lib/supabase/hooks";
import { useOnboardingStore } from "@/stores/onboarding-store";

const QUICK_ADD = [
  "Brush Teeth",
  "Shower",
  "Make Bed",
  "Read",
  "Meditate",
  "Walk Dog",
  "Make Breakfast",
];

export default function BuildRoutineScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setHasCompletedOnboarding = useOnboardingStore(
    (state) => state.setHasCompletedOnboarding,
  );

  const hasHydrated = useRoutineBuilderStore((state) => state._hasHydrated);
  const items = useRoutineBuilderStore((state) => state.items);
  const wakeTime = useRoutineBuilderStore((state) => state.wakeTime);
  const setItems = useRoutineBuilderStore((state) => state.setItems);
  const updateMinutes = useRoutineBuilderStore((state) => state.updateMinutes);
  const addItem = useRoutineBuilderStore((state) => state.addItem);
  const deleteItem = useRoutineBuilderStore((state) => state.deleteItem);

  const handleSyncError = useCallback((err: Error) => {
    console.error("Failed to sync routine:", err);
  }, []);

  const { saveRoutine } = useRoutineSync({
    autoLoad: true,
    onError: handleSyncError,
  });

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    const timeoutId = setTimeout(() => {
      void saveRoutine();
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [items, wakeTime, hasHydrated, isAuthenticated, saveRoutine]);

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
    <RoutineBuilderTemplate
      step={ONBOARDING_STEPS.routine}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      items={items}
      onReorder={setItems}
      onChangeMinutes={updateMinutes}
      onDelete={deleteItem}
      onAddItem={addItem}
      quickAddItems={QUICK_ADD}
      wakeTime={wakeTime}
      onContinue={() => {
        void saveRoutine();
        setHasCompletedOnboarding(true);
        router.replace("/home");
      }}
      onBack={() => router.replace("/morning-mindset")}
    />
  );
}
