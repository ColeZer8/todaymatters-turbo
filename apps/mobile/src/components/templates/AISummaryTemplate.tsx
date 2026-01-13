import { useMemo } from 'react';
import { ArrowRight, CheckCircle, Edit3, Sparkles, Target, Heart, TrendingUp } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { CoreValue, ValueScore } from '@/stores/onboarding-store';

interface AISummaryTemplateProps {
  step?: number;
  totalSteps?: number;
  userName: string;
  coreValues: CoreValue[];
  goals: string[];
  valuesScores: ValueScore[];
  onConfirm: () => void;
  onEdit?: () => void;
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
  if (score <= 3) return '#EF4444';
  if (score <= 6) return '#F59E0B';
  return '#10B981';
};

export const AISummaryTemplate = ({
  step = ONBOARDING_STEPS.aiSummary,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  userName,
  coreValues,
  goals,
  valuesScores,
  onConfirm,
  onEdit,
  onBack,
}: AISummaryTemplateProps) => {
  const selectedValues = useMemo(
    () => coreValues.filter((v) => v.isSelected),
    [coreValues]
  );

  const validGoals = useMemo(
    () => goals.filter((g) => g.trim().length > 0),
    [goals]
  );

  const getScoreForValue = (valueId: string) => {
    const found = valuesScores.find((s) => s.valueId === valueId);
    return found?.score || 5;
  };

  const topStrengths = useMemo(() => {
    return selectedValues
      .map((v) => ({ ...v, score: getScoreForValue(v.id) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
  }, [selectedValues, valuesScores]);

  const growthAreas = useMemo(() => {
    return selectedValues
      .map((v) => ({ ...v, score: getScoreForValue(v.id) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 2);
  }, [selectedValues, valuesScores]);

  const displayName = userName || 'there';

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Does This Look Right?"
      subtitle="Here's what we've learned about you so far."
      onBack={onBack}
      footer={
        <View className="gap-3">
          <GradientButton label="Looks Good!" onPress={onConfirm} rightIcon={ArrowRight} />
          {onEdit && (
            <Pressable
              accessibilityRole="button"
              onPress={onEdit}
              className="flex-row items-center justify-center gap-2 py-3"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Edit3 size={16} color="#64748B" />
              <Text className="text-sm font-semibold text-[#64748B]">
                Make Changes
              </Text>
            </Pressable>
          )}
        </View>
      }
    >
      <View className="mt-2 gap-4">
        {/* AI Greeting Card */}
        <View
          className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-4"
          style={cardShadowStyle}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Sparkles size={20} color="#6366F1" />
            <Text className="text-sm font-semibold text-[#4338CA]">
              Your Profile Summary
            </Text>
          </View>
          <Text className="text-base leading-6 text-[#3730A3]">
            Hi {displayName}! Based on what you've shared, you're someone who values{' '}
            <Text className="font-semibold">
              {selectedValues.slice(0, 3).map((v) => v.label.toLowerCase()).join(', ')}
            </Text>
            {selectedValues.length > 3 && ' and more'}. You're working toward{' '}
            <Text className="font-semibold">
              {validGoals.length} {validGoals.length === 1 ? 'goal' : 'goals'}
            </Text>{' '}
            and we're here to help you make progress every day.
          </Text>
        </View>

        {/* Core Values Summary */}
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
          style={cardShadowStyle}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Heart size={18} color="#2563EB" />
            <Text className="text-sm font-semibold text-text-primary">
              Your Core Values ({selectedValues.length})
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {selectedValues.map((value) => (
              <View
                key={value.id}
                className="rounded-full bg-[#F1F5F9] px-3 py-1.5"
              >
                <Text className="text-sm font-medium text-text-primary">
                  {value.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Goals Summary */}
        {validGoals.length > 0 && (
          <View
            className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
            style={cardShadowStyle}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Target size={18} color="#2563EB" />
              <Text className="text-sm font-semibold text-text-primary">
                Your Goals
              </Text>
            </View>
            <View className="gap-2">
              {validGoals.map((goal, index) => (
                <View key={index} className="flex-row items-center gap-2">
                  <CheckCircle size={16} color="#10B981" />
                  <Text className="text-sm text-text-primary flex-1">{goal}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Strengths & Growth */}
        <View className="flex-row gap-3">
          {/* Strengths */}
          <View
            className="flex-1 rounded-2xl border border-[#D1FAE5] bg-[#ECFDF5] px-3 py-3"
            style={cardShadowStyle}
          >
            <View className="flex-row items-center gap-1.5 mb-2">
              <TrendingUp size={14} color="#059669" />
              <Text className="text-xs font-semibold text-[#047857]">Strengths</Text>
            </View>
            {topStrengths.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between py-1">
                <Text className="text-xs text-[#065F46]">{item.label}</Text>
                <Text className="text-xs font-semibold" style={{ color: getScoreColor(item.score) }}>
                  {item.score}/10
                </Text>
              </View>
            ))}
          </View>

          {/* Growth Areas */}
          <View
            className="flex-1 rounded-2xl border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-3"
            style={cardShadowStyle}
          >
            <View className="flex-row items-center gap-1.5 mb-2">
              <TrendingUp size={14} color="#D97706" />
              <Text className="text-xs font-semibold text-[#B45309]">Growth Areas</Text>
            </View>
            {growthAreas.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between py-1">
                <Text className="text-xs text-[#92400E]">{item.label}</Text>
                <Text className="text-xs font-semibold" style={{ color: getScoreColor(item.score) }}>
                  {item.score}/10
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </SetupStepLayout>
  );
};
