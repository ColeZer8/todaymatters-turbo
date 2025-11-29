import { ArrowRight } from 'lucide-react-native';
import { View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { RadioOptionCard } from '@/components/molecules';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface FocusStyleOption {
  id: string;
  label: string;
  description?: string;
  badge: string;
}

interface FocusStyleTemplateProps {
  step?: number;
  totalSteps?: number;
  options: FocusStyleOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
}

export const FocusStyleTemplate = ({
  step = ONBOARDING_STEPS.focusStyle,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  options,
  selectedId,
  onSelect,
  onContinue,
  onBack,
}: FocusStyleTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Focus Style"
      subtitle="How long do you like to work uninterrupted?"
      onBack={onBack}
      footer={<GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />}
    >
      <View className="mt-5 gap-3">
        {options.map((option) => (
          <RadioOptionCard
            key={option.id}
            badge={option.badge}
            label={option.label}
            description={option.description}
            selected={selectedId === option.id}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
    </SetupStepLayout>
  );
};
