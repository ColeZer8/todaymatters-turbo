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
 *   5. Auto reverse geocode segments with missing place labels
 *   6. Enrich summaries with place labels, segments, inference descriptions
 *   7. Group into LocationBlock[] via:
 *      - groupSegmentsIntoLocationBlocks() when segments exist (fine-grained)
 *      - groupIntoLocationBlocks() as fallback (hourly-based)
 *
 * It does NOT include buildTimelineEvents() — that is Activity Timeline
 * specific and remains in LocationBlockList.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { EnrichedSummary } from "@/components/organisms/HourlySummaryList";
import type { LocationBlock, PlaceAlternative } from "@/lib/types/location-block";
import {
  groupIntoLocationBlocks,
  groupSegmentsIntoLocationBlocks,
  fillLocationGaps,
} from "@/lib/utils/group-location-blocks";
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

/** A candidate place near the user's location. */
interface PlaceAlternativeResult {
  placeName: string;
  googlePlaceId: string | null;
  vicinity: string | null;
  types: string[] | null;
  placeLatitude: number | null;
  placeLongitude: number | null;
  distanceMeters: number | null;
}

/** Response from location-place-lookup edge function */
interface PlaceLookupResult {
  geohash7: string;
  latitude: number;
  longitude: number;
  placeName: string | null;
  googlePlaceId: string | null;
  vicinity: string | null;
  types: string[] | null;
  source: "cache" | "google_places_nearby" | "reverse_geocode" | "none";
  expiresAt: string | null;
  placeLatitude: number | null;
  placeLongitude: number | null;
  distanceMeters: number | null;
  alternatives: PlaceAlternativeResult[] | null;
}

interface PlaceLookupResponse {
  results: PlaceLookupResult[];
}

