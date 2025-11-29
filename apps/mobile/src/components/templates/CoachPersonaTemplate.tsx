import { ArrowRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { PersonaCard } from '@/components/molecules';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface CoachPersonaOption {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
}

interface CoachPersonaTemplateProps {
  step?: number;
  totalSteps?: number;
  options: CoachPersonaOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
}

export const CoachPersonaTemplate = ({
  step = ONBOARDING_STEPS.coachPersona,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  options,
  selectedId,
  onSelect,
  onContinue,
  onBack,
}: CoachPersonaTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Coach Persona"
      subtitle="Choose the voice of your AI agent."
      onBack={onBack}
      footer={<GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />}
    >
      <View className="mt-5 gap-3.5">
        {options.map((option) => (
          <PersonaCard
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
