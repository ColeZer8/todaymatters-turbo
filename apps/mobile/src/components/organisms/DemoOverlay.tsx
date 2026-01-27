import { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  X,
} from "lucide-react-native";
import { Icon } from "@/components/atoms";
import { useDemoStore, TIME_PRESETS, type TimeOfDay } from "@/stores";

// Time preset icons mapping
const TIME_ICONS: Record<TimeOfDay, typeof Sun> = {
  devotional: Sparkles,
  morning: Sunrise,
  midday: Sun,
  afternoon: Sunset,
  evening: Sunset,
  night: Moon,
};

const TIME_COLORS: Record<TimeOfDay, string> = {
  devotional: "#EC4899",
  morning: "#F59E0B",
  midday: "#3B82F6",
  afternoon: "#F97316",
  evening: "#8B5CF6",
  night: "#6366F1",
};

// Demo tour - screens to navigate through
const DEMO_TOUR = [
  { path: "/home", label: "Home" },
  { path: "/demo-screen-time", label: "Screen Time" },
  { path: "/demo-workout-interruption", label: "Focus Alert" },
  { path: "/demo-workout-summary", label: "Workout" },
  { path: "/demo-meeting", label: "Meeting" },
  { path: "/demo-meeting-rate", label: "Meeting Rate" },
  { path: "/demo-traffic-accident", label: "Traffic" },
  { path: "/demo-traffic", label: "Departure" },
  { path: "/demo-prayer", label: "Prayer" },
  { path: "/demo-prayer-rate", label: "Prayer Rate" },
  { path: "/demo-overview-goals", label: "Goals" },
  { path: "/demo-overview-initiatives", label: "Initiatives" },
  { path: "/demo-overview-values", label: "Values" },
];

/**
 * DemoOverlay - Floating overlay for demo mode
 *
 * Renders on top of the app when demo mode is active.
 * Provides:
 * - Subtle corner button to open controls
 * - Time of day selector
 * - Navigation arrows for guided tour
 * - Exit button
 */
