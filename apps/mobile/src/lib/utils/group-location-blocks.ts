/**
 * Location Block Grouping Algorithm
 *
 * Two grouping strategies:
 * 1. groupSegmentsIntoLocationBlocks() — NEW, segment-driven (fine-grained)
 *    Uses ActivitySegments as primary source, produces Google Timeline-like blocks
 * 2. groupIntoLocationBlocks() — LEGACY, hourly-summary-driven (coarse)
 *    Falls back when no segments are available
 */

import type { EnrichedSummary } from "@/components/organisms/HourlySummaryList";
import type {
  ActivitySegment,
  InferredActivityType,
} from "@/lib/supabase/services/activity-segments";
import type { MovementType } from "@/lib/supabase/services/actual-ingestion";
import type { SummaryAppBreakdown } from "@/lib/supabase/services";
import {
  generateInferenceDescription,
  type InferenceContext,
} from "@/lib/supabase/services/activity-inference-descriptions";
import type {
  LocationBlock,
  BlockAppUsage,
  AppSession,
  PlaceAlternative,
} from "@/lib/types/location-block";

// 🔥 VERSION CHECK - Verify this file is loaded
console.log("🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED - VERSION 2026-02-11-ULTRA-VERBOSE");

// ============================================================================
// Haversine Distance (for coordinate proximity check)
// ============================================================================

/**
 * Calculate distance between two lat/lng points in meters.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================================
// Segment-Based Grouping (NEW - Fine-Grained)
// ============================================================================

/** Maximum distance in meters for same-place proximity matching */
const SAME_PLACE_DISTANCE_THRESHOLD_M = 200;

/**
 * Check if a segment is a travel/commute segment.
 */
function isCommuteSegment(segment: ActivitySegment): boolean {
  return (
    segment.inferredActivity === "commute" || segment.placeCategory === "commute"
  );
}

/**
 * Check if two segments are at the "same place" for grouping purposes.
 * Uses place_id match first, then coordinate proximity as fallback, then label match.
 */
function isSamePlace(seg1: ActivitySegment, seg2: ActivitySegment): boolean {
  // 🔥 ULTRA VERBOSE DEBUGGING - Print EVERYTHING about both segments
  console.log(`\n🔥🔥🔥 [isSamePlace] DETAILED COMPARISON:`);
  console.log(`  SEG1:`, JSON.stringify({
    placeLabel: seg1.placeLabel,
    placeId: seg1.placeId,
    placeCategory: seg1.placeCategory,
    inferredActivity: seg1.inferredActivity,
    lat: seg1.locationLat,
    lng: seg1.locationLng,
    startTime: seg1.startedAt.toISOString(),
    endTime: seg1.endedAt.toISOString(),
  }, null, 2));
  console.log(`  SEG2:`, JSON.stringify({
    placeLabel: seg2.placeLabel,
    placeId: seg2.placeId,
    placeCategory: seg2.placeCategory,
    inferredActivity: seg2.inferredActivity,
    lat: seg2.locationLat,
    lng: seg2.locationLng,
    startTime: seg2.startedAt.toISOString(),
    endTime: seg2.endedAt.toISOString(),
  }, null, 2));

  // Both are commute segments — group them together
  if (isCommuteSegment(seg1) && isCommuteSegment(seg2)) {
    console.log(`🔥 [isSamePlace] ✅ BOTH COMMUTE - MERGING`);
    return true;
  }

  // One is commute, one isn't — different blocks
  if (isCommuteSegment(seg1) || isCommuteSegment(seg2)) {
    console.log(`🔥 [isSamePlace] ❌ ONE COMMUTE, ONE NOT - NOT MERGING`);
    return false;
  }

  // Place ID match (strongest signal)
  if (seg1.placeId && seg2.placeId && seg1.placeId === seg2.placeId) {
    console.log(`🔥 [isSamePlace] ✅ PLACE ID MATCH: "${seg1.placeLabel}" (${seg1.placeId}) - MERGING`);
    return true;
  } else {
    console.log(`🔥 [isSamePlace] Place ID check: seg1.placeId="${seg1.placeId}", seg2.placeId="${seg2.placeId}" - NO MATCH`);
  }

  // Coordinate proximity fallback (< 200m)
  if (
    seg1.locationLat != null &&
    seg1.locationLng != null &&
    seg2.locationLat != null &&
    seg2.locationLng != null
  ) {
    const distance = haversineDistance(
      seg1.locationLat,
      seg1.locationLng,
      seg2.locationLat,
      seg2.locationLng,
    );
    console.log(`🔥 [isSamePlace] Distance: ${Math.round(distance)}m (threshold: ${SAME_PLACE_DISTANCE_THRESHOLD_M}m)`);
    if (distance < SAME_PLACE_DISTANCE_THRESHOLD_M) {
      console.log(`🔥 [isSamePlace] ✅ PROXIMITY MATCH: "${seg1.placeLabel}" ↔ "${seg2.placeLabel}" (${Math.round(distance)}m) - MERGING`);
      return true;
    } else {
      console.log(`🔥 [isSamePlace] ❌ TOO FAR APART: ${Math.round(distance)}m > ${SAME_PLACE_DISTANCE_THRESHOLD_M}m - NOT MERGING`);
    }
  } else {
    console.log(`🔥 [isSamePlace] Coords check: seg1 (${seg1.locationLat},${seg1.locationLng}), seg2 (${seg2.locationLat},${seg2.locationLng}) - INCOMPLETE COORDS`);
  }

  // NEW: Place label match for geocoded locations (both have same meaningful label)
  // This handles cases where reverse geocoding returns the same place name but no place_id
  const label1 = seg1.placeLabel?.trim().toLowerCase();
  const label2 = seg2.placeLabel?.trim().toLowerCase();
  console.log(`🔥 [isSamePlace] Label check: label1="${label1}", label2="${label2}"`);
  if (
    label1 &&
    label2 &&
    label1 === label2 &&
    label1 !== 'unknown location' &&
    label1 !== 'unknown' &&
    label1 !== 'location'
  ) {
    console.log(`🔥 [isSamePlace] ✅ LABEL MATCH: "${seg1.placeLabel}" === "${seg2.placeLabel}" - MERGING`);
    return true;
  } else {
    if (!label1 || !label2) {
      console.log(`🔥 [isSamePlace] Label check: one or both labels empty`);
    } else if (label1 !== label2) {
      console.log(`🔥 [isSamePlace] Label check: labels don't match ("${label1}" !== "${label2}")`);
    } else if (label1 === 'unknown location' || label1 === 'unknown' || label1 === 'location') {
      console.log(`🔥 [isSamePlace] Label check: labels match but are meaningless ("${label1}")`);
    }
  }

  // Different unknown locations or no match — don't merge
  console.log(`🔥 [isSamePlace] ❌ FINAL VERDICT: NOT MERGING - No place ID, proximity, or label match`);
  return false;
}

