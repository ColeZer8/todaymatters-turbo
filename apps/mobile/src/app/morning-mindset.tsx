import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { BookOpenCheck, Coffee, Smile, Zap } from 'lucide-react-native';
import { MorningMindsetTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

const MORNING_MINDSET_OPTIONS = [
  {
    id: 'slow',
    title: 'Slow & Intentional',
    description: 'Ease into the day with quiet time.',
    icon: Coffee,
  },
  {
    id: 'energy',
    title: 'High Energy',
    description: 'Jumpstart with movement and action.',
    icon: Zap,
  },
  {
    id: 'deep-focus',
    title: 'Deep Focus',
    description: 'Tackle the biggest task first.',
    icon: BookOpenCheck,
  },
  {
    id: 'joy-family',
    title: 'Joy & Family',
    description: 'Connect with loved ones early.',
    icon: Smile,
  },
] as const;

export default function MorningMindsetScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [selected, setSelected] = useState<string | null>('slow');

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  return (
    <MorningMindsetTemplate
      step={ONBOARDING_STEPS.morningMindset}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={MORNING_MINDSET_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onContinue={() => router.replace('/goals')}
      onBack={() => router.back()}
    />
  );
}
