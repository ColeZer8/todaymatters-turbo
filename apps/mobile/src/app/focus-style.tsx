import { useEffect } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { FocusStyleTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

const FOCUS_OPTIONS = [
  { id: 'sprint', badge: '25m', label: 'Sprint', description: 'Short bursts.' },
  { id: 'flow', badge: '50m', label: 'Flow', description: 'Balanced rhythm.' },
  { id: 'deep', badge: '90m', label: 'Deep', description: 'Intense focus.' },
];

export default function FocusStyleScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const selected = useOnboardingStore((state) => state.focusStyle);
  const setSelected = useOnboardingStore((state) => state.setFocusStyle);

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
    <FocusStyleTemplate
      step={ONBOARDING_STEPS.focusStyle}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      options={FOCUS_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onContinue={() => router.replace('/coach-persona')}
      onBack={() => router.replace('/your-why')}
    />
  );
}
