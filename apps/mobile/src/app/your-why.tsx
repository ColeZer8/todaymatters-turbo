import { useEffect } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { Brain, HeartHandshake, ShieldCheck, Trophy } from 'lucide-react-native';
import { PurposeSelectionTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

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

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const selected = useOnboardingStore((state) => state.purpose);
  const setSelected = useOnboardingStore((state) => state.setPurpose);

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
    <PurposeSelectionTemplate
      step={ONBOARDING_STEPS.yourWhy}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={PURPOSE_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onContinue={() => router.replace('/focus-style')}
      onBack={() => router.replace('/drains')}
    />
  );
}
