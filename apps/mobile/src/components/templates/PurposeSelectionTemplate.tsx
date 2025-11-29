import { ArrowRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { IconChoiceCard } from '@/components/molecules';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface PurposeOption {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
}

interface PurposeSelectionTemplateProps {
  step?: number;
  totalSteps?: number;
  options: PurposeOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
}

export const PurposeSelectionTemplate = ({
  step = ONBOARDING_STEPS.yourWhy,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  options,
  selectedId,
  onSelect,
  onContinue,
  onBack,
}: PurposeSelectionTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Your Why"
      subtitle="What is your primary driver?"
      onBack={onBack}
      footer={<GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />}
    >
      <View className="flex-row flex-wrap justify-between mt-5 gap-3.5">
        {options.map((option) => (
          <IconChoiceCard
            key={option.id}
            title={option.title}
            description={option.description}
            icon={option.icon}
            selected={selectedId === option.id}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
    </SetupStepLayout>
  );
};
