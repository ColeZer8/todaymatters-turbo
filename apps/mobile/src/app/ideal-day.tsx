import { useEffect } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
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

  // Wait for store to hydrate from AsyncStorage
  const hasHydrated = useIdealDayStore((state) => state._hasHydrated);
  const categories = useIdealDayStore((state) => state.categoriesByType[state.dayType]);
  const dayType = useIdealDayStore((state) => state.dayType);
  const setDayType = useIdealDayStore((state) => state.setDayType);
  const setHours = useIdealDayStore((state) => state.setHours);
  const addCategory = useIdealDayStore((state) => state.addCategory);
  const deleteCategory = useIdealDayStore((state) => state.deleteCategory);
  const selectedDays = useIdealDayStore((state) => state.selectedDaysByType[state.dayType]);
  const toggleDay = useIdealDayStore((state) => state.toggleDay);

  // Wait for navigation and hydration
  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

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
      selectedDays={selectedDays}
      onToggleDay={toggleDay}
      onDayTypeChange={setDayType}
      onCategoryHoursChange={setHours}
      onAddCategory={addCategory}
      onDeleteCategory={deleteCategory}
      onContinue={() => router.replace('/home')}
      onSkip={() => router.replace('/build-routine')}
      onBack={() => router.replace('/build-routine')}
    />
  );
}
