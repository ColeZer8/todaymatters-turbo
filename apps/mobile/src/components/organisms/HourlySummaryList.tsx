/**
 * HourlySummaryList Component
 *
 * Displays a list of hourly summaries for a given day using FlatList.
 * Shows summaries in reverse chronological order (most recent first).
 * Includes loading skeleton and empty states.
 *
 * Now integrates Place Inference data to show inferred places (Home, Work, etc.)
 * when no user-defined place exists for an hour.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Calendar, Inbox, Sparkles } from "lucide-react-native";
import { HourlySummaryCard } from "./HourlySummaryCard";
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

// ============================================================================
// Types
// ============================================================================

export interface HourlySummaryListProps {
  /** The date to display summaries for (YYYY-MM-DD format) */
  date: string;
  /** User ID to fetch summaries for */
  userId: string;
  /** Called when user marks summary as accurate */
  onMarkAccurate?: (summaryId: string) => void;
  /** Called when user marks summary as needing correction */
  onNeedsCorrection?: (summaryId: string) => void;
  /** Called when user wants to edit the summary */
  onEdit?: (summary: HourlySummary) => void;
  /** Optional header component */
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  /** Optional footer component */
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  /** Content container style */
  contentContainerStyle?: object;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      {/* Header skeleton */}
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonTime} />
        <View style={styles.skeletonBadge} />
      </View>
      {/* Location skeleton */}
      <View style={styles.skeletonLocationRow}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonLocation} />
      </View>
      {/* Title skeleton */}
      <View style={styles.skeletonTitle} />
      {/* Description skeleton */}
      <View style={styles.skeletonDescription} />
      <View style={styles.skeletonDescriptionShort} />
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

interface EmptyStateProps {
  date: string;
}