export const DemoOverlay = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [showControls, setShowControls] = useState(false);

  // Demo store - ALL hooks must be called before any conditional returns
  const isActive = useDemoStore((state) => state.isActive);
  const setDemoActive = useDemoStore((state) => state.setActive);
  const setTimeOfDay = useDemoStore((state) => state.setTimeOfDay);
  const timeOfDay = useDemoStore((state) => state.timeOfDay);
  const getFormattedTime = useDemoStore((state) => state.getFormattedTime);

  // Find current position in tour
  const currentTourIndex = DEMO_TOUR.findIndex(
    (item) => pathname === item.path,
  );
  const isOnTour = currentTourIndex !== -1;

  // ALL useCallback hooks must be called unconditionally
  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  const hideControls = useCallback(() => {
    setShowControls(false);
  }, []);

  const handleTimeSelect = useCallback(
    (time: TimeOfDay) => {
      setTimeOfDay(time);
    },
    [setTimeOfDay],
  );

  const handleExitDemo = useCallback(() => {
    setDemoActive(false);
    setShowControls(false);
  }, [setDemoActive]);

  const goToPrevious = useCallback(() => {
    if (currentTourIndex > 0) {
      router.push(DEMO_TOUR[currentTourIndex - 1].path as any);
    }
  }, [currentTourIndex, router]);

  const goToNext = useCallback(() => {
    if (currentTourIndex < DEMO_TOUR.length - 1) {
      router.push(DEMO_TOUR[currentTourIndex + 1].path as any);
    }
  }, [currentTourIndex, router]);

  // NOW we can have the early return - after ALL hooks have been called
  if (!isActive) return null;

  const currentIcon = TIME_ICONS[timeOfDay];
  const currentColor = TIME_COLORS[timeOfDay];

  return (
    <>
      {/* Subtle Corner Button to Open Controls */}
      {!showControls && (
        <Pressable
          onPress={toggleControls}
          hitSlop={12}
          className="absolute h-10 w-10 items-center justify-center rounded-full"
          style={{
            top: insets.top + 8,
            right: 12,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 1000,
          }}
        >
          <Icon icon={Settings2} size={20} color="rgba(255,255,255,0.9)" />
        </Pressable>
      )}

      {/* Control Overlay */}
      {showControls && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute inset-0 bg-black/60"
          style={{ zIndex: 2000 }}
        >
          <Pressable className="flex-1" onPress={hideControls}>
            {/* Top Bar */}
            <View
              className="flex-row items-center justify-between px-5"
              style={{ paddingTop: insets.top + 8 }}
            >
              {/* Exit Button */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleExitDemo();
                }}
                hitSlop={12}
                className="h-11 w-11 items-center justify-center rounded-full bg-white/20"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon icon={X} size={22} color="#FFFFFF" />
              </Pressable>

              {/* Demo Mode Badge */}
              <View className="flex-row items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                <View className="h-2 w-2 rounded-full bg-red-500" />
                <Text className="text-white font-bold text-[13px]">DEMO</Text>
              </View>

              {/* Current Time Display */}
              <View className="flex-row items-center gap-1.5 bg-white/20 px-3 py-2 rounded-full">
                <Icon icon={currentIcon} size={16} color={currentColor} />
                <Text className="text-white font-semibold text-[13px]">
                  {getFormattedTime()}
                </Text>
              </View>
            </View>

            {/* Center - Current Screen Info */}
            <View className="flex-1 justify-center items-center px-8">
              {isOnTour && (
                <>
                  <Text className="text-white/60 text-[13px] font-semibold uppercase tracking-wider mb-2">
                    {currentTourIndex + 1} of {DEMO_TOUR.length}
                  </Text>
                  <Text className="text-white text-[28px] font-bold text-center mb-2">
                    {DEMO_TOUR[currentTourIndex]?.label}
                  </Text>
                </>
              )}

              {/* Navigation Arrows */}
              {isOnTour && (
                <View className="flex-row items-center gap-4 mt-4 mb-6">
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      goToPrevious();
                    }}
                    disabled={currentTourIndex === 0}
                    className="h-12 w-12 items-center justify-center rounded-full bg-white/20"
                    style={({ pressed }) => ({
                      opacity: currentTourIndex === 0 ? 0.3 : pressed ? 0.7 : 1,
                    })}
                  >
                    <Icon icon={ChevronLeft} size={24} color="#FFFFFF" />
                  </Pressable>

                  {/* Page Dots */}
                  <View className="flex-row items-center gap-1.5">
                    {DEMO_TOUR.map((item, index) => (
                      <View
                        key={item.path}
                        className="rounded-full"
                        style={{
                          width: index === currentTourIndex ? 16 : 6,
                          height: 6,
                          backgroundColor:
                            index === currentTourIndex
                              ? "#FFFFFF"
                              : "rgba(255,255,255,0.4)",
                        }}
                      />
                    ))}
                  </View>

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      goToNext();
                    }}
                    disabled={currentTourIndex === DEMO_TOUR.length - 1}
                    className="h-12 w-12 items-center justify-center rounded-full bg-white/20"
                    style={({ pressed }) => ({
                      opacity:
                        currentTourIndex === DEMO_TOUR.length - 1
                          ? 0.3
                          : pressed
                            ? 0.7
                            : 1,
                    })}
                  >
                    <Icon icon={ChevronRight} size={24} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              {/* Quick Navigation */}
              <View className="flex-row flex-wrap justify-center gap-2">
                {DEMO_TOUR.map((item, index) => (
                  <Pressable
                    key={item.path}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(item.path as any);
                      hideControls();
                    }}
                    className="px-4 py-2 rounded-full"
                    style={({ pressed }) => ({
                      backgroundColor:
                        index === currentTourIndex
                          ? "rgba(59, 130, 246, 0.8)"
                          : "rgba(255,255,255,0.15)",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      className="text-[14px] font-semibold"
                      style={{
                        color:
                          index === currentTourIndex
                            ? "#FFFFFF"
                            : "rgba(255,255,255,0.8)",
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Setup Tour Button */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  router.push("/setup-questions" as any);
                  hideControls();
                }}
                className="mt-6 px-6 py-3 rounded-full border border-white/30"
                style={({ pressed }) => ({
                  backgroundColor: "rgba(255,255,255,0.1)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text className="text-white font-semibold text-[14px]">
                  ▶ Start Setup Tour
                </Text>
              </Pressable>
            </View>

            {/* Bottom - Time Controls */}
            <View
              className="px-5"
              style={{ paddingBottom: insets.bottom + 20 }}
            >
              <Text className="text-white/50 text-[11px] font-bold uppercase tracking-wider text-center mb-3">
                Simulate Time of Day
              </Text>
              <View className="flex-row justify-center gap-2">
                {(Object.keys(TIME_PRESETS) as TimeOfDay[]).map((presetId) => {
                  const preset = TIME_PRESETS[presetId];
                  const PresetIcon = TIME_ICONS[presetId];
                  const presetColor = TIME_COLORS[presetId];
                  const isSelected = timeOfDay === presetId;

                  return (
                    <Pressable
                      key={presetId}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleTimeSelect(presetId);
                      }}
                      className="items-center px-3 py-2 rounded-xl"
                      style={({ pressed }) => ({
                        backgroundColor: isSelected
                          ? "rgba(255,255,255,0.25)"
                          : "rgba(255,255,255,0.1)",
                        opacity: pressed ? 0.7 : 1,
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: isSelected ? presetColor : "transparent",
                      })}
                    >
                      <Icon
                        icon={PresetIcon}
                        size={20}
                        color={isSelected ? presetColor : "#FFFFFF"}
                      />
                      <Text
                        className="text-[10px] font-semibold mt-1"
                        style={{
                          color: isSelected ? presetColor : "#FFFFFF",
                        }}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      )}
    </>
  );
};
