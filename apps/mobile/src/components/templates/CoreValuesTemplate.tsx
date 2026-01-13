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
  onToggleValue: (id: string) => void;
  onAddValue: (label: string) => void;
  onRemoveValue: (id: string) => void;
  onContinue: () => void;
  onBack?: () => void;
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

export const CoreValuesTemplate = ({
  step = ONBOARDING_STEPS.coreValues,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  coreValues,
  onToggleValue,
  onAddValue,
  onRemoveValue,
  onContinue,
  onBack,
}: CoreValuesTemplateProps) => {
  const [newValueText, setNewValueText] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const selectedCount = coreValues.filter((v) => v.isSelected).length;

  const handleAddCustom = () => {
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
      title="Your Core Values"
      subtitle="What matters most to you? Select the values that guide your life."
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
        {/* Info Card */}
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-[#F5F9FF] px-4 py-3"
          style={cardShadowStyle}
        >
          <Text className="text-sm leading-5 text-text-secondary">
            Core values are the fundamental beliefs that guide your decisions and actions.
            We'll use these to help you track time in ways that matter to you.
          </Text>
        </View>

        {/* Selected Count */}
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Select Your Values
          </Text>
          <Text className="text-sm font-semibold text-brand-primary">
            {selectedCount} selected
          </Text>
        </View>

        {/* Values Grid */}
        <View className="flex-row flex-wrap gap-3">
          {coreValues.map((value) => {
            const IconComponent = ICON_MAP[value.icon] || Star;
            const isSelected = value.isSelected;

            return (
              <Pressable
                key={value.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => onToggleValue(value.id)}
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
                {value.isCustom && (
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

        {/* Add Custom Value */}
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
      </View>
    </SetupStepLayout>
  );
};
