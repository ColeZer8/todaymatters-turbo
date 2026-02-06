/**
 * LocationBlockList Component
 *
 * Fetches hourly summaries for a day, enriches them with place inference
 * and activity segments, groups consecutive same-location hours into
 * LocationBlock objects, and renders them as LocationBlockCard items.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Calendar, Inbox, Sparkles, Layers } from "lucide-react-native";
import { TimelineBlockSection } from "./TimelineBlockSection";
import { EventDetailSheet } from "@/components/molecules/EventDetailSheet";
import { CurrentTimeLine } from "@/components/molecules/CurrentTimeLine";
import type { EnrichedSummary } from "./HourlySummaryList";
import type { LocationBlock } from "@/lib/types/location-block";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import { groupIntoLocationBlocks } from "@/lib/utils/group-location-blocks";
import {
  buildTimelineEvents,
  filterCommEventsToTimeRange,
  filterScheduledToTimeRange,
} from "@/lib/utils/build-timeline-events";
import {
  type HourlySummary,
  fetchHourlySummariesForDate,
  humanizeActivity,
} from "@/lib/supabase/services";
import { supabase } from "@/lib/supabase/client";
import {
  inferPlacesFromHistory,
  type InferredPlace,
  type PlaceInferenceResult,
} from "@/lib/supabase/services/place-inference";
import {
  generateInferenceDescription,
  type InferenceContext,
} from "@/lib/supabase/services/activity-inference-descriptions";
import {
  fetchActivitySegmentsForDate,
  type ActivitySegment,
} from "@/lib/supabase/services/activity-segments";
import {
  fetchPlannedCalendarEventsForDay,
  fetchActualCalendarEventsForDay,
} from "@/lib/supabase/services/calendar-events";
import { fetchCommunicationEventsForDay } from "@/lib/supabase/services/communication-events";

// ============================================================================
// Types
// ============================================================================

export interface LocationBlockListProps {
  date: string;
  userId: string;
  onMarkAccurate?: (summaryIds: string[]) => void;
  onNeedsCorrection?: (summaryIds: string[]) => void;
  onEdit?: (block: LocationBlock) => void;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  contentContainerStyle?: object;
}

interface LocationHourlyRow {
  hour_start: string;
  geohash7: string | null;
  sample_count: number;
  place_label: string | null;
  google_place_name: string | null;
  google_place_types?: string[] | null;
  radius_m?: number | null;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonIcon} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonTime} />
        </View>
        <View style={styles.skeletonBadge} />
      </View>
      <View style={styles.skeletonInference} />
      <View style={styles.skeletonAppRow} />
      <View style={styles.skeletonAppRow} />
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ date }: { date: string }) {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const displayDate = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Inbox size={48} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Activity Data</Text>
      <Text style={styles.emptySubtitle}>
        No location blocks are available for {displayDate}. Blocks are generated
        from your location and screen time data.
      </Text>
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateHeader(dateString: string): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (dateString === todayStr) return "Today";
  if (dateString === yesterdayStr) return "Yesterday";

  const [year, month, day] = dateString.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Floor a Date to the start of its hour.
 */
function floorToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

// ============================================================================
// Main Component
// ============================================================================

