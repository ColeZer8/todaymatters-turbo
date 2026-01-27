import { useMemo, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  ArrowRight,
  MoonStar,
  SunMedium,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GradientButton } from "@/components/atoms";
import { TimeSelectionCard } from "@/components/molecules";
import { TimePickerModal } from "@/components/organisms";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";

type PickerType = "wake" | "sleep" | null;

interface DailyRhythmTemplateProps {
  step?: number;
  totalSteps?: number;
  wakeTime: Date;
  sleepTime: Date;
  onSelectWakeTime: (time: Date) => void;
  onSelectSleepTime: (time: Date) => void;
  onContinue?: () => void;
  onBack?: () => void;
  /** When 'settings', hides progress bar and continue button */
  mode?: "onboarding" | "settings";
}

const formatTime = (time: Date) => {
  const rawHour = time.getHours();
  const hour = rawHour % 12 || 12;
  const paddedHour = hour < 10 ? `0${hour}` : String(hour);
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const period = rawHour >= 12 ? "PM" : "AM";

  return `${paddedHour}:${minutes} ${period}`;
};

export const DailyRhythmTemplate = ({
  step = ONBOARDING_STEPS.dailyRhythm,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  wakeTime,
  sleepTime,
  onSelectWakeTime,
  onSelectSleepTime,
  onContinue,
  onBack,
  mode = "onboarding",
}: DailyRhythmTemplateProps) => {
  const [activePicker, setActivePicker] = useState<PickerType>(null);

  const progressPercent = Math.min(100, Math.max(0, (step / totalSteps) * 100));
  const formattedWakeTime = useMemo(() => formatTime(wakeTime), [wakeTime]);
  const formattedSleepTime = useMemo(() => formatTime(sleepTime), [sleepTime]);
  const isSettings = mode === "settings";

  const closePicker = () => setActivePicker(null);

  return (
    <LinearGradient
      colors={["#f5f9ff", "#eef5ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Settings mode header */}
          {isSettings ? (
            <View style={styles.settingsHeader}>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onBack}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.settingsBackButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ArrowLeft size={18} color="#2563EB" strokeWidth={2.5} />
                  <Text className="text-[15px] font-semibold text-brand-primary">
                    Back
                  </Text>
                </Pressable>
              ) : (
                <View />
              )}
            </View>
          ) : (
            <>
              {/* Onboarding mode header */}
              <View style={styles.headerRow}>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-text-secondary">
                    <Text className="text-brand-primary">Step {step}</Text> of{" "}
                    {totalSteps}
                  </Text>
                  {onBack ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={onBack}
                      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                      className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-white"
                    >
                      <ArrowLeft size={14} color="#111827" />
                      <Text className="text-xs font-semibold text-text-primary">
                        Back
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text className="text-sm font-semibold text-text-secondary">
                  Setup
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>
            </>
          )}

          <View
            style={[styles.titleBlock, isSettings && styles.settingsTitleBlock]}
          >
            <Text className="text-3xl font-extrabold text-text-primary">
              Your daily rhythm
            </Text>
            <Text className="text-base leading-6 text-text-secondary">
              {isSettings
                ? "Adjust your wake and sleep times."
                : "Let's establish your baseline hours."}
            </Text>
          </View>

          <View style={styles.cardStack}>
            <TimeSelectionCard
              label="Wake time"
              value={formattedWakeTime}
              icon={SunMedium}
              accentColor="#E0671E"
              accentBackground="#FFEFE4"
              onPress={() => setActivePicker("wake")}
            />
            <TimeSelectionCard
              label="Sleep time"
              value={formattedSleepTime}
              icon={MoonStar}
              accentColor="#5B5CE2"
              accentBackground="#EEF0FF"
              onPress={() => setActivePicker("sleep")}
            />
          </View>

          <View style={styles.spacer} />

          {/* Only show continue button in onboarding mode */}
          {!isSettings && onContinue && (
            <View style={styles.actions}>
              <GradientButton
                label="Continue"
                onPress={onContinue}
                rightIcon={ArrowRight}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <TimePickerModal
        label="Select your wake time"
        visible={activePicker === "wake"}
        initialTime={wakeTime}
        onConfirm={(time) => {
          onSelectWakeTime(time);
          closePicker();
        }}
        onClose={closePicker}
      />

      <TimePickerModal
        label="Select your sleep time"
        visible={activePicker === "sleep"}
        initialTime={sleepTime}
        onConfirm={(time) => {
          onSelectSleepTime(time);
          closePicker();
        }}
        onClose={closePicker}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 8,
  },
  settingsBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingRight: 12,
  },
  settingsTitleBlock: {
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E4E8F0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563EB",
  },
  titleBlock: {
    marginTop: 14,
    gap: 8,
  },
  cardStack: {
    gap: 12,
    marginTop: 8,
  },
  actions: {
    marginTop: 18,
  },
  spacer: {
    flexGrow: 1,
    minHeight: 20,
  },
});
