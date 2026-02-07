/**
 * Location Block Grouping Algorithm
 *
 * Takes an array of EnrichedSummary items (one per hour, already enriched
 * with place inference and activity segments) and groups consecutive items
 * at the same location into LocationBlock objects.
 */

import type { EnrichedSummary } from "@/components/organisms/HourlySummaryList";
import type { InferredActivityType } from "@/lib/supabase/services/activity-segments";
import type { SummaryAppBreakdown } from "@/lib/supabase/services";
import {
  generateInferenceDescription,
  type InferenceContext,
} from "@/lib/supabase/services/activity-inference-descriptions";
import type {
  LocationBlock,
  BlockAppUsage,
  AppSession,
} from "@/lib/types/location-block";

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

  // -- Location label --
  let locationLabel = first.primaryPlaceLabel ?? "Unknown Location";
  if (isTravel) {
    // Build "Origin -> Destination" label for travel
    const origin =
      group[0].previousPlaceLabel ??
      allSegments[0]?.placeLabel ??
      null;
    const destination =
      allSegments.length > 0
        ? allSegments[allSegments.length - 1].placeLabel
        : last.primaryPlaceLabel;

    if (origin && destination && destination !== "Unknown Location") {
      locationLabel = `${origin} → ${destination}`;
    } else if (destination && destination !== "Unknown Location") {
      locationLabel = `Travel → ${destination}`;
    } else {
      locationLabel = "In Transit";
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
