import { useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PermissionsTemplate } from '@/components/templates';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore, type PermissionKey } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';

export default function PermissionsScreen() {
  const router = useRouter();
  const [showIndividual, setShowIndividual] = useState(false);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const permissions = useOnboardingStore((state) => state.permissions);
  const togglePermission = useOnboardingStore((state) => state.togglePermission);
  const setAllPermissions = useOnboardingStore((state) => state.setAllPermissions);

  const { savePermissions } = useOnboardingSync({ autoLoad: false, autoSave: false });

  // Derived: all permissions enabled = allowAll is on
  const allEnabled = useMemo(
    () => Object.values(permissions).every(Boolean),
    [permissions]
  );

  const handleAllowAllToggle = useCallback(() => {
    setAllPermissions(!allEnabled);
  }, [allEnabled, setAllPermissions]);

  const handleTogglePermission = useCallback(
    (key: PermissionKey) => {
      togglePermission(key);
    },
    [togglePermission]
  );

  const handleToggleShowIndividual = useCallback(() => {
    setShowIndividual((prev) => !prev);
  }, []);

  const handleContinue = () => {
    void savePermissions(permissions);
    router.replace('/connect-google-services');
  };

  if (!hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <PermissionsTemplate
      allowAllEnabled={allEnabled}
      onToggleAllowAll={handleAllowAllToggle}
      showIndividual={showIndividual}
      onToggleShowIndividual={handleToggleShowIndividual}
      permissions={permissions}
      onTogglePermission={handleTogglePermission}
      onContinue={handleContinue}
      onBack={() => router.replace('/signup')}
      step={ONBOARDING_STEPS.permissions}
      totalSteps={ONBOARDING_TOTAL_STEPS}
    />
  );
}