export const LocationBlockList = ({
  date,
  userId,
  onMarkAccurate,
  onNeedsCorrection,
  onEdit,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
}: LocationBlockListProps) => {
  const [blocks, setBlocks] = useState<LocationBlock[]>([]);
  const [inferenceResult, setInferenceResult] =
    useState<PlaceInferenceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Compute "is today" and current minutes for the red NOW line
  const isToday = useMemo(() => {
    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return date === todayYmd;
  }, [date]);

  const currentMinutes = useMemo(() => {
    if (!isToday) return -1;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, [isToday]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // 1. Fetch CHARLIE summaries
      const charlieSummaries = await fetchHourlySummariesForDate(userId, date);

      // 2. Fetch location hourly data
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: locationRows, error: locError } = await (supabase as any)
        .schema("tm")
        .from("location_hourly")
        .select(
          "hour_start, geohash7, sample_count, place_label, google_place_name, google_place_types, radius_m",
        )
        .eq("user_id", userId)
        .gte("hour_start", startOfDay)
        .lte("hour_start", endOfDay)
        .order("hour_start", { ascending: true }) as {
        data: LocationHourlyRow[] | null;
        error: unknown;
      };

      if (locError && (locError as { code?: string })?.code !== "42P01") {
        console.warn("[LocationBlockList] Location fetch warning:", locError);
      }

      // 3. Run place inference
      let inference: PlaceInferenceResult | null = null;
      try {
        inference = await inferPlacesFromHistory(userId, 14);
        setInferenceResult(inference);
      } catch (infErr) {
        console.warn("[LocationBlockList] Place inference warning:", infErr);
      }

      // 4. Build hour -> location map
      const locationByHour = new Map<string, LocationHourlyRow>();
      for (const row of ((locationRows || []) as unknown as LocationHourlyRow[])) {
        const hourKey = new Date(row.hour_start).toISOString();
        locationByHour.set(hourKey, row);
      }

      // 5. Build geohash -> inferred place map
      const inferenceByGeohash = new Map<string, InferredPlace>();
      if (inference) {
        for (const place of inference.inferredPlaces) {
          inferenceByGeohash.set(place.geohash7, place);
        }
      }

      // 6. Fetch ALL activity segments for the day at once (perf improvement)
      let allSegments: ActivitySegment[] = [];
      try {
        allSegments = await fetchActivitySegmentsForDate(userId, date);
      } catch (segErr) {
        console.warn("[LocationBlockList] Segment fetch warning:", segErr);
      }

      // Build segments-by-hour map
      const segmentsByHour = new Map<string, ActivitySegment[]>();
      for (const seg of allSegments) {
        const hourKey = floorToHour(seg.startedAt).toISOString();
        const existing = segmentsByHour.get(hourKey) || [];
        existing.push(seg);
        segmentsByHour.set(hourKey, existing);
      }

      // 7. Enrich summaries (same logic as HourlySummaryList)
      const sortedSummaries = [...charlieSummaries].sort(
        (a, b) => a.hourStart.getTime() - b.hourStart.getTime(),
      );

      let prevGeohash: string | null = null;
      let prevPlaceLabel: string | null = null;

      const enriched: EnrichedSummary[] = sortedSummaries.map((summary) => {
        const hourKey = summary.hourStart.toISOString();
        const locData = locationByHour.get(hourKey);
        const geohash7 = locData?.geohash7 || null;
        const inferredPlace = geohash7
          ? inferenceByGeohash.get(geohash7) || null
          : null;

        // Determine best place label
        const inferredLabel = inferredPlace?.suggestedLabel;
        const hasMeaningfulInference =
          inferredLabel &&
          inferredLabel !== "Unknown Location" &&
          inferredLabel !== "Location" &&
          inferredLabel !== "Frequent Location";

        const hasUserDefinedLabel =
          summary.primaryPlaceLabel &&
          summary.primaryPlaceLabel !== "Unknown Location" &&
          summary.primaryPlaceLabel !== "Location" &&
          summary.primaryPlaceLabel !== "Unknown";

        let enrichedLabel: string | null = null;
        if (hasUserDefinedLabel) {
          enrichedLabel = summary.primaryPlaceLabel;
        } else {
          enrichedLabel =
            locData?.place_label ||
            (hasMeaningfulInference ? inferredLabel! : null) ||
            locData?.google_place_name ||
            inferredLabel ||
            null;
        }

        // Regenerate title if needed
        let enrichedTitle = summary.title;
        const titleNeedsEnrichment =
          summary.title.includes("Unknown Location") ||
          summary.title.includes("Unknown -") ||
          summary.title === "No Activity Data" ||
          summary.title.includes("Mixed Activity") ||
          summary.primaryActivity === "mixed_activity";

        if (titleNeedsEnrichment) {
          const inferenceCtx: InferenceContext = {
            activity: summary.primaryActivity,
            apps: summary.appBreakdown,
            screenMinutes: summary.totalScreenMinutes,
            hourOfDay: summary.hourOfDay,
            placeLabel: enrichedLabel,
            previousPlaceLabel: prevPlaceLabel,
            inferredPlace,
            locationSamples: locData?.sample_count || 0,
            confidence: summary.confidenceScore,
            previousGeohash: prevGeohash,
            currentGeohash: geohash7,
            locationRadius: locData?.radius_m || null,
            googlePlaceTypes: locData?.google_place_types || null,
          };
          const smartInference = generateInferenceDescription(inferenceCtx);

          if (summary.primaryActivity === "commute") {
            if (
              prevPlaceLabel &&
              enrichedLabel &&
              enrichedLabel !== "Unknown Location"
            ) {
              enrichedTitle = `${prevPlaceLabel} → ${enrichedLabel}`;
            } else if (
              enrichedLabel &&
              enrichedLabel !== "Unknown Location"
            ) {
              enrichedTitle = `Commute → ${enrichedLabel}`;
            } else {
              enrichedTitle = "In Transit";
            }
          } else if (smartInference) {
            if (
              enrichedLabel &&
              enrichedLabel !== "Unknown Location" &&
              !smartInference.primary
                .toLowerCase()
                .includes(enrichedLabel.toLowerCase())
            ) {
              enrichedTitle = `${enrichedLabel} - ${smartInference.primary}`;
            } else {
              enrichedTitle = smartInference.primary;
            }
          } else {
            const activityLabel = humanizeActivity(summary.primaryActivity);
            if (enrichedLabel && enrichedLabel !== "Unknown Location") {
              enrichedTitle = `${enrichedLabel} - ${activityLabel}`;
            } else {
              enrichedTitle = activityLabel;
            }
          }
        }

        const hourSegments = segmentsByHour.get(hourKey) || [];

        const result: EnrichedSummary = {
          ...summary,
          title: enrichedTitle,
          primaryPlaceLabel: enrichedLabel,
          inferredPlace,
          geohash7,
          locationSamples: locData?.sample_count || 0,
          previousGeohash: prevGeohash,
          previousPlaceLabel: prevPlaceLabel,
          locationRadius: locData?.radius_m || null,
          googlePlaceTypes: locData?.google_place_types || null,
          segments: hourSegments,
        };

        prevGeohash = geohash7;
        prevPlaceLabel = enrichedLabel;

        return result;
      });

      // 8. Group into location blocks
      const locationBlocks = groupIntoLocationBlocks(enriched);

      // 9. Fetch calendar + communication events for timeline
      let plannedEvents: import("@/stores").ScheduledEvent[] = [];
      let actualEvents: import("@/stores").ScheduledEvent[] = [];
      let commEvents: import("@/lib/supabase/services/communication-events").TmEventRow[] = [];

      try {
        [plannedEvents, actualEvents, commEvents] = await Promise.all([
          fetchPlannedCalendarEventsForDay(userId, date),
          fetchActualCalendarEventsForDay(userId, date),
          fetchCommunicationEventsForDay(userId, date),
        ]);
      } catch (fetchErr) {
        console.warn("[LocationBlockList] Calendar/comm fetch warning:", fetchErr);
      }

      // 10. Build timeline events for each block
      const now = new Date();
      const isTodayDate =
        date ===
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const curMin = isTodayDate
        ? now.getHours() * 60 + now.getMinutes()
        : -1;

      for (const block of locationBlocks) {
        const blockComm = filterCommEventsToTimeRange(
          commEvents,
          block.startTime,
          block.endTime,
        );
        const blockPlanned = filterScheduledToTimeRange(
          plannedEvents,
          block.startTime,
          block.endTime,
          date,
        );
        const blockActual = filterScheduledToTimeRange(
          actualEvents,
          block.startTime,
          block.endTime,
          date,
        );

        block.timelineEvents = buildTimelineEvents(
          block,
          blockComm,
          blockPlanned,
          blockActual,
          curMin,
          date,
        );
      }

      setBlocks(locationBlocks);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load data";
      setError(message);
      if (__DEV__) {
        console.warn("[LocationBlockList] Fetch error:", err);
      }
    }
  }, [userId, date]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));
  }, [fetchData]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  // Event press handler
  const handleEventPress = useCallback((event: TimelineEvent) => {
    setSelectedEvent(event);
    setShowDetail(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedEvent(null);
  }, []);

  // Render item
  const renderItem = useCallback(
    ({ item }: { item: LocationBlock }) => (
      <TimelineBlockSection
        block={item}
        isToday={isToday}
        currentMinutes={currentMinutes}
        onEventPress={handleEventPress}
      />
    ),
    [isToday, currentMinutes, handleEventPress],
  );

  const keyExtractor = useCallback(
    (item: LocationBlock) => item.id,
    [],
  );

  // Count inferred places
  const inferredBlockCount = useMemo(() => {
    return blocks.filter((b) => b.isPlaceInferred).length;
  }, [blocks]);

  // List header
  const renderListHeader = () => {
    const HeaderContent = ListHeaderComponent
      ? typeof ListHeaderComponent === "function"
        ? <ListHeaderComponent />
        : ListHeaderComponent
      : null;

    return (
      <View>
        {HeaderContent}
        <View style={styles.dateHeader}>
          <View style={styles.dateIconContainer}>
            <Layers size={16} color="#2563EB" />
          </View>
          <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
          {blocks.length > 0 && (
            <Text style={styles.blockCount}>
              {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
            </Text>
          )}
        </View>

        {/* Inference banner */}
        {inferenceResult &&
          inferenceResult.inferredPlaces &&
          inferenceResult.inferredPlaces.length > 0 &&
          inferredBlockCount > 0 && (
            <View style={styles.inferenceBanner}>
              <View style={styles.inferenceBannerHeader}>
                <Sparkles size={14} color="#D97706" />
                <Text style={styles.inferenceBannerTitle}>
                  Place Inference Active
                </Text>
              </View>
              <Text style={styles.inferenceBannerText}>
                {inferredBlockCount}{" "}
                {inferredBlockCount === 1 ? "block" : "blocks"} using inferred
                locations.
                {inferenceResult.stats
                  ? ` Analyzed ${inferenceResult.stats.hoursAnalyzed}h across ${inferenceResult.stats.daysAnalyzed} days.`
                  : ""}
              </Text>
            </View>
          )}
      </View>
    );
  };

  // Show the NOW line after the last block when current time is past all blocks
  const showTrailingNowLine = useMemo(() => {
    if (!isToday || currentMinutes < 0 || blocks.length === 0) return false;
    // Check if current time is already inside a block (handled by TimelineBlockSection)
    const insideABlock = blocks.some((b) => {
      const bStart = b.startTime.getHours() * 60 + b.startTime.getMinutes();
      const bEnd = b.endTime.getHours() * 60 + b.endTime.getMinutes();
      return currentMinutes >= bStart && currentMinutes < bEnd;
    });
    if (insideABlock) return false;
    // Show after the last block if current time is past its end
    const lastBlock = blocks[blocks.length - 1];
    const lastEnd =
      lastBlock.endTime.getHours() * 60 + lastBlock.endTime.getMinutes();
    return currentMinutes >= lastEnd;
  }, [isToday, currentMinutes, blocks]);

  const renderFooter = useCallback(() => (
    <View>
      {showTrailingNowLine && (
        <View style={styles.trailingNowLine}>
          <CurrentTimeLine />
        </View>
      )}
      {ListFooterComponent
        ? typeof ListFooterComponent === "function"
          ? <ListFooterComponent />
          : ListFooterComponent
        : null}
    </View>
  ), [showTrailingNowLine, ListFooterComponent]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        {renderListHeader()}
        <LoadingSkeleton />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        {renderListHeader()}
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Could not Load Data</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <FlatList<LocationBlock>
        data={blocks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={<EmptyState date={date} />}
        contentContainerStyle={[styles.listContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
      />
      <EventDetailSheet
        event={selectedEvent}
        visible={showDetail}
        onClose={handleCloseDetail}
        onMarkAccurate={onMarkAccurate}
        onNeedsCorrection={onNeedsCorrection}
      />
    </>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  trailingNowLine: {
    marginTop: 4,
    marginBottom: 12,
  },

  // Date header
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  dateIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateHeaderText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  blockCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },

  // Inference banner
  inferenceBanner: {
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  inferenceBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  inferenceBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  inferenceBannerText: {
    fontSize: 12,
    color: "#A16207",
    lineHeight: 16,
  },

  // Skeleton
  skeletonContainer: {
    paddingTop: 8,
  },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.32)",
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonTitle: {
    width: "60%",
    height: 16,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonTime: {
    width: "80%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  skeletonBadge: {
    width: 48,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonInference: {
    width: "100%",
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    marginBottom: 10,
  },
  skeletonAppRow: {
    width: "90%",
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    marginBottom: 4,
  },

  // Empty state
  emptyContainer: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
  },

  // Error state
  errorContainer: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#EF4444",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
  },
});
