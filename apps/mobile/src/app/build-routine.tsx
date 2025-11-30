import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { RoutineBuilderTemplate } from '@/components/templates/RoutineBuilderTemplate';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useRoutineBuilderStore } from '@/stores/routine-builder-store';

const QUICK_ADD = ['Brush Teeth', 'Shower', 'Make Bed', 'Read', 'Meditate', 'Walk Dog', 'Make Breakfast'];

export default function BuildRoutineScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const items = useRoutineBuilderStore((state) => state.items);
  const wakeTime = useRoutineBuilderStore((state) => state.wakeTime);
  const setItems = useRoutineBuilderStore((state) => state.setItems);
  const updateMinutes = useRoutineBuilderStore((state) => state.updateMinutes);
  const addItem = useRoutineBuilderStore((state) => state.addItem);
  const deleteItem = useRoutineBuilderStore((state) => state.deleteItem);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  return (
    <RoutineBuilderTemplate
      step={ONBOARDING_STEPS.routine}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      items={items}
      onReorder={setItems}
      onChangeMinutes={updateMinutes}
      onDelete={deleteItem}
      onAddItem={addItem}
      quickAddItems={QUICK_ADD}
      wakeTime={wakeTime}
      onContinue={() => router.replace('/ideal-day')}
      onBack={() => router.back()}
    />
  );
}
