import { useEffect } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { SetupQuestionsTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

const OPTIONS = [
  'Student',
  'Professional',
  'Parent',
  'Entrepreneur',
  'Retired',
  'Creative',
  'Other',
];

export default function SetupQuestionsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const role = useOnboardingStore((state) => state.role);
  const setRole = useOnboardingStore((state) => state.setRole);

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
    <SetupQuestionsTemplate
      step={ONBOARDING_STEPS.setupQuestions}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={OPTIONS}
      selectedOption={role}
      onSelect={setRole}
      onContinue={() => router.replace('/daily-rhythm')}
      onBack={() => router.replace('/permissions')}
      onSkip={() => router.replace('/daily-rhythm')}
    />
  );
}
