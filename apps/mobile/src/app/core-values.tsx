import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { CoreValuesTemplate } from '@/components/templates/CoreValuesTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

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

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleContinue = () => {
    router.replace('/core-categories');
  };

  const handleBack = () => {
    router.replace('/connect-google-services');
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
      step={ONBOARDING_STEPS.coreValues}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      coreValues={coreValues}
      onToggleValue={toggleCoreValue}
      onAddValue={addCoreValue}
      onRemoveValue={removeCoreValue}
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
