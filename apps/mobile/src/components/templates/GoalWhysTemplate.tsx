import { ArrowRight, Target, Info } from 'lucide-react-native';
import { Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { GoalWhy } from '@/stores/onboarding-store';

interface GoalWhysTemplateProps {
  step?: number;
  totalSteps?: number;
  goals: string[];
  goalWhys: GoalWhy[];
  onUpdateWhy: (goalIndex: number, why: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const GoalWhysTemplate = ({
  step = ONBOARDING_STEPS.goalWhys,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  goals,
  goalWhys,
  onUpdateWhy,
  onContinue,
  onSkip,
  onBack,
}: GoalWhysTemplateProps) => {
  const getWhyForGoal = (goalIndex: number) => {
    const found = goalWhys.find((w) => w.goalIndex === goalIndex);
    return found?.why || '';
  };

  const validGoals = goals.filter((g) => g.trim().length > 0);

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Define Your Why"
      subtitle="Understanding why each goal matters will help you stay motivated."
      onBack={onBack}
      footer={<GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />}
    >
      <View className="mt-2 gap-4">
        {/* Info Card */}
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-[#FFFBEB] px-4 py-3"
          style={cardShadowStyle}
        >
          <View className="flex-row items-start gap-3">
            <Info size={18} color="#F59E0B" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-[#92400E]">
                Why does this matter?
              </Text>
              <Text className="text-sm leading-5 text-[#A16207] mt-1">
                Goals without a clear "why" are easily abandoned. When you know deeply
                why something matters, you'll push through obstacles to achieve it.
              </Text>
            </View>
          </View>
        </View>

        {/* Goals List */}
        {validGoals.length === 0 ? (
          <View
            className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-8 items-center"
            style={cardShadowStyle}
          >
            <Target size={32} color="#94A3B8" />
            <Text className="text-base font-semibold text-text-secondary mt-3">
              No goals defined yet
            </Text>
            <Text className="text-sm text-[#94A3B8] text-center mt-1">
              You can add goals in the previous step
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {validGoals.map((goal, index) => (
              <View
                key={`goal-${index}`}
                className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
                style={cardShadowStyle}
              >
                {/* Goal Header */}
                <View className="flex-row items-center gap-3 mb-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF]">
                    <Target size={18} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Goal #{index + 1}
                    </Text>
                    <Text className="text-base font-semibold text-text-primary">
                      {goal}
                    </Text>
                  </View>
                </View>

                {/* Why Input */}
                <View>
                  <Text className="text-sm font-semibold text-text-secondary mb-2">
                    Why is this important to you?
                  </Text>
                  <TextInput
                    value={getWhyForGoal(index)}
                    onChangeText={(text) => onUpdateWhy(index, text)}
                    placeholder="Because..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    className="rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm text-text-primary min-h-[80px]"
                    style={{
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      textAlignVertical: 'top',
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </SetupStepLayout>
  );
};
