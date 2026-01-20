import { ArrowRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { TextChoiceCard } from '@/components/molecules';
import { SetupStepLayout } from '@/components/organisms';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';

interface SetupQuestionsTemplateProps {
  step?: number;
  totalSteps?: number;
  mode: 'full' | 'fast';
  title: string;
  subtitle: string;
  questionLabel: string;
  question: string;
  options: string[];
  selectedOption?: string | null;
  onSelect: (value: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  onSwitchMode: () => void;
  isContinueDisabled?: boolean;
  switchLabel: string;
}

export const SetupQuestionsTemplate = ({
  step = SETUP_SCREENS_STEPS.setupQuestions,
  totalSteps = SETUP_SCREENS_TOTAL_STEPS,
  mode,
  title,
  subtitle,
  questionLabel,
  question,
  options,
  selectedOption,
  onSelect,
  onContinue,
  onBack,
  onSwitchMode,
  isContinueDisabled = false,
  switchLabel,
}: SetupQuestionsTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      footer={
        <GradientButton
          label={mode === 'fast' ? 'Continue' : 'Next'}
          onPress={onContinue}
          rightIcon={ArrowRight}
          disabled={isContinueDisabled}
        />
      }
    >
      <View className="mt-2">
        <Text className="text-sm font-semibold text-text-secondary">{questionLabel}</Text>
        <Text className="mt-3 text-lg font-semibold text-text-primary">{question}</Text>
      </View>

      <View className="mt-5 gap-3">
        {options.map((option) => {
          const isActive = option === selectedOption;
          return (
            <TextChoiceCard
              key={option}
              label={option}
              selected={isActive}
              onPress={() => onSelect(option)}
            />
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onSwitchMode}
        className="self-start mt-6"
      >
        <Text className="text-sm font-semibold text-brand-primary">{switchLabel}</Text>
      </Pressable>
    </SetupStepLayout>
  );
};
