import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ban,
  Clock,
  Dumbbell,
  ChevronRight,
  MapPin,
  Navigation,
} from "lucide-react-native";
import { Icon } from "@/components/atoms";
import { BottomToolbar } from "./BottomToolbar";

/**
 * DemoWorkoutInterruption - Social media interruption alert for demo mode
 *
 * Shows a "no time for social media" alert when user should be preparing
 * for their workout. Displays a stop icon, countdown timer, and upcoming event preview.
 * Follows home page golden standard for spacing and typography.
 */
export const DemoWorkoutInterruption = ({
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
        {/* Header - matches Greeting: mt-1 mb-2 (tightened) */}
        <View className="mt-1 mb-2">
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            Hold on,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            {userName}.
          </Text>
        </View>

        {/* Message - tightened spacing */}
        <View className="mb-3">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            There's no time for Instagram right now — you're supposed to be
            leaving for your workout.
          </Text>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-4" />

        {/* Alert Card - compact */}
        <View className="items-center mb-4">
          {/* Stop Icon - smaller */}
          <View
            className="h-16 w-16 items-center justify-center rounded-full bg-[#FEE2E2] mb-3"
            style={{
              borderWidth: 3,
              borderColor: "#EF4444",
            }}
          >
            <Icon icon={Ban} size={32} color="#EF4444" />
          </View>

          {/* Timer Display */}
          <View className="flex-row items-center gap-2 mb-1">
            <Icon icon={Clock} size={18} color="#EF4444" />
            <Text className="text-[18px] font-bold text-[#111827]">
              Workout starts in
            </Text>
          </View>

          {/* Countdown - smaller */}
          <Text className="text-[36px] font-extrabold text-[#EF4444] mb-2">
            12 minutes
          </Text>

          {/* Category Badge */}
          <View className="px-3 py-1.5 rounded-full border border-[#FECACA] bg-[#FEF2F2]">
            <Text className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#EF4444]">
              Alert: Focus Required
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-3" />

        {/* Section Header */}
        <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-2">
          Upcoming Event
        </Text>

        {/* Upcoming Event Card - compact */}
        <Pressable
          className="flex-row items-center justify-between bg-white rounded-xl px-3 py-3 border border-[#E5E7EB]"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View className="flex-row items-center gap-3 flex-1">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#DCFCE7]">
              <Icon icon={Dumbbell} size={20} color="#16A34A" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-[#111827]">
                Gym Workout
              </Text>
              <Text className="text-[13px] text-[#6B7280]">
                6:30 AM • CrossFit Downtown
              </Text>
            </View>
          </View>
          <Icon icon={ChevronRight} size={18} color="#9CA3AF" />
        </Pressable>

        {/* Travel Time Map Section - compact */}
        <View className="mt-3">
          {/* Mini Map Container */}
          <View className="rounded-xl overflow-hidden border border-[#E5E7EB]">
            {/* Map Background - styled placeholder */}
            <View className="h-20 bg-[#E8F4EA] relative">
              {/* Map grid lines for visual effect */}
              <View className="absolute inset-0 opacity-30">
                <View
                  className="absolute top-0 left-0 right-0 h-[1px] bg-[#94D3A2]"
                  style={{ top: "33%" }}
                />
                <View
                  className="absolute top-0 left-0 right-0 h-[1px] bg-[#94D3A2]"
                  style={{ top: "66%" }}
                />
                <View
                  className="absolute top-0 bottom-0 w-[1px] bg-[#94D3A2]"
                  style={{ left: "33%" }}
                />
                <View
                  className="absolute top-0 bottom-0 w-[1px] bg-[#94D3A2]"
                  style={{ left: "66%" }}
                />
              </View>

              {/* Route line */}
              <View className="absolute top-[60%] left-[15%] right-[20%] h-[3px] bg-[#2563EB] rounded-full" />

              {/* Start point (current location) */}
              <View className="absolute" style={{ top: "55%", left: "12%" }}>
                <View className="h-3 w-3 rounded-full bg-[#2563EB] border-2 border-white" />
              </View>

              {/* Destination marker */}
              <View
                className="absolute items-center"
                style={{ top: "35%", right: "15%" }}
              >
                <Icon icon={MapPin} size={22} color="#EF4444" fill="#EF4444" />
              </View>
            </View>

            {/* Travel Info Bar - compact */}
            <View className="bg-white px-3 py-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-7 w-7 rounded-full bg-[#EFF6FF] items-center justify-center">
                  <Icon icon={Navigation} size={14} color="#2563EB" />
                </View>
                <View>
                  <Text className="text-[13px] font-bold text-[#111827]">
                    CrossFit Downtown
                  </Text>
                  <Text className="text-[11px] text-[#6B7280]">
                    via current traffic
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[16px] font-bold text-[#16A34A]">
                  8 min
                </Text>
                <Text className="text-[10px] text-[#6B7280]">2.4 mi</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <BottomToolbar />
    </View>
  );
};
