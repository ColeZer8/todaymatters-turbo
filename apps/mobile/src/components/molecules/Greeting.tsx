import { View, Text, Pressable, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useDemoStore } from "@/stores";

const getTimeOfDayGreeting = (hour?: number): string => {
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning,";
  if (h >= 12 && h < 17) return "Good afternoon,";
  if (h >= 17 && h < 21) return "Good evening,";
  return "Good night,";
};

interface GreetingProps {
  name: string;
  date: string;
  unassignedCount?: number;
  onPressGreeting?: () => void;
}

export const Greeting = ({
  name,
  date,
  unassignedCount = 0,
  onPressGreeting,
}: GreetingProps) => {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Demo mode support - use simulated time when active
  const isDemoActive = useDemoStore((state) => state.isActive);
  const simulatedHour = useDemoStore((state) => state.simulatedHour);
  const greeting = getTimeOfDayGreeting(
    isDemoActive ? simulatedHour : undefined,
  );

  useEffect(() => {
    if (unassignedCount > 0) {
      // Subtle pulse animation
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [unassignedCount, pulseAnim]);

  const handleBadgePress = () => {
    router.push("/review-time");
  };

  return (
    <View className="mt-1 mb-4">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPressGreeting}
          disabled={!onPressGreeting}
          hitSlop={12}
          accessibilityRole={onPressGreeting ? "button" : undefined}
          accessibilityLabel={
            onPressGreeting ? "Toggle voice assistant" : undefined
          }
          android_disableSound
        >
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            {greeting}
          </Text>
        </Pressable>
        {unassignedCount > 0 && (
          <Pressable
            onPress={handleBadgePress}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Animated.View
              className="h-7 w-7 items-center justify-center rounded-full bg-[#2563EB]/15"
              style={{ transform: [{ scale: pulseAnim }] }}
            >
              <Text className="text-[13px] font-bold text-[#2563EB]">
                {unassignedCount}
              </Text>
            </Animated.View>
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={onPressGreeting}
        disabled={!onPressGreeting}
        hitSlop={12}
        accessibilityRole={onPressGreeting ? "button" : undefined}
        accessibilityLabel={
          onPressGreeting ? "Toggle voice assistant" : undefined
        }
        android_disableSound
      >
        <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
          {name}.
        </Text>
      </Pressable>
    </View>
  );
};
