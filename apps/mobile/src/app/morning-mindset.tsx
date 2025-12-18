import { useEffect } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { BookOpenCheck, Coffee, Smile, Zap } from 'lucide-react-native';
import { MorningMindsetTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';

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

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const selected = useOnboardingStore((state) => state.morningMindset);
  const setSelected = useOnboardingStore((state) => state.setMorningMindset);

  // Supabase sync
  const { saveMorningMindset } = useOnboardingSync({ autoLoad: false, autoSave: false });

  // Save to Supabase when morning mindset changes
  useEffect(() => {
    if (hasHydrated && isAuthenticated && selected) {
      saveMorningMindset(selected);
    }
  }, [selected, hasHydrated, isAuthenticated, saveMorningMindset]);

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
    <MorningMindsetTemplate
      step={ONBOARDING_STEPS.morningMindset}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={MORNING_MINDSET_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onContinue={() => router.replace('/goals')}
      onBack={() => router.replace('/coach-persona')}
    />
  );
}
