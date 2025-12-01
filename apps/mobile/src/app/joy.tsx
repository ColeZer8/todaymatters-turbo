import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { TagSelectionTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

const JOY_OPTIONS = [
  'Reading',
  'Exercise',
  'Music',
  'Travel',
  'Tech',
  'Cooking',
  'Art',
  'Photography',
  'Gaming',
  'Outdoors',
  'Friends & Family',
];

export default function JoyScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [selected, setSelected] = useState<string[]>(['Reading', 'Exercise', 'Music']);
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
      step={ONBOARDING_STEPS.joy}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      title="What brings you joy?"
      subtitle="Select things that energize you."
      placeholder="Search hobbies..."
      options={JOY_OPTIONS}
      selectedOptions={selected}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onToggleOption={toggleSelection}
      onContinue={() => router.replace('/drains')}
      onBack={() => router.replace('/daily-rhythm')}
      tone="primary"
    />
  );
}
