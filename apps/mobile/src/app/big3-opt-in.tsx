import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { Big3OptInTemplate } from '@/components/templates/Big3OptInTemplate';
import { useAuthStore } from '@/stores';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { fetchUserDataPreferences, upsertUserDataPreferences } from '@/lib/supabase/services/user-preferences';
import { useUserPreferencesStore } from '@/stores/user-preferences-store';

export default function Big3OptInScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const setBig3Enabled = useOnboardingStore((state) => state.setBig3Enabled);
  const updatePreferences = useUserPreferencesStore((state) => state.updatePreferences);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const saveBig3Preference = async (enabled: boolean) => {
    if (!userId) return;
    try {
      const current = await fetchUserDataPreferences(userId);
      const updated = { ...current, big3Enabled: enabled };
      await upsertUserDataPreferences({ userId, preferences: updated });
      updatePreferences({ big3Enabled: enabled });
      setBig3Enabled(enabled);
    } catch (error) {
      if (__DEV__) {
        console.warn('[Big3OptIn] Failed to save preference:', error);
      }
    }
  };

  const handleEnable = () => {
    setBig3Enabled(true);
    void saveBig3Preference(true);
    router.replace('/ai-summary');
  };

  const handleSkip = () => {
    setBig3Enabled(false);
    void saveBig3Preference(false);
    router.replace('/ai-summary');
  };

  const handleBack = () => {
    router.replace('/setup-questions');
  };

  return (
    <Big3OptInTemplate
      step={SETUP_SCREENS_STEPS.big3OptIn}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      onEnable={handleEnable}
      onSkip={handleSkip}
      onBack={handleBack}
    />
  );
}