/**
 * Build a LocationBlock from a group of ActivitySegments.
 * Uses hourly summaries only for supplementary app usage data.
 */
function buildBlockFromSegments(
  segments: ActivitySegment[],
  summaries: EnrichedSummary[],
  alternativesBySegmentId?: Map<string, PlaceAlternative[]>,
): LocationBlock {
  const first = segments[0];
  const last = segments[segments.length - 1];

  // -- Time range (precise from segments) --
  const startTime = new Date(
    Math.min(...segments.map((s) => s.startedAt.getTime())),
  );
  const endTime = new Date(
    Math.max(...segments.map((s) => s.endedAt.getTime())),
  );
  const durationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / 60000,
  );

  // -- Block type --
  const isTravel = isCommuteSegment(first);
  const blockType = isTravel ? "travel" : "stationary";

  // -- Movement type & distance for travel blocks --
  let movementType: MovementType | null = null;
  let distanceM: number | null = null;
  if (isTravel) {
    // Pick the dominant movement type
    for (const seg of segments) {
      if (seg.movementType && seg.movementType !== "unknown") {
        movementType = seg.movementType;
        break;
      }
    }
    if (!movementType && segments.length > 0 && segments[0].movementType) {
      movementType = segments[0].movementType;
    }
    // Sum distances
    const totalDist = segments.reduce((sum, s) => sum + (s.distanceM ?? 0), 0);
    if (totalDist > 0) distanceM = totalDist;
  }

  // -- Location label --
  let locationLabel = first.placeLabel ?? "Unknown Location";
  if (isTravel) {
    const destination = last.placeLabel;
    const verb =
      movementType === "walking"
        ? "Walking"
        : movementType === "cycling"
          ? "Cycling"
          : movementType === "driving"
            ? "Driving"
            : "Travel";

    if (destination && destination !== "Unknown Location") {
      locationLabel = `${verb} → ${destination}`;
    } else {
      locationLabel = movementType && movementType !== "unknown" ? verb : "In Transit";
    }
  }

  // -- Find overlapping hourly summaries for app usage --
  const blockStartMs = startTime.getTime();
  const blockEndMs = endTime.getTime();
  const overlappingSummaries = summaries.filter((s) => {
    const hourStartMs = s.hourStart.getTime();
    const hourEndMs = hourStartMs + 60 * 60 * 1000;
    return hourStartMs < blockEndMs && hourEndMs > blockStartMs;
  });

  // -- Apps aggregation from overlapping summaries --
  const appMap = new Map<
    string,
    {
      appId: string;
      displayName: string;
      category: string;
      totalMinutes: number;
      sessions: AppSession[];
    }
  >();

  for (const summary of overlappingSummaries) {
    for (const app of summary.appBreakdown) {
      if (app.minutes < 1) continue;
      const existing = appMap.get(app.appId);
      if (existing) {
        existing.totalMinutes += app.minutes;
      } else {
        appMap.set(app.appId, {
          appId: app.appId,
          displayName: app.displayName,
          category: app.category,
          totalMinutes: app.minutes,
          sessions: [],
        });
      }
    }
  }

  // Build sessions from segment-level data
  for (const seg of segments) {
    if (!seg.topApps) continue;
    for (const segApp of seg.topApps) {
      if (segApp.seconds < 60) continue;
      const entry = appMap.get(segApp.appId);
      if (entry) {
        const sessStart = new Date(
          Math.max(seg.startedAt.getTime(), blockStartMs),
        );
        const sessEnd = new Date(Math.min(seg.endedAt.getTime(), blockEndMs));
        if (sessEnd > sessStart) {
          entry.sessions.push({
            startTime: sessStart,
            endTime: sessEnd,
            minutes: Math.round(segApp.seconds / 60),
          });
        }
      }
    }
  }

  const apps: BlockAppUsage[] = Array.from(appMap.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .map((a) => ({
      appId: a.appId,
      displayName: a.displayName,
      category: a.category,
      totalMinutes: a.totalMinutes,
      sessions: a.sessions,
    }));

  // -- Screen time --
  const totalScreenSeconds = segments.reduce(
    (sum, s) => sum + s.totalScreenSeconds,
    0,
  );
  const totalScreenMinutes = Math.round(totalScreenSeconds / 60);

  // -- Dominant activity (duration-weighted) --
  const activityMinutes = new Map<InferredActivityType, number>();
  for (const seg of segments) {
    if (seg.inferredActivity) {
      const durMinutes = Math.round(
        (seg.endedAt.getTime() - seg.startedAt.getTime()) / 60000,
      );
      const prev = activityMinutes.get(seg.inferredActivity) ?? 0;
      activityMinutes.set(seg.inferredActivity, prev + durMinutes);
    }
  }
  let dominantActivity: InferredActivityType | null = null;
  let maxMinutes = 0;
  for (const [activity, minutes] of activityMinutes) {
    if (minutes > maxMinutes) {
      maxMinutes = minutes;
      dominantActivity = activity;
    }
  }

  // -- Confidence (duration-weighted average) --
  const totalMs = segments.reduce(
    (sum, s) => sum + (s.endedAt.getTime() - s.startedAt.getTime()),
    0,
  );
  const confidenceScore =
    totalMs > 0
      ? segments.reduce(
          (sum, s) =>
            sum +
            s.activityConfidence *
              (s.endedAt.getTime() - s.startedAt.getTime()),
          0,
        ) / totalMs
      : 0;

  // -- Location samples --
  const totalLocationSamples = segments.reduce(
    (sum, s) => sum + s.evidence.locationSamples,
    0,
  );

  // -- Activity inference description --
  const midpointHour = Math.round(
    (startTime.getHours() + endTime.getHours()) / 2,
  );
  const allApps: SummaryAppBreakdown[] = overlappingSummaries.flatMap(
    (s) => s.appBreakdown,
  );
  const referenceSegment = segments[0];
  const inferenceContext: InferenceContext = {
    activity: dominantActivity,
    apps: allApps,
    screenMinutes: totalScreenMinutes,
    hourOfDay: midpointHour,
    placeLabel: first.placeLabel,
    previousPlaceLabel: null,
    inferredPlace: null,
    locationSamples: totalLocationSamples,
    confidence: confidenceScore,
    previousGeohash: null,
    currentGeohash: null,
    locationRadius: null,
    googlePlaceTypes: null,
  };
  const activityInference = generateInferenceDescription(inferenceContext);

  // -- Feedback state from overlapping summaries --
  const summaryIds = overlappingSummaries.map((s) => s.id);
  const hasUserFeedback = overlappingSummaries.some((s) => !!s.userFeedback);
  const isLocked = overlappingSummaries.some((s) => !!s.lockedAt);

  // -- Inferred place from first overlapping summary --
  const inferredPlace = overlappingSummaries[0]?.inferredPlace ?? null;
  const isPlaceInferred = !first.placeId && !!inferredPlace;

  // -- Geohash7: derive from overlapping summaries (summaries carry geohash from location_hourly) --
  const geohash7 = overlappingSummaries.find((s) => s.geohash7)?.geohash7 ?? null;

  // -- Place alternatives (for disambiguation UI) --
  // Collect alternatives from the first segment that has them
  let placeAlternatives: PlaceAlternative[] | undefined;
  if (alternativesBySegmentId && !isTravel) {
    for (const seg of segments) {
      const alts = alternativesBySegmentId.get(seg.id);
      if (alts && alts.length > 0) {
        placeAlternatives = alts;
        break;
      }
    }
  }

  // -- Location centroid (for place creation) --
  const blockLat = first.locationLat ?? null;
  const blockLng = first.locationLng ?? null;

  return {
    id: first.id,
    type: blockType,
    movementType,
    distanceM,
    locationLabel,
    locationCategory: first.placeCategory ?? null,
    inferredPlace,
    isPlaceInferred,
    geohash7,
    startTime,
    endTime,
    durationMinutes,
    apps,
    totalScreenMinutes,
    dominantActivity,
    activityInference,
    confidenceScore,
    totalLocationSamples,
    summaries: overlappingSummaries,
    segments,
    summaryIds,
    hasUserFeedback,
    isLocked,
    placeAlternatives,
    latitude: blockLat,
    longitude: blockLng,
  };
}

