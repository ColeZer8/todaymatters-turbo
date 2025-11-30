import { useMemo } from 'react';
import { InteractionManager, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useRootNavigationState } from 'expo-router';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useAuthStore } from '@/stores';
import { useRoutineBuilderStore } from '@/stores/routine-builder-store';
import { Minus, Plus } from 'lucide-react-native';

const formatTime = (minutesFromMidnight: number) => {
  const mins = minutesFromMidnight % (24 * 60);
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  const paddedHours = hours.toString().padStart(2, '0');
  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `${paddedHours}:${paddedMinutes}`;
};

export default function RoutineItemDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const items = useRoutineBuilderStore((state) => state.items);
  const wakeTime = useRoutineBuilderStore((state) => state.wakeTime);
  const updateMinutes = useRoutineBuilderStore((state) => state.updateMinutes);

  const itemIndex = items.findIndex((item) => item.id === id);
  const item = itemIndex >= 0 ? items[itemIndex] : undefined;

  const startEnd = useMemo(() => {
    if (!item || itemIndex < 0) return { start: '—', end: '—' };
    const [wakeHour, wakeMinute] = wakeTime.split(':').map((n) => parseInt(n, 10));
    const wakeTotal = wakeHour * 60 + wakeMinute;
    const priorMinutes = items.slice(0, itemIndex).reduce((sum, curr) => sum + curr.minutes, 0);
    const start = wakeTotal + priorMinutes;
    const end = start + item.minutes;
    return { start: formatTime(start), end: formatTime(end) };
  }, [item, itemIndex, items, wakeTime]);

  if (!item) {
    return null;
  }

  const handleStep = (delta: number) => {
    const next = Math.max(1, item.minutes + delta);
    updateMinutes(item.id, next);
  };

  return (
    <SetupStepLayout
      step={ONBOARDING_STEPS.routine}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      title={item.title}
      subtitle="Adjust the time allotted for this habit."
      onBack={() => router.back()}
      footer={
        <GradientButton
          label="Save"
          onPress={() => router.back()}
        />
      }
    >
      <View className="mt-4 gap-4 rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4 shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
        <View className="flex-row justify-between">
          <Text className="text-sm font-semibold text-text-secondary">Start</Text>
          <Text className="text-sm font-semibold text-text-secondary">End</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xl font-bold text-text-primary">{startEnd.start}</Text>
          <Text className="text-xl font-bold text-text-primary">{startEnd.end}</Text>
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-[#E4E8F0] bg-white px-4 py-5 shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
        <Text className="text-base font-semibold text-text-primary">Time allotted</Text>
        <View className="flex-row items-center justify-center gap-3">
          <Pressable
            onPress={() => handleStep(-5)}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#EEF5FF]"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <Minus size={18} color="#2563EB" />
          </Pressable>
          <Text className="text-2xl font-bold text-text-primary">{item.minutes}m</Text>
          <Pressable
            onPress={() => handleStep(5)}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#EEF5FF]"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <Plus size={18} color="#2563EB" />
          </Pressable>
        </View>
      </View>
    </SetupStepLayout>
  );
}
