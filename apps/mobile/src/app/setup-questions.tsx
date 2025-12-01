import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { SetupQuestionsTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function SetupQuestionsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [selection, setSelection] = useState<string | null>(null);

  const OPTIONS = [
    'Student',
    'Professional',
    'Parent',
    'Entrepreneur',
    'Retired',
    'Creative',
    'Other',
  ];

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  return (
    <SetupQuestionsTemplate
      step={ONBOARDING_STEPS.setupQuestions}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={OPTIONS}
      selectedOption={selection}
      onSelect={setSelection}
      onContinue={() => router.replace('/daily-rhythm')}
      onBack={() => router.replace('/permissions')}
      onSkip={() => router.replace('/daily-rhythm')}
    />
  );
}