/**
 * Group ActivitySegments into LocationBlocks (segment-driven, fine-grained).
 *
 * This produces Google Timeline-like blocks where:
 * - Each stationary period at a place is its own block
 * - Each travel segment is its own block
 * - Times are accurate to segment boundaries (not hour boundaries)
 *
 * @param segments - All activity segments for the day, sorted chronologically
 * @param summaries - Hourly summaries for supplementary data (app usage)
 * @param alternativesBySegmentId - Optional map of segment ID to place alternatives for disambiguation
 * @returns LocationBlock[] with fine-grained time boundaries
 */
export function groupSegmentsIntoLocationBlocks(
  segments: ActivitySegment[],
  summaries: EnrichedSummary[],
  alternativesBySegmentId?: Map<string, PlaceAlternative[]>,
): LocationBlock[] {
  console.log(`\n🔥🔥🔥 [groupSegmentsIntoLocationBlocks] FUNCTION CALLED!`);
  console.log(`🔥 Received ${segments.length} segments, ${summaries.length} summaries`);
  
  if (segments.length === 0) {
    console.log(`🔥 [groupSegmentsIntoLocationBlocks] No segments - returning empty array`);
    return [];
  }

  // Sort segments chronologically
  const sorted = [...segments].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );

  // Group consecutive segments at the same place
  const groups: ActivitySegment[][] = [];
  let currentGroup: ActivitySegment[] = [sorted[0]];

  console.log(`🔥 [groupSegmentsIntoLocationBlocks] Processing ${sorted.length} segments:`);
  sorted.forEach((seg, idx) => {
    console.log(`  🔥 ${idx}: ${seg.startedAt.toLocaleTimeString()} - ${seg.endedAt.toLocaleTimeString()}: "${seg.placeLabel}" (ID: ${seg.placeId}, lat/lng: ${seg.locationLat?.toFixed(4)},${seg.locationLng?.toFixed(4)})`);
  });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (__DEV__) {
      console.log(`\n📍 [groupSegmentsIntoLocationBlocks] Comparing segments ${i - 1} and ${i}:`);
      console.log(`  Prev: "${prev.placeLabel}" (${prev.startedAt.toLocaleTimeString()} - ${prev.endedAt.toLocaleTimeString()})`);
      console.log(`  Curr: "${curr.placeLabel}" (${curr.startedAt.toLocaleTimeString()} - ${curr.endedAt.toLocaleTimeString()})`);
    }

    if (isSamePlace(prev, curr)) {
      currentGroup.push(curr);
      if (__DEV__) {
        console.log(`  ✅ Merged into current group (now ${currentGroup.length} segments)`);
      }
    } else {
      if (__DEV__) {
        console.log(`  ❌ Starting new group (previous group had ${currentGroup.length} segments)`);
      }
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  if (__DEV__) {
    console.log(`\n📍 [groupSegmentsIntoLocationBlocks] Created ${groups.length} groups:`);
    groups.forEach((group, idx) => {
      const first = group[0];
      const last = group[group.length - 1];
      console.log(`  Group ${idx}: "${first.placeLabel}" (${group.length} segments, ${first.startedAt.toLocaleTimeString()} - ${last.endedAt.toLocaleTimeString()})`);
    });
  }

  // Build blocks from groups
  return groups.map((group) => buildBlockFromSegments(group, summaries, alternativesBySegmentId));
}

// ============================================================================
// Location Key
// ============================================================================

/**
 * Compute a grouping key for a summary. Summaries with the same key (or
 * compatible keys) will be merged into one LocationBlock.
 */
