import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { IdealDayTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useIdealDayStore } from '@/stores/ideal-day-store';

export default function IdealDayScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const categories = useIdealDayStore((state) => state.categories);
  const dayType = useIdealDayStore((state) => state.dayType);
  const setDayType = useIdealDayStore((state) => state.setDayType);
  const setHours = useIdealDayStore((state) => state.setHours);
  const addCategory = useIdealDayStore((state) => state.addCategory);
  const deleteCategory = useIdealDayStore((state) => state.deleteCategory);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  return (
    <IdealDayTemplate
      step={ONBOARDING_STEPS.idealDay}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      categories={categories}
      dayType={dayType}
      onDayTypeChange={setDayType}
      onCategoryHoursChange={setHours}
      onAddCategory={addCategory}
      onDeleteCategory={deleteCategory}
      onContinue={() => router.replace('/home')}
      onSkip={() => router.back()}
    />
  );
}
