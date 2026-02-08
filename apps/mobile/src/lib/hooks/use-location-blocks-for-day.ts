/**
 * useLocationBlocksForDay Hook
 *
 * Shared hook that fetches BRAVO/CHARLIE pipeline data for a given day
 * and returns grouped LocationBlock[] objects.
 *
 * Extracted from LocationBlockList.tsx (fetchData, lines 220-460) so that
 * both the Activity Timeline and the Comprehensive Calendar can share
 * the same data-fetching and enrichment logic.
 *
 * This hook performs:
 *   1. Fetch CHARLIE hourly summaries
 *   2. Fetch location_hourly rows from Supabase
 *   3. Run place inference (14-day window, cached)
 *   4. Fetch BRAVO activity segments
 *   5. Enrich summaries with place labels, segments, inference descriptions
 *   6. Group into LocationBlock[] via groupIntoLocationBlocks()
 *
 * It does NOT include buildTimelineEvents() — that is Activity Timeline
 * specific and remains in LocationBlockList.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { EnrichedSummary } from "@/components/organisms/HourlySummaryList";
import type { LocationBlock } from "@/lib/types/location-block";
import { groupIntoLocationBlocks } from "@/lib/utils/group-location-blocks";
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

// ============================================================================
// Types
// ============================================================================

export interface UseLocationBlocksForDayOptions {
  /** Supabase user ID */
  userId: string;
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Whether fetching is enabled (default: true). Set false to skip loading. */
  enabled?: boolean;
}

export interface UseLocationBlocksForDayReturn {
  /** Grouped location blocks for the day */
  blocks: LocationBlock[];
  /** The place inference result (for display of inference banners, etc.) */
  inferenceResult: PlaceInferenceResult | null;
  /** Whether the initial load is in progress */
  isLoading: boolean;
  /** Error message, or null if no error */
  error: string | null;
  /** Trigger a full data refresh */
  refresh: () => Promise<void>;
}

/** Shape of a row from tm.location_hourly */
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
// Helpers
// ============================================================================

/** Floor a Date to the start of its hour. */
function floorToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

// ============================================================================
// Hook
// ============================================================================

export function useLocationBlocksForDay(
  options: UseLocationBlocksForDayOptions,
): UseLocationBlocksForDayReturn {
  const { userId, date, enabled = true } = options;

  const [blocks, setBlocks] = useState<LocationBlock[]>([]);
  const [inferenceResult, setInferenceResult] =
    useState<PlaceInferenceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Inference cache ----
  // Place inference is expensive (scans 14 days of location data).
  // Cache it across re-fetches for the same userId. Only invalidate on
  // explicit refresh or when userId changes.
  const inferenceCache = useRef<{
    userId: string;
    result: PlaceInferenceResult;
  } | null>(null);

  // ---- Core fetch logic ----
  // Mirrors LocationBlockList.tsx fetchData (lines 220-420), steps 1-6.
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // ------------------------------------------------------------------
      // 1. Fetch CHARLIE hourly summaries
      // ------------------------------------------------------------------
      const charlieSummaries = await fetchHourlySummariesForDate(userId, date);

      // ------------------------------------------------------------------
      // 2. Fetch location_hourly rows for the day
      // ------------------------------------------------------------------
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
        console.warn(
          "[useLocationBlocksForDay] Location fetch warning:",
          locError,
        );
      }

      // ------------------------------------------------------------------
      // 3. Run place inference (with caching)
      // ------------------------------------------------------------------
      let inference: PlaceInferenceResult | null = null;
      try {
        if (
          inferenceCache.current &&
          inferenceCache.current.userId === userId
        ) {
          inference = inferenceCache.current.result;
        } else {
          inference = await inferPlacesFromHistory(userId, 14);
          if (inference) {
            inferenceCache.current = { userId, result: inference };
          }
        }
        setInferenceResult(inference);
      } catch (infErr) {
        console.warn(
          "[useLocationBlocksForDay] Place inference warning:",
          infErr,
        );
      }

      // ------------------------------------------------------------------
      // 4. Build lookup maps
      // ------------------------------------------------------------------

      // hour ISO string → location row
      const locationByHour = new Map<string, LocationHourlyRow>();
      for (const row of (locationRows || []) as unknown as LocationHourlyRow[]) {
        const hourKey = new Date(row.hour_start).toISOString();
        locationByHour.set(hourKey, row);
      }

      // geohash7 → inferred place
      const inferenceByGeohash = new Map<string, InferredPlace>();
      if (inference) {
        for (const place of inference.inferredPlaces) {
          inferenceByGeohash.set(place.geohash7, place);
        }
      }

      // ------------------------------------------------------------------
      // 5. Fetch ALL activity segments for the day (BRAVO)
      // ------------------------------------------------------------------
      let allSegments: ActivitySegment[] = [];
      try {
        allSegments = await fetchActivitySegmentsForDate(userId, date);
      } catch (segErr) {
        console.warn(
          "[useLocationBlocksForDay] Segment fetch warning:",
          segErr,
        );
      }

      // Build segments-by-hour map
      const segmentsByHour = new Map<string, ActivitySegment[]>();
      for (const seg of allSegments) {
        const hourKey = floorToHour(seg.startedAt).toISOString();
        const existing = segmentsByHour.get(hourKey) || [];
        existing.push(seg);
        segmentsByHour.set(hourKey, existing);
      }

      // ------------------------------------------------------------------
      // 6. Enrich summaries
      // ------------------------------------------------------------------
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

      // ------------------------------------------------------------------
      // 7. Group enriched summaries into location blocks
      // ------------------------------------------------------------------
      const locationBlocks = groupIntoLocationBlocks(enriched);
      setBlocks(locationBlocks);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load location blocks";
      setError(message);
      if (__DEV__) {
        console.warn("[useLocationBlocksForDay] Fetch error:", err);
      }
    }
  }, [userId, date]);

  // ---- Initial load ----
  useEffect(() => {
    if (!enabled || !userId || !date) {
      setBlocks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));
  }, [fetchData, enabled, userId, date]);

  // ---- Refresh (invalidates inference cache) ----
  const refresh = useCallback(async () => {
    // Clear inference cache so a fresh 14-day query runs
    inferenceCache.current = null;
    await fetchData();
  }, [fetchData]);

  return { blocks, inferenceResult, isLoading, error, refresh };
}
