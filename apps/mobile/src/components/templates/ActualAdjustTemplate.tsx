import { useMemo, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  titleValue: string;
  timeLabel: string;
  sleepStartLabel?: string;
  sleepEndLabel?: string;
  isSleep?: boolean;
  selectedCategory: EventCategory;
  isBig3: boolean;
  values: string[];
  selectedValue: string | null;
  linkedGoals: Array<{ id: string; label: string }>;
  selectedGoalId: string | null;
  goalContribution: number | null;
  note: string;
  helperText: string;
  evidenceRows?: Array<{ label: string; value: string }>;
  suggestion?: ActualAdjustSuggestion | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onSplit?: () => void;
  onEditSleepStart?: () => void;
  onEditSleepEnd?: () => void;
  onChangeTitle: (value: string) => void;
  onChangeNote: (value: string) => void;
  onToggleBig3: (value: boolean) => void;
  onSelectCategory: (value: EventCategory) => void;
  onSelectValue: (value: string | null) => void;
  onSelectGoal: (value: string | null) => void;
  onSelectGoalContribution: (value: number | null) => void;
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
  titleValue,
  timeLabel,
  sleepStartLabel,
  sleepEndLabel,
  isSleep = false,
  selectedCategory,
  isBig3,
  values,
  selectedValue,
  linkedGoals,
  selectedGoalId,
  goalContribution,
  note,
  helperText,
  evidenceRows = [],
  suggestion,
  isSaving,
  onCancel,
  onSave,
  onSplit,
  onEditSleepStart,
  onEditSleepEnd,
  onChangeTitle,
  onChangeNote,
  onToggleBig3,
  onSelectCategory,
  onSelectValue,
  onSelectGoal,
  onSelectGoalContribution,
}: ActualAdjustTemplateProps) => {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const confidenceRow = useMemo(
    () => evidenceRows.find((row) => row.label.toLowerCase() === 'confidence') ?? null,
    [evidenceRows],
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F7FAFF]">
      <View
        className="flex-row items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
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

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
          <TextInput
            value={titleValue}
            onChangeText={onChangeTitle}
            placeholder={title}
            placeholderTextColor="#94A3B8"
            className="text-[14px] font-semibold text-[#111827]"
            autoCapitalize="sentences"
            returnKeyType="done"
          />
          <Text className="mt-1 text-[12px] text-[#64748B]">{timeLabel}</Text>
          {onSplit && (
            <Pressable
              onPress={onSplit}
              className="mt-3 self-start rounded-full border border-[#E2E8F0] bg-white px-3 py-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-[12px] font-semibold text-[#2563EB]">Split event</Text>
            </Pressable>
          )}
        </View>

        {isSleep && (
          <View className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
            <Text className="text-[13px] font-semibold text-[#111827]">Sleep timing</Text>
            <Text className="mt-1 text-[12px] text-[#64748B]">
              Adjust the start and end time to match when you actually slept.
            </Text>
            <View className="mt-3 flex-row gap-3">
              <Pressable
                onPress={onEditSleepStart}
                className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-[11px] font-semibold text-[#64748B]">Start</Text>
                <Text className="mt-1 text-[14px] font-semibold text-[#111827]">
                  {sleepStartLabel ?? 'Set time'}
                </Text>
              </Pressable>
              <Pressable
                onPress={onEditSleepEnd}
                className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-[11px] font-semibold text-[#64748B]">End</Text>
                <Text className="mt-1 text-[14px] font-semibold text-[#111827]">
                  {sleepEndLabel ?? 'Set time'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

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

        {selectedGoalId && (
          <View className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
            <Text className="text-[13px] font-semibold text-[#111827]">Contribution</Text>
            <Text className="mt-1 text-[12px] text-[#64748B]">
              How much did this activity contribute to that goal?
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {[
                { label: 'Not set', value: null },
                { label: 'Partial (50%)', value: 50 },
                { label: 'Complete (100%)', value: 100 },
              ].map((option) => {
                const isSelected = goalContribution === option.value;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => onSelectGoalContribution(option.value)}
                    className={`rounded-full border px-3 py-2 ${
                      isSelected ? 'border-[#6366F1] bg-[#EEF2FF]' : 'border-[#E2E8F0] bg-white'
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text
                      className={`text-[12px] font-semibold ${
                        isSelected ? 'text-[#4338CA]' : 'text-[#64748B]'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

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
