import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ban, Clock, Dumbbell, ChevronRight } from 'lucide-react-native';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoWorkoutInterruption - Social media interruption alert for demo mode
 * 
 * Shows a "no time for social media" alert when user should be preparing
 * for their workout. Displays a stop icon, countdown timer, and upcoming event preview.
 * Follows home page golden standard for spacing and typography.
 */
export const DemoWorkoutInterruption = () => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
    >
      <View className="flex-1 px-6">
        {/* Header - matches Greeting: mt-1 mb-4 */}
        <View className="mt-1 mb-4">
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            Hold on,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            Paul.
          </Text>
        </View>

        {/* Message - matches DailyBrief: mt-3.5 mb-5 */}
        <View className="mt-3.5 mb-5">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            There's no time for social media right now — you're supposed to be leaving for your workout.
          </Text>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-6" />

        {/* Alert Card */}
        <View className="items-center mb-6">
          {/* Stop Icon */}
          <View 
            className="h-24 w-24 items-center justify-center rounded-full bg-[#FEE2E2] mb-5"
            style={{
              borderWidth: 4,
              borderColor: '#EF4444',
            }}
          >
            <Icon icon={Ban} size={48} color="#EF4444" />
          </View>

          {/* Timer Display */}
          <View className="flex-row items-center gap-2 mb-3">
            <Icon icon={Clock} size={20} color="#EF4444" />
            <Text className="text-[24px] font-bold text-[#111827]">
              Workout starts in
            </Text>
          </View>

          {/* Countdown */}
          <Text className="text-[48px] font-extrabold text-[#EF4444] mb-4">
            12 minutes
          </Text>

          {/* Category Badge */}
          <View className="px-4 py-2 rounded-full border border-[#FECACA] bg-[#FEF2F2]">
            <Text className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#EF4444]">
              Alert: Focus Required
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-4" />

        {/* Section Header */}
        <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-3">
          Upcoming Event
        </Text>

        {/* Upcoming Event Card */}
        <Pressable
          className="flex-row items-center justify-between bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB]"
          style={({ pressed }) => ({ 
            opacity: pressed ? 0.7 : 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          })}
        >
          <View className="flex-row items-center gap-3 flex-1">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#DCFCE7]">
              <Icon icon={Dumbbell} size={24} color="#16A34A" />
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-[#111827] mb-0.5">
                Gym Workout
              </Text>
              <Text className="text-[14px] text-[#6B7280]">
                6:30 AM • CrossFit Downtown
              </Text>
            </View>
          </View>
          <Icon icon={ChevronRight} size={20} color="#9CA3AF" />
        </Pressable>

        {/* Helper Text */}
        <Text className="text-[13px] text-[#9CA3AF] text-center mt-4">
          Close distracting apps and start your pre-workout routine.
        </Text>
      </View>

      <BottomToolbar />
    </View>
  );
};
