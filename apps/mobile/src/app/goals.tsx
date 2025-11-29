import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { GoalsTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function GoalsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [goals, setGoals] = useState<string[]>(['Launch MVP', 'Run 5k']);
  const [initiatives, setInitiatives] = useState<string[]>(['Q4 Strategy', 'Team Hiring']);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const addGoal = () => {
    setGoals((prev) => [...prev, '']);
  };

  const removeGoal = (index: number) => {
    setGoals((prev) => prev.filter((_, idx) => idx !== index));
  };

  const changeGoal = (index: number, value: string) => {
    setGoals((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const addInitiative = () => {
    setInitiatives((prev) => [...prev, '']);
  };

  const removeInitiative = (index: number) => {
    setInitiatives((prev) => prev.filter((_, idx) => idx !== index));
  };

  const changeInitiative = (index: number, value: string) => {
    setInitiatives((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  return (
    <GoalsTemplate
      step={ONBOARDING_STEPS.goals}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      goals={goals}
      initiatives={initiatives}
      onAddGoal={addGoal}
      onRemoveGoal={removeGoal}
      onChangeGoal={changeGoal}
      onAddInitiative={addInitiative}
      onRemoveInitiative={removeInitiative}
      onChangeInitiative={changeInitiative}
      onContinue={() => router.replace('/home')}
      onBack={() => router.back()}
    />
  );
}
