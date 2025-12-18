import { useEffect } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { BriefcaseBusiness, ShieldCheck, Sparkles } from 'lucide-react-native';
import { CoachPersonaTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';

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

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const selected = useOnboardingStore((state) => state.coachPersona);
  const setSelected = useOnboardingStore((state) => state.setCoachPersona);

  // Supabase sync
  const { saveCoachPersona } = useOnboardingSync({ autoLoad: false, autoSave: false });

  // Save to Supabase when coach persona changes
  useEffect(() => {
    if (hasHydrated && isAuthenticated && selected) {
      saveCoachPersona(selected);
    }
  }, [selected, hasHydrated, isAuthenticated, saveCoachPersona]);

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
    <CoachPersonaTemplate
      step={ONBOARDING_STEPS.coachPersona}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={COACH_PERSONA_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onContinue={() => router.replace('/morning-mindset')}
      onBack={() => router.replace('/focus-style')}
    />
  );
}
