import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Target, LucideIcon } from 'lucide-react-native';
import { ProfileItemCard, ProfileMenuItem, ProfilePill, ProfileSummaryCard } from '@/components/molecules';

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
  onBack: () => void;
  onEditPress?: () => void;
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
  onBack,
  onEditPress,
}: ProfileTemplateProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="px-6">
        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={onBack}
            className="w-12"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color="#94A3B8" />
          </Pressable>

          <View className="flex-1 items-center">
            <Text className="text-[#0F172A] text-[17px] font-semibold">
              Profile
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            hitSlop={10}
            disabled={!onEditPress}
            onPress={onEditPress}
            className="items-end w-12"
            style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
          >
            <Text className="text-[#2563EB] text-[15px] font-semibold">Edit</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-6">
          <ProfileSummaryCard name={name} role={role} badgeLabel={badgeLabel} />
        </View>

        <View className="mt-8">
          <Text className={sectionTitleClass}>Core Values</Text>
          <View className="flex-row flex-wrap mt-3 gap-3">
            {coreValues.map((value) => (
              <ProfilePill key={value} label={value} />
            ))}
          </View>
        </View>

        <View className="mt-8">
          <Text className={sectionTitleClass}>Goals</Text>
          <View className="mt-3 gap-3">
            {goals.map((goal) => (
              <ProfileItemCard
                key={goal.id}
                label={goal.label}
                icon={goal.icon || Target}
                accent={goal.accent || 'blue'}
              />
            ))}
          </View>
        </View>

        <View className="mt-8">
          <Text className={sectionTitleClass}>Work Initiatives</Text>
          <View className="mt-3 gap-3">
            {initiatives.map((initiative) => (
              <ProfileItemCard
                key={initiative.id}
                label={initiative.label}
                icon={initiative.icon || Target}
                accent={initiative.accent || 'purple'}
              />
            ))}
          </View>
        </View>

        <View className="mt-8 pt-1 border-t border-[#E5E9F2]">
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
    </View>
  );
};
