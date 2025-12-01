import { useState } from 'react';
import { useRouter } from 'expo-router';
import { PermissionsTemplate } from '@/components/templates';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function PermissionsScreen() {
  const router = useRouter();
  const [allowAll, setAllowAll] = useState(true);

  const handleAllowAllToggle = () => {
    setAllowAll((prev) => !prev);
  };

  const handleContinue = () => {
    router.replace('/setup-questions');
  };

  const handleCustomizeLater = () => {
    router.replace('/setup-questions');
  };

  return (
    <PermissionsTemplate
      allowAllEnabled={allowAll}
      onToggleAllowAll={handleAllowAllToggle}
      onContinue={handleContinue}
      onCustomizeLater={handleCustomizeLater}
      onBack={() => router.replace('/signup')}
      step={ONBOARDING_STEPS.permissions}
      totalSteps={ONBOARDING_TOTAL_STEPS}
    />
  );
}
