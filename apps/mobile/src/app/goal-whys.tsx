import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { GoalWhysTemplate } from '@/components/templates/GoalWhysTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function GoalWhysScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const goals = useOnboardingStore((state) => state.goals);
  const goalWhys = useOnboardingStore((state) => state.goalWhys);
  const updateGoalWhy = useOnboardingStore((state) => state.updateGoalWhy);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleContinue = () => {
    router.replace('/ideal-day');
  };

  const handleBack = () => {
    router.replace('/goals');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <GoalWhysTemplate
      step={ONBOARDING_STEPS.goalWhys}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      goals={goals}
      goalWhys={goalWhys}
      onUpdateWhy={updateGoalWhy}
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
