import { ArrowRight, Info, Target, Briefcase, Plus, X } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface GoalsTemplateProps {
  step?: number;
  totalSteps?: number;
  goals: string[];
  initiatives: string[];
  onAddGoal: () => void;
  onRemoveGoal: (index: number) => void;
  onChangeGoal: (index: number, value: string) => void;
  onAddInitiative: () => void;
  onRemoveInitiative: (index: number) => void;
  onChangeInitiative: (index: number, value: string) => void;
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

const ListCard = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View
    className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
    style={cardShadowStyle}
  >
    <View className="flex-row items-center gap-2 pb-3">
      {icon}
      <Text className="text-base font-semibold text-text-primary">{title}</Text>
    </View>
    <View className="gap-3">{children}</View>
  </View>
);

const ListItem = ({
  value,
  index,
  onRemove,
  onChange,
}: {
  value: string;
  index: number;
  onRemove: () => void;
  onChange: (text: string) => void;
}) => (
  <View className="flex-row items-center gap-3 rounded-2xl border border-[#D1DBEC] bg-white px-4 py-3">
    <View className="min-w-[42px] items-center justify-center rounded-xl bg-[#EEF2FF]">
      <Text className="text-sm font-semibold text-brand-primary">#{index + 1}</Text>
    </View>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Add a goal"
      placeholderTextColor="#9CA3AF"
      className="flex-1 text-base font-semibold text-text-primary"
      accessibilityLabel={`Goal ${index + 1}`}
    />
    <Pressable
      accessibilityLabel={`Remove ${value || `goal ${index + 1}`}`}
      onPress={onRemove}
      className="h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6]"
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      <X size={16} color="#6B7280" />
    </Pressable>
  </View>
);

const AddButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-4 py-3"
    style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
  >
    <Plus size={18} color="#2563EB" />
    <Text className="text-base font-semibold text-brand-primary">{label}</Text>
  </Pressable>
);

export const GoalsTemplate = ({
  step = ONBOARDING_STEPS.goals,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  goals,
  initiatives,
  onAddGoal,
  onRemoveGoal,
  onChangeGoal,
  onAddInitiative,
  onRemoveInitiative,
  onChangeInitiative,
  onContinue,
  onBack,
}: GoalsTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Goals"
      subtitle="Define goals and initiatives to track your progress."
      onBack={onBack}
      footer={<GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />}
    >
      <View className="mt-4 gap-4">
        <View className="rounded-2xl border border-[#E4E8F0] bg-[#F5F9FF] px-4 py-3" style={cardShadowStyle}>
          <View className="flex-row items-start gap-3">
            <View className="mt-[2px]">
              <Info size={18} color="#F59E0B" />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-base font-semibold text-text-primary">Why this matters</Text>
              <Text className="text-sm leading-5 text-text-secondary">
                These aren’t just list items. We use these to measure if your daily actions align with your long-term vision. Think big, but actionable.
              </Text>
            </View>
          </View>
        </View>

        <ListCard
          title="Goals"
          icon={<Target size={18} color="#2563EB" />}
        >
          <Text className="text-sm leading-5 text-text-secondary">
            What are the 1–3 outcomes you must achieve soon?
          </Text>
          <View className="gap-2">
            {goals.map((goal, idx) => (
              <ListItem
                key={`goal-${idx}`}
                value={goal}
                index={idx}
                onRemove={() => onRemoveGoal(idx)}
                onChange={(text) => onChangeGoal(idx, text)}
              />
            ))}
            <AddButton label="Add Goal" onPress={onAddGoal} />
          </View>
        </ListCard>

        <ListCard
          title="Work Initiatives"
          icon={<Briefcase size={18} color="#6B7280" />}
        >
          <Text className="text-sm leading-5 text-text-secondary">
            Major projects or themes for your professional life.
          </Text>
          <View className="gap-2">
            {initiatives.map((item, idx) => (
              <ListItem
                key={`initiative-${idx}`}
                value={item}
                index={idx}
                onRemove={() => onRemoveInitiative(idx)}
                onChange={(text) => onChangeInitiative(idx, text)}
              />
            ))}
            <AddButton label="Add Work Initiative" onPress={onAddInitiative} />
          </View>
        </ListCard>
      </View>
    </SetupStepLayout>
  );
};
