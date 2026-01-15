import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { AISummaryTemplate } from '@/components/templates/AISummaryTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';

export default function AISummaryScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const fullName = useOnboardingStore((state) => state.fullName);
  const coreValues = useOnboardingStore((state) => state.coreValues);
  const goals = useOnboardingStore((state) => state.goals);
  const valuesScores = useOnboardingStore((state) => state.valuesScores);
  const setHasCompletedOnboarding = useOnboardingStore((state) => state.setHasCompletedOnboarding);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleConfirm = () => {
    setHasCompletedOnboarding(true);
    router.replace('/home');
  };

  const handleEdit = () => {
    // Go back to core values to make changes
    router.replace('/core-values');
  };

  const handleBack = () => {
    router.replace('/my-church');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // Extract first name for greeting
  const firstName = fullName.split(' ')[0] || '';

  return (
    <AISummaryTemplate
      step={SETUP_SCREENS_STEPS.aiSummary}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      userName={firstName}
      coreValues={coreValues}
      goals={goals}
      valuesScores={valuesScores}
      onConfirm={handleConfirm}
      onEdit={handleEdit}
      onBack={handleBack}
    />
  );
}
