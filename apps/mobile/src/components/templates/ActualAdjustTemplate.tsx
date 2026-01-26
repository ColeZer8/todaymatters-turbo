import { useMemo, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Target, Plus } from 'lucide-react-native';
import type { EventCategory } from '@/stores';
import type { ActivityCategory } from '@/lib/supabase/services/activity-categories';
import { HierarchicalCategoryPicker, Big3InputModal } from '@/components/molecules';
import type { CategoryPath } from '@/components/molecules/HierarchicalCategoryPicker';

export interface ActualAdjustSuggestion {
  category: EventCategory;
  title?: string;
  description?: string;
  confidence?: number;
  reason?: string;
}

/** Big 3 priorities for today */
export interface Big3Priorities {
  priority_1: string;
  priority_2: string;
  priority_3: string;
}

/** Place label state passed from the screen to the template */
export interface PlaceLabelInfo {
  /** The location label from evidence (e.g., "Starbucks", "Office") */
  locationLabel: string;
  /** Whether this place already has a user-defined label in user_places */
  hasExistingLabel: boolean;
  /** Whether the place label form is saving */
  isSavingPlace: boolean;
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
  /** Which Big 3 priority is assigned (1, 2, or 3), or null if none */
  big3Priority: 1 | 2 | 3 | null;
  /** Whether Big 3 feature is enabled for this user */
  big3Enabled: boolean;
  /** Today's Big 3 priorities, or null if not yet set */
  big3Priorities: Big3Priorities | null;
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
  /** Hierarchical activity categories (flat list from Supabase) */
  activityCategories?: ActivityCategory[];
  /** Currently selected hierarchical category id */
  selectedCategoryId?: string | null;
  /** Called when user selects a hierarchical category */
  onSelectActivityCategory?: (categoryId: string, path: CategoryPath) => void;
  /** Place labeling info — shown when event has location evidence */
  placeLabelInfo?: PlaceLabelInfo | null;
  /** Called when user saves a place label */
  onSavePlaceLabel?: (label: string, categoryId: string | null) => void;
  onCancel: () => void;
  onSave: () => void;
  onSplit?: () => void;
  onEditSleepStart?: () => void;
  onEditSleepEnd?: () => void;
  onChangeTitle: (value: string) => void;
  onChangeNote: (value: string) => void;
  onToggleBig3: (value: boolean) => void;
  /** Called when user taps a Big 3 priority button (1, 2, or 3) or null to unassign */
  onSelectBig3Priority: (priority: 1 | 2 | 3 | null) => void;
  /** Called when user sets Big 3 from inline input (no Big 3 set for today) */
  onSetBig3Inline: (p1: string, p2: string, p3: string) => void;
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

// ---------------------------------------------------------------------------
// Big 3 Section — shows priority buttons or inline input
// ---------------------------------------------------------------------------

interface Big3SectionProps {
  big3Priorities: Big3Priorities | null;
  big3Priority: 1 | 2 | 3 | null;
  onSelectBig3Priority: (priority: 1 | 2 | 3 | null) => void;
  onSetBig3Inline: (p1: string, p2: string, p3: string) => void;
}

const Big3Section = ({
  big3Priorities,
  big3Priority,
  onSelectBig3Priority,
  onSetBig3Inline,
}: Big3SectionProps) => {
  const [showModal, setShowModal] = useState(false);

  const hasPriorities =
    big3Priorities &&
    (big3Priorities.priority_1.trim() !== '' ||
      big3Priorities.priority_2.trim() !== '' ||
      big3Priorities.priority_3.trim() !== '');

  if (hasPriorities) {
    const priorities = [
      { num: 1 as const, text: big3Priorities.priority_1 },
      { num: 2 as const, text: big3Priorities.priority_2 },
      { num: 3 as const, text: big3Priorities.priority_3 },
    ].filter((p) => p.text.trim() !== '');

    return (
      <View className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
        <Text className="text-[13px] font-semibold text-[#111827]">Mark as Big 3</Text>
        <Text className="mt-1 text-[12px] text-[#64748B]">
          Assign this time block to one of today's priorities.
        </Text>
        <View className="mt-3 gap-2">
          {priorities.map((p) => {
            const isSelected = big3Priority === p.num;
            return (
              <Pressable
                key={p.num}
                onPress={() => onSelectBig3Priority(isSelected ? null : p.num)}
                className={`flex-row items-center rounded-xl border px-4 py-3 ${
                  isSelected
                    ? 'border-[#2563EB] bg-[#DBEAFE]'
                    : 'border-[#E2E8F0] bg-[#F8FAFC]'
                }`}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View
                  className={`mr-3 h-6 w-6 items-center justify-center rounded-full ${
                    isSelected ? 'bg-[#2563EB]' : 'bg-[#E2E8F0]'
                  }`}
                >
                  <Text
                    className={`text-[12px] font-bold ${
                      isSelected ? 'text-white' : 'text-[#64748B]'
                    }`}
                  >
                    {p.num}
                  </Text>
                </View>
                <Text
                  className={`flex-1 text-[13px] ${
                    isSelected ? 'font-semibold text-[#1D4ED8]' : 'text-[#374151]'
                  }`}
                  numberOfLines={2}
                >
                  {p.text}
                </Text>
                {isSelected && (
                  <Text className="text-[12px] font-semibold text-[#2563EB]">Assigned</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // No Big 3 set for today — show button to open modal
  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        className="mt-4 flex-row items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View className="flex-row items-center flex-1 gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EFF6FF]">
            <Target size={18} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-[14px] font-semibold text-[#111827]">
              Set your Big 3 for today
            </Text>
            <Text className="text-[12px] text-[#64748B]">
              Pick 3 priorities that would make today a success
            </Text>
          </View>
        </View>
        <View className="ml-2">
          <Plus size={20} color="#2563EB" strokeWidth={2.5} />
        </View>
      </Pressable>

      <Big3InputModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={(p1, p2, p3) => {
          onSetBig3Inline(p1, p2, p3);
          setShowModal(false);
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Place Label Section — label this place with name + category
// ---------------------------------------------------------------------------

interface PlaceLabelSectionProps {
  placeLabelInfo: PlaceLabelInfo;
  activityCategories?: ActivityCategory[];
  onSavePlaceLabel: (label: string, categoryId: string | null) => void;
}

const PlaceLabelSection = ({
  placeLabelInfo,
  activityCategories,
  onSavePlaceLabel,
}: PlaceLabelSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [placeName, setPlaceName] = useState(placeLabelInfo.locationLabel);
  const [placeCategoryId, setPlaceCategoryId] = useState<string | null>(null);

  const buttonLabel = placeLabelInfo.hasExistingLabel
    ? 'Edit place label'
    : 'Label this place';

  if (!isExpanded) {
    return (
      <View className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-[#111827]">
              {placeLabelInfo.locationLabel}
            </Text>
            <Text className="mt-1 text-[12px] text-[#64748B]">
              {placeLabelInfo.hasExistingLabel
                ? 'This place has a label. Tap to edit.'
                : 'Label this place so future visits auto-tag correctly.'}
            </Text>
          </View>
          <Pressable
            onPress={() => setIsExpanded(true)}
            className="ml-3 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-[12px] font-semibold text-[#2563EB]">{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
      <Text className="text-[13px] font-semibold text-[#111827]">{buttonLabel}</Text>
      <Text className="mt-1 text-[12px] text-[#64748B]">
        Name this place and assign a category. Future visits will be auto-tagged.
      </Text>

      <View className="mt-3">
        <Text className="text-[11px] font-semibold text-[#64748B]">Place name</Text>
        <TextInput
          value={placeName}
          onChangeText={setPlaceName}
          placeholder="e.g., Home, Office, Gym"
          placeholderTextColor="#94A3B8"
          className="mt-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111827]"
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>

      {activityCategories && activityCategories.length > 0 && (
        <View className="mt-3">
          <Text className="text-[11px] font-semibold text-[#64748B]">Category</Text>
          <View className="mt-1 max-h-[200px] rounded-xl border border-[#E5E7EB] px-2 py-2">
            <HierarchicalCategoryPicker
              categories={activityCategories}
              selectedCategoryId={placeCategoryId}
              onSelect={(categoryId) => setPlaceCategoryId(categoryId)}
            />
          </View>
        </View>
      )}

      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={() => {
            if (placeName.trim()) {
              onSavePlaceLabel(placeName.trim(), placeCategoryId);
            }
          }}
          disabled={!placeName.trim() || placeLabelInfo.isSavingPlace}
          className="rounded-full bg-[#2563EB] px-4 py-2"
          style={({ pressed }) => ({
            opacity: !placeName.trim() || placeLabelInfo.isSavingPlace ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <Text className="text-[12px] font-semibold text-white">
            {placeLabelInfo.isSavingPlace ? 'Saving…' : 'Save label'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIsExpanded(false)}
          className="rounded-full border border-[#E2E8F0] px-4 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-[12px] font-semibold text-[#64748B]">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const ActualAdjustTemplate = ({
  title,
  titleValue,
  timeLabel,
  sleepStartLabel,
  sleepEndLabel,
  isSleep = false,
  selectedCategory,
  isBig3,
  big3Priority,
  big3Enabled,
  big3Priorities,
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
  activityCategories,
  selectedCategoryId,
  onSelectActivityCategory,
  placeLabelInfo,
  onSavePlaceLabel,
  onCancel,
  onSave,
  onSplit,
  onEditSleepStart,
  onEditSleepEnd,
  onChangeTitle,
  onChangeNote,
  onToggleBig3,
  onSelectBig3Priority,
  onSetBig3Inline,
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

        {big3Enabled && (
          <Big3Section
            big3Priorities={big3Priorities}
            big3Priority={big3Priority}
            onSelectBig3Priority={onSelectBig3Priority}
            onSetBig3Inline={onSetBig3Inline}
          />
        )}

        {placeLabelInfo && onSavePlaceLabel && (
          <PlaceLabelSection
            placeLabelInfo={placeLabelInfo}
            activityCategories={activityCategories}
            onSavePlaceLabel={onSavePlaceLabel}
          />
        )}

        <View className="mt-6">
          <Text className="text-[12px] font-semibold text-[#F97316]">LIFE AREA</Text>
          {activityCategories && activityCategories.length > 0 && onSelectActivityCategory ? (
            <View className="mt-3 max-h-[280px] rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2">
              <HierarchicalCategoryPicker
                categories={activityCategories}
                selectedCategoryId={selectedCategoryId}
                onSelect={onSelectActivityCategory}
              />
            </View>
          ) : (
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
          )}
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
