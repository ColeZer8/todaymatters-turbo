import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen } from 'lucide-react-native';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoMorningRoutine - Special morning devotional screen for demo mode
 * 
 * Shows the spiritual growth / morning prayer flow that appears
 * when the user wakes up and opens the app.
 * 
 * Spacing matches HomeTemplate exactly.
 */
export const DemoMorningRoutine = () => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
    >
      <View className="flex-1 px-6">
        {/* Greeting - matches Greeting component: mt-1 mb-4 */}
        <View className="mt-1 mb-4">
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            Good morning,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            Paul.
          </Text>
        </View>

        {/* Daily Message - matches DailyBrief: mt-3.5 mb-5 */}
        <View className="mt-3.5 mb-5">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
            This is the 13,653rd day of your life.
          </Text>
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
            Would you like to begin with prayer?
          </Text>
        </View>

        {/* Priority Section - extra top margin to space from message */}
        <View className="mt-8 mb-5">
          <Text className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
            Priority #1: Spiritual Growth
          </Text>
          <View className="h-px bg-[#E5E7EB] mt-3" />
        </View>

        {/* Devotional Card */}
        <View className="bg-[#F0F7FF] rounded-2xl p-6 border border-[#DBEAFE] mt-2">
          {/* Icon */}
          <View className="items-center mb-4">
            <View className="h-14 w-14 items-center justify-center rounded-xl bg-white border border-[#E5E7EB]">
              <Icon icon={BookOpen} size={24} color="#2563EB" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-[20px] font-bold text-[#111827] text-center mb-3">
            Start your day with Truth.
          </Text>

          {/* Scripture Quote */}
          <Text className="text-[15px] leading-[24px] text-[#6B7280] text-center mb-6">
            "Trust in the Lord with all your heart and lean not on your own understanding."
          </Text>

          {/* Action Button */}
          <Pressable
            className="bg-[#991B1B] rounded-xl py-4 flex-row items-center justify-center gap-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <Icon icon={BookOpen} size={18} color="#FFFFFF" />
            <Text className="text-[16px] font-bold text-white">
              Open YouVersion
            </Text>
          </Pressable>
        </View>

        {/* Coming Up Later */}
        <View className="mt-8">
          <View className="h-px bg-[#E5E7EB] mb-4" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
              Coming Up Later
            </Text>
            <Text className="text-[14px] font-semibold text-[#6B7280]">
              9:00 AM • Q4 Strategy
            </Text>
          </View>
        </View>
      </View>

      <BottomToolbar />
    </View>
  );
};






