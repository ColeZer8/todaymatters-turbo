import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, MapPin, MapPinOff, Clock, Info, AlertCircle, CheckCircle, Scissors, Merge, ChevronRight, Plus } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { TimePickerModal } from "../organisms/TimePickerModal";
import { AddPlaceModal } from "./AddPlaceModal";
import { PlaceSuggestionPrompt } from "./PlaceSuggestionPrompt";
import type { ScheduledEvent } from "@/stores";
import { useAuth } from "@/hooks/use-auth";
import { splitSessionEvent, mergeSessionEvents, findMergeableNeighbors } from "@/lib/supabase/services/calendar-events";
import {
  isGooglePlacesAvailable,
  mapPlaceTypeToCategory,
  type GooglePlaceSuggestion,
} from "@/lib/supabase/services/google-places";
import {
  splitScheduledEventSession,
  mergeScheduledEventSessions,
  sessionBlockToDerivedEvent,
} from "@/lib/supabase/services/actual-ingestion";
import { createUserPlace } from "@/lib/supabase/services/user-places";
import type { Intent } from "@/lib/supabase/services/app-categories";
import { formatLocalIso } from "@/lib/calendar/local-time";
import { getReadableAppName } from "@/lib/app-names";

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
  /** Callback when session is successfully split - receives the two new events */
  onSplit?: (firstEvent: ScheduledEvent, secondEvent: ScheduledEvent) => void;
  /** Callback when sessions are successfully merged - receives the merged event */
  onMerge?: (mergedEvent: ScheduledEvent) => void;
  /** Callback when a new place is added - receives the place label */
  onAddPlace?: (placeLabel: string) => void;
  /** The start of the day for time calculations */
  dayStart?: Date;
  /** All actual events for the day (used to find mergeable neighbors) */
  allActualEvents?: ScheduledEvent[];
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
  onSplit,
  onMerge,
  onAddPlace,
  dayStart: dayStartProp,
  allActualEvents = [],
}: SessionDetailModalProps) => {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;
  const { user } = useAuth();

  // Split state
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  // Merge state
  const [showMergeOptions, setShowMergeOptions] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<ScheduledEvent | null>(null);

  // Add place state
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  // Track if user dismissed the suggestion to show manual entry button
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const meta = event?.meta;
  const isSessionBlock = meta?.kind === "session_block";

  // Get intent styling
  const intent = meta?.intent || "mixed";
  const intentStyle = INTENT_COLORS[intent] || INTENT_COLORS.mixed;
  const intentLabel = INTENT_LABELS[intent] || "Mixed";

  // Calculate the day start
  const dayStart = useMemo(() => {
    if (dayStartProp) return dayStartProp;
    // Default to today's start
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, [dayStartProp]);

  // Calculate session start and end times
  const sessionTimes = useMemo(() => {
    if (!event) return null;
    const startMs = dayStart.getTime() + event.startMinutes * 60 * 1000;
    const endMs = startMs + event.duration * 60 * 1000;
    return {
      start: new Date(startMs),
      end: new Date(endMs),
      midpoint: new Date(startMs + (endMs - startMs) / 2),
    };
  }, [event, dayStart]);

  // Calculate percentages for app breakdown
  const appBreakdown = useMemo(() => {
    const summary =
      meta?.app_summary?.map((entry) => ({
        label:
          getReadableAppName({ appId: entry.app_id }) ?? entry.app_id,
        seconds: entry.seconds,
      })) ??
      meta?.summary?.map((entry) => ({
        label: getReadableAppName({ appId: entry.label }) ?? entry.label,
        seconds: entry.seconds,
      })) ??
      [];

    if (summary.length === 0) {
      return [];
    }

    const totalSeconds = summary.reduce((sum, app) => sum + app.seconds, 0);
    return summary.map((app) => ({
      label: app.label,
      seconds: app.seconds,
      percentage: totalSeconds > 0 ? Math.round((app.seconds / totalSeconds) * 100) : 0,
    }));
  }, [meta?.app_summary, meta?.summary]);

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

  // Check if session can be split (must be at least 10 minutes long)
  const canSplit = useMemo(() => {
    if (!event) return false;
    return event.duration >= 10;
  }, [event]);

  // Find mergeable neighbors (adjacent session blocks)
  const mergeableNeighbors = useMemo(() => {
    if (!event || !allActualEvents.length) return [];
    return findMergeableNeighbors(event, allActualEvents);
  }, [event, allActualEvents]);

  // Check if session can be merged (must have at least one adjacent session)
  const canMerge = mergeableNeighbors.length > 0;

  // Check if we can add a place (must be at unknown location with coordinates)
  const canAddPlace = useMemo(() => {
    if (!meta) return false;
    // Session must be at an unknown location (no place_id or "Unknown" label)
    const isUnknownLocation =
      !meta.place_id &&
      (!meta.place_label ||
        meta.place_label.toLowerCase() === "unknown" ||
        meta.place_label.toLowerCase().startsWith("near "));
    // Must have coordinates to create a place
    const hasCoordinates =
      typeof meta.latitude === "number" && typeof meta.longitude === "number";
    return isUnknownLocation && hasCoordinates;
  }, [meta]);

  // Check if we should show the Google Places suggestion prompt
  const showGooglePlacesSuggestion = useMemo(() => {
    // Must be able to add a place
    if (!canAddPlace) return false;
    // Must not have dismissed the suggestion already
    if (suggestionDismissed) return false;
    // Google Places API must be available
    if (!isGooglePlacesAvailable()) return false;
    return true;
  }, [canAddPlace, suggestionDismissed]);

  // Handle add place button press
  const handleAddPlacePress = useCallback(() => {
    if (!canAddPlace) {
      Alert.alert(
        "Cannot Add Place",
        "This location already has a place label or is missing coordinates.",
        [{ text: "OK" }]
      );
      return;
    }
    setShowAddPlaceModal(true);
  }, [canAddPlace]);

  // Handle accepting a Google Places suggestion
  const handleAcceptPlaceSuggestion = useCallback(
    async (suggestion: GooglePlaceSuggestion, category: string | null) => {
      if (!user?.id || !meta?.latitude || !meta?.longitude) return;

      setIsAddingPlace(true);
      try {
        // Create the user place with the suggestion's name
        await createUserPlace({
          userId: user.id,
          label: suggestion.name,
          latitude: suggestion.latitude, // Use suggestion's coordinates for accuracy
          longitude: suggestion.longitude,
          category,
          radiusMeters: 150, // Default 150m radius
        });

        // Notify parent component
        if (onAddPlace) {
          onAddPlace(suggestion.name);
        }

        Alert.alert(
          "Place Added",
          `"${suggestion.name}" has been saved. Future visits will be recognized automatically.`,
          [
            {
              text: "OK",
              onPress: () => {
                setSuggestionDismissed(true);
                onClose();
              },
            },
          ]
        );
      } catch (error) {
        console.error("Failed to add place from suggestion:", error);
        Alert.alert(
          "Failed to Add Place",
          "There was an error saving the place. Please try again.",
          [{ text: "OK" }]
        );
      } finally {
        setIsAddingPlace(false);
      }
    },
    [user?.id, meta?.latitude, meta?.longitude, onAddPlace, onClose]
  );

  // Handle rejecting a Google Places suggestion - show manual entry
  const handleRejectPlaceSuggestion = useCallback(() => {
    setSuggestionDismissed(true);
    setShowAddPlaceModal(true);
  }, []);

  // Handle using the "Near [Area]" fallback from suggestion prompt
  const handleUseFallbackPlace = useCallback(
    async (fallbackName: string) => {
      if (!user?.id || !meta?.latitude || !meta?.longitude) return;

      setIsAddingPlace(true);
      try {
        // Create the user place with the fallback name
        await createUserPlace({
          userId: user.id,
          label: fallbackName,
          latitude: meta.latitude,
          longitude: meta.longitude,
          category: "other",
          radiusMeters: 150,
        });

        // Notify parent component
        if (onAddPlace) {
          onAddPlace(fallbackName);
        }

        Alert.alert(
          "Place Added",
          `"${fallbackName}" has been saved. Future visits will be recognized automatically.`,
          [
            {
              text: "OK",
              onPress: () => {
                setSuggestionDismissed(true);
                onClose();
              },
            },
          ]
        );
      } catch (error) {
        console.error("Failed to add fallback place:", error);
        Alert.alert(
          "Failed to Add Place",
          "There was an error saving the place. Please try again.",
          [{ text: "OK" }]
        );
      } finally {
        setIsAddingPlace(false);
      }
    },
    [user?.id, meta?.latitude, meta?.longitude, onAddPlace, onClose]
  );

  // Handle saving a new place
  const handleSavePlace = useCallback(
    async (label: string, category: string | null) => {
      if (!user?.id || !meta?.latitude || !meta?.longitude) return;

      setIsAddingPlace(true);
      try {
        await createUserPlace({
          userId: user.id,
          label,
          latitude: meta.latitude,
          longitude: meta.longitude,
          category,
          radiusMeters: 150, // Default 150m radius
        });

        // Notify parent component
        if (onAddPlace) {
          onAddPlace(label);
        }

        Alert.alert(
          "Place Added",
          `"${label}" has been saved. Future visits to this location will be recognized automatically.`,
          [
            {
              text: "OK",
              onPress: () => {
                setShowAddPlaceModal(false);
                onClose();
              },
            },
          ]
        );
      } catch (error) {
        console.error("Failed to add place:", error);
        Alert.alert(
          "Failed to Add Place",
          "There was an error saving the place. Please try again.",
          [{ text: "OK" }]
        );
      } finally {
        setIsAddingPlace(false);
      }
    },
    [user?.id, meta?.latitude, meta?.longitude, onAddPlace, onClose]
  );

  // Handle merge button press
  const handleMergePress = useCallback(() => {
    if (!canMerge) {
      Alert.alert(
        "Cannot Merge",
        "No adjacent sessions found to merge with.",
        [{ text: "OK" }]
      );
      return;
    }
    setShowMergeOptions(true);
  }, [canMerge]);

  // Handle selecting a merge target
  const handleSelectMergeTarget = useCallback(
    (target: ScheduledEvent) => {
      setSelectedMergeTarget(target);

      // Confirm the merge
      const targetTimeRange = `${formatTime(target.startMinutes)} - ${formatTime(target.startMinutes + target.duration)}`;
      Alert.alert(
        "Merge Sessions",
        `Merge this session with "${target.title}" (${targetTimeRange})?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setSelectedMergeTarget(null),
          },
          {
            text: "Merge",
            style: "destructive",
            onPress: async () => {
              await performMerge(target);
            },
          },
        ]
      );
    },
    []
  );

  // Perform the actual merge operation
  const performMerge = useCallback(
    async (target: ScheduledEvent) => {
      if (!event || !user?.id) return;

      setIsMerging(true);
      try {
        // Use the merge function to calculate the merged session
        const mergeResult = mergeScheduledEventSessions(
          {
            id: event.id,
            title: event.title,
            startMinutes: event.startMinutes,
            duration: event.duration,
            meta: event.meta as {
              kind?: string;
              place_id?: string | null;
              place_label?: string | null;
              intent?: Intent;
              children?: string[];
              confidence?: number;
              summary?: Array<{ label: string; seconds: number }>;
              intent_reasoning?: string;
            },
          },
          {
            id: target.id,
            title: target.title,
            startMinutes: target.startMinutes,
            duration: target.duration,
            meta: target.meta as {
              kind?: string;
              place_id?: string | null;
              place_label?: string | null;
              intent?: Intent;
              children?: string[];
              confidence?: number;
              summary?: Array<{ label: string; seconds: number }>;
              intent_reasoning?: string;
            },
          },
          dayStart,
          undefined // userOverrides - not available in this context
        );

        // Convert merged session to the format needed for database operations
        const mergedDerived = sessionBlockToDerivedEvent(mergeResult.mergedSession);

        // Call the database function to persist the merge
        const result = await mergeSessionEvents({
          userId: user.id,
          originalEventIds: [event.id, target.id],
          mergedSession: {
            title: mergedDerived.title,
            scheduledStartIso: formatLocalIso(mergedDerived.scheduledStart),
            scheduledEndIso: formatLocalIso(mergedDerived.scheduledEnd),
            meta: {
              ...mergeResult.mergedSession.meta,
              category: event.category,
            } as Parameters<typeof mergeSessionEvents>[0]["mergedSession"]["meta"],
          },
        });

        // Notify parent component of successful merge
        if (onMerge) {
          onMerge(result.mergedEvent);
        }

        Alert.alert(
          "Sessions Merged",
          "The sessions have been merged into a single block.",
          [
            {
              text: "OK",
              onPress: onClose,
            },
          ]
        );
      } catch (error) {
        console.error("Failed to merge sessions:", error);
        Alert.alert(
          "Merge Failed",
          "Failed to merge the sessions. Please try again.",
          [{ text: "OK" }]
        );
      } finally {
        setIsMerging(false);
        setSelectedMergeTarget(null);
        setShowMergeOptions(false);
      }
    },
    [event, user?.id, dayStart, onMerge, onClose]
  );

  // Handle split button press
  const handleSplitPress = useCallback(() => {
    if (!canSplit) {
      Alert.alert(
        "Cannot Split",
        "Sessions must be at least 10 minutes long to split.",
        [{ text: "OK" }]
      );
      return;
    }
    setShowSplitPicker(true);
  }, [canSplit]);

  // Handle split time selection
  const handleSplitTimeConfirm = useCallback(
    async (splitTime: Date) => {
      setShowSplitPicker(false);

      if (!event || !sessionTimes || !user?.id) {
        return;
      }

      // Validate split time is within session bounds
      const splitMs = splitTime.getTime();
      const startMs = sessionTimes.start.getTime();
      const endMs = sessionTimes.end.getTime();

      // The time picker returns time for today, adjust to session's day
      const adjustedSplitTime = new Date(dayStart);
      adjustedSplitTime.setHours(splitTime.getHours(), splitTime.getMinutes(), 0, 0);
      const adjustedSplitMs = adjustedSplitTime.getTime();

      if (adjustedSplitMs <= startMs || adjustedSplitMs >= endMs) {
        Alert.alert(
          "Invalid Split Point",
          "The split point must be between the session start and end times.",
          [{ text: "OK" }]
        );
        return;
      }

      // Confirm the split
      Alert.alert(
        "Split Session",
        `Split this session at ${formatTime(adjustedSplitTime.getHours() * 60 + adjustedSplitTime.getMinutes())}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Split",
            style: "destructive",
            onPress: async () => {
              await performSplit(adjustedSplitTime);
            },
          },
        ]
      );
    },
    [event, sessionTimes, user?.id, dayStart]
  );

  // Perform the actual split operation
  const performSplit = useCallback(
    async (splitPoint: Date) => {
      if (!event || !user?.id) return;

      setIsSplitting(true);
      try {
        // Use the split function to calculate the new sessions
        const splitResult = splitScheduledEventSession(
          {
            id: event.id,
            title: event.title,
            startMinutes: event.startMinutes,
            duration: event.duration,
            meta: event.meta as {
              kind?: string;
              place_id?: string | null;
              place_label?: string | null;
              intent?: Intent;
              children?: string[];
              confidence?: number;
              summary?: Array<{ label: string; seconds: number }>;
              intent_reasoning?: string;
            },
          },
          splitPoint,
          dayStart,
          undefined, // childEvents - not available in this context
          undefined  // userOverrides - not available in this context
        );

        // Convert session blocks to the format needed for database operations
        const firstDerived = sessionBlockToDerivedEvent(splitResult.firstSession);
        const secondDerived = sessionBlockToDerivedEvent(splitResult.secondSession);

        // Call the database function to persist the split
        const result = await splitSessionEvent({
          userId: user.id,
          originalEventId: event.id,
          splitPointIso: formatLocalIso(splitPoint),
          firstSession: {
            title: firstDerived.title,
            scheduledStartIso: formatLocalIso(firstDerived.scheduledStart),
            scheduledEndIso: formatLocalIso(firstDerived.scheduledEnd),
            meta: {
              ...splitResult.firstSession.meta,
              category: event.category,
            } as Parameters<typeof splitSessionEvent>[0]["firstSession"]["meta"],
          },
          secondSession: {
            title: secondDerived.title,
            scheduledStartIso: formatLocalIso(secondDerived.scheduledStart),
            scheduledEndIso: formatLocalIso(secondDerived.scheduledEnd),
            meta: {
              ...splitResult.secondSession.meta,
              category: event.category,
            } as Parameters<typeof splitSessionEvent>[0]["secondSession"]["meta"],
          },
        });

        // Notify parent component of successful split
        if (onSplit) {
          onSplit(result.firstEvent, result.secondEvent);
        }

        Alert.alert(
          "Session Split",
          "The session has been split into two separate blocks.",
          [
            {
              text: "OK",
              onPress: onClose,
            },
          ]
        );
      } catch (error) {
        console.error("Failed to split session:", error);
        Alert.alert(
          "Split Failed",
          "Failed to split the session. Please try again.",
          [{ text: "OK" }]
        );
      } finally {
        setIsSplitting(false);
      }
    },
    [event, user?.id, dayStart, onSplit, onClose]
  );

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

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setShowSplitPicker(false);
      setIsSplitting(false);
      setShowMergeOptions(false);
      setIsMerging(false);
      setSelectedMergeTarget(null);
      setShowAddPlaceModal(false);
      setIsAddingPlace(false);
      setSuggestionDismissed(false);
    }
  }, [visible]);

  if (!event || !isSessionBlock) return null;

  const confidence = meta?.confidence ?? 0;
  const confidenceInfo = getConfidenceLevel(confidence);
  const reasoning = meta?.intent_reasoning || `Classified as ${intentLabel}`;

  return (
    <>
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
                      <Icon
                        icon={meta.fuzzy_location ? MapPinOff : MapPin}
                        size={14}
                        color={meta.fuzzy_location ? COLORS.textSubtle : COLORS.textMuted}
                      />
                      <Text
                        className="ml-1 text-sm"
                        style={{
                          color: meta.fuzzy_location ? COLORS.textSubtle : COLORS.textMuted,
                          fontStyle: meta.fuzzy_location ? "italic" : "normal",
                        }}
                      >
                        {meta.place_label}
                        {meta.fuzzy_location && " (approximate)"}
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

              {/* Google Places Suggestion Prompt (shown for unknown locations) */}
              {showGooglePlacesSuggestion &&
                meta?.latitude !== undefined &&
                meta?.longitude !== undefined && (
                  <View className="mt-4 mx-4">
                    <PlaceSuggestionPrompt
                      latitude={meta.latitude}
                      longitude={meta.longitude}
                      onAccept={handleAcceptPlaceSuggestion}
                      onReject={handleRejectPlaceSuggestion}
                      onUseFallback={handleUseFallbackPlace}
                      isSaving={isAddingPlace}
                    />
                  </View>
                )}

              {/* Actions Section */}
              <View className="mt-6 px-4">
                <Text className="text-xs font-semibold tracking-wider text-[#94A3B8] mb-3">
                  ACTIONS
                </Text>
                <View className="overflow-hidden rounded-xl bg-white">
                  {/* Split Button */}
                  <Pressable
                    onPress={handleSplitPress}
                    disabled={!canSplit || isSplitting}
                    className={`flex-row items-center px-4 py-3 ${
                      !canSplit || isSplitting ? "opacity-50" : ""
                    }`}
                  >
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: "#FEF3C7" }}
                    >
                      <Icon icon={Scissors} size={16} color="#D97706" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base text-[#111827] font-medium">
                        {isSplitting ? "Splitting..." : "Split Session"}
                      </Text>
                      <Text className="text-sm text-[#64748B]">
                        {canSplit
                          ? "Divide this session into two blocks"
                          : "Session too short to split"}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Divider */}
                  <View className="h-[1px] ml-4 bg-[#E5E5EA]" />

                  {/* Merge Button */}
                  <Pressable
                    onPress={handleMergePress}
                    disabled={!canMerge || isMerging}
                    className={`flex-row items-center px-4 py-3 ${
                      !canMerge || isMerging ? "opacity-50" : ""
                    }`}
                  >
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: "#DBEAFE" }}
                    >
                      <Icon icon={Merge} size={16} color="#2563EB" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base text-[#111827] font-medium">
                        {isMerging ? "Merging..." : "Merge Session"}
                      </Text>
                      <Text className="text-sm text-[#64748B]">
                        {canMerge
                          ? `${mergeableNeighbors.length} adjacent session${mergeableNeighbors.length > 1 ? "s" : ""} available`
                          : "No adjacent sessions to merge"}
                      </Text>
                    </View>
                    {canMerge && !isMerging && (
                      <Icon icon={ChevronRight} size={20} color={COLORS.textMuted} />
                    )}
                  </Pressable>

                  {/* Add Place Button (only shown for unknown locations when suggestion is not showing) */}
                  {canAddPlace && !showGooglePlacesSuggestion && (
                    <>
                      <View className="h-[1px] ml-4 bg-[#E5E5EA]" />
                      <Pressable
                        onPress={handleAddPlacePress}
                        disabled={isAddingPlace}
                        className={`flex-row items-center px-4 py-3 ${
                          isAddingPlace ? "opacity-50" : ""
                        }`}
                      >
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: "#F0FDF4" }}
                        >
                          <Icon icon={Plus} size={16} color="#16A34A" />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className="text-base text-[#111827] font-medium">
                            {isAddingPlace ? "Adding..." : "Add Place"}
                          </Text>
                          <Text className="text-sm text-[#64748B]">
                            Label this location for future recognition
                          </Text>
                        </View>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              {/* Merge Options Section (shown when merge is pressed) */}
              {showMergeOptions && mergeableNeighbors.length > 0 && (
                <View className="mt-4 px-4">
                  <Text className="text-xs font-semibold tracking-wider text-[#94A3B8] mb-3">
                    SELECT SESSION TO MERGE WITH
                  </Text>
                  <View className="overflow-hidden rounded-xl bg-white">
                    {mergeableNeighbors.map((neighbor, index) => {
                      const neighborTimeRange = `${formatTime(neighbor.startMinutes)} - ${formatTime(neighbor.startMinutes + neighbor.duration)}`;
                      const neighborDuration = formatDuration(neighbor.duration * 60);
                      const neighborIntent = (neighbor.meta?.intent as string) || "mixed";
                      const neighborIntentStyle = INTENT_COLORS[neighborIntent] || INTENT_COLORS.mixed;

                      return (
                        <View key={neighbor.id}>
                          {index > 0 && <View className="h-[1px] ml-4 bg-[#E5E5EA]" />}
                          <Pressable
                            onPress={() => handleSelectMergeTarget(neighbor)}
                            disabled={isMerging}
                            className="flex-row items-center px-4 py-3"
                          >
                            <View
                              className="w-8 h-8 rounded-full items-center justify-center"
                              style={{ backgroundColor: neighborIntentStyle.bg }}
                            >
                              <MapPin size={14} color={neighborIntentStyle.text} />
                            </View>
                            <View className="ml-3 flex-1">
                              <Text className="text-base text-[#111827] font-medium">
                                {neighbor.title}
                              </Text>
                              <Text className="text-sm text-[#64748B]">
                                {neighborTimeRange} · {neighborDuration}
                              </Text>
                            </View>
                            <Icon icon={ChevronRight} size={20} color={COLORS.textMuted} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                  {/* Cancel merge selection */}
                  <Pressable
                    onPress={() => setShowMergeOptions(false)}
                    className="mt-3 py-2"
                  >
                    <Text className="text-center text-sm text-[#2563EB]">
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              )}

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

      {/* Time Picker for Split Point */}
      {sessionTimes && (
        <TimePickerModal
          visible={showSplitPicker}
          label="Choose Split Time"
          initialTime={sessionTimes.midpoint}
          onConfirm={handleSplitTimeConfirm}
          onClose={() => setShowSplitPicker(false)}
        />
      )}

      {/* Add Place Modal */}
      <AddPlaceModal
        visible={showAddPlaceModal}
        onClose={() => setShowAddPlaceModal(false)}
        onSave={handleSavePlace}
        isSaving={isAddingPlace}
      />
    </>
  );
};