function getLocationKey(summary: EnrichedSummary): string {
  // Travel is its own grouping category
  if (summary.primaryActivity === "commute") return "__travel__";
  // Prefer geohash7 — most precise
  if (summary.geohash7) return `geo:${summary.geohash7}`;
  // Fall back to place label
  if (
    summary.primaryPlaceLabel &&
    summary.primaryPlaceLabel !== "Unknown Location" &&
    summary.primaryPlaceLabel !== "Unknown" &&
    summary.primaryPlaceLabel !== "Location"
  ) {
    return `label:${summary.primaryPlaceLabel}`;
  }
  // Unknown location — use a per-hour key so we can selectively merge
  return `unknown:${summary.hourStart.toISOString()}`;
}

/**
 * Decide whether two adjacent location keys should merge.
 */
function shouldMerge(key1: string, key2: string): boolean {
  if (key1 === key2) return true;
  // Merge adjacent unknowns
  if (key1.startsWith("unknown:") && key2.startsWith("unknown:")) return true;
  return false;
}

// ============================================================================
// Build a LocationBlock from a group of summaries
// ============================================================================

function buildBlock(group: EnrichedSummary[]): LocationBlock {
  const first = group[0];
  const last = group[group.length - 1];

  // Collect all segments
  const allSegments = group.flatMap((s) => s.segments ?? []);
  allSegments.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  // -- Time range --
  // Use raw segment timestamps (derived from GPS recorded_at) for precise
  // block boundaries. Only fall back to hour buckets when no segments exist.
  const blockHourStart = first.hourStart;
  const lastHourEnd = new Date(last.hourStart.getTime() + 60 * 60 * 1000);

  const startTime =
    allSegments.length > 0
      ? new Date(Math.min(...allSegments.map((s) => s.startedAt.getTime())))
      : first.hourStart;

  const endTime =
    allSegments.length > 0
      ? new Date(Math.max(...allSegments.map((s) => s.endedAt.getTime())))
      : lastHourEnd;

  const durationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / 60000,
  );

  // -- Block type --
  const isTravel = first.primaryActivity === "commute";
  const blockType = isTravel ? "travel" : "stationary";

  // -- Movement type & distance for travel blocks --
  let movementType: MovementType | null = null;
  let distanceM: number | null = null;
  if (isTravel) {
    const commuteSegments = allSegments.filter(
      (s) => s.inferredActivity === "commute" || s.placeCategory === "commute",
    );
    // Pick the dominant movement type from commute segments
    for (const seg of commuteSegments) {
      if (seg.movementType && seg.movementType !== "unknown" && seg.movementType !== "stationary") {
        movementType = seg.movementType;
        break;
      }
    }
    if (!movementType && commuteSegments.length > 0) {
      movementType = commuteSegments[0].movementType ?? null;
    }
    // Sum distances from commute segments
    const totalDist = commuteSegments.reduce(
      (sum, s) => sum + (s.distanceM ?? 0),
      0,
    );
    if (totalDist > 0) distanceM = totalDist;
  }

  // -- Location label (movement-type-aware for travel) --
  let locationLabel = first.primaryPlaceLabel ?? "Unknown Location";
  if (isTravel) {
    const destination =
      allSegments.length > 0
        ? allSegments[allSegments.length - 1].placeLabel
        : last.primaryPlaceLabel;

    const verb =
      movementType === "walking" ? "Walking"
      : movementType === "cycling" ? "Cycling"
      : movementType === "driving" ? "Driving"
      : "Travel";

    if (destination && destination !== "Unknown Location") {
      locationLabel = `${verb} → ${destination}`;
    } else {
      locationLabel = movementType && movementType !== "unknown" ? verb : "In Transit";
    }
  }

  // -- Apps aggregation --
  const appMap = new Map<
    string,
    { appId: string; displayName: string; category: string; totalMinutes: number; sessions: AppSession[] }
  >();

  for (const summary of group) {
    for (const app of summary.appBreakdown) {
      if (app.minutes < 1) continue;
      const existing = appMap.get(app.appId);
      if (existing) {
        existing.totalMinutes += app.minutes;
      } else {
        appMap.set(app.appId, {
          appId: app.appId,
          displayName: app.displayName,
          category: app.category,
          totalMinutes: app.minutes,
          sessions: [],
        });
      }
    }
  }

  // Build sessions from segment-level data (clamped to actual block range)
  const blockStartMs = startTime.getTime();
  const blockEndMs = endTime.getTime();
  for (const seg of allSegments) {
    if (!seg.topApps) continue;
    for (const segApp of seg.topApps) {
      if (segApp.seconds < 60) continue;
      const entry = appMap.get(segApp.appId);
      if (entry) {
        const sessStart = new Date(Math.max(seg.startedAt.getTime(), blockStartMs));
        const sessEnd = new Date(Math.min(seg.endedAt.getTime(), blockEndMs));
        if (sessEnd > sessStart) {
          entry.sessions.push({
            startTime: sessStart,
            endTime: sessEnd,
            minutes: Math.round(segApp.seconds / 60),
          });
        }
      }
    }
  }

  const apps: BlockAppUsage[] = Array.from(appMap.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .map((a) => ({
      appId: a.appId,
      displayName: a.displayName,
      category: a.category,
      totalMinutes: a.totalMinutes,
      sessions: a.sessions,
    }));

  // -- Screen time --
  const totalScreenMinutes = group.reduce(
    (sum, s) => sum + s.totalScreenMinutes,
    0,
  );

  // -- Dominant activity (duration-weighted) --
  const activityMinutes = new Map<InferredActivityType, number>();
  for (const summary of group) {
    if (summary.primaryActivity) {
      const prev = activityMinutes.get(summary.primaryActivity) ?? 0;
      activityMinutes.set(summary.primaryActivity, prev + 60);
    }
  }
  let dominantActivity: InferredActivityType | null = null;
  let maxMinutes = 0;
  for (const [activity, minutes] of activityMinutes) {
    if (minutes > maxMinutes) {
      maxMinutes = minutes;
      dominantActivity = activity;
    }
  }

  // -- Confidence (duration-weighted average) --
  const totalHours = group.length;
  const confidenceScore =
    totalHours > 0
      ? group.reduce((sum, s) => sum + s.confidenceScore, 0) / totalHours
      : 0;

  // -- Location samples --
  const totalLocationSamples = group.reduce(
    (sum, s) => sum + (s.locationSamples ?? 0),
    0,
  );

  // -- Activity inference description --
  // Build a merged context using the block's midpoint hour
  const midpointHour = Math.round(
    (startTime.getHours() + endTime.getHours()) / 2,
  );
  const allApps: SummaryAppBreakdown[] = group.flatMap((s) => s.appBreakdown);
  const inferenceContext: InferenceContext = {
    activity: dominantActivity,
    apps: allApps,
    screenMinutes: totalScreenMinutes,
    hourOfDay: midpointHour,
    placeLabel: first.primaryPlaceLabel,
    previousPlaceLabel: first.previousPlaceLabel,
    inferredPlace: first.inferredPlace,
    locationSamples: totalLocationSamples,
    confidence: confidenceScore,
    previousGeohash: first.previousGeohash,
    currentGeohash: first.geohash7,
    locationRadius: first.locationRadius,
    googlePlaceTypes: first.googlePlaceTypes,
  };
  const activityInference = generateInferenceDescription(inferenceContext);

  // -- Inferred place --
  const inferredPlace = first.inferredPlace ?? null;
  const isPlaceInferred = !first.primaryPlaceId && !!inferredPlace;

  // -- Feedback state --
  const summaryIds = group.map((s) => s.id);
  const hasUserFeedback = group.some((s) => !!s.userFeedback);
  const isLocked = group.some((s) => !!s.lockedAt);

  return {
    id: first.id,
    type: blockType,
    movementType,
    distanceM,
    locationLabel,
    locationCategory: first.inferredPlace?.inferredType ?? null,
    inferredPlace,
    isPlaceInferred,
    geohash7: first.geohash7 ?? null,
    startTime,
    endTime,
    durationMinutes,
    apps,
    totalScreenMinutes,
    dominantActivity,
    activityInference,
    confidenceScore,
    totalLocationSamples,
    summaries: group,
    segments: allSegments,
    summaryIds,
    hasUserFeedback,
    isLocked,
  };
}

