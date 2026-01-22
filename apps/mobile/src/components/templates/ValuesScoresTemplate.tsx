import { useMemo } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { GradientButton, HardenedSlider } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { CoreValue, ValueScore } from '@/stores/onboarding-store';

interface ValuesScoresTemplateProps {
  step?: number;
  totalSteps?: number;
  coreValues: CoreValue[];
  valuesScores: ValueScore[];
  onUpdateScore: (valueId: string, score: number) => void;
  onContinue: () => void;
  onBack?: () => void;
}

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const getScoreColor = (score: number) => {
  if (score <= 3) return '#EF4444'; // Red
  if (score <= 6) return '#F59E0B'; // Yellow
  return '#10B981'; // Green
};

const getScoreLabel = (score: number) => {
  if (score <= 3) return 'Needs Work';
  if (score <= 6) return 'Getting There';
  return 'Doing Well';
};

interface ScoreSliderProps {
  label: string;
  score: number;
  onScoreChange: (score: number) => void;
}

const ScoreSlider = ({ label, score, onScoreChange }: ScoreSliderProps) => {
  const scoreColor = getScoreColor(score);

  return (
    <View
      className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
      style={cardShadowStyle}
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-semibold text-text-primary">{label}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-medium" style={{ color: scoreColor }}>
            {getScoreLabel(score)}
          </Text>
          <View
            className="min-w-[32px] rounded-lg px-2 py-1"
            style={{ backgroundColor: scoreColor + '20' }}
          >
            <Text
              className="text-center text-sm font-bold"
              style={{ color: scoreColor }}
            >
              {score}
            </Text>
          </View>
        </View>
      </View>

      {/* Slider */}
      <HardenedSlider
        value={score}
        min={1}
        max={10}
        step={1}
        fillColor={scoreColor}
        accessibilityLabel={`${label} score`}
        onChange={(next) => onScoreChange(next)}
      />

      {/* Scale Labels */}
      <View className="flex-row justify-between mt-2 px-1">
        <Text className="text-[10px] text-[#94A3B8]">Struggling</Text>
        <Text className="text-[10px] text-[#94A3B8]">Thriving</Text>
      </View>
    </View>
  );
};

export const ValuesScoresTemplate = ({
  step = ONBOARDING_STEPS.valuesScores,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  coreValues,
  valuesScores,
  onUpdateScore,
  onContinue,
  onBack,
}: ValuesScoresTemplateProps) => {
  const selectedValues = useMemo(
    () => coreValues.filter((v) => v.isSelected),
    [coreValues]
  );

  const getScoreForValue = (valueId: string) => {
    const found = valuesScores.find((s) => s.valueId === valueId);
    return found?.score || 5; // Default to 5
  };

  const averageScore = useMemo(() => {
    if (selectedValues.length === 0) return 0;
    const totalScore = selectedValues.reduce(
      (sum, v) => sum + getScoreForValue(v.id),
      0
    );
    return Math.round((totalScore / selectedValues.length) * 10) / 10;
  }, [selectedValues, valuesScores]);

  const averageColor = getScoreColor(averageScore);

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="How Are You Doing?"
      subtitle="Rate yourself honestly in each area. This helps us understand where to focus."
      onBack={onBack}
      footer={<GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />}
    >
      <View className="mt-2 gap-4">
        {/* Average Score Card */}
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
          style={cardShadowStyle}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: averageColor + '20' }}
            >
              <TrendingUp size={24} color={averageColor} />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-[#94A3B8]">Overall Score</Text>
              <Text
                className="text-2xl font-bold"
                style={{ color: averageColor }}
              >
                {averageScore.toFixed(1)}
              </Text>
            </View>
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: averageColor + '20' }}
            >
              <Text className="text-sm font-semibold" style={{ color: averageColor }}>
                {getScoreLabel(averageScore)}
              </Text>
            </View>
          </View>
        </View>

        {/* Value Sliders */}
        {selectedValues.map((value) => (
          <ScoreSlider
            key={value.id}
            label={value.label}
            score={getScoreForValue(value.id)}
            onScoreChange={(score) => onUpdateScore(value.id, score)}
          />
        ))}

        {/* Info Text */}
        <Text className="text-xs text-center text-[#94A3B8] px-4">
          Be honest with yourself. There's no judgment here - this is just to help
          you understand where you are today.
        </Text>
      </View>
    </SetupStepLayout>
  );
};
