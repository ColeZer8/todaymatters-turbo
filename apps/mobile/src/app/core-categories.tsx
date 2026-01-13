import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { CoreCategoriesTemplate } from '@/components/templates/CoreCategoriesTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function CoreCategoriesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const coreValues = useOnboardingStore((state) => state.coreValues);
  const coreCategories = useOnboardingStore((state) => state.coreCategories);
  const addCoreCategory = useOnboardingStore((state) => state.addCoreCategory);
  const removeCoreCategory = useOnboardingStore((state) => state.removeCoreCategory);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleContinue = () => {
    router.replace('/sub-categories');
  };

  const handleSkip = () => {
    router.replace('/sub-categories');
  };

  const handleBack = () => {
    router.replace('/core-values');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <CoreCategoriesTemplate
      step={ONBOARDING_STEPS.coreCategories}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      coreValues={coreValues}
      categories={coreCategories}
      onAddCategory={addCoreCategory}
      onRemoveCategory={removeCoreCategory}
      onContinue={handleContinue}
      onSkip={handleSkip}
      onBack={handleBack}
    />
  );
}