// ============================================================================
// Main Grouping Function
// ============================================================================

/**
 * Group an array of EnrichedSummary items into LocationBlock objects.
 *
 * Summaries must be for a single day. They are sorted chronologically and
 * consecutive summaries at the same location are merged into blocks.
 */
export function groupIntoLocationBlocks(
  summaries: EnrichedSummary[],
): LocationBlock[] {
  if (summaries.length === 0) return [];

  // Sort ascending by hourStart
  const sorted = [...summaries].sort(
    (a, b) => a.hourStart.getTime() - b.hourStart.getTime(),
  );

  const groups: EnrichedSummary[][] = [];
  let currentGroup: EnrichedSummary[] = [sorted[0]];
  let currentKey = getLocationKey(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const nextKey = getLocationKey(sorted[i]);
    if (shouldMerge(currentKey, nextKey)) {
      currentGroup.push(sorted[i]);
      // If the new key is more specific (not unknown), adopt it
      if (!nextKey.startsWith("unknown:")) {
        currentKey = nextKey;
      }
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      currentKey = nextKey;
    }
  }
  groups.push(currentGroup);

  return groups.map(buildBlock);
}

// ============================================================================
// Location Carry-Forward (Gap Filling)
// ============================================================================

/**
 * Minimum gap duration in milliseconds to consider for carry-forward.
 * 30 minutes - shorter gaps are likely just data collection pauses.
 */
const MIN_GAP_FOR_CARRY_FORWARD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Maximum gap duration to carry forward a location.
 * 16 hours - covers overnight stays (e.g., 9pm → 1pm = 16 hours).
 * Longer than this and we can't be confident the user stayed put.
 */
const MAX_CARRY_FORWARD_DURATION_MS = 16 * 60 * 60 * 1000; // 16 hours

/**
 * Check if a location block has a meaningful location label that should be carried forward.
 * Filters out unknown/empty/meaningless locations.
 */
function hasMeaningfulLocation(block: LocationBlock): boolean {
  const normalized = block.locationLabel?.trim().toLowerCase() || '';
  if (!normalized) return false;
  
  // Don't carry forward these meaningless labels (normalized to lowercase)
  const meaninglessLabels = [
    'unknown location',
    'unknown',
    'location',
    'in transit',
  ];
  
  return !meaninglessLabels.includes(normalized);
}

/**
 * Fill gaps in location blocks by carrying forward the last known location.
 * 
 * This solves two problems:
 * 1. Gaps between blocks where GPS didn't sample (overnight stays, etc.)
 * 2. "Unknown Location" blocks that immediately follow a known location
 * 
 * Algorithm:
 * 1. Find gaps between blocks (>30 min) OR blocks with "Unknown Location" after known locations
 * 2. If after a stationary block (not travel), carry forward that location
 * 3. Stop carrying forward when we hit a travel block (movement = new location)
 * 4. Create synthetic "carried forward" blocks to fill the gaps or replace "Unknown" blocks
 * 
 * @param blocks - Location blocks sorted chronologically
 * @param summaries - Hourly summaries for the day (for supplementary data)
 * @returns Blocks with gaps filled by carried-forward locations
 */
