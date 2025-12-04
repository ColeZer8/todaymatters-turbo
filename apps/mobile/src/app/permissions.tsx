import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { PermissionsTemplate, IndividualPermissions, PermissionKey } from '@/components/templates';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

const DEFAULT_PERMISSIONS: IndividualPermissions = {
  calendar: true,
  notifications: true,
  email: true,
  health: true,
  location: true,
  contacts: true,
  browsing: true,
  appUsage: true,
};

export default function PermissionsScreen() {
  const router = useRouter();
  const [showIndividual, setShowIndividual] = useState(false);
  const [permissions, setPermissions] = useState<IndividualPermissions>(DEFAULT_PERMISSIONS);

  // Derived: all permissions enabled = allowAll is on
  const allEnabled = Object.values(permissions).every(Boolean);

  const handleAllowAllToggle = useCallback(() => {
    const newValue = !allEnabled;
    setPermissions({
      calendar: newValue,
      notifications: newValue,
      email: newValue,
      health: newValue,
      location: newValue,
      contacts: newValue,
      browsing: newValue,
      appUsage: newValue,
    });
  }, [allEnabled]);

  const handleTogglePermission = useCallback((key: PermissionKey) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleToggleShowIndividual = useCallback(() => {
    setShowIndividual((prev) => !prev);
  }, []);

  const handleContinue = () => {
    router.replace('/setup-questions');
  };

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
