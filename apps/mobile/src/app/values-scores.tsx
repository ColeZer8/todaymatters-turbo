import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { ValuesScoresTemplate } from '@/components/templates/ValuesScoresTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';
import { useOnboardingSync } from '@/lib/supabase/hooks';

export default function ValuesScoresScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const coreValues = useOnboardingStore((state) => state.coreValues);
  const valuesScores = useOnboardingStore((state) => state.valuesScores);
  const updateValueScore = useOnboardingStore((state) => state.updateValueScore);
  const { saveValuesScores } = useOnboardingSync({ autoLoad: false, autoSave: false });

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    const timeoutId = setTimeout(() => {
      saveValuesScores(valuesScores);
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [valuesScores, hasHydrated, isAuthenticated, saveValuesScores]);

  const handleContinue = () => {
    saveValuesScores(valuesScores);
    router.replace('/goals');
  };

  const handleBack = () => {
    router.replace('/core-categories');
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
      step={SETUP_SCREENS_STEPS.valuesScores}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      coreValues={coreValues}
      valuesScores={valuesScores}
      onUpdateScore={updateValueScore}
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
