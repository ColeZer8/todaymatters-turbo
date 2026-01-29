import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  LayoutChangeEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleHelp,
  Dumbbell,
  Gift,
  Heart,
  MapPin,
  Scissors,
  Smartphone,
  Sparkles,
  SunMedium,
} from "lucide-react-native";
import { Icon } from "@/components/atoms";
import { TimeSplitControl } from "@/components/molecules";
import {
  useReviewTimeStore,
  useAuthStore,
  useEventsStore,
  type EventCategory,
  type ScheduledEvent,
  type TimeBlock,
} from "@/stores";
import { useCalendarEventsSync } from "@/lib/supabase/hooks/use-calendar-events-sync";
import { fetchAllEvidenceForDay } from "@/lib/supabase/services/evidence-data";
import { buildReviewTimeBlocks } from "@/lib/calendar/review-time-blocks";
import { requestReviewTimeSuggestion } from "@/lib/supabase/services/review-time-suggestions";
import {
  formatLocalIso,
  ymdMinutesToLocalDate,
} from "@/lib/calendar/local-time";
import {
  fetchLocationSamplesForRange,
  upsertUserPlaceFromSamples,
} from "@/lib/supabase/services/user-places";
import { getIosInsightsSupportStatus } from "@/lib/ios-insights";
import { syncIosScreenTimeSummary } from "@/lib/supabase/services";

const CATEGORIES = [
  {
    id: "faith",
    label: "Faith",
    icon: SunMedium,
    color: "#F79A3B",
    bgColor: "#FFF5E8",
    selectedBg: "#FEF3E2",
  },
  {
    id: "family",
    label: "Family",
    icon: Heart,
    color: "#5F63F5",
    bgColor: "#EFF0FF",
    selectedBg: "#E8E9FF",
  },
  {
    id: "work",
    label: "Work",
    icon: Gift,
    color: "#2F7BFF",
    bgColor: "#E9F2FF",
    selectedBg: "#DBEAFE",
  },
  {
    id: "health",
    label: "Health",
    icon: Dumbbell,
    color: "#1F9C66",
    bgColor: "#E8F7EF",
    selectedBg: "#D1FAE5",
  },
  {
    id: "other",
    label: "Other",
    icon: CircleHelp,
    color: "#6B7280",
    bgColor: "#F3F4F6",
    selectedBg: "#E5E7EB",
  },
] as const;

const REVIEW_CATEGORY_TO_EVENT: Record<
  (typeof CATEGORIES)[number]["id"],
  EventCategory
> = {
  faith: "routine",
  family: "family",
  work: "work",
  health: "health",
  other: "free",
};

const formatDuration = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

const formatMinutesToTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

interface ReviewTimeTemplateProps {
  focusBlock?: {
    id: string;
    startMinutes: number;
    duration: number;
    title?: string;
    description?: string;
  };
}

