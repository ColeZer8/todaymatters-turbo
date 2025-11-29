import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { TagSelectionTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

const DRAIN_OPTIONS = [
  'Traffic',
  'Long meetings',
  'Early mornings',
  'Late nights',
  'Small talk',
  'Cold weather',
  'Clutter',
  'Waiting',
  'Interruptions',
  'Context switching',
];

export default function DrainsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [selected, setSelected] = useState<string[]>(['Traffic']);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const toggleSelection = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  return (
    <TagSelectionTemplate
      step={ONBOARDING_STEPS.drains}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      title="What drains you?"
      subtitle="We'll help you minimize these."
      placeholder="Search annoyances..."
      options={DRAIN_OPTIONS}
      selectedOptions={selected}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onToggleOption={toggleSelection}
      onContinue={() => router.replace('/your-why')}
      onBack={() => router.back()}
      tone="danger"
    />
  );
}