function EmptyState({ date }: EmptyStateProps) {
  // Format the date for display
  const displayDate = formatDateForDisplay(date);

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Inbox size={48} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Activity Summaries</Text>
      <Text style={styles.emptySubtitle}>
        No hourly summaries are available for {displayDate}. Summaries are
        generated from your location and screen time data.
      </Text>
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date string for display (e.g., "January 15, 2026")
 */
function formatDateForDisplay(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format date string for header (e.g., "Today", "Yesterday", or "Jan 15")
 */
function formatDateHeader(dateString: string): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (dateString === todayStr) return "Today";
  if (dateString === yesterdayStr) return "Yesterday";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Types for Place Inference Integration
// ============================================================================

interface LocationHourlyRow {
  hour_start: string;
  geohash7: string | null;
  sample_count: number;
  place_label: string | null;
  google_place_name: string | null;
  google_place_types?: string[] | null;
  radius_m?: number | null;
}

/** Extended summary with inferred place data */
interface EnrichedSummary extends HourlySummary {
  inferredPlace?: InferredPlace | null;
  geohash7?: string | null;
  locationSamples?: number;
  previousGeohash?: string | null;
  previousPlaceLabel?: string | null;
  locationRadius?: number | null;
  googlePlaceTypes?: string[] | null;
}

// ============================================================================
// Main Component
// ============================================================================

export const HourlySummaryList = ({
  date,
  userId,
  onMarkAccurate,
  onNeedsCorrection,
  onEdit,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
}: HourlySummaryListProps) => {
  const [summaries, setSummaries] = useState<EnrichedSummary[]>([]);
  const [inferenceResult, setInferenceResult] = useState<PlaceInferenceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch summaries + location data + place inference on mount and when date changes
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // 1. Fetch CHARLIE summaries
      const charlieSummaries = await fetchHourlySummariesForDate(userId, date);

      // 2. Fetch location hourly data to get geohash for each hour
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: locationRows, error: locError } = await (supabase as any)
        .schema("tm")
        .from("location_hourly")
        .select("hour_start, geohash7, sample_count, place_label, google_place_name, google_place_types, radius_m")
        .eq("user_id", userId)
        .gte("hour_start", startOfDay)
        .lte("hour_start", endOfDay)
        .order("hour_start", { ascending: true }) as { data: LocationHourlyRow[] | null; error: unknown };

      if (locError && (locError as { code?: string })?.code !== "42P01") {
        console.warn("[HourlySummaryList] Location fetch warning:", locError);
      }

      // 3. Run place inference (uses 14 days of history)
      let inference: PlaceInferenceResult | null = null;
      try {
        inference = await inferPlacesFromHistory(userId, 14);
        setInferenceResult(inference);
      } catch (infErr) {
        console.warn("[HourlySummaryList] Place inference warning:", infErr);
      }

      // 4. Build a map of hour -> location data
      const locationByHour = new Map<string, LocationHourlyRow>();
      for (const row of (locationRows || []) as unknown as LocationHourlyRow[]) {
        // Normalize to just the hour for matching
        const hourKey = new Date(row.hour_start).toISOString();
        locationByHour.set(hourKey, row);
      }

      // 5. Build a map of geohash -> inferred place
      const inferenceByGeohash = new Map<string, InferredPlace>();
      if (inference) {
        for (const place of inference.inferredPlaces) {
          inferenceByGeohash.set(place.geohash7, place);
        }
      }

      // 6. Enrich CHARLIE summaries with inferred place data
      // Sort summaries by hour (ascending) first to track previous geohash
      const sortedSummaries = [...charlieSummaries].sort(
        (a, b) => a.hourStart.getTime() - b.hourStart.getTime()
      );

      // Build enriched summaries with previous geohash and place label tracking
      let prevGeohash: string | null = null;
      let prevPlaceLabel: string | null = null;
      const enrichedAsc: EnrichedSummary[] = sortedSummaries.map((summary) => {
        const hourKey = summary.hourStart.toISOString();
        const locData = locationByHour.get(hourKey);
        const geohash7 = locData?.geohash7 || null;
        const inferredPlace = geohash7 ? inferenceByGeohash.get(geohash7) || null : null;

        // Determine best place label:
        // Priority: user-defined meaningful label > location_hourly place > google place > inference
        const inferredLabel = inferredPlace?.suggestedLabel;
        const hasMeaningfulInference = inferredLabel && 
          inferredLabel !== "Unknown Location" && 
          inferredLabel !== "Location" &&
          inferredLabel !== "Frequent Location";

        // Check if summary has a MEANINGFUL user-defined label (not a placeholder)
        const hasUserDefinedLabel = summary.primaryPlaceLabel && 
          summary.primaryPlaceLabel !== "Unknown Location" &&
          summary.primaryPlaceLabel !== "Location" &&
          summary.primaryPlaceLabel !== "Unknown";

        let enrichedLabel: string | null = null;

        if (hasUserDefinedLabel) {
          // User has explicitly labeled this - respect it
          enrichedLabel = summary.primaryPlaceLabel;
        } else {
          // No meaningful label - apply enrichment priority
          enrichedLabel = locData?.place_label  // User-defined place from location_hourly
            || (hasMeaningfulInference ? inferredLabel : null)  // Home/Work inference
            || locData?.google_place_name  // Google place (e.g. "Target")
            || inferredLabel  // Any inference (Frequent Location, etc.)
            || null;
        }

        // Regenerate title using smart inference
        // The DB title may have "Unknown Location - Activity" or "Mixed Activity" baked in
        let enrichedTitle = summary.title;
        
        // Check if the current title needs improvement
        const titleNeedsEnrichment = 
          summary.title.includes("Unknown Location") ||
          summary.title.includes("Unknown -") ||
          summary.title === "No Activity Data" ||
          summary.title.includes("Mixed Activity") ||
          summary.primaryActivity === "mixed_activity";
        
        if (titleNeedsEnrichment) {
          // Use smart inference to generate a better title
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
            // Special case for commute - show origin → destination
            if (prevPlaceLabel && enrichedLabel && enrichedLabel !== "Unknown Location") {
              enrichedTitle = `${prevPlaceLabel} → ${enrichedLabel}`;
            } else if (enrichedLabel && enrichedLabel !== "Unknown Location") {
              enrichedTitle = `Commute → ${enrichedLabel}`;
            } else {
              enrichedTitle = "In Transit";
            }
          } else if (smartInference) {
            // Use the smart inference primary as the title
            if (enrichedLabel && enrichedLabel !== "Unknown Location" && 
                !smartInference.primary.toLowerCase().includes(enrichedLabel.toLowerCase())) {
              // Add place to title if not already included
              enrichedTitle = `${enrichedLabel} - ${smartInference.primary}`;
            } else {
              enrichedTitle = smartInference.primary;
            }
          } else {
            // Fallback to basic activity label
            const activityLabel = humanizeActivity(summary.primaryActivity);
            if (enrichedLabel && enrichedLabel !== "Unknown Location") {
              enrichedTitle = `${enrichedLabel} - ${activityLabel}`;
            } else {
              enrichedTitle = activityLabel;
            }
          }
        }

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
        };

        // Update prev for next iteration
        prevGeohash = geohash7;
        prevPlaceLabel = enrichedLabel;

        return result;
      });

      // Reverse back to descending order for display
      const enriched = enrichedAsc.reverse();

      setSummaries(enriched);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load summaries";
      setError(message);
      if (__DEV__) {
        console.warn("[HourlySummaryList] Fetch error:", err);
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

  // Render item - now includes inference data
  const renderItem = useCallback(
    ({ item }: { item: EnrichedSummary }) => (
      <HourlySummaryCard
        summary={item}
        onMarkAccurate={onMarkAccurate}
        onNeedsCorrection={onNeedsCorrection}
        onEdit={onEdit}
        inferredPlace={item.inferredPlace}
        locationSamples={item.locationSamples}
        previousGeohash={item.previousGeohash}
        previousPlaceLabel={item.previousPlaceLabel}
        currentGeohash={item.geohash7}
        locationRadius={item.locationRadius}
        googlePlaceTypes={item.googlePlaceTypes}
      />
    ),
    [onMarkAccurate, onNeedsCorrection, onEdit],
  );

  // Key extractor
  const keyExtractor = useCallback((item: EnrichedSummary) => item.id, []);

  // Count inferred places being used
  const inferredPlaceCount = useMemo(() => {
    return summaries.filter(s => s.inferredPlace && !s.primaryPlaceId).length;
  }, [summaries]);

  // List header with date and inference summary
  const renderListHeader = () => {
    // Handle ListHeaderComponent which can be ComponentType or ReactElement
    const HeaderContent = ListHeaderComponent 
      ? typeof ListHeaderComponent === 'function' 
        ? <ListHeaderComponent />
        : ListHeaderComponent
      : null;
    
    return (
    <View>
      {HeaderContent}
      <View style={styles.dateHeader}>
        <View style={styles.dateIconContainer}>
          <Calendar size={16} color="#2563EB" />
        </View>
        <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
        {summaries.length > 0 && (
          <Text style={styles.summaryCount}>
            {summaries.length} {summaries.length === 1 ? "hour" : "hours"}
          </Text>
        )}
      </View>
      
      {/* Place Inference Summary Banner */}
      {inferenceResult && inferenceResult.inferredPlaces && inferenceResult.inferredPlaces.length > 0 && inferredPlaceCount > 0 && (
        <View style={styles.inferenceBanner}>
          <View style={styles.inferenceBannerHeader}>
            <Sparkles size={14} color="#D97706" />
            <Text style={styles.inferenceBannerTitle}>
              Place Inference Active
            </Text>
          </View>
          <Text style={styles.inferenceBannerText}>
            {inferredPlaceCount} {inferredPlaceCount === 1 ? "hour" : "hours"} using inferred locations.
            {inferenceResult.stats ? ` Analyzed ${inferenceResult.stats.hoursAnalyzed}h across ${inferenceResult.stats.daysAnalyzed} days.` : ""}
          </Text>
        </View>
      )}
    </View>
  );
  };

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
          <Text style={styles.errorTitle}>Could not Load Summaries</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList<EnrichedSummary>
      data={summaries}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={renderListHeader}
      ListFooterComponent={ListFooterComponent}
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
  summaryCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  // Inference banner styles
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
  // Loading skeleton styles
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  skeletonTime: {
    width: 120,
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonBadge: {
    width: 48,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  skeletonIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonLocation: {
    width: 100,
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonTitle: {
    width: "70%",
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    marginBottom: 8,
  },
  skeletonDescription: {
    width: "100%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    marginBottom: 6,
  },
  skeletonDescriptionShort: {
    width: "60%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  // Empty state styles
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
  // Error state styles
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
