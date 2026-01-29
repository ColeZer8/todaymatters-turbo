import { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, MapPin, Clock, Info, AlertCircle, CheckCircle } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import type { ScheduledEvent } from "@/stores";

// Theme colors matching ComprehensiveCalendarTemplate
const COLORS = {
  primary: "#2563EB",
  background: "#F2F2F7",
  cardBg: "#FFFFFF",
  textDark: "#111827",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  border: "rgba(148,163,184,0.25)",
};

// Intent colors matching CATEGORY_STYLES
const INTENT_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  work: { bg: "#EFF6FF", accent: "#3B82F6", text: "#1D4ED8" },
  leisure: { bg: "#F0FDF4", accent: "#22C55E", text: "#16A34A" },
  distracted_work: { bg: "#FFF7ED", accent: "#F97316", text: "#C2410C" },
  sleep: { bg: "#EEF2FF", accent: "#818CF8", text: "#4F46E5" },
  offline: { bg: "#F8FAFC", accent: "#94A3B8", text: "#64748B" },
  mixed: { bg: "#FEF9C3", accent: "#EAB308", text: "#A16207" },
  commute: { bg: "#F8FAFC", accent: "#94A3B8", text: "#64748B" },
};

// Intent display names
const INTENT_LABELS: Record<string, string> = {
  work: "Work",
  leisure: "Leisure",
  distracted_work: "Distracted Work",
  sleep: "Sleep",
  offline: "Offline",
  mixed: "Mixed",
  commute: "Commute",
};

interface SessionDetailModalProps {
  event: ScheduledEvent | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * Format duration from seconds to human-readable string
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  return `${mins}m`;
};

/**
 * Format minutes from midnight to time string
 */
const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
};

/**
 * Get confidence level description
 */
const getConfidenceLevel = (confidence: number): { label: string; color: string } => {
  if (confidence >= 0.8) {
    return { label: "High", color: "#16A34A" };
  }
  if (confidence >= 0.5) {
    return { label: "Medium", color: "#EAB308" };
  }
  return { label: "Low", color: "#F97316" };
};