export function fillLocationGaps(
  blocks: LocationBlock[],
  summaries: EnrichedSummary[],
): LocationBlock[] {
  console.log(`\n🔥🔥🔥 [fillLocationGaps] STARTING - Processing ${blocks.length} blocks`);
  
  if (blocks.length === 0) {
    console.log(`🔥 [fillLocationGaps] No blocks to process - returning empty array`);
    return blocks;
  }

  // Sort blocks chronologically
  const sorted = [...blocks].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  console.log(`🔥 [fillLocationGaps] Sorted blocks:`);
  sorted.forEach((block, idx) => {
    console.log(`  Block ${idx}: "${block.locationLabel}" (${block.type}) ` +
      `${block.startTime.toLocaleTimeString()} - ${block.endTime.toLocaleTimeString()}`);
  });

  const result: LocationBlock[] = [];
  let lastKnownLocation: LocationBlock | null = null;
  
  for (let i = 0; i < sorted.length; i++) {
    const currentBlock = sorted[i];
    
    console.log(`\n🔥 [fillLocationGaps] Processing block ${i}: "${currentBlock.locationLabel}"`);
    console.log(`  Type: ${currentBlock.type}, hasMeaningful: ${hasMeaningfulLocation(currentBlock)}`);
    console.log(`  lastKnownLocation: ${lastKnownLocation ? `"${lastKnownLocation.locationLabel}" (${lastKnownLocation.type})` : 'null'}`);
    
    // Check if this is an "Unknown Location" block that should be replaced with carried-forward location
    if (
      !hasMeaningfulLocation(currentBlock) &&
      currentBlock.type === "stationary" &&
      lastKnownLocation &&
      lastKnownLocation.type === "stationary"
    ) {
      console.log(`🔥 [fillLocationGaps] 🎯 FOUND UNKNOWN LOCATION TO REPLACE!`);
      console.log(`  Current: "${currentBlock.locationLabel}" (${currentBlock.startTime.toLocaleTimeString()} - ${currentBlock.endTime.toLocaleTimeString()})`);
      console.log(`  Last known: "${lastKnownLocation.locationLabel}"`);
      
      // Replace "Unknown Location" block with carried-forward location
      const carriedBlock = createCarriedForwardBlock(
        lastKnownLocation,
        currentBlock.startTime,
        currentBlock.endTime,
        summaries,
      );
      
      if (carriedBlock) {
        result.push(carriedBlock);
        console.log(
          `🔥 [fillLocationGaps] ✅ REPLACED "Unknown Location" block (${currentBlock.startTime.toLocaleTimeString()} - ${currentBlock.endTime.toLocaleTimeString()}) ` +
          `with carried-forward location "${lastKnownLocation.locationLabel}"`
        );
        continue; // Skip the original "Unknown Location" block
      } else {
        console.log(`🔥 [fillLocationGaps] ⚠️ createCarriedForwardBlock returned null`);
      }
    } else {
      console.log(`🔥 [fillLocationGaps] NOT replacing block - conditions not met`);
      if (hasMeaningfulLocation(currentBlock)) {
        console.log(`    ✓ Has meaningful location`);
      } else {
        console.log(`    ✗ Does NOT have meaningful location`);
      }
      if (currentBlock.type === "stationary") {
        console.log(`    ✓ Is stationary`);
      } else {
        console.log(`    ✗ Is NOT stationary (type: ${currentBlock.type})`);
      }
      if (lastKnownLocation) {
        console.log(`    ✓ Has last known location`);
        if (lastKnownLocation.type === "stationary") {
          console.log(`      ✓ Last known is stationary`);
        } else {
          console.log(`      ✗ Last known is NOT stationary (type: ${lastKnownLocation.type})`);
        }
      } else {
        console.log(`    ✗ No last known location`);
      }
    }
    
    result.push(currentBlock);
    
    // Track last known meaningful location
    if (hasMeaningfulLocation(currentBlock) && currentBlock.type === "stationary") {
      lastKnownLocation = currentBlock;
    }

    // Check for gap to next block
    if (i < sorted.length - 1) {
      const nextBlock = sorted[i + 1];
      const gapStart = currentBlock.endTime;
      const gapEnd = nextBlock.startTime;
      const gapDurationMs = gapEnd.getTime() - gapStart.getTime();

      // Only fill significant gaps
      if (
        gapDurationMs >= MIN_GAP_FOR_CARRY_FORWARD_MS &&
        gapDurationMs <= MAX_CARRY_FORWARD_DURATION_MS
      ) {
        // Only carry forward from stationary blocks with meaningful locations
        if (currentBlock.type === "stationary" && hasMeaningfulLocation(currentBlock)) {
          // Don't carry forward if next block has a different meaningful location
          // (user changed locations during the gap)
          const currentLoc = currentBlock.locationLabel?.trim().toLowerCase() || '';
          const nextLoc = nextBlock.locationLabel?.trim().toLowerCase() || '';
          if (
            nextBlock.type === "stationary" &&
            hasMeaningfulLocation(nextBlock) &&
            nextLoc && nextLoc !== currentLoc
          ) {
            if (__DEV__) {
              console.log(
                `📍 [fillLocationGaps] ⏭️  Skipping gap - location changed ` +
                `from "${currentBlock.locationLabel}" to "${nextBlock.locationLabel}"`
              );
            }
            continue; // User moved to a different location
          }

          // Allow carry-forward before travel blocks, but add a 30min buffer
          // (assume user left shortly before travel started)
          let adjustedGapEnd = gapEnd;
          if (nextBlock.type === "travel") {
            const bufferMs = 30 * 60 * 1000; // 30 minutes
            adjustedGapEnd = new Date(gapEnd.getTime() - bufferMs);
            const adjustedDuration = adjustedGapEnd.getTime() - gapStart.getTime();
            
            // If gap becomes too small after buffer, skip it
            if (adjustedDuration < MIN_GAP_FOR_CARRY_FORWARD_MS) {
              if (__DEV__) {
                console.log(
                  `📍 [fillLocationGaps] ⏭️  Skipping gap before travel - too small after buffer ` +
                  `(${Math.round(adjustedDuration / 1000 / 60)}min after buffer, need ${MIN_GAP_FOR_CARRY_FORWARD_MS / 1000 / 60}min)`
                );
              }
              continue;
            }

            if (__DEV__) {
              console.log(
                `📍 [fillLocationGaps] 📦 Applying 30min buffer before travel block ` +
                `(${Math.round((gapEnd.getTime() - adjustedGapEnd.getTime()) / 1000 / 60)}min buffer)`
              );
            }
          }

          if (__DEV__) {
            console.log(
              `📍 [fillLocationGaps] Found ${Math.round(gapDurationMs / 1000 / 60)}min gap ` +
              `from ${gapStart.toISOString()} to ${adjustedGapEnd.toISOString()} ` +
              `after "${currentBlock.locationLabel}"`
            );
          }

          // Create a carried-forward block to fill the gap
          const carriedBlock = createCarriedForwardBlock(
            currentBlock,
            gapStart,
            adjustedGapEnd,
            summaries,
          );

          if (carriedBlock) {
            result.push(carriedBlock);
            if (__DEV__) {
              console.log(
                `📍 [fillLocationGaps] ✅ Carried forward "${currentBlock.locationLabel}" ` +
                `to fill ${Math.round((adjustedGapEnd.getTime() - gapStart.getTime()) / 1000 / 60)}min gap`
              );
            }
          }
        }
      }
    }
  }

  // Sort final result chronologically
  const sortedResult = result.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  // Final merge: combine consecutive blocks at same location
  console.log(`\n🔥🔥🔥 [fillLocationGaps] Calling mergeConsecutiveBlocks on ${sortedResult.length} blocks`);
  const finalMerged = mergeConsecutiveBlocks(sortedResult);
  console.log(`🔥 [fillLocationGaps] Final result: ${finalMerged.length} blocks after merging`);
  
  return finalMerged;
}

