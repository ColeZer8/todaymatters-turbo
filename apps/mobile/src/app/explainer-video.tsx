import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { ExplainerVideoTemplate } from '@/components/templates/ExplainerVideoTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function ExplainerVideoScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const hasWatched = useOnboardingStore((state) => state.hasWatchedExplainerVideo);
  const setHasWatched = useOnboardingStore((state) => state.setHasWatchedExplainerVideo);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handlePlay = () => {
    // In the future, this could trigger video playback
    // For now, just mark as watched
    setHasWatched(true);
  };

  const handleSkip = () => {
    router.replace('/permissions');
  };

  const handleContinue = () => {
    setHasWatched(true);
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
    <ExplainerVideoTemplate
      step={ONBOARDING_STEPS.explainerVideo}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      hasWatched={hasWatched}
      onPlay={handlePlay}
      onSkip={handleSkip}
      onContinue={handleContinue}
    />
  );
}
