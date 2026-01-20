import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, TextInput, View, Switch } from 'react-native';
import type { EventCategory } from '@/stores';

export interface ActualAdjustSuggestion {
  category: EventCategory;
  title?: string;
  description?: string;
  confidence?: number;
  reason?: string;
}

export interface ActualAdjustTemplateProps {
  title: string;
  timeLabel: string;
  selectedCategory: EventCategory;
  isBig3: boolean;
  values: string[];
  selectedValue: string | null;
  linkedGoals: Array<{ id: string; label: string }>;
  selectedGoalId: string | null;
  note: string;
  helperText: string;
  evidenceRows?: Array<{ label: string; value: string }>;
  suggestion?: ActualAdjustSuggestion | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onChangeNote: (value: string) => void;
  onToggleBig3: (value: boolean) => void;
  onSelectCategory: (value: EventCategory) => void;
  onSelectValue: (value: string | null) => void;
  onSelectGoal: (value: string | null) => void;
}

const LIFE_AREA_OPTIONS: Array<{ id: EventCategory; label: string }> = [
  { id: 'routine', label: 'Faith' },
  { id: 'family', label: 'Family' },
  { id: 'work', label: 'Work' },
  { id: 'health', label: 'Health' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'digital', label: 'Digital' },
  { id: 'unknown', label: 'Other' },
];

export const ActualAdjustTemplate = ({
  title,
  timeLabel,
  selectedCategory,
  isBig3,
  values,
  selectedValue,
  linkedGoals,
  selectedGoalId,
  note,
  helperText,
  evidenceRows = [],
  suggestion,
  isSaving,
  onCancel,
  onSave,
  onChangeNote,
  onToggleBig3,
  onSelectCategory,
  onSelectValue,
  onSelectGoal,
}: ActualAdjustTemplateProps) => {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const confidenceRow = useMemo(
    () => evidenceRows.find((row) => row.label.toLowerCase() === 'confidence') ?? null,
    [evidenceRows],
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F7FAFF]">
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <Pressable onPress={onCancel} className="px-3 py-2" disabled={isSaving}>
          <Text className="text-[14px] font-semibold text-[#64748B]">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-semibold text-[#111827]">Adjust Actual</Text>
        <Pressable
          onPress={onSave}
          className="px-3 py-2"
          disabled={isSaving}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-[14px] font-semibold text-[#2563EB]">
            {isSaving ? 'Saving…' : 'Done'}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8">
        <View className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
          <Text className="text-[14px] font-semibold text-[#111827]">{title}</Text>
          <Text className="mt-1 text-[12px] text-[#64748B]">{timeLabel}</Text>
        </View>

        <View className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold text-[#111827]">Mark as Big 3</Text>
            <Switch
              value={isBig3}
              onValueChange={onToggleBig3}
              trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
              thumbColor={isBig3 ? '#2563EB' : '#FFFFFF'}
            />
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-[12px] font-semibold text-[#F97316]">LIFE AREA</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {LIFE_AREA_OPTIONS.map((option) => {
              const isSelected = selectedCategory === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onSelectCategory(option.id)}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected ? 'border-[#2563EB] bg-[#DBEAFE]' : 'border-[#E2E8F0] bg-white'
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Text
                    className={`text-[12px] font-semibold ${
                      isSelected ? 'text-[#1D4ED8]' : 'text-[#64748B]'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-[12px] font-semibold text-[#94A3B8]">ALIGN WITH VALUES</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {values.length === 0 && (
              <Text className="text-[12px] text-[#94A3B8]">No values found</Text>
            )}
            {values.map((value) => {
              const isSelected = selectedValue === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onSelectValue(isSelected ? null : value)}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected ? 'border-[#2563EB] bg-[#DBEAFE]' : 'border-[#E2E8F0] bg-white'
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Text
                    className={`text-[12px] font-semibold ${
                      isSelected ? 'text-[#1D4ED8]' : 'text-[#64748B]'
                    }`}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-[12px] font-semibold text-[#94A3B8]">LINKED GOAL</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => onSelectGoal(null)}
              className={`rounded-full border px-4 py-2 ${
                !selectedGoalId ? 'border-[#2563EB] bg-[#DBEAFE]' : 'border-[#E2E8F0] bg-white'
              }`}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className={`text-[12px] font-semibold ${!selectedGoalId ? 'text-[#1D4ED8]' : 'text-[#64748B]'}`}>
                None
              </Text>
            </Pressable>
            {linkedGoals.map((goal) => {
              const isSelected = selectedGoalId === goal.id;
              return (
                <Pressable
                  key={goal.id}
                  onPress={() => onSelectGoal(isSelected ? null : goal.id)}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected ? 'border-[#2563EB] bg-[#DBEAFE]' : 'border-[#E2E8F0] bg-white'
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Text
                    className={`text-[12px] font-semibold ${
                      isSelected ? 'text-[#1D4ED8]' : 'text-[#64748B]'
                    }`}
                  >
                    {goal.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
          <Text className="text-[13px] font-semibold text-[#111827]">Tell us what really happened</Text>
          <TextInput
            value={note}
            onChangeText={onChangeNote}
            placeholder={helperText}
            placeholderTextColor="#9CA3AF"
            multiline
            className="mt-3 min-h-[110px] rounded-xl border border-[#E5E7EB] px-3 py-3 text-[14px] text-[#111827]"
          />
          {suggestion?.confidence !== undefined && (
            <Text className="mt-3 text-[12px] text-[#6B7280]">
              {Math.round(suggestion.confidence * 100)}% confidence
            </Text>
          )}
          {suggestion?.reason && (
            <Text className="mt-2 text-[12px] text-[#6B7280]">{suggestion.reason}</Text>
          )}
        </View>

        {evidenceRows.length > 0 && (
          <View className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
            <Pressable
              onPress={() => setIsEvidenceExpanded((prev) => !prev)}
              className="flex-row items-center justify-between"
            >
              <Text className="text-[13px] font-semibold text-[#111827]">Why we marked this</Text>
              <Text className="text-[12px] font-semibold text-[#2563EB]">
                {confidenceRow?.value ?? (isEvidenceExpanded ? 'Hide' : 'Details')}
              </Text>
            </Pressable>
            {isEvidenceExpanded && (
              <View className="mt-3 gap-2">
                {evidenceRows.map((row) => (
                  <View key={row.label} className="flex-row items-center justify-between">
                    <Text className="text-[12px] text-[#64748B]">{row.label}</Text>
                    <Text className="text-[12px] font-semibold text-[#111827]">{row.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
