import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { FocusStyleTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

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

  const [selected, setSelected] = useState<string | null>('flow');

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

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
