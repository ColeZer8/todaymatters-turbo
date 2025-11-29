import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { Brain, HeartHandshake, ShieldCheck, Trophy } from 'lucide-react-native';
import { PurposeSelectionTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

const PURPOSE_OPTIONS = [
  { id: 'balance', title: 'Work-Life Balance', description: undefined, icon: HeartHandshake },
  { id: 'clarity', title: 'Mental Clarity', description: undefined, icon: Brain },
  { id: 'stress', title: 'Reduce Stress', description: undefined, icon: ShieldCheck },
  { id: 'goals', title: 'Achieve Big Goals', description: undefined, icon: Trophy },
];

export default function YourWhyScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [selected, setSelected] = useState<string | null>('balance');

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  return (
    <PurposeSelectionTemplate
      step={ONBOARDING_STEPS.yourWhy}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={PURPOSE_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onContinue={() => router.replace('/focus-style')}
      onBack={() => router.back()}
    />
  );
}
