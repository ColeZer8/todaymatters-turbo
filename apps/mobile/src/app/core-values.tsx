import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { CoreValuesTemplate } from '@/components/templates/CoreValuesTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';
import { useOnboardingSync } from '@/lib/supabase/hooks';

export default function CoreValuesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const coreValues = useOnboardingStore((state) => state.coreValues);
  const toggleCoreValue = useOnboardingStore((state) => state.toggleCoreValue);
  const addCoreValue = useOnboardingStore((state) => state.addCoreValue);
  const removeCoreValue = useOnboardingStore((state) => state.removeCoreValue);
  const { saveCoreValues } = useOnboardingSync({ autoLoad: false, autoSave: false });

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    const timeoutId = setTimeout(() => {
      saveCoreValues(coreValues);
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [coreValues, hasHydrated, isAuthenticated, saveCoreValues]);

  const handleContinue = () => {
    saveCoreValues(coreValues);
    router.replace('/core-categories');
  };

  const handleBack = () => {
    router.replace('/permissions');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <CoreValuesTemplate
      step={SETUP_SCREENS_STEPS.coreValues}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      coreValues={coreValues}
      onToggleValue={toggleCoreValue}
      onAddValue={addCoreValue}
      onRemoveValue={removeCoreValue}
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