export const SessionDetailModal = ({
  event,
  visible,
  onClose,
}: SessionDetailModalProps) => {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;

  const meta = event?.meta;
  const isSessionBlock = meta?.kind === "session_block";

  // Get intent styling
  const intent = meta?.intent || "mixed";
  const intentStyle = INTENT_COLORS[intent] || INTENT_COLORS.mixed;
  const intentLabel = INTENT_LABELS[intent] || "Mixed";

  // Calculate percentages for app breakdown
  const appBreakdown = useMemo(() => {
    if (!meta?.summary || meta.summary.length === 0) {
      return [];
    }

    const totalSeconds = meta.summary.reduce((sum, app) => sum + app.seconds, 0);
    return meta.summary.map((app) => ({
      label: app.label,
      seconds: app.seconds,
      percentage: totalSeconds > 0 ? Math.round((app.seconds / totalSeconds) * 100) : 0,
    }));
  }, [meta?.summary]);

  // Time range
  const timeRange = useMemo(() => {
    if (!event) return "";
    const startTime = formatTime(event.startMinutes);
    const endTime = formatTime(event.startMinutes + event.duration);
    return `${startTime} - ${endTime}`;
  }, [event]);

  // Total duration
  const totalDuration = useMemo(() => {
    if (!event) return "";
    return formatDuration(event.duration * 60);
  }, [event]);

  useEffect(() => {
    if (visible && event) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(panelTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      panelTranslateY.setValue(1000);
    }
  }, [visible, event, backdropOpacity, panelTranslateY]);

  if (!event || !isSessionBlock) return null;

  const confidence = meta?.confidence ?? 0;
  const confidenceInfo = getConfidenceLevel(confidence);
  const reasoning = meta?.intent_reasoning || `Classified as ${intentLabel}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Animated.View
          className="absolute inset-0 bg-black/40"
          style={{ opacity: backdropOpacity }}
        />
        <Pressable className="absolute inset-0" onPress={onClose} />

        {/* Panel */}
        <Animated.View
          className="bg-[#F2F2F7] rounded-t-3xl"
          style={{
            maxHeight: "85%",
            transform: [{ translateY: panelTranslateY }],
            paddingTop: Platform.OS === "android" ? insets.top : 0,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <View className="w-10" />
            <Text className="text-lg font-bold text-[#111827]">Session Details</Text>
            <Pressable onPress={onClose} className="w-10 items-end">
              <Icon icon={X} size={24} color={COLORS.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          >
            {/* Title Section */}
            <View className="mt-4 mx-4 overflow-hidden rounded-xl bg-white">
              <View className="px-4 py-4">
                <Text className="text-xl font-bold text-[#111827]">
                  {event.title}
                </Text>
                {meta?.place_label && (
                  <View className="flex-row items-center mt-2">
                    <Icon icon={MapPin} size={14} color={COLORS.textMuted} />
                    <Text className="ml-1 text-sm text-[#64748B]">
                      {meta.place_label}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Time Range Section */}
            <View className="mt-4 mx-4 overflow-hidden rounded-xl bg-white">
              <View className="flex-row items-center px-4 py-3">
                <Icon icon={Clock} size={18} color={COLORS.textMuted} />
                <View className="ml-3 flex-1">
                  <Text className="text-base text-[#111827]">{timeRange}</Text>
                  <Text className="text-sm text-[#64748B]">{totalDuration}</Text>
                </View>
              </View>
            </View>

            {/* Intent Classification Section */}
            <View className="mt-6 px-4">
              <Text className="text-xs font-semibold tracking-wider text-[#94A3B8] mb-3">
                CLASSIFICATION
              </Text>
              <View className="overflow-hidden rounded-xl bg-white">
                {/* Intent Badge */}
                <View className="px-4 py-3 flex-row items-center">
                  <View
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: intentStyle.bg }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: intentStyle.text }}
                    >
                      {intentLabel}
                    </Text>
                  </View>
                </View>

                {/* Reasoning */}
                <View className="h-[1px] ml-4 bg-[#E5E5EA]" />
                <View className="px-4 py-3 flex-row">
                  <Icon icon={Info} size={16} color={COLORS.textSubtle} />
                  <Text className="ml-2 flex-1 text-sm text-[#64748B] leading-5">
                    {reasoning}
                  </Text>
                </View>
              </View>
            </View>

            {/* App Usage Breakdown Section */}
            {appBreakdown.length > 0 && (
              <View className="mt-6 px-4">
                <Text className="text-xs font-semibold tracking-wider text-[#94A3B8] mb-3">
                  APP USAGE
                </Text>
                <View className="overflow-hidden rounded-xl bg-white">
                  {appBreakdown.map((app, index) => (
                    <View key={app.label}>
                      {index > 0 && <View className="h-[1px] ml-4 bg-[#E5E5EA]" />}
                      <View className="px-4 py-3">
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-base text-[#111827] font-medium">
                            {app.label}
                          </Text>
                          <View className="flex-row items-center">
                            <Text className="text-sm text-[#64748B] mr-2">
                              {formatDuration(app.seconds)}
                            </Text>
                            <Text className="text-sm font-semibold text-[#111827]">
                              {app.percentage}%
                            </Text>
                          </View>
                        </View>
                        {/* Progress bar */}
                        <View className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${app.percentage}%`,
                              backgroundColor: intentStyle.accent,
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Location Confidence Section */}
            <View className="mt-6 px-4">
              <Text className="text-xs font-semibold tracking-wider text-[#94A3B8] mb-3">
                LOCATION CONFIDENCE
              </Text>
              <View className="overflow-hidden rounded-xl bg-white">
                <View className="px-4 py-3 flex-row items-center">
                  <Icon
                    icon={confidence >= 0.5 ? CheckCircle : AlertCircle}
                    size={18}
                    color={confidenceInfo.color}
                  />
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-base text-[#111827]">
                        {confidenceInfo.label} Confidence
                      </Text>
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: confidenceInfo.color }}
                      >
                        {Math.round(confidence * 100)}%
                      </Text>
                    </View>
                    {/* Confidence bar */}
                    <View className="mt-2 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(confidence * 100)}%`,
                          backgroundColor: confidenceInfo.color,
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* During Sleep Warning */}
            {meta?.during_scheduled_sleep && (
              <View className="mt-6 mx-4 overflow-hidden rounded-xl bg-[#FFF7ED] border border-[#FDBA74]">
                <View className="px-4 py-3 flex-row items-center">
                  <Icon icon={AlertCircle} size={18} color="#F97316" />
                  <Text className="ml-2 flex-1 text-sm text-[#C2410C]">
                    This session occurred during your scheduled sleep time
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};
