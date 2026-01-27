import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, MessageSquare, ChevronRight } from "lucide-react-native";
import { Icon } from "@/components/atoms";
import { BottomToolbar } from "./BottomToolbar";

/**
 * DemoMeetingReminder - Meeting notification/reminder screen for demo mode
 *
 * Shows the interruption flow when a meeting is about to start.
 * Spacing matches HomeTemplate exactly.
 */
export const DemoMeetingReminder = ({
  userName = "Paul",
}: {
  userName?: string;
}) => {
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
            Excuse me,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            {userName}.
          </Text>
        </View>

        {/* Message - matches DailyBrief: mt-3.5 mb-5 */}
        <View className="mt-3.5 mb-5">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
            Your meeting with Cole starts in 5 minutes.
          </Text>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-6" />

        {/* Meeting Card */}
        <View className="items-center mb-6">
          {/* Video Icon */}
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-[#2563EB] mb-5">
            <Icon icon={Video} size={36} color="#FFFFFF" />
          </View>

          {/* Meeting Title */}
          <Text className="text-[24px] font-bold text-[#111827] text-center mb-2">
            Meeting with Cole
          </Text>

          {/* Meeting Details */}
          <Text className="text-[16px] text-[#6B7280] text-center mb-4">
            Starts at 3:00 PM • Zoom
          </Text>

          {/* Category Badge */}
          <View className="px-4 py-2 rounded-full border border-[#DBEAFE] bg-[#EFF6FF]">
            <Text className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#2563EB]">
              Strategy Sync
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-4" />

        {/* Action Buttons */}
        <View className="gap-3">
          {/* Join Video Call */}
          <Pressable
            className="flex-row items-center justify-between bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF]">
                <Icon icon={Video} size={20} color="#2563EB" />
              </View>
              <Text className="text-[16px] font-semibold text-[#111827]">
                Join Video Call
              </Text>
            </View>
            <Icon icon={ChevronRight} size={20} color="#9CA3AF" />
          </Pressable>

          {/* Message Cole */}
          <Pressable
            className="flex-row items-center justify-between bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F6]">
                <Icon icon={MessageSquare} size={20} color="#6B7280" />
              </View>
              <Text className="text-[16px] font-semibold text-[#111827]">
                Message Cole
              </Text>
            </View>
            <Icon icon={ChevronRight} size={20} color="#9CA3AF" />
          </Pressable>
        </View>
      </View>

      <BottomToolbar />
    </View>
  );
};