/**
 * Check if two LocationBlocks are at the "same place" for merging purposes.
 * Similar to isSamePlace() but operates on blocks instead of segments.
 */
function isSameBlockLocation(block1: LocationBlock, block2: LocationBlock): boolean {
  console.log(`\n🔥🔥🔥 [isSameBlockLocation] Comparing blocks:`);
  console.log(`  Block 1: "${block1.locationLabel}" (${block1.type}, geohash: ${block1.geohash7})`);
  console.log(`  Block 2: "${block2.locationLabel}" (${block2.type}, geohash: ${block2.geohash7})`);

  // Both are travel blocks — don't merge (each journey is distinct)
  if (block1.type === "travel" && block2.type === "travel") {
    console.log(`🔥 [isSameBlockLocation] ❌ Both travel blocks - NOT merging`);
    return false;
  }

  // One is travel, one isn't — different blocks
  if (block1.type === "travel" || block2.type === "travel") {
    console.log(`🔥 [isSameBlockLocation] ❌ One travel, one stationary - NOT merging`);
    return false;
  }

  // Geohash7 match (strongest signal, similar to place_id)
  if (block1.geohash7 && block2.geohash7 && block1.geohash7 === block2.geohash7) {
    console.log(`🔥 [isSameBlockLocation] ✅ Geohash match: ${block1.geohash7} - MERGING`);
    return true;
  }

  // Inferred place ID match
  if (
    block1.inferredPlace?.placeId &&
    block2.inferredPlace?.placeId &&
    block1.inferredPlace.placeId === block2.inferredPlace.placeId
  ) {
    console.log(`🔥 [isSameBlockLocation] ✅ Inferred place ID match: ${block1.inferredPlace.placeId} - MERGING`);
    return true;
  }

  // Coordinate proximity fallback (< 200m)
  if (
    block1.latitude != null &&
    block1.longitude != null &&
    block2.latitude != null &&
    block2.longitude != null
  ) {
    const distance = haversineDistance(
      block1.latitude,
      block1.longitude,
      block2.latitude,
      block2.longitude,
    );
    console.log(`🔥 [isSameBlockLocation] Distance: ${Math.round(distance)}m`);
    if (distance < SAME_PLACE_DISTANCE_THRESHOLD_M) {
      console.log(`🔥 [isSameBlockLocation] ✅ Proximity match: ${Math.round(distance)}m - MERGING`);
      return true;
    }
  }

  // Location label match (for geocoded locations)
  const label1 = block1.locationLabel?.trim().toLowerCase();
  const label2 = block2.locationLabel?.trim().toLowerCase();
  if (
    label1 &&
    label2 &&
    label1 === label2 &&
    label1 !== 'unknown location' &&
    label1 !== 'unknown' &&
    label1 !== 'location'
  ) {
    console.log(`🔥 [isSameBlockLocation] ✅ Label match: "${block1.locationLabel}" - MERGING`);
    return true;
  }

  console.log(`🔥 [isSameBlockLocation] ❌ No match - NOT merging`);
  return false;
}

/**
 * Merge consecutive LocationBlocks that are at the same place.
 * This is the final step after gap-filling to combine blocks that should be one.
 * 
 * Example: Gap-filling might create:
 *   Block A: 2:42-4 AM "Believe Candle Co." (real data)
 *   Block B: 4-7:03 AM "Believe Candle Co." (gap-filled)
 *   Block C: 7:03-7:56 AM "Believe Candle Co." (real data)
 * 
 * This function merges them into one block: 2:42-7:56 AM "Believe Candle Co."
 */
function mergeConsecutiveBlocks(blocks: LocationBlock[]): LocationBlock[] {
  console.log(`\n🔥🔥🔥 [mergeConsecutiveBlocks] Starting with ${blocks.length} blocks`);
  
  if (blocks.length === 0) {
    console.log(`🔥 [mergeConsecutiveBlocks] No blocks to merge`);
    return blocks;
  }

  // Sort chronologically
  const sorted = [...blocks].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  const result: LocationBlock[] = [];
  let currentMerge = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const nextBlock = sorted[i];

    if (isSameBlockLocation(currentMerge, nextBlock)) {
      console.log(
        `🔥 [mergeConsecutiveBlocks] ✅ Merging "${currentMerge.locationLabel}" ` +
        `(${currentMerge.startTime.toLocaleTimeString()}-${currentMerge.endTime.toLocaleTimeString()}) ` +
        `with "${nextBlock.locationLabel}" ` +
        `(${nextBlock.startTime.toLocaleTimeString()}-${nextBlock.endTime.toLocaleTimeString()})`
      );

      // Merge: extend end time, combine screen time, samples, etc.
      currentMerge = {
        ...currentMerge,
        endTime: nextBlock.endTime,
        durationMinutes: Math.round(
          (nextBlock.endTime.getTime() - currentMerge.startTime.getTime()) / 60000
        ),
        totalScreenMinutes: currentMerge.totalScreenMinutes + nextBlock.totalScreenMinutes,
        totalLocationSamples: currentMerge.totalLocationSamples + nextBlock.totalLocationSamples,
        // Combine apps (sum total minutes for matching apps)
        apps: mergeAppUsage(currentMerge.apps, nextBlock.apps),
        // Combine segments
        segments: [...currentMerge.segments, ...nextBlock.segments],
        // Combine summaries
        summaries: [...currentMerge.summaries, ...nextBlock.summaries],
        summaryIds: [...currentMerge.summaryIds, ...nextBlock.summaryIds],
        // Preserve feedback/lock state if either has it
        hasUserFeedback: currentMerge.hasUserFeedback || nextBlock.hasUserFeedback,
        isLocked: currentMerge.isLocked || nextBlock.isLocked,
        // Average confidence weighted by duration
        confidenceScore: (
          (currentMerge.confidenceScore * currentMerge.durationMinutes +
           nextBlock.confidenceScore * nextBlock.durationMinutes) /
          (currentMerge.durationMinutes + nextBlock.durationMinutes)
        ),
      };
    } else {
      console.log(
        `🔥 [mergeConsecutiveBlocks] ❌ NOT merging "${currentMerge.locationLabel}" with "${nextBlock.locationLabel}"`
      );
      result.push(currentMerge);
      currentMerge = nextBlock;
    }
  }

  // Push the final merged block
  result.push(currentMerge);

  console.log(`🔥 [mergeConsecutiveBlocks] ✅ Finished: ${blocks.length} blocks → ${result.length} blocks`);
  return result;
}

