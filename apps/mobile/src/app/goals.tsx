import { useEffect } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { GoalsTemplate } from "@/components/templates";
import { useAuthStore } from "@/stores";
import {
  SETUP_SCREENS_STEPS,
  SETUP_SCREENS_TOTAL_STEPS,
} from "@/constants/setup-screens";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useEventsSync } from "@/lib/supabase/hooks";

function dedupeTitles(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export default function GoalsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const goals = useOnboardingStore((state) => state.goals);
  const initiatives = useOnboardingStore((state) => state.initiatives);
  const setGoals = useOnboardingStore((state) => state.setGoals);
  const setInitiatives = useOnboardingStore((state) => state.setInitiatives);
  const addGoal = useOnboardingStore((state) => state.addGoal);
  const removeGoal = useOnboardingStore((state) => state.removeGoal);
  const changeGoal = useOnboardingStore((state) => state.changeGoal);
  const addInitiative = useOnboardingStore((state) => state.addInitiative);
  const removeInitiative = useOnboardingStore(
    (state) => state.removeInitiative,
  );
  const changeInitiative = useOnboardingStore(
    (state) => state.changeInitiative,
  );

  // Supabase sync
  const { bulkSaveGoals, bulkSaveInitiatives } = useEventsSync({
    onError: (err) => console.error("Failed to save goals/initiatives:", err),
  });

  // Defensive: if stale persisted data contains duplicates, normalize it once for a clean UX.
  useEffect(() => {
    if (!hasHydrated) return;
    const uniqueGoals = dedupeTitles(goals);
    const uniqueInitiatives = dedupeTitles(initiatives);
    if (uniqueGoals.length !== goals.filter(Boolean).length) {
      setGoals(uniqueGoals);
    }
    if (uniqueInitiatives.length !== initiatives.filter(Boolean).length) {
      setInitiatives(uniqueInitiatives);
    }
  }, [goals, initiatives, hasHydrated, setGoals, setInitiatives]);

  // Save to Supabase when goals/initiatives change (debounced)
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      const timeoutId = setTimeout(() => {
        const validGoals = dedupeTitles(goals);
        const validInitiatives = dedupeTitles(initiatives);
        if (validGoals.length > 0) {
          bulkSaveGoals(validGoals);
        }
        if (validInitiatives.length > 0) {
          bulkSaveInitiatives(validInitiatives);
        }
      }, 2000); // Longer debounce for bulk operations
      return () => clearTimeout(timeoutId);
    }
  }, [
    goals,
    initiatives,
    hasHydrated,
    isAuthenticated,
    bulkSaveGoals,
    bulkSaveInitiatives,
  ]);

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
    <GoalsTemplate
      step={SETUP_SCREENS_STEPS.goals}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      goals={goals}
      initiatives={initiatives}
      onAddGoal={addGoal}
      onRemoveGoal={removeGoal}
      onChangeGoal={changeGoal}
      onAddInitiative={addInitiative}
      onRemoveInitiative={removeInitiative}
      onChangeInitiative={changeInitiative}
      onContinue={() => router.replace("/goal-whys")}
      onBack={() => router.replace("/values-scores")}
    />
  );
}
