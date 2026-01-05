import { useEffect, useMemo } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { NameTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';
import { deriveFullNameFromEmail } from '@/lib/user-name';

export default function NameScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useOnboardingStore((s) => s._hasHydrated);

  const fullName = useOnboardingStore((s) => s.fullName);
  const setFullName = useOnboardingStore((s) => s.setFullName);

  const suggestedName = useMemo(() => deriveFullNameFromEmail(user?.email), [user?.email]);

  const { saveFullName } = useOnboardingSync({
    autoLoad: false,
    autoSave: false,
    onError: (err) => console.error('Failed to save name:', err),
  });

  // Seed from email if empty (temporary until we fully pull from auth profile info).
  useEffect(() => {
    if (!hasHydrated) return;
    if (fullName.trim()) return;
    if (suggestedName) setFullName(suggestedName);
  }, [fullName, hasHydrated, setFullName, suggestedName]);

  // Save to Supabase when name changes (debounced).
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    const trimmed = fullName.trim();
    if (!trimmed) return;
    const timeoutId = setTimeout(() => {
      void saveFullName(trimmed);
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [fullName, hasHydrated, isAuthenticated, saveFullName]);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const isContinueDisabled = fullName.trim().length === 0;

  return (
    <NameTemplate
      step={ONBOARDING_STEPS.name}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      fullName={fullName}
      onChangeFullName={setFullName}
      isContinueDisabled={isContinueDisabled}
      onContinue={() => router.replace('/daily-rhythm')}
      onBack={() => router.replace('/setup-questions')}
    />
  );
}


