import { ArrowRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { IconListCard } from '@/components/molecules';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface MorningMindsetOption {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
}

interface MorningMindsetTemplateProps {
  step?: number;
  totalSteps?: number;
  options: ReadonlyArray<MorningMindsetOption>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
}

export const MorningMindsetTemplate = ({
  step = ONBOARDING_STEPS.morningMindset,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  options,
  selectedId,
  onSelect,
  onContinue,
  onBack,
}: MorningMindsetTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Morning Mindset"
      subtitle="How do you want your morning to feel?"
      onBack={onBack}
      footer={<GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />}
    >
      <View className="mt-5 gap-3">
        {options.map((option) => (
          <IconListCard
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
