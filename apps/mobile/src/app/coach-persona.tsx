import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { BriefcaseBusiness, ShieldCheck, Sparkles } from 'lucide-react-native';
import { CoachPersonaTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

const COACH_PERSONA_OPTIONS = [
  {
    id: 'strategist',
    title: 'The Strategist',
    description: 'Logical, data-driven, and efficient.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'cheerleader',
    title: 'The Cheerleader',
    description: 'Warm, encouraging, and positive.',
    icon: Sparkles,
  },
  {
    id: 'sergeant',
    title: 'The Sergeant',
    description: 'Direct, no-nonsense accountability.',
    icon: ShieldCheck,
  },
] as const;

export default function CoachPersonaScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [selected, setSelected] = useState<string | null>('strategist');

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  return (
    <CoachPersonaTemplate
      step={ONBOARDING_STEPS.coachPersona}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={COACH_PERSONA_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onContinue={() => router.replace('/morning-mindset')}
      onBack={() => router.back()}
    />
  );
}
