import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Target, LucideIcon, Plus } from 'lucide-react-native';
import {
  EditableValuePill,
  ProfileAddInput,
  ProfileItemCard,
  ProfileMenuItem,
  ProfilePill,
  ProfileSummaryCard,
} from '@/components/molecules';
import { BottomToolbar } from '@/components/organisms';

type AccentTone = 'blue' | 'purple';

interface ProfileItem {
  id: string;
  label: string;
  icon: LucideIcon;
  accent?: AccentTone;
}

interface ProfileMenuEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
}

interface ProfileTemplateProps {
  name: string;
  role: string;
  badgeLabel: string;
  coreValues: string[];
  goals: ProfileItem[];
  initiatives: ProfileItem[];
  menuItems: ProfileMenuEntry[];
  /** Personalization settings (Daily Rhythm, Coach Persona, etc.) */
  personalizationItems?: ProfileMenuEntry[];
  onEditPress?: () => void;
  onDonePress?: () => void;
  isEditing?: boolean;
  newValueText?: string;
  onChangeNewValue?: (text: string) => void;
  onAddValue?: () => void;
  onRemoveValue?: (value: string) => void;
  newGoalText?: string;
  onChangeNewGoal?: (text: string) => void;
  onAddGoal?: () => void;
  onRemoveGoal?: (id: string) => void;
  newInitiativeText?: string;
  onChangeNewInitiative?: (text: string) => void;
  onAddInitiative?: () => void;
  onRemoveInitiative?: (id: string) => void;
}

const sectionTitleClass =
  'text-[#94A3B8] text-xs font-semibold uppercase tracking-[0.18em]';

export const ProfileTemplate = ({
  name,
  role,
  badgeLabel,
  coreValues,
  goals,
  initiatives,
  menuItems,
  personalizationItems = [],
  onEditPress,
  onDonePress,
  isEditing = false,
  newValueText = '',
  onChangeNewValue,
  onAddValue,
  onRemoveValue,
  newGoalText = '',
  onChangeNewGoal,
  onAddGoal,
  onRemoveGoal,
  newInitiativeText = '',
  onChangeNewInitiative,
  onAddInitiative,
  onRemoveInitiative,
}: ProfileTemplateProps) => {
  const insets = useSafeAreaInsets();
  const isEditingHeader = isEditing;
  const headerActionEnabled = isEditingHeader ? !!onDonePress : !!onEditPress;
  const handleHeaderAction = isEditingHeader ? onDonePress : onEditPress;

  return (
    <View className="flex-1 bg-[#F7FAFF]">
      <View
        className="bg-[#F7FAFF] px-0"
        style={{
          paddingTop: Math.max(insets.top - 11, 0),
          paddingBottom: 12,
          shadowColor: '#0f172a',
          shadowOpacity: 0.03,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
          zIndex: 10,
        }}
      >
        <View className="flex-row items-center px-6 my-4">
          <View className="w-12" />

          <View className="flex-1 items-center">
            <Text className="text-[#0F172A] text-[17px] font-semibold">
              Profile
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditingHeader ? 'Save profile changes' : 'Edit profile'}
            hitSlop={10}
            disabled={!headerActionEnabled}
            onPress={handleHeaderAction}
            className="items-end min-w-[60px]"
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <View
              className={`${
                isEditingHeader ? 'rounded-lg bg-[#E9F2FF] px-2.5 py-1.5' : ''
              }`}
            >
              <Text className="text-[15px] font-semibold text-[#2563EB]">
                {isEditingHeader ? 'Done' : 'Edit'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-6 px-6">
          <ProfileSummaryCard name={name} role={role} badgeLabel={badgeLabel} />
        </View>

        <View className="mt-8 px-6">
          <Text className={sectionTitleClass}>Core Values</Text>
          <View className="flex-row flex-wrap mt-3 gap-3">
            {coreValues.map((value) =>
              isEditing && onRemoveValue ? (
                <EditableValuePill key={value} label={value} onRemove={() => onRemoveValue(value)} />
              ) : (
                <ProfilePill key={value} label={value} />
              ),
            )}

            {isEditing && (
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={newValueText}
                  onChangeText={onChangeNewValue || (() => {})}
                  placeholder="New Value"
                  placeholderTextColor="#9CA3AF"
                  className="h-11 min-w-[140px] px-4 rounded-full border border-[#E5E7EB] bg-[#F7F9FC] text-sm font-semibold text-[#111827]"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add value"
                  disabled={!newValueText.trim() || !onAddValue}
                  onPress={onAddValue}
                  className="items-center justify-center h-11 w-11 rounded-full bg-[#111827]"
                  style={({ pressed }) => [
                    {
                      opacity: !newValueText.trim() || !onAddValue ? 0.4 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Plus size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View className="mt-8 px-6">
          <Text className={sectionTitleClass}>Goals</Text>
          <View className="mt-3 gap-3">
            {goals.map((goal) => (
              <ProfileItemCard
                key={goal.id}
                label={goal.label}
                icon={goal.icon || Target}
                accent={goal.accent || 'blue'}
                onRemove={
                  isEditing && onRemoveGoal ? () => onRemoveGoal(goal.id) : undefined
                }
              />
            ))}
            {isEditing && (
              <ProfileAddInput
                placeholder="Add a goal..."
                value={newGoalText}
                onChangeText={onChangeNewGoal || (() => {})}
                onAdd={onAddGoal}
                accent="blue"
              />
            )}
          </View>
        </View>

        <View className="mt-8 px-6">
          <Text className={sectionTitleClass}>Work Initiatives</Text>
          <View className="mt-3 gap-3">
            {initiatives.map((initiative) => (
              <ProfileItemCard
                key={initiative.id}
                label={initiative.label}
                icon={initiative.icon || Target}
                accent={initiative.accent || 'purple'}
                onRemove={
                  isEditing && onRemoveInitiative
                    ? () => onRemoveInitiative(initiative.id)
                    : undefined
                }
              />
            ))}
            {isEditing && (
              <ProfileAddInput
                placeholder="Add initiative..."
                value={newInitiativeText}
                onChangeText={onChangeNewInitiative || (() => {})}
                onAdd={onAddInitiative}
                accent="purple"
              />
            )}
          </View>
        </View>

        {/* Personalization Settings */}
        {personalizationItems.length > 0 && (
          <View className="mt-8 px-6">
            <Text className={sectionTitleClass}>Personalization</Text>
            <View className="mt-3">
              {personalizationItems.map((item) => (
                <ProfileMenuItem
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  onPress={item.onPress}
                />
              ))}
            </View>
          </View>
        )}

        <View className="mt-8 pt-1 border-t border-[#E5E9F2] px-6">
          {menuItems.map((item) => (
            <ProfileMenuItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              onPress={item.onPress}
            />
          ))}
        </View>
      </ScrollView>

      <BottomToolbar />
    </View>
  );
};