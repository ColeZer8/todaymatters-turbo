import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { VIPContactsTemplate } from '@/components/templates/VIPContactsTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function VIPContactsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const vipContacts = useOnboardingStore((state) => state.vipContacts);
  const addVIPContact = useOnboardingStore((state) => state.addVIPContact);
  const removeVIPContact = useOnboardingStore((state) => state.removeVIPContact);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleContinue = () => {
    router.replace('/my-church');
  };

  const handleSkip = () => {
    router.replace('/my-church');
  };

  const handleBack = () => {
    router.replace('/name');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <VIPContactsTemplate
      step={ONBOARDING_STEPS.vipContacts}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      contacts={vipContacts}
      onAddContact={addVIPContact}
      onRemoveContact={removeVIPContact}
      onContinue={handleContinue}
      onSkip={handleSkip}
      onBack={handleBack}
    />
  );
}
