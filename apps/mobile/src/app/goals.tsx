import { useEffect } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { GoalsTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

export default function GoalsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const goals = useOnboardingStore((state) => state.goals);
  const initiatives = useOnboardingStore((state) => state.initiatives);
  const addGoal = useOnboardingStore((state) => state.addGoal);
  const removeGoal = useOnboardingStore((state) => state.removeGoal);
  const changeGoal = useOnboardingStore((state) => state.changeGoal);
  const addInitiative = useOnboardingStore((state) => state.addInitiative);
  const removeInitiative = useOnboardingStore((state) => state.removeInitiative);
  const changeInitiative = useOnboardingStore((state) => state.changeInitiative);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
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
      step={ONBOARDING_STEPS.goals}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      goals={goals}
      initiatives={initiatives}
      onAddGoal={addGoal}
      onRemoveGoal={removeGoal}
      onChangeGoal={changeGoal}
      onAddInitiative={addInitiative}
      onRemoveInitiative={removeInitiative}
      onChangeInitiative={changeInitiative}
      onContinue={() => router.replace('/build-routine')}
      onBack={() => router.replace('/morning-mindset')}
    />
  );
}
