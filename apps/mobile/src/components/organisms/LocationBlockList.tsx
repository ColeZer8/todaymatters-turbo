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
  Alert,
} from "react-native";
import { Inbox, Sparkles, Layers } from "lucide-react-native";
import { TimelineBlockSection } from "./TimelineBlockSection";
import type { PlaceSelection } from "@/components/molecules/PlacePickerSheet";
import { EventDetailSheet } from "@/components/molecules/EventDetailSheet";
import { CurrentTimeLine } from "@/components/molecules/CurrentTimeLine";
import type { LocationBlock } from "@/lib/types/location-block";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import {
  buildTimelineEvents,
  filterCommEventsToTimeRange,
  filterScheduledToTimeRange,
} from "@/lib/utils/build-timeline-events";
import {
  fetchPlannedCalendarEventsForDay,
  fetchActualCalendarEventsForDay,
} from "@/lib/supabase/services/calendar-events";
import { fetchCommunicationEventsForDay } from "@/lib/supabase/services/communication-events";
import { createUserPlace } from "@/lib/supabase/services/user-places";
import { encodeGeohash, type LocationLabelEntry } from "@/lib/supabase/services/location-labels";
import { useLocationBlocksForDay } from "@/lib/hooks/use-location-blocks-for-day";

// ============================================================================
// Types
// ============================================================================

export type TimelineFilterValue = "actual" | "scheduled" | "both";

