import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { MyChurchTemplate } from '@/components/templates/MyChurchTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';
import { CHURCH_OPTIONS_US_SAMPLE } from '@/constants/churches';

export default function MyChurchScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const churchName = useOnboardingStore((state) => state.churchName);
  const churchAddress = useOnboardingStore((state) => state.churchAddress);
  const churchWebsite = useOnboardingStore((state) => state.churchWebsite);
  const setChurchName = useOnboardingStore((state) => state.setChurchName);
  const setChurchAddress = useOnboardingStore((state) => state.setChurchAddress);
  const setChurchWebsite = useOnboardingStore((state) => state.setChurchWebsite);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleContinue = () => {
    router.replace('/ai-summary');
  };

  const handleSkip = () => {
    router.replace('/ai-summary');
  };

  const handleBack = () => {
    router.replace('/daily-rhythm');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <MyChurchTemplate
      step={SETUP_SCREENS_STEPS.myChurch}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      churchName={churchName}
      churchAddress={churchAddress}
      churchWebsite={churchWebsite}
      onChangeChurchName={setChurchName}
      onChangeChurchAddress={setChurchAddress}
      onChangeChurchWebsite={setChurchWebsite}
      churchOptions={CHURCH_OPTIONS_US_SAMPLE}
      onContinue={handleContinue}
      onSkip={handleSkip}
      onBack={handleBack}
    />
  );
}