export const ReviewTimeTemplate = ({ focusBlock }: ReviewTimeTemplateProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const blockPositions = useRef<Record<string, number>>({});
  const [splittingBlockId, setSplittingBlockId] = useState<string | null>(null);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiLoadingBlockId, setAiLoadingBlockId] = useState<string | null>(null);
  const [placeSavingBlockId, setPlaceSavingBlockId] = useState<string | null>(
    null,
  );
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  const userId = useAuthStore((s) => s.user?.id ?? null);
  const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
  const actualEvents = useEventsStore((s) => s.actualEvents);
  const derivedActualEvents = useEventsStore((s) => s.derivedActualEvents);
  const setActualEventsForDate = useEventsStore(
    (s) => s.setActualEventsForDate,
  );
  const updateActualEvent = useEventsStore((s) => s.updateActualEvent);
  const addActualEvent = useEventsStore((s) => s.addActualEvent);

  const {
    timeBlocks,
    assignments,
    notes,
    aiSuggestions,
    autoAssignRequestedAt,
    assignCategory,
    clearAssignment,
    setNote,
    setAiSuggestion,
    markReviewComplete,
    clearAutoAssignRequest,
    highlightedBlockId,
    setHighlightedBlockId,
    splitTimeBlock,
    setTimeBlocks,
  } = useReviewTimeStore();

  const { loadActualForDay, createActual, updateActual } =
    useCalendarEventsSync();

  const focusEventFromStore = useMemo<ScheduledEvent | null>(() => {
    if (focusBlock) return null;
    if (!highlightedBlockId) return null;
    const allEvents = [...(derivedActualEvents ?? []), ...actualEvents];
    const match = allEvents.find((event) => event.id === highlightedBlockId);
    if (!match || match.category !== "unknown") return null;
    return match;
  }, [actualEvents, derivedActualEvents, focusBlock, highlightedBlockId]);

  const focusTimeBlock = useMemo<TimeBlock | null>(() => {
    const source = focusBlock ?? focusEventFromStore;
    if (!source) return null;
    if (
      !Number.isFinite(source.startMinutes) ||
      !Number.isFinite(source.duration)
    )
      return null;
    const startMinutes = Math.max(0, Math.round(source.startMinutes));
    const duration = Math.max(1, Math.round(source.duration));
    const rawTitle = source.title?.trim();
    const rawDescription = source.description?.trim();
    const description =
      rawDescription && rawDescription !== "Tap to assign"
        ? rawDescription
        : "";

    return {
      id:
        focusBlock?.id ??
        focusEventFromStore?.id ??
        `focus_unknown_${startMinutes}_${duration}`,
      sourceId: `unknown:${focusBlock?.id ?? focusEventFromStore?.id ?? `${startMinutes}_${duration}`}`,
      source: "unknown",
      title: rawTitle || "Unknown",
      description,
      duration,
      startMinutes,
      startTime: formatMinutesToTime(startMinutes),
      endTime: formatMinutesToTime(startMinutes + duration),
      activityDetected: "No activity detected",
    };
  }, [focusBlock, focusEventFromStore]);

  const mergeFocusBlock = useCallback(
    (blocks: TimeBlock[], actualEvents: ScheduledEvent[]) => {
      if (!focusTimeBlock) return blocks;
      const focusStart = focusTimeBlock.startMinutes;
      const focusEnd = focusStart + focusTimeBlock.duration;
      const hasNonUnknownOverlap = actualEvents.some((event) => {
        if (event.category === "unknown") return false;
        const eventStart = event.startMinutes;
        const eventEnd = event.startMinutes + event.duration;
        return eventEnd > focusStart && eventStart < focusEnd;
      });

      if (hasNonUnknownOverlap) return blocks;
      const alreadyIncluded = blocks.some(
        (block) =>
          block.id === focusTimeBlock.id || block.eventId === focusTimeBlock.id,
      );
      if (alreadyIncluded) return blocks;
      return [...blocks, focusTimeBlock].sort(
        (a, b) => a.startMinutes - b.startMinutes,
      );
    },
    [focusTimeBlock],
  );

  const totalUnassigned = timeBlocks.reduce((sum, block) => {
    if (!assignments[block.id]) return sum + block.duration;
    return sum;
  }, 0);

  const highlightedBlockKey = useMemo(() => {
    if (!highlightedBlockId) return null;
    const direct = timeBlocks.find((block) => block.id === highlightedBlockId);
    if (direct) return direct.id;
    const byEvent = timeBlocks.find(
      (block) => block.eventId === highlightedBlockId,
    );
    return byEvent?.id ?? null;
  }, [highlightedBlockId, timeBlocks]);

  const refreshBlocks = useCallback(async () => {
    if (!userId) {
      if (focusTimeBlock) {
        const fallbackEvents = useEventsStore.getState().actualEvents;
        setTimeBlocks(mergeFocusBlock([], fallbackEvents));
      }
      return;
    }
    setIsLoadingBlocks(true);
    try {
      const events = await loadActualForDay(selectedDateYmd);
      setActualEventsForDate(selectedDateYmd, events);
      const evidence = await fetchAllEvidenceForDay(userId, selectedDateYmd);
      const blocks = buildReviewTimeBlocks({
        ymd: selectedDateYmd,
        evidence,
        actualEvents: events,
      });
      setTimeBlocks(mergeFocusBlock(blocks, events));
    } catch (error) {
      if (__DEV__) {
        console.error("[ReviewTime] Failed to load blocks:", error);
      }
    } finally {
      setIsLoadingBlocks(false);
    }
  }, [
    focusTimeBlock,
    loadActualForDay,
    mergeFocusBlock,
    selectedDateYmd,
    setActualEventsForDate,
    setTimeBlocks,
    userId,
  ]);

  useEffect(() => {
    void refreshBlocks();
  }, [refreshBlocks]);

  useEffect(() => {
    if (!autoAssignRequestedAt) return;
    if (isLoadingBlocks || isAutoAssigning) return;
    if (!userId) return;

    let cancelled = false;
    const run = async () => {
      setIsAutoAssigning(true);
      try {
        for (const block of timeBlocks) {
          if (cancelled) return;
          if (assignments[block.id]) continue;
          const note = notes[block.id] ?? "";
          const suggestion = await requestReviewTimeSuggestion({
            block: {
              id: block.id,
              title: block.title,
              description: block.description,
              source: block.source,
              startTime: block.startTime,
              endTime: block.endTime,
              durationMinutes: block.duration,
              activityDetected: block.activityDetected ?? null,
              location: block.location ?? null,
              note,
            },
            date: selectedDateYmd,
          });
          if (cancelled) return;
          setAiSuggestion(block.id, suggestion);
          assignCategory(block.id, suggestion.category);
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[ReviewTime] Auto-assign failed:", error);
        }
      } finally {
        if (!cancelled) {
          setIsAutoAssigning(false);
          clearAutoAssignRequest();
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    assignCategory,
    autoAssignRequestedAt,
    clearAutoAssignRequest,
    isAutoAssigning,
    isLoadingBlocks,
    notes,
    selectedDateYmd,
    setAiSuggestion,
    timeBlocks,
    userId,
  ]);

  useEffect(() => {
    if (
      highlightedBlockKey &&
      blockPositions.current[highlightedBlockKey] !== undefined
    ) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: blockPositions.current[highlightedBlockKey] - 100,
          animated: true,
        });
      }, 100);
    }

    return () => {
      setHighlightedBlockId(null);
    };
  }, [highlightedBlockKey, setHighlightedBlockId]);

  useEffect(() => {
    if (!focusTimeBlock) return;
    if (isLoadingBlocks) return;
    if (
      timeBlocks.some(
        (block) =>
          block.id === focusTimeBlock.id || block.eventId === focusTimeBlock.id,
      )
    )
      return;
    setTimeBlocks(mergeFocusBlock(timeBlocks, actualEvents));
  }, [
    actualEvents,
    focusTimeBlock,
    isLoadingBlocks,
    mergeFocusBlock,
    setTimeBlocks,
    timeBlocks,
  ]);

  const handleBlockLayout = useCallback(
    (blockId: string, event: LayoutChangeEvent) => {
      blockPositions.current[blockId] = event.nativeEvent.layout.y;
    },
    [],
  );

  const handleCategorySelect = (
    blockId: string,
    categoryId: (typeof CATEGORIES)[number]["id"],
  ) => {
    if (assignments[blockId] === categoryId) {
      clearAssignment(blockId);
    } else {
      assignCategory(blockId, categoryId);
    }
  };

  const handleSplitConfirm = useCallback(
    (blockId: string, splitMinutes: number) => {
      splitTimeBlock(blockId, splitMinutes);
      setSplittingBlockId(null);
    },
    [splitTimeBlock],
  );

  const handleSplitCancel = useCallback(() => {
    setSplittingBlockId(null);
  }, []);

  const handleAiSuggest = useCallback(
    async (blockId: string) => {
      const block = timeBlocks.find((b) => b.id === blockId);
      if (!block || !userId) return;
      setAiLoadingBlockId(blockId);
      try {
        const note = notes[blockId] ?? "";
        const suggestion = await requestReviewTimeSuggestion({
          block: {
            id: block.id,
            title: block.title,
            description: block.description,
            source: block.source,
            startTime: block.startTime,
            endTime: block.endTime,
            durationMinutes: block.duration,
            activityDetected: block.activityDetected ?? null,
            location: block.location ?? null,
            note,
          },
          date: selectedDateYmd,
        });
        setAiSuggestion(blockId, suggestion);
      } catch (error) {
        if (__DEV__) {
          console.error("[ReviewTime] AI suggestion failed:", error);
        }
      } finally {
        setAiLoadingBlockId(null);
      }
    },
    [notes, selectedDateYmd, setAiSuggestion, timeBlocks, userId],
  );

  const handleSavePlaceLabel = useCallback(
    async (blockId: string, label: string, category: string) => {
      const block = timeBlocks.find((b) => b.id === blockId);
      if (!block || !userId) return;
      setPlaceSavingBlockId(blockId);
      try {
        const start = ymdMinutesToLocalDate(
          selectedDateYmd,
          block.startMinutes,
        );
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + block.duration);
        const samples = await fetchLocationSamplesForRange(
          userId,
          formatLocalIso(start),
          formatLocalIso(end),
        );
        if (samples.length === 0) return;
        await upsertUserPlaceFromSamples({
          userId,
          label,
          category,
          samples,
        });
        await refreshBlocks();
      } catch (error) {
        if (__DEV__) {
          console.error("[ReviewTime] Failed to save place label:", error);
        }
      } finally {
        setPlaceSavingBlockId(null);
      }
    },
    [refreshBlocks, selectedDateYmd, timeBlocks, userId],
  );

  const handleApplyAi = useCallback(
    (blockId: string) => {
      const suggestion = aiSuggestions[blockId];
      if (!suggestion) return;
      assignCategory(blockId, suggestion.category);
    },
    [aiSuggestions, assignCategory],
  );

  const handleSaveAssignments = useCallback(async () => {
    if (isSaving || !userId) return;
    setIsSaving(true);
    try {
      for (const block of timeBlocks) {
        const assigned = assignments[block.id];
        if (!assigned) continue;

        const eventCategory = REVIEW_CATEGORY_TO_EVENT[assigned];
        const note = notes[block.id]?.trim() ?? "";
        const ai = aiSuggestions[block.id];
        const title = ai?.title || block.title || "Actual";
        const description = note || ai?.description || block.description || "";
        const location = block.location ?? undefined;

        const start = ymdMinutesToLocalDate(
          selectedDateYmd,
          block.startMinutes,
        );
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + block.duration);

        const meta = {
          category: eventCategory,
          source: "review_time",
          source_id: block.sourceId,
          actual: true,
          tags: ["actual"],
          ai: ai ? { confidence: ai.confidence, reason: ai.reason } : undefined,
        };

        if (block.eventId) {
          const updated = await updateActual(block.eventId, {
            title,
            description,
            location,
            scheduledStartIso: formatLocalIso(start),
            scheduledEndIso: formatLocalIso(end),
            meta,
          });
          updateActualEvent(updated, selectedDateYmd);
        } else {
          const created = await createActual({
            title,
            description,
            location,
            scheduledStartIso: formatLocalIso(start),
            scheduledEndIso: formatLocalIso(end),
            meta,
          });
          addActualEvent(created, selectedDateYmd);
        }
      }

      const allAssigned = timeBlocks.every((block) =>
        Boolean(assignments[block.id]),
      );
      if (allAssigned) {
        markReviewComplete(selectedDateYmd);
      }
      await refreshBlocks();
    } catch (error) {
      if (__DEV__) {
        console.error("[ReviewTime] Save failed:", error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    addActualEvent,
    aiSuggestions,
    assignments,
    createActual,
    isSaving,
    notes,
    refreshBlocks,
    selectedDateYmd,
    timeBlocks,
    updateActual,
    updateActualEvent,
    userId,
  ]);

  const canSyncScreenTime = useMemo(() => {
    if (Platform.OS !== "ios") return false;
    return getIosInsightsSupportStatus() === "available";
  }, []);

  const handleSyncScreenTime = useCallback(() => {
    if (!canSyncScreenTime) return;
    router.push("/dev/screen-time");
  }, [canSyncScreenTime, router]);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-[#E5E7EB]">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon icon={ArrowLeft} size={20} color="#374151" />
          </Pressable>
          <Text className="text-[18px] font-bold text-text-primary">
            Review Time
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 32 + insets.bottom,
          }}
        >
          <View className="mb-6 bg-white rounded-2xl p-5 border border-[#E5E7EB]">
            <View className="flex-row items-baseline">
              <Text className="text-[40px] font-bold text-[#1F2937] tracking-tight">
                {formatDuration(totalUnassigned)}
              </Text>
              <Text className="text-[16px] text-[#6B7280] ml-2">to assign</Text>
            </View>
            <Text className="text-[14px] text-[#9CA3AF] mt-1">
              Review each block, add context, and assign a category
            </Text>
            {canSyncScreenTime && (
              <Pressable
                onPress={handleSyncScreenTime}
                disabled={!canSyncScreenTime}
                className="mt-4 items-center justify-center h-10 rounded-full bg-[#EEF2FF]"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <Text className="text-[13px] font-semibold text-[#4F46E5]">
                  Sync Screen Time
                </Text>
              </Pressable>
            )}
          </View>

          {isLoadingBlocks && (
            <View className="mb-6 bg-white rounded-2xl p-4 border border-[#E5E7EB]">
              <Text className="text-[14px] text-[#6B7280]">
                Loading time blocks…
              </Text>
            </View>
          )}

          {!isLoadingBlocks && timeBlocks.length === 0 && (
            <View className="mb-6 bg-white rounded-2xl p-4 border border-[#E5E7EB]">
              <Text className="text-[14px] text-[#6B7280]">
                No unassigned blocks right now.
              </Text>
            </View>
          )}

          <View className="gap-4">
            {timeBlocks.map((block) => {
              const selectedCategory = assignments[block.id];
              const selectedCat = CATEGORIES.find(
                (c) => c.id === selectedCategory,
              );
              const isHighlighted = highlightedBlockKey === block.id;
              const aiSuggestion = aiSuggestions[block.id];
              const isAiSuggested = aiSuggestion?.category;

              return (
                <View
                  key={block.id}
                  onLayout={(e) => handleBlockLayout(block.id, e)}
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{
                    borderWidth: isHighlighted ? 2 : 1,
                    borderColor: isHighlighted
                      ? "#2563EB"
                      : selectedCat
                        ? selectedCat.color + "30"
                        : "#E5E7EB",
                    shadowColor: isHighlighted ? "#2563EB" : "#0f172a",
                    shadowOpacity: isHighlighted ? 0.15 : 0.05,
                    shadowRadius: isHighlighted ? 16 : 12,
                    shadowOffset: { width: 0, height: isHighlighted ? 6 : 4 },
                  }}
                >
                  {(selectedCat || isHighlighted) && (
                    <View
                      className="h-1"
                      style={{
                        backgroundColor: isHighlighted
                          ? "#2563EB"
                          : selectedCat?.color,
                      }}
                    />
                  )}

                  <View className="p-5">
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-[28px] font-bold text-[#1F2937]">
                          {formatDuration(block.duration)}
                        </Text>
                        <Text className="text-[14px] text-[#9CA3AF]">
                          {block.startTime} - {block.endTime}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        {block.duration >= 10 &&
                          splittingBlockId !== block.id && (
                            <Pressable
                              onPress={() => setSplittingBlockId(block.id)}
                              hitSlop={8}
                              className="flex-row items-center gap-1.5 h-8 px-3 rounded-full bg-[#F3F4F6] border border-[#E5E7EB]"
                              style={({ pressed }) => ({
                                opacity: pressed ? 0.7 : 1,
                              })}
                            >
                              <Icon icon={Scissors} size={13} color="#6B7280" />
                              <Text className="text-[12px] font-medium text-[#6B7280]">
                                Split
                              </Text>
                            </Pressable>
                          )}
                        {aiSuggestion && (
                          <Pressable
                            onPress={() => handleApplyAi(block.id)}
                            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{
                              backgroundColor: "#EEF2FF",
                              borderWidth: 1,
                              borderColor: "#C7D2FE",
                            }}
                          >
                            <Icon icon={Sparkles} size={12} color="#6366F1" />
                            <Text className="text-[10px] font-bold text-[#6366F1] uppercase tracking-wider">
                              Use AI
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {splittingBlockId !== block.id && (
                      <View className="mb-4">
                        {block.activityDetected ? (
                          <View className="flex-row items-center gap-2 bg-[#FEF3C7] px-3 py-2 rounded-lg self-start">
                            <Icon
                              icon={Smartphone}
                              size={16}
                              color="#D97706"
                              strokeWidth={1.5}
                            />
                            <Text className="text-[14px] font-medium text-[#92400E]">
                              {block.activityDetected}
                            </Text>
                          </View>
                        ) : block.location ? (
                          <View className="flex-row items-center gap-2 bg-[#DBEAFE] px-3 py-2 rounded-lg self-start">
                            <Icon
                              icon={MapPin}
                              size={16}
                              color="#2563EB"
                              strokeWidth={1.5}
                            />
                            <Text className="text-[14px] font-medium text-[#1E40AF]">
                              Location: {block.location}
                            </Text>
                          </View>
                        ) : (
                          <View className="flex-row items-center gap-2 bg-[#F3F4F6] px-3 py-2 rounded-lg self-start">
                            <Icon
                              icon={CircleHelp}
                              size={16}
                              color="#9CA3AF"
                              strokeWidth={1.5}
                            />
                            <Text className="text-[14px] text-[#9CA3AF]">
                              No activity detected
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {splittingBlockId !== block.id &&
                      block.source === "location" &&
                      block.location && (
                        <View className="flex-row flex-wrap gap-2 mb-4">
                          {[
                            { label: "Set as Work", category: "office" },
                            { label: "Set as Gym", category: "gym" },
                            { label: "Set as Home", category: "home" },
                          ].map((item) => (
                            <Pressable
                              key={item.label}
                              onPress={() =>
                                handleSavePlaceLabel(
                                  block.id,
                                  block.location || item.label,
                                  item.category,
                                )
                              }
                              disabled={placeSavingBlockId === block.id}
                              className="px-3 py-2 rounded-full border border-[#E5E7EB] bg-white"
                              style={({ pressed }) => ({
                                opacity: pressed ? 0.7 : 1,
                              })}
                            >
                              <Text className="text-[12px] font-medium text-[#374151]">
                                {placeSavingBlockId === block.id
                                  ? "Saving…"
                                  : item.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}

                    {splittingBlockId === block.id ? (
                      <TimeSplitControl
                        duration={block.duration}
                        startTime={block.startTime}
                        endTime={block.endTime}
                        onConfirm={(splitMinutes) =>
                          handleSplitConfirm(block.id, splitMinutes)
                        }
                        onCancel={handleSplitCancel}
                      />
                    ) : (
                      <>
                        <View className="mb-4">
                          <TextInput
                            value={notes[block.id] ?? ""}
                            onChangeText={(value) => setNote(block.id, value)}
                            placeholder="Describe what you were doing…"
                            placeholderTextColor="#9CA3AF"
                            multiline
                            className="min-h-[48px] px-4 py-3 rounded-xl border border-[#E5E7EB] text-[14px] text-[#1F2937]"
                          />
                          <View className="flex-row items-center justify-between mt-3">
                            <Pressable
                              onPress={() => handleAiSuggest(block.id)}
                              disabled={aiLoadingBlockId === block.id}
                              className="flex-row items-center gap-2 px-3 py-2 rounded-full bg-[#EEF2FF]"
                              style={({ pressed }) => ({
                                opacity: pressed ? 0.7 : 1,
                              })}
                            >
                              <Icon icon={Sparkles} size={14} color="#6366F1" />
                              <Text className="text-[12px] font-semibold text-[#4F46E5]">
                                {aiLoadingBlockId === block.id
                                  ? "Analyzing…"
                                  : "Ask AI"}
                              </Text>
                            </Pressable>
                            {aiSuggestion && (
                              <Text className="text-[12px] text-[#6B7280]">
                                {Math.round(aiSuggestion.confidence * 100)}%
                                confidence
                              </Text>
                            )}
                          </View>
                          {aiSuggestion?.reason && (
                            <Text className="text-[12px] text-[#6B7280] mt-2">
                              {aiSuggestion.reason}
                            </Text>
                          )}
                        </View>

                        <View className="flex-row justify-between">
                          {CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat.id;
                            const isAi = isAiSuggested === cat.id;

                            return (
                              <Pressable
                                key={cat.id}
                                onPress={() =>
                                  handleCategorySelect(block.id, cat.id)
                                }
                                style={({ pressed }) => ({
                                  opacity: pressed ? 0.8 : 1,
                                })}
                              >
                                <View className="items-center gap-2">
                                  <View
                                    className="h-[52px] w-[52px] items-center justify-center rounded-full"
                                    style={{
                                      backgroundColor: isSelected
                                        ? cat.selectedBg
                                        : isAi
                                          ? cat.bgColor
                                          : "#F9FAFB",
                                      borderWidth: isSelected || isAi ? 1.5 : 1,
                                      borderColor: isSelected
                                        ? cat.color
                                        : isAi
                                          ? cat.color + "50"
                                          : "#E5E7EB",
                                    }}
                                  >
                                    <Icon
                                      icon={cat.icon}
                                      size={20}
                                      color={
                                        isSelected || isAi
                                          ? cat.color
                                          : "#9CA3AF"
                                      }
                                    />
                                  </View>
                                  <Text
                                    className="text-[12px] font-medium"
                                    style={{
                                      color:
                                        isSelected || isAi
                                          ? cat.color
                                          : "#9CA3AF",
                                    }}
                                  >
                                    {cat.label}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {timeBlocks.length > 0 && (
            <Pressable
              onPress={handleSaveAssignments}
              disabled={isSaving}
              className="mt-8 mb-4 items-center justify-center h-12 rounded-full bg-[#2563EB]"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-[15px] font-semibold text-white">
                {isSaving ? "Saving…" : "Save to Actual"}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