/** Resolved place data including alternatives for disambiguation. */
interface ResolvedPlaceData {
  placeName: string;
  alternatives: PlaceAlternativeResult[];
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

/**
 * Resolve place labels for segments that have coordinates but no label.
 * Calls the location-place-lookup edge function in batch.
 * Returns both the resolved name AND alternatives for disambiguation.
 *
 * @param segments - Activity segments to resolve
 * @returns Map of segment ID to resolved place data (name + alternatives)
 */
async function resolveUnknownPlaceLabels(
  segments: ActivitySegment[],
): Promise<Map<string, ResolvedPlaceData>> {
  const resolved = new Map<string, ResolvedPlaceData>();

  // Collect segments that need resolution
  const needsResolution = segments.filter(
    (s) =>
      s.locationLat != null &&
      s.locationLng != null &&
      (!s.placeLabel ||
        s.placeLabel === "Unknown Location" ||
        s.placeLabel === "Unknown"),
  );

  if (needsResolution.length === 0) return resolved;

  // Build unique coordinate points (dedupe by rounded lat/lng)
  const pointsByKey = new Map<
    string,
    { latitude: number; longitude: number; segmentIds: string[] }
  >();

  for (const seg of needsResolution) {
    // Round to 4 decimal places for deduplication (~11m precision)
    const key = `${seg.locationLat!.toFixed(4)},${seg.locationLng!.toFixed(4)}`;
    const existing = pointsByKey.get(key);
    if (existing) {
      existing.segmentIds.push(seg.id);
    } else {
      pointsByKey.set(key, {
        latitude: seg.locationLat!,
        longitude: seg.locationLng!,
        segmentIds: [seg.id],
      });
    }
  }

  const points = Array.from(pointsByKey.values()).map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  if (points.length === 0) return resolved;

  try {
    // Call edge function with batched coordinates
    const { data, error } = await supabase.functions.invoke<PlaceLookupResponse>(
      "location-place-lookup",
      {
        body: { points, radiusMeters: 500 },
      },
    );

    if (error) {
      console.warn(
        "[useLocationBlocksForDay] Place lookup error:",
        error.message,
      );
      return resolved;
    }

    if (!data?.results) return resolved;

    // Map results back to segments (include alternatives for disambiguation)
    for (const result of data.results) {
      if (!result.placeName) continue;

      const key = `${result.latitude.toFixed(4)},${result.longitude.toFixed(4)}`;
      const pointData = pointsByKey.get(key);
      if (pointData) {
        const placeData: ResolvedPlaceData = {
          placeName: result.placeName,
          alternatives: (result.alternatives ?? []) as PlaceAlternativeResult[],
        };
        for (const segId of pointData.segmentIds) {
          resolved.set(segId, placeData);
        }
      }
    }

    if (resolved.size > 0) {
      console.log(
        `[useLocationBlocksForDay] Resolved ${resolved.size} unknown place labels`,
      );
    }
  } catch (err) {
    console.warn(
      "[useLocationBlocksForDay] Place lookup exception:",
      err instanceof Error ? err.message : err,
    );
  }

  return resolved;
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

      console.log(`[useLocationBlocksForDay] 🔍 DEBUG: location_hourly data for ${date}:`);
      if (locationRows && locationRows.length > 0) {
        (locationRows as LocationHourlyRow[]).forEach(row => {
          const hour = new Date(row.hour_start).getHours();
          console.log(`  ${hour}:00 - geohash=${row.geohash7}, samples=${row.sample_count}, label="${row.place_label}", google="${row.google_place_name}"`);
        });
      } else {
        console.log('  ❌ No location_hourly rows found');
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

      // ------------------------------------------------------------------
      // 5b. Auto reverse geocode segments with missing place labels
      // ------------------------------------------------------------------
      let resolvedLabels = new Map<string, ResolvedPlaceData>();
      if (allSegments.length > 0) {
        try {
          resolvedLabels = await resolveUnknownPlaceLabels(allSegments);
        } catch (geoErr) {
          console.warn(
            "[useLocationBlocksForDay] Reverse geocode warning:",
            geoErr,
          );
        }
      }

      // Apply resolved labels to segments (create new array with updated labels)
      if (resolvedLabels.size > 0) {
        allSegments = allSegments.map((seg) => {
          const resolvedData = resolvedLabels.get(seg.id);
          if (resolvedData && (!seg.placeLabel || seg.placeLabel === "Unknown Location" || seg.placeLabel === "Unknown")) {
            return { ...seg, placeLabel: resolvedData.placeName };
          }
          return seg;
        });
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
      // 7. Group into location blocks
      //    - Use segment-based grouping when segments exist (fine-grained)
      //    - Fall back to hourly-summary-based grouping (coarse)
      // ------------------------------------------------------------------
      let locationBlocks: LocationBlock[];

      if (allSegments.length > 0) {
        // Build alternatives map for place disambiguation
        const alternativesBySegmentId = new Map<string, PlaceAlternative[]>();
        if (resolvedLabels.size > 0) {
          for (const [segId, data] of resolvedLabels) {
            if (data.alternatives.length > 0) {
              alternativesBySegmentId.set(segId, data.alternatives as PlaceAlternative[]);
            }
          }
        }

        // NEW: Segment-driven grouping for Google Timeline-like granularity
        locationBlocks = groupSegmentsIntoLocationBlocks(allSegments, enriched, alternativesBySegmentId);
        console.log(
          `[useLocationBlocksForDay] Used segment-based grouping: ${allSegments.length} segments → ${locationBlocks.length} blocks`,
        );
      } else {
        // FALLBACK: Hourly-summary-based grouping for backward compatibility
        locationBlocks = groupIntoLocationBlocks(enriched);
        console.log(
          `[useLocationBlocksForDay] Used hourly-based grouping: ${enriched.length} summaries → ${locationBlocks.length} blocks`,
        );
      }

      // ------------------------------------------------------------------
      // 8. Fill location gaps with carry-forward logic
      //    - Detects gaps where user was stationary but no GPS samples
      //    - Carries forward last known location to fill the gap
      //    - Stops at travel blocks (movement = new location)
      // ------------------------------------------------------------------
      console.log(`[useLocationBlocksForDay] 🔍 DEBUG: Before gap-filling, ${locationBlocks.length} blocks:`);
      locationBlocks.forEach(b => {
        console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}" (${b.totalLocationSamples} samples, geohash=${b.geohash7})`);
      });
      
      const blocksWithGapsFilled = fillLocationGaps(locationBlocks, enriched);
      
      console.log(`[useLocationBlocksForDay] 🔍 DEBUG: After gap-filling, ${blocksWithGapsFilled.length} blocks:`);
      blocksWithGapsFilled.forEach(b => {
        const carriedFlag = (b as any).isCarriedForward ? ' [CARRIED]' : '';
        console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}" (${b.totalLocationSamples} samples${carriedFlag})`);
      });
      
      if (blocksWithGapsFilled.length !== locationBlocks.length) {
        console.log(
          `[useLocationBlocksForDay] Filled gaps: ${locationBlocks.length} blocks → ${blocksWithGapsFilled.length} blocks (${blocksWithGapsFilled.length - locationBlocks.length} gaps filled)`,
        );
      }

      setBlocks(blocksWithGapsFilled);
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
    setIsLoading(true);
    try {
      await fetchData();
    } finally {
      setIsLoading(false);
    }
  }, [fetchData]);

  return { blocks, inferenceResult, isLoading, error, refresh };
}