export interface EventPressContext {
  allBlockEvents: TimelineEvent[];
  locationLabel: string;
  geohash7: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LocationBlockListProps {
  date: string;
  userId: string;
  /** Filter timeline events: actual-only, scheduled-only, or both */
  filter?: TimelineFilterValue;
  /** User-defined location labels keyed by geohash7, for client-side overlay. */
  userLabels?: Record<string, LocationLabelEntry>;
  onMarkAccurate?: (summaryIds: string[]) => void;
  onNeedsCorrection?: (summaryIds: string[]) => void;
  onEdit?: (block: LocationBlock) => void;
  /** Callback when a timeline event row is pressed */
  onEventPress?: (event: TimelineEvent, context: EventPressContext) => void;
  /** Callback when a location banner is pressed */
  onBannerPress?: (block: LocationBlock) => void;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  contentContainerStyle?: object;
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

// ============================================================================
// Main Component
// ============================================================================

export const LocationBlockList = ({
  date,
  userId,
  filter = "both",
  userLabels,
  onMarkAccurate,
  onNeedsCorrection,
  onEdit,
  onEventPress: onEventPressProp,
  onBannerPress,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
}: LocationBlockListProps) => {
  // Use the shared hook for location blocks
  const {
    blocks: baseBlocks,
    inferenceResult,
    isLoading,
    error,
    refresh,
  } = useLocationBlocksForDay({
    userId,
    date,
    enabled: true,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [blocksWithTimeline, setBlocksWithTimeline] = useState<LocationBlock[]>([]);
  
  // Dirty tracking: prevent realtime updates from overwriting user edits
  const [dirtyLocationIds, setDirtyLocationIds] = useState<Set<string>>(new Set());
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  // Helper: Mark a location as being edited (dirty)
  const handleStartEdit = useCallback((geohash7: string) => {
    console.log(`[LocationBlockList] 🔒 Marking location as dirty: ${geohash7}`);
    setEditingLocationId(geohash7);
    setDirtyLocationIds(prev => {
      const next = new Set(prev);
      next.add(geohash7);
      return next;
    });
  }, []);

  // Helper: Clear dirty state after successful save
  const handleSaveComplete = useCallback((geohash7: string) => {
    console.log(`[LocationBlockList] ✅ Clearing dirty state for: ${geohash7}`);
    setDirtyLocationIds(prev => {
      const next = new Set(prev);
      next.delete(geohash7);
      return next;
    });
    setEditingLocationId(null);
  }, []);

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

  // Build timeline events for each block (Activity Timeline specific logic)
  useEffect(() => {
    console.log(`[LocationBlockList] 🔍 useEffect triggered: baseBlocks.length = ${baseBlocks?.length ?? 0}`);
    if (baseBlocks && baseBlocks.length > 0) {
      console.log('[LocationBlockList] 🔍 Base blocks from hook:');
      baseBlocks.forEach(b => {
        console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}" (${b.totalLocationSamples} samples)`);
      });
    }
    
    if (!baseBlocks || baseBlocks.length === 0) {
      console.log('[LocationBlockList] 🔍 No baseBlocks, clearing blocksWithTimeline');
      setBlocksWithTimeline([]);
      return;
    }

    // IMMEDIATELY set blocksWithTimeline to baseBlocks (without timeline events)
    // This ensures the UI shows the correct blocks while async enrichment runs
    console.log('[LocationBlockList] 🔍 Initializing blocksWithTimeline with baseBlocks (pre-enrichment)');
    setBlocksWithTimeline(baseBlocks);

    let cancelled = false;

    const buildTimeline = async () => {
      try {
        // Fetch calendar + communication events for timeline
        let plannedEvents: import("@/stores").ScheduledEvent[] = [];
        let actualEvents: import("@/stores").ScheduledEvent[] = [];
        let commEvents: import("@/lib/supabase/services/communication-events").TmEventRow[] = [];

        try {
          const [rawPlanned, rawActual, rawComm] = await Promise.all([
            fetchPlannedCalendarEventsForDay(userId, date),
            fetchActualCalendarEventsForDay(userId, date),
            fetchCommunicationEventsForDay(userId, date),
          ]);
          // Filter out all-day events (holidays, multi-day) — they don't belong in timeline blocks
          plannedEvents = rawPlanned.filter((e) => !e.isAllDay);
          actualEvents = rawActual.filter((e) => !e.isAllDay);
          commEvents = rawComm;
        } catch (fetchErr) {
          console.warn("[LocationBlockList] Calendar/comm fetch warning:", fetchErr);
        }

        if (cancelled) return;

        // Build timeline events for each block
        const now = new Date();
        const isTodayDate =
          date ===
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const curMin = isTodayDate
          ? now.getHours() * 60 + now.getMinutes()
          : -1;

        const enrichedBlocks = baseBlocks.map((block) => {
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

          return {
            ...block,
            timelineEvents: buildTimelineEvents(
              block,
              blockComm,
              blockPlanned,
              blockActual,
              curMin,
              date,
            ),
          };
        });

        if (cancelled) {
          console.log('[LocationBlockList] 🔍 Enrichment was cancelled before completion');
          return;
        }
        
        console.log(`[LocationBlockList] 🔍 Setting blocksWithTimeline: ${enrichedBlocks.length} blocks`);
        enrichedBlocks.forEach(b => {
          console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}" (${b.totalLocationSamples} samples, ${b.timelineEvents?.length ?? 0} events)`);
        });
        
        setBlocksWithTimeline(enrichedBlocks);
      } catch (err) {
        console.error("[LocationBlockList] ❌ Timeline build error:", err);
        if (__DEV__) {
          console.warn("[LocationBlockList] Timeline build error:", err);
        }
      }
    };

    buildTimeline();

    return () => {
      console.log('[LocationBlockList] 🔍 Cleanup: marking enrichment as cancelled');
      cancelled = true;
    };
  }, [baseBlocks, userId, date]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedEvent(null);
  }, []);

  // Apply filter to a block's timeline events
  const applyFilter = useCallback(
    (block: LocationBlock): LocationBlock => {
      if (filter === "both" || !block.timelineEvents) return block;
      const filtered = block.timelineEvents.filter((e) => {
        if (filter === "actual") return e.kind !== "scheduled";
        if (filter === "scheduled") return e.kind === "scheduled" || e.kind === "meeting";
        return true;
      });
      return { ...block, timelineEvents: filtered };
    },
    [filter],
  );

  // Handle place selection from disambiguation sheet
  const handlePlaceSelected = useCallback(
    async (block: LocationBlock, selection: PlaceSelection) => {
      console.log("[LocationBlockList] 🔍 PLACE SELECTION TRIGGERED:", {
        blockId: block.id,
        blockLabel: block.locationLabel,
        selectionPlaceName: selection.placeName,
        selectionCategory: selection.category,
        selectionIsCustom: selection.isCustom,
      });

      // Mark location as dirty while processing
      if (block.geohash7) {
        handleStartEdit(block.geohash7);
      }

      try {
        const firstValidSegment = block.segments?.find((s) =>
          s.locationLat != null &&
          s.locationLng != null &&
          Number.isFinite(s.locationLat) &&
          Number.isFinite(s.locationLng)
        );
        const lat = block.inferredPlace?.latitude
          ?? firstValidSegment?.locationLat
          ?? null;
        const lng = block.inferredPlace?.longitude
          ?? firstValidSegment?.locationLng
          ?? null;

        console.log("[LocationBlockList] 🔍 EXTRACTED COORDINATES:", {
          latitude: lat,
          longitude: lng,
          source: block.inferredPlace?.latitude ? "inferredPlace" : firstValidSegment ? "firstValidSegment" : "none",
        });

        if (lat === null || lng === null) {
          console.error("[LocationBlockList] ❌ NO COORDINATES for place creation");
          // Clear dirty state on error
          if (block.geohash7) {
            handleSaveComplete(block.geohash7);
          }
          Alert.alert(
            "Cannot Save Location",
            "No coordinates available for this location. Please try a different block.",
          );
          return;
        }

        console.log("[LocationBlockList] 🔍 CALLING createUserPlace with:", {
          userId: userId.substring(0, 8) + "...",
          label: selection.placeName,
          latitude: lat,
          longitude: lng,
          category: selection.category ?? "other",
          radiusMeters: 150,
        });

        const result = await createUserPlace({
          userId,
          label: selection.placeName,
          latitude: lat,
          longitude: lng,
          category: selection.category ?? "other",
          radiusMeters: 150,
        });

        console.log(
          `[LocationBlockList] ✅ USER PLACE CREATED SUCCESSFULLY:`,
          {
            id: result.id,
            label: result.label,
            category: result.category,
            user_id: result.user_id.substring(0, 8) + "...",
          }
        );

        // Clear dirty state after successful save
        if (block.geohash7) {
          handleSaveComplete(block.geohash7);
        }

        // Refresh to pick up the new place
        console.log("[LocationBlockList] 🔄 Refreshing blocks...");
        refresh();
      } catch (err) {
        console.error("[LocationBlockList] ❌ FAILED to create user place:", err);
        // Clear dirty state on error
        if (block.geohash7) {
          handleSaveComplete(block.geohash7);
        }
        Alert.alert(
          "Couldn't save place",
          `Error: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        );
      }
    },
    [userId, refresh, handleStartEdit, handleSaveComplete],
  );

  // Render item — passes block context alongside event for overlap/location editing
  const renderItem = useCallback(
    ({ item }: { item: LocationBlock }) => {
      const filteredBlock = applyFilter(item);
      const handleBlockEventPress = (event: TimelineEvent) => {
        if (onEventPressProp) {
          const firstValidSegment = item.segments?.find(s =>
            s.locationLat != null &&
            s.locationLng != null &&
            Number.isFinite(s.locationLat) &&
            Number.isFinite(s.locationLng)
          );
          const lat = item.inferredPlace?.latitude
            ?? firstValidSegment?.locationLat
            ?? null;
          const lng = item.inferredPlace?.longitude
            ?? firstValidSegment?.locationLng
            ?? null;
          onEventPressProp(event, {
            allBlockEvents: filteredBlock.timelineEvents ?? [],
            locationLabel: item.locationLabel,
            geohash7: item.geohash7,
            latitude: lat,
            longitude: lng,
          });
        } else {
          setSelectedEvent(event);
          setShowDetail(true);
        }
      };
      return (
        <TimelineBlockSection
          block={filteredBlock}
          isToday={isToday}
          currentMinutes={currentMinutes}
          onEventPress={handleBlockEventPress}
          onBannerPress={onBannerPress}
          onPlaceSelected={handlePlaceSelected}
        />
      );
    },
    [isToday, currentMinutes, onEventPressProp, onBannerPress, applyFilter, handlePlaceSelected],
  );

  const keyExtractor = useCallback(
    (item: LocationBlock) => item.id,
    [],
  );

  // Count inferred places
  const inferredBlockCount = useMemo(() => {
    return blocksWithTimeline.filter((b) => b.isPlaceInferred).length;
  }, [blocksWithTimeline]);

  // Apply user-defined labels to blocks (client-side overlay)
  const blocksWithUserLabels = useMemo(() => {
    if (!userLabels || Object.keys(userLabels).length === 0) {
      return blocksWithTimeline;
    }

    if (__DEV__) {
      console.log('[LocationBlockList] 🏷️ Applying user labels overlay:', {
        userLabelCount: Object.keys(userLabels).length,
        blockCount: blocksWithTimeline.length,
        labelKeys: Object.keys(userLabels),
        dirtyCount: dirtyLocationIds.size,
      });
    }

    return blocksWithTimeline.map((block) => {
      // SAFETY: Don't apply updates to locations user is editing
      const isDirty = block.geohash7 && dirtyLocationIds.has(block.geohash7);
      if (isDirty) {
        if (__DEV__) {
          console.log(`[LocationBlockList] 🔒 Skipping update for dirty location: ${block.geohash7}`);
        }
        return block; // Keep current state, ignore background updates
      }
      
      // Check if user has a custom label for this geohash
      if (block.geohash7 && userLabels[block.geohash7]) {
        const userLabel = userLabels[block.geohash7];
        if (__DEV__) {
          console.log(`[LocationBlockList] 🏷️ Applying user label: "${block.locationLabel}" → "${userLabel.label}" (geohash: ${block.geohash7})`);
        }
        return {
          ...block,
          locationLabel: userLabel.label,
          locationCategory: userLabel.category || block.locationCategory,
          isUserDefined: true,
        };
      }
      return block;
    });
  }, [blocksWithTimeline, userLabels, dirtyLocationIds]);

  // When filtering to "scheduled" only, hide blocks with no matching events
  const displayBlocks = useMemo(() => {
    let result: LocationBlock[];
    if (filter === "both") {
      result = blocksWithUserLabels;
    } else {
      result = blocksWithUserLabels.filter((b) => {
        const filtered = applyFilter(b);
        return (filtered.timelineEvents?.length ?? 0) > 0;
      });
    }
    
    console.log(`[LocationBlockList] 🔍 displayBlocks computed: filter="${filter}", blocksWithUserLabels.length=${blocksWithUserLabels.length}, displayBlocks.length=${result.length}`);
    if (result.length > 0) {
      result.forEach(b => {
        console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}"${b.isUserDefined ? ' (user-defined)' : ''}`);
      });
    }
    
    return result;
  }, [blocksWithUserLabels, filter, applyFilter]);

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
          {blocksWithTimeline.length > 0 && (
            <Text style={styles.blockCount}>
              {blocksWithTimeline.length} {blocksWithTimeline.length === 1 ? "block" : "blocks"}
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
    if (!isToday || currentMinutes < 0 || blocksWithTimeline.length === 0) return false;
    // Check if current time is already inside a block (handled by TimelineBlockSection)
    const insideABlock = blocksWithTimeline.some((b) => {
      const bStart = b.startTime.getHours() * 60 + b.startTime.getMinutes();
      const bEnd = b.endTime.getHours() * 60 + b.endTime.getMinutes();
      return currentMinutes >= bStart && currentMinutes < bEnd;
    });
    if (insideABlock) return false;
    // Show after the last block if current time is past its end
    const lastBlock = blocksWithTimeline[blocksWithTimeline.length - 1];
    const lastEnd =
      lastBlock.endTime.getHours() * 60 + lastBlock.endTime.getMinutes();
    return currentMinutes >= lastEnd;
  }, [isToday, currentMinutes, blocksWithTimeline]);

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
        data={displayBlocks}
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