/**
 * Merge app usage arrays from two blocks.
 * Combines total minutes for apps that appear in both arrays.
 */
function mergeAppUsage(apps1: BlockAppUsage[], apps2: BlockAppUsage[]): BlockAppUsage[] {
  const appMap = new Map<string, BlockAppUsage>();

  // Add apps from first block
  for (const app of apps1) {
    appMap.set(app.appId, { ...app });
  }

  // Merge apps from second block
  for (const app of apps2) {
    const existing = appMap.get(app.appId);
    if (existing) {
      existing.totalMinutes += app.totalMinutes;
      existing.sessions = [...existing.sessions, ...app.sessions];
    } else {
      appMap.set(app.appId, { ...app });
    }
  }

  // Return sorted by total minutes descending
  return Array.from(appMap.values()).sort(
    (a, b) => b.totalMinutes - a.totalMinutes
  );
}

/**
 * Create a synthetic "carried forward" location block to fill a gap.
 * 
 * The block inherits location data from the previous block but has:
 * - New time range (the gap period)
 * - Screen time data from overlapping hourly summaries
 * - Lower confidence score (it's inferred, not measured)
 * - Special flag to indicate it's a carried-forward block
 */
function createCarriedForwardBlock(
  sourceBlock: LocationBlock,
  gapStart: Date,
  gapEnd: Date,
  summaries: EnrichedSummary[],
): LocationBlock | null {
  const durationMinutes = Math.round(
    (gapEnd.getTime() - gapStart.getTime()) / 60000,
  );

  // Find overlapping hourly summaries for app usage
  const gapStartMs = gapStart.getTime();
  const gapEndMs = gapEnd.getTime();
  const overlappingSummaries = summaries.filter((s) => {
    const hourStartMs = s.hourStart.getTime();
    const hourEndMs = hourStartMs + 60 * 60 * 1000;
    return hourStartMs < gapEndMs && hourEndMs > gapStartMs;
  });

  // Aggregate app usage from overlapping summaries
  const appMap = new Map<
    string,
    {
      appId: string;
      displayName: string;
      category: string;
      totalMinutes: number;
      sessions: AppSession[];
    }
  >();

  for (const summary of overlappingSummaries) {
    for (const app of summary.appBreakdown) {
      if (app.minutes < 1) continue;
      const existing = appMap.get(app.appId);
      if (existing) {
        existing.totalMinutes += app.minutes;
      } else {
        appMap.set(app.appId, {
          appId: app.appId,
          displayName: app.displayName,
          category: app.category,
          totalMinutes: app.minutes,
          sessions: [],
        });
      }
    }
  }

  const apps: BlockAppUsage[] = Array.from(appMap.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .map((a) => ({
      appId: a.appId,
      displayName: a.displayName,
      category: a.category,
      totalMinutes: a.totalMinutes,
      sessions: a.sessions,
    }));

  const totalScreenMinutes = overlappingSummaries.reduce(
    (sum, s) => sum + s.totalScreenMinutes,
    0,
  );

  // Infer activity for the gap period
  const midpointHour = Math.round(
    (gapStart.getHours() + gapEnd.getHours()) / 2,
  );
  const allApps: SummaryAppBreakdown[] = overlappingSummaries.flatMap(
    (s) => s.appBreakdown,
  );
  const inferenceContext: InferenceContext = {
    activity: sourceBlock.dominantActivity, // Inherit from source block
    apps: allApps,
    screenMinutes: totalScreenMinutes,
    hourOfDay: midpointHour,
    placeLabel: sourceBlock.locationLabel,
    previousPlaceLabel: null,
    inferredPlace: sourceBlock.inferredPlace,
    locationSamples: 0, // No actual samples - this is carried forward
    confidence: sourceBlock.confidenceScore * 0.6, // Lower confidence for inferred
    previousGeohash: null,
    currentGeohash: sourceBlock.geohash7,
    locationRadius: null,
    googlePlaceTypes: null,
  };
  const activityInference = generateInferenceDescription(inferenceContext);

  return {
    id: `${sourceBlock.id}-carried-${gapStart.getTime()}`,
    type: "stationary",
    movementType: null,
    distanceM: null,
    locationLabel: sourceBlock.locationLabel,
    locationCategory: sourceBlock.locationCategory,
    inferredPlace: sourceBlock.inferredPlace,
    isPlaceInferred: sourceBlock.isPlaceInferred,
    geohash7: sourceBlock.geohash7,
    startTime: gapStart,
    endTime: gapEnd,
    durationMinutes,
    apps,
    totalScreenMinutes,
    dominantActivity: sourceBlock.dominantActivity,
    activityInference,
    confidenceScore: Math.max(0.3, sourceBlock.confidenceScore * 0.6), // Lower confidence
    totalLocationSamples: 0, // No actual samples
    summaries: overlappingSummaries,
    segments: [], // No segments - this is synthetic
    summaryIds: overlappingSummaries.map((s) => s.id),
    hasUserFeedback: false,
    isLocked: false,
    latitude: sourceBlock.latitude,
    longitude: sourceBlock.longitude,
    // Mark as carried forward for UI/debugging
    isCarriedForward: true,
  };
}
