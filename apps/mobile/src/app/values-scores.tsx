import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { ValuesScoresTemplate } from '@/components/templates/ValuesScoresTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function ValuesScoresScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const coreValues = useOnboardingStore((state) => state.coreValues);
  const valuesScores = useOnboardingStore((state) => state.valuesScores);
  const updateValueScore = useOnboardingStore((state) => state.updateValueScore);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleContinue = () => {
    router.replace('/ai-summary');
  };

  const handleBack = () => {
    router.replace('/ideal-day');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ValuesScoresTemplate
      step={ONBOARDING_STEPS.valuesScores}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      coreValues={coreValues}
      valuesScores={valuesScores}
      onUpdateScore={updateValueScore}
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
