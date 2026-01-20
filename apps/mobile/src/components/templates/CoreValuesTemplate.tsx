import { useState } from 'react';
import { ArrowRight, Plus, X, Cross, Users, Briefcase, Moon, TrendingUp, Heart, Home, Palette, Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { CoreValue } from '@/stores/onboarding-store';

interface CoreValuesTemplateProps {
  step?: number;
  totalSteps?: number;
  coreValues: CoreValue[];
  onToggleValue?: (id: string) => void;
  onAddValue?: (label: string) => void;
  onRemoveValue?: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  isSelectionLocked?: boolean;
}

const ICON_MAP: Record<string, typeof Cross> = {
  cross: Cross,
  users: Users,
  briefcase: Briefcase,
  moon: Moon,
  'trending-up': TrendingUp,
  heart: Heart,
  home: Home,
  palette: Palette,
  star: Star,
};

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const VALUE_EXPLANATIONS: Record<string, { description: string; answer: string }> = {
  faith: {
    description: 'Meaning and spiritual life rooted in purpose and eternal perspective.',
    answer: 'Why do I live the way I live?',
  },
  family: {
    description: 'Relationships and the people you are called to love and lead.',
    answer: 'Who am I responsible to love well?',
  },
  health: {
    description: 'Physical, mental, and emotional vitality that gives you capacity.',
    answer: 'Do I have the capacity to live fully?',
  },
  work: {
    description: 'Calling and contribution through how you create value and serve.',
    answer: 'How do I use my gifts to serve and provide?',
  },
  'personal-growth': {
    description: 'Intentional growth in character, skills, and mindset.',
    answer: 'Am I becoming a better version of myself?',
  },
  finances: {
    description: 'Stewardship and security in how you manage resources.',
    answer: 'Am I stewarding resources wisely and responsibly?',
  },
};

const VALUE_COLORS: Record<string, string> = {
  faith: '#F33C83',
  family: '#F59E0B',
  health: '#F95C2E',
  work: '#1FA56E',
  'personal-growth': '#8B5CF6',
  finances: '#10B981',
};

export const CoreValuesTemplate = ({
  step = ONBOARDING_STEPS.coreValues,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  coreValues,
  onToggleValue,
  onAddValue,
  onRemoveValue,
  onContinue,
  onBack,
  isSelectionLocked = false,
}: CoreValuesTemplateProps) => {
  const [newValueText, setNewValueText] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const selectedCount = coreValues.filter((v) => v.isSelected).length;

  const handleAddCustom = () => {
    if (!onAddValue) return;
    if (newValueText.trim()) {
      onAddValue(newValueText.trim());
      setNewValueText('');
      setIsAddingCustom(false);
    }
  };

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Core Values Framework"
      subtitle={
        isSelectionLocked
          ? 'These six values shape how Today Matters classifies your time.'
          : 'Start with the six core values. Add more if you want.'
      }
      onBack={onBack}
      footer={
        <GradientButton
          label="Continue"
          onPress={onContinue}
          rightIcon={ArrowRight}
          disabled={selectedCount === 0}
        />
      }
    >
      <View className="mt-2 gap-4">
        {/* Intro Card */}
        <View className="rounded-3xl border border-[#DBEAFE] bg-[#EFF6FF] px-5 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-text-primary">
              Why these six?
            </Text>
            <View className="flex-row gap-2">
              <View className="h-2 w-2 rounded-full bg-[#F33C83]" />
              <View className="h-2 w-2 rounded-full bg-[#F59E0B]" />
              <View className="h-2 w-2 rounded-full bg-[#F95C2E]" />
              <View className="h-2 w-2 rounded-full bg-[#1FA56E]" />
              <View className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
              <View className="h-2 w-2 rounded-full bg-[#10B981]" />
            </View>
          </View>
          <Text className="mt-3 text-sm leading-5 text-text-secondary">
            We use one shared framework so your calendar, habits, and coaching all speak the same
            language. Every activity gets tagged to one primary value, then (optionally) a
            sub-category to explain why.
          </Text>
          {isSelectionLocked && (
            <Text className="mt-3 text-sm leading-5 text-text-secondary">
              These six values are fixed so your time stays consistent. Next you'll add
              sub-categories that explain why each activity matters.
            </Text>
          )}
        </View>

        {!isSelectionLocked && (
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Select Your Values
            </Text>
            <Text className="text-sm font-semibold text-brand-primary">
              {selectedCount} selected
            </Text>
          </View>
        )}

        {/* Values Grid */}
        <View className="flex-row flex-wrap gap-3">
          {coreValues.map((value) => {
            const IconComponent = ICON_MAP[value.icon] || Star;
            const isSelected = value.isSelected;
            const details = VALUE_EXPLANATIONS[value.id];

            const accentColor = VALUE_COLORS[value.id] ?? '#2563EB';

            if (isSelectionLocked) {
              return (
                <View
                  key={value.id}
                  className="w-full rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
                  style={cardShadowStyle}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: accentColor }}
                    >
                      <IconComponent size={18} color="#fff" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-text-primary">
                        {value.label}
                      </Text>
                      {details ? (
                        <Text className="text-sm text-text-secondary">
                          {details.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {details ? (
                    <Text className="mt-3 text-sm font-semibold" style={{ color: accentColor }}>
                      {details.answer}
                    </Text>
                  ) : null}
                </View>
              );
            }

            return (
              <Pressable
                key={value.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => onToggleValue?.(value.id)}
                disabled={isSelectionLocked}
                className={`flex-row items-center gap-2 rounded-2xl border px-4 py-3 ${
                  isSelected
                    ? 'border-brand-primary bg-[#EEF2FF]'
                    : 'border-[#E4E8F0] bg-white'
                }`}
                style={[cardShadowStyle, { opacity: isSelected ? 1 : 0.85 }]}
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-xl ${
                    isSelected ? 'bg-brand-primary' : 'bg-[#F1F5F9]'
                  }`}
                >
                  <IconComponent size={18} color={isSelected ? '#fff' : '#64748B'} />
                </View>
                <Text
                  className={`text-[15px] font-semibold ${
                    isSelected ? 'text-brand-primary' : 'text-text-primary'
                  }`}
                >
                  {value.label}
                </Text>
                {value.isCustom && !isSelectionLocked && onRemoveValue && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${value.label}`}
                    onPress={(e) => {
                      e.stopPropagation();
                      onRemoveValue(value.id);
                    }}
                    className="ml-1 h-6 w-6 items-center justify-center rounded-full bg-[#FEE2E2]"
                    style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                  >
                    <X size={12} color="#EF4444" />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>

        {!isSelectionLocked && onAddValue && (
          <>
            {isAddingCustom ? (
              <View
                className="rounded-2xl border border-[#E4E8F0] bg-white p-4"
                style={cardShadowStyle}
              >
                <Text className="text-sm font-semibold text-text-primary mb-3">
                  Add Custom Value
                </Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={newValueText}
                    onChangeText={setNewValueText}
                    placeholder="Enter value name"
                    placeholderTextColor="#94A3B8"
                    autoFocus
                    className="flex-1 rounded-xl bg-[#F8FAFC] px-4 py-3 text-[15px] text-text-primary"
                    style={{ borderWidth: 1, borderColor: '#E2E8F0' }}
                    onSubmitEditing={handleAddCustom}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleAddCustom}
                    disabled={!newValueText.trim()}
                    className="rounded-xl bg-brand-primary px-4 py-3"
                    style={({ pressed }) => [
                      { opacity: !newValueText.trim() ? 0.5 : pressed ? 0.9 : 1 },
                    ]}
                  >
                    <Text className="text-[15px] font-semibold text-white">Add</Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsAddingCustom(false);
                    setNewValueText('');
                  }}
                  className="items-center py-2 mt-2"
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text className="text-[14px] font-semibold text-[#94A3B8]">Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsAddingCustom(true)}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-4 py-4"
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <Plus size={18} color="#2563EB" />
                <Text className="text-base font-semibold text-brand-primary">
                  Add Custom Value
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </SetupStepLayout>
  );
};
