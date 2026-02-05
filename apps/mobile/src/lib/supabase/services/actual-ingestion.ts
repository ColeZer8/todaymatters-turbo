/**
 * Actual ingestion service for converting evidence data into calendar events.
 * Handles location segment generation and sessionization.
 */

import type {
  EvidenceLocationSample,
  UserPlaceRow,
} from "./evidence-data";

import {
  classifyIntent,
  type AppSummary,
  type Intent,
  type IntentClassificationResult,
  type UserAppCategoryOverrides,
} from "./app-categories";

// ============================================================================
// Sleep Detection Types
// ============================================================================

/**
 * User's sleep schedule configuration.
 * Used to determine when to create sleep sessions.
 */
export interface SleepSchedule {
  /** Typical bedtime in HH:MM format (24-hour), e.g., "22:30" */
  bedtime: string;
  /** Typical wake time in HH:MM format (24-hour), e.g., "07:00" */
  wakeTime: string;
}

/**
 * Default sleep schedule when user hasn't configured one.
 * 22:00 (10 PM) to 07:00 (7 AM)
 */
export const DEFAULT_SLEEP_SCHEDULE: SleepSchedule = {
  bedtime: "22:00",
  wakeTime: "07:00",
};

/**
 * Result of sleep session detection for a time range.
 */
export interface SleepDetectionResult {
  /** Whether a sleep period was detected */
  isSleep: boolean;
  /** The detected sleep session blocks */
  sleepSessions: SessionBlock[];
  /** Screen-time interruptions during sleep */
  screenTimeInterruptions: SessionizableEvent[];
}

import type { ReconciliationEvent, DerivedEvent } from "./event-reconciliation";

// ============================================================================
// Types
// ============================================================================

/**
 * A location segment representing a contiguous block of time at a place.
 * Generated from raw location samples using place radius matching.
 */
export interface LocationSegment {
  /** Deterministic source ID for reconciliation: location:{windowStartMs}:{placeId}:{segmentStartMs} */
  sourceId: string;
  /** Start timestamp of this segment */
  start: Date;
  /** End timestamp of this segment */
  end: Date;
  /** User place ID if matched, "unknown" for unmatched locations */
  placeId: string | null;
  /** User place label if matched, null for unknown */
  placeLabel: string | null;
  /** Latitude centroid of samples in this segment */
  latitude: number;
  /** Longitude centroid of samples in this segment */
  longitude: number;
  /** Number of samples in this segment */
  sampleCount: number;
  /** Confidence score 0-1 based on sample density and place match strength */
  confidence: number;
  /** Metadata for event creation */
  meta: {
    kind: "location_block" | "commute";
    place_id: string | null;
    place_label: string | null;
    sample_count: number;
    confidence: number;
    /** Intent type for commute segments */
    intent?: "commute";
    /** Travel annotation for short commutes < 10 min (added to next segment) */
    travel_annotation?: string;
    /** Destination place for commute segments */
    destination_place_id?: string | null;
    destination_place_label?: string | null;
    /** Distance traveled in meters (approximate) */
    distance_m?: number;
    /** True if the location label is fuzzy (low confidence, uses "Near [Area]" format) */
    fuzzy_location?: boolean;
  };
}

/**
 * Result of commute detection for a segment of movement.
 */
export interface CommuteDetectionResult {
  /** Whether a commute was detected */
  isCommute: boolean;
  /** Duration of the commute in milliseconds */
  durationMs: number;
  /** Whether this is a "long" commute (>= 10 min) that should be its own segment */
  isLongCommute: boolean;
  /** Travel annotation for short commutes (< 10 min) */
  travelAnnotation: string | null;
  /** Start place (where the commute started from) */
  fromPlace: { id: string | null; label: string | null } | null;
  /** End place (where the commute ended at) */
  toPlace: { id: string | null; label: string | null } | null;
  /** Approximate distance traveled in meters */
  distanceM: number;
  /** Samples that are part of the commute */
  samples: EvidenceLocationSample[];
}

/**
 * Internal type for tracking sample groups during segmentation.
 */
interface SampleGroup {
  samples: EvidenceLocationSample[];
  placeId: string | null;
  place: UserPlaceRow | null;
}

// ============================================================================
// Constants
// ============================================================================

/** 
 * Default radius in meters for user place matching.
 * FIX #3: Reduced from 150m to 100m to prevent matching places user drove near.
 * 100m is reasonable for suburban areas; urban areas might benefit from 75m.
 */
const DEFAULT_PLACE_RADIUS_M = 100;

/** Minimum percentage of samples that must match a place for the segment to be labeled as that place */
const PLACE_MATCH_THRESHOLD = 0.7;

/** Minimum commute duration in milliseconds to create a separate commute segment */
const MIN_COMMUTE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/** Maximum movement speed in m/s to be considered stationary (walking pace ~1.4 m/s) */
const STATIONARY_SPEED_THRESHOLD_MS = 0.5; // 0.5 m/s = very slow walk

/**
 * FIX #2: Minimum dwell time in milliseconds required to tag a location.
 * Prevents "drive-by" scenarios where user passes near a place but doesn't stop.
 * 5 minutes is long enough to filter driving, short enough to capture quick stops.
 */
const MIN_DWELL_TIME_MS = 5 * 60 * 1000; // 5 minutes

/** Minimum total distance traveled to consider as movement */
const MIN_COMMUTE_DISTANCE_M = 200; // 200 meters

/** Maximum gap in milliseconds to merge into adjacent sessions (5 minutes) */
const MAX_MICRO_GAP_MS = 5 * 60 * 1000;

/** Minimum session duration in milliseconds (10 minutes) */
const MIN_SESSION_DURATION_MS = 10 * 60 * 1000;

/** Minimum sleep duration in milliseconds to be considered a sleep session (4 hours) */
const MIN_SLEEP_DURATION_MS = 4 * 60 * 60 * 1000;

/** Minimum gap duration to be considered a potential sleep period (3 hours) */
const MIN_OVERNIGHT_GAP_MS = 3 * 60 * 60 * 1000;

/** Common "Home" place labels for sleep detection (case-insensitive matching) */
const HOME_PLACE_LABELS = ["home", "house", "apartment", "residence", "my place"];

/** Confidence threshold below which location labels become fuzzy (use "Near [Area]" format) */
export const FUZZY_LOCATION_CONFIDENCE_THRESHOLD = 0.7;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate the haversine distance between two points in meters.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find the best matching user place for a given coordinate.
 * Uses haversine distance with the place's configured radius (or default 150m).
 */
function findMatchingPlace(
  latitude: number,
  longitude: number,
  userPlaces: UserPlaceRow[],
): UserPlaceRow | null {
  let bestMatch: UserPlaceRow | null = null;
  let bestDistance = Infinity;

  for (const place of userPlaces) {
    if (place.latitude === null || place.longitude === null) continue;

    const distance = haversineDistance(
      latitude,
      longitude,
      place.latitude,
      place.longitude,
    );

    // Use place's configured radius or default to 150m
    const effectiveRadius = place.radius_m ?? DEFAULT_PLACE_RADIUS_M;

    // Check if within radius and closer than current best
    if (distance <= effectiveRadius && distance < bestDistance) {
      bestMatch = place;
      bestDistance = distance;
    }
  }

  return bestMatch;
}

/**
 * Calculate the centroid (average) of sample coordinates.
 */
function calculateCentroid(samples: EvidenceLocationSample[]): {
  latitude: number;
  longitude: number;
} {
  if (samples.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  let latSum = 0;
  let lonSum = 0;
  let validCount = 0;

  for (const sample of samples) {
    if (sample.latitude !== null && sample.longitude !== null) {
      latSum += sample.latitude;
      lonSum += sample.longitude;
      validCount++;
    }
  }

  if (validCount === 0) {
    return { latitude: 0, longitude: 0 };
  }

  return {
    latitude: latSum / validCount,
    longitude: lonSum / validCount,
  };
}

/**
 * Generate a deterministic source ID for a location segment.
 * Format: location:{windowStartMs}:{placeId}:{segmentStartMs}
 */
function generateSourceId(
  windowStart: Date,
  placeId: string | null,
  segmentStart: Date,
): string {
  const windowStartMs = windowStart.getTime();
  const segmentStartMs = segmentStart.getTime();
  const placeIdPart = placeId ?? "unknown";
  return `location:${windowStartMs}:${placeIdPart}:${segmentStartMs}`;
}

/**
 * Calculate confidence score for a location segment.
 * Based on sample count and place match strength.
 */
function calculateSegmentConfidence(
  sampleCount: number,
  placeMatchRatio: number,
): number {
  // Base confidence from sample count (0.3-0.6)
  // More samples = higher confidence, up to ~10 samples per segment
  const countConfidence = Math.min(0.6, 0.3 + (sampleCount / 10) * 0.3);

  // Place match bonus (0-0.4)
  // 70% match = minimum bonus, 100% = full bonus
  let matchBonus = 0;
  if (placeMatchRatio >= PLACE_MATCH_THRESHOLD) {
    matchBonus = 0.1 + (placeMatchRatio - PLACE_MATCH_THRESHOLD) / 0.3 * 0.3;
    matchBonus = Math.min(0.4, matchBonus);
  }

  return Math.min(1, countConfidence + matchBonus);
}

/**
 * Count samples that match a specific place (or null for unknown).
 */
function countSamplesMatchingPlace(
  samples: EvidenceLocationSample[],
  targetPlaceId: string | null,
  userPlaces: UserPlaceRow[],
): number {
  let count = 0;
  for (const sample of samples) {
    if (sample.latitude === null || sample.longitude === null) continue;
    const match = findMatchingPlace(sample.latitude, sample.longitude, userPlaces);
    const matchId = match?.id ?? null;
    if (matchId === targetPlaceId) {
      count++;
    }
  }
  return count;
}

/**
 * Determine the dominant place for a group of samples.
 * A place is dominant if 70%+ of samples match it.
 */
function findDominantPlace(
  samples: EvidenceLocationSample[],
  userPlaces: UserPlaceRow[],
): { placeId: string | null; place: UserPlaceRow | null; matchRatio: number } {
  if (samples.length === 0) {
    return { placeId: null, place: null, matchRatio: 0 };
  }

  // Count matches per place
  const placeCounts = new Map<string | null, { count: number; place: UserPlaceRow | null }>();

  // Initialize with null (unknown location)
  placeCounts.set(null, { count: 0, place: null });

  for (const sample of samples) {
    if (sample.latitude === null || sample.longitude === null) {
      // Invalid sample - count as unknown
      const current = placeCounts.get(null)!;
      current.count++;
      continue;
    }

    const match = findMatchingPlace(sample.latitude, sample.longitude, userPlaces);
    const key = match?.id ?? null;

    if (!placeCounts.has(key)) {
      placeCounts.set(key, { count: 0, place: match });
    }
    const current = placeCounts.get(key)!;
    current.count++;
  }

  // Find the dominant place
  let dominantKey: string | null = null;
  let maxCount = 0;
  let dominantPlace: UserPlaceRow | null = null;

  for (const [key, value] of placeCounts.entries()) {
    if (value.count > maxCount) {
      maxCount = value.count;
      dominantKey = key;
      dominantPlace = value.place;
    }
  }

  const matchRatio = maxCount / samples.length;

  // Only return the place if it meets the threshold
  if (matchRatio >= PLACE_MATCH_THRESHOLD) {
    return { placeId: dominantKey, place: dominantPlace, matchRatio };
  }

  // Not enough consensus - return unknown
  return { placeId: null, place: null, matchRatio };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate location segments from raw location samples and user places.
 *
 * This function:
 * 1. Groups consecutive samples by place using radius matching (default 150m)
 * 2. Creates contiguous blocks where 70%+ of samples match a single place
 * 3. Assigns deterministic source_id for reconciliation
 * 4. Includes metadata for event creation (meta.kind = 'location_block')
 *
 * @param locationSamples - Raw GPS samples from the ingestion window
 * @param userPlaces - User's labeled places for matching
 * @param windowStart - Start of the ingestion window (for source_id generation)
 * @param windowEnd - End of the ingestion window (for clamping segment boundaries)
 * @returns Array of LocationSegment objects ready for event creation
 */
export function generateLocationSegments(
  locationSamples: EvidenceLocationSample[],
  userPlaces: UserPlaceRow[],
  windowStart: Date,
  windowEnd: Date,
): LocationSegment[] {
  // DEBUG: Log function entry
  console.log(`📍 [generateLocationSegments] Called with ${locationSamples.length} samples, window: ${windowStart.toISOString()} - ${windowEnd.toISOString()}`);
  
  if (locationSamples.length === 0) {
    return [];
  }

  const segments: LocationSegment[] = [];

  // Sort samples by timestamp
  const sortedSamples = [...locationSamples].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  // Group consecutive samples by their matched place OR by coordinate proximity
  // This ensures we create separate segments even when locations aren't user-defined places
  const groups: SampleGroup[] = [];
  let currentGroup: SampleGroup | null = null;

  for (const sample of sortedSamples) {
    // Skip samples with invalid coordinates
    if (sample.latitude === null || sample.longitude === null) {
      continue;
    }

    const matchedPlace = findMatchingPlace(sample.latitude, sample.longitude, userPlaces);
    const currentPlaceId = matchedPlace?.id ?? null;

    if (currentGroup === null) {
      // Start first group
      currentGroup = {
        samples: [sample],
        placeId: currentPlaceId,
        place: matchedPlace,
      };
    } else {
      // Check if we should continue the current group or start a new one
      const sameUserPlace = currentGroup.placeId === currentPlaceId && currentPlaceId !== null;
      
      // For samples without user place matches, check coordinate proximity
      // If the sample is >200m from the group's centroid, start a new group
      let sameCoordinateCluster = false;
      let distanceFromCentroid = 0;
      if (currentPlaceId === null && currentGroup.placeId === null) {
        const groupCentroid = calculateCentroid(currentGroup.samples);
        distanceFromCentroid = haversineDistance(
          groupCentroid.latitude,
          groupCentroid.longitude,
          sample.latitude,
          sample.longitude,
        );
        // 200m threshold for considering it the same location cluster
        sameCoordinateCluster = distanceFromCentroid < 200;
        
        // DEBUG: Log when distance is significant
        if (distanceFromCentroid > 100) {
          console.log(`📍 [CLUSTER DEBUG] Distance from centroid: ${Math.round(distanceFromCentroid)}m, sameCluster: ${sameCoordinateCluster}, sample: (${sample.latitude}, ${sample.longitude}), centroid: (${groupCentroid.latitude}, ${groupCentroid.longitude})`);
        }
      }

      if (sameUserPlace || sameCoordinateCluster) {
        // Same place or same coordinate cluster - extend current group
        currentGroup.samples.push(sample);
      } else {
        // DEBUG: Log when starting new group
        console.log(`📍 [CLUSTER DEBUG] Starting NEW group! sameUserPlace: ${sameUserPlace}, sameCoordinateCluster: ${sameCoordinateCluster}, distance: ${Math.round(distanceFromCentroid)}m`);
        // Different place/cluster - finalize current group and start new one
        groups.push(currentGroup);
        currentGroup = {
          samples: [sample],
          placeId: currentPlaceId,
          place: matchedPlace,
        };
      }
    }
  }

  // Don't forget the last group
  if (currentGroup && currentGroup.samples.length > 0) {
    groups.push(currentGroup);
  }

  // Convert groups to segments, applying the 70% threshold
  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const group = groups[groupIdx];
    if (group.samples.length === 0) continue;

    // Find the dominant place in this group (may differ from initial grouping)
    const { placeId, place, matchRatio } = findDominantPlace(group.samples, userPlaces);

    // Calculate segment boundaries
    const firstSample = group.samples[0];
    const lastSample = group.samples[group.samples.length - 1];
    const rawSegmentStart = new Date(firstSample.recorded_at);
    const rawSegmentEnd = new Date(lastSample.recorded_at);
    
    // Use actual sample timestamps for segment boundaries
    // This preserves accurate duration data instead of inflating to fill windows.
    // Gaps between segments will be handled by commute detection or shown as gaps.
    const segmentStart = rawSegmentStart;
    const segmentEnd = rawSegmentEnd;

    // Clamp to window boundaries
    const clampedStart = new Date(Math.max(segmentStart.getTime(), windowStart.getTime()));
    const clampedEnd = new Date(Math.min(segmentEnd.getTime(), windowEnd.getTime()));

    // Skip if segment is invalid after clamping
    if (clampedStart >= clampedEnd) {
      continue;
    }

    // FIX #2: Skip segments shorter than minimum dwell time
    // This prevents "drive-by" scenarios where user passes near a place
    const segmentDurationMs = clampedEnd.getTime() - clampedStart.getTime();
    if (segmentDurationMs < MIN_DWELL_TIME_MS) {
      if (__DEV__) {
        console.log(`📍 [filter] Skipping segment at ${place?.label ?? 'unknown'} - duration ${Math.round(segmentDurationMs / 1000 / 60)}min < ${MIN_DWELL_TIME_MS / 1000 / 60}min minimum`);
      }
      continue;
    }

    // Calculate centroid
    const centroid = calculateCentroid(group.samples);

    // Calculate confidence
    const confidence = calculateSegmentConfidence(group.samples.length, matchRatio);

    // Generate source ID
    const sourceId = generateSourceId(windowStart, placeId, clampedStart);

    segments.push({
      sourceId,
      start: clampedStart,
      end: clampedEnd,
      placeId,
      placeLabel: place?.label ?? null,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      sampleCount: group.samples.length,
      confidence,
      meta: {
        kind: "location_block",
        place_id: placeId,
        place_label: place?.label ?? null,
        sample_count: group.samples.length,
        confidence,
      },
    });
  }

  // DEBUG: Log results
  console.log(`📍 [generateLocationSegments] Created ${groups.length} groups, ${segments.length} segments`);
  for (const seg of segments) {
    console.log(`📍 [generateLocationSegments] Segment: ${seg.start.toISOString()} - ${seg.end.toISOString()}, place: ${seg.placeLabel ?? 'unknown'}, coords: (${seg.latitude}, ${seg.longitude})`);
  }

  return segments;
}

/**
 * Merge adjacent segments with the same place to avoid fragmentation.
 * This can happen when samples briefly don't match (e.g., GPS drift).
 *
 * @param segments - Location segments to merge
 * @param maxGapMs - Maximum gap in milliseconds between segments to merge (default: 5 minutes)
 * @returns Merged segments
 */
export function mergeAdjacentSegments(
  segments: LocationSegment[],
  maxGapMs: number = 5 * 60 * 1000,
): LocationSegment[] {
  if (segments.length <= 1) {
    return segments;
  }

  const merged: LocationSegment[] = [];
  let current = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    const gap = next.start.getTime() - current.end.getTime();

    // Merge if same place and gap is small enough
    // For segments without placeId (null), also check coordinate proximity
    let shouldMerge = false;
    if (gap <= maxGapMs) {
      if (current.placeId !== null && current.placeId === next.placeId) {
        // Both have same non-null placeId
        shouldMerge = true;
      } else if (current.placeId === null && next.placeId === null) {
        // Both unknown - check if coordinates are close (< 200m)
        const distance = haversineDistance(
          current.latitude,
          current.longitude,
          next.latitude,
          next.longitude,
        );
        shouldMerge = distance < 200;
      }
    }
    
    if (shouldMerge) {
      // Extend current segment
      current = {
        ...current,
        end: next.end,
        sampleCount: current.sampleCount + next.sampleCount,
        // Recalculate confidence based on combined sample count
        confidence: calculateSegmentConfidence(
          current.sampleCount + next.sampleCount,
          1.0, // Same place, full match
        ),
        meta: {
          ...current.meta,
          sample_count: current.sampleCount + next.sampleCount,
          confidence: calculateSegmentConfidence(
            current.sampleCount + next.sampleCount,
            1.0,
          ),
        },
      };
    } else {
      // Cannot merge - push current and start new
      merged.push(current);
      current = next;
    }
  }

  // Don't forget the last segment
  merged.push(current);

  return merged;
}

/**
 * Convert location segments to derived events for reconciliation.
 * Creates events with the proper structure for the reconciliation pipeline.
 *
 * @param segments - Location segments to convert
 * @returns Array of derived events ready for reconciliation
 */
export function segmentsToDerivedEvents(
  segments: LocationSegment[],
): Array<{
  sourceId: string;
  title: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  meta: Record<string, unknown>;
}> {
  return segments.map((segment) => ({
    sourceId: segment.sourceId,
    title: segment.meta.kind === "commute"
      ? "Commute"
      : segment.placeLabel
        ? `At ${segment.placeLabel}`
        : "Unknown Location",
    scheduledStart: segment.start,
    scheduledEnd: segment.end,
    meta: {
      ...segment.meta,
      source: "derived",
      source_id: segment.sourceId,
      latitude: segment.latitude,
      longitude: segment.longitude,
    },
  }));
}

// ============================================================================
// Commute Detection
// ============================================================================

/**
 * Calculate the total path distance traveled across a series of samples.
 * Uses haversine distance for each consecutive pair.
 */
function calculatePathDistance(samples: EvidenceLocationSample[]): number {
  if (samples.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];

    if (
      prev.latitude !== null &&
      prev.longitude !== null &&
      curr.latitude !== null &&
      curr.longitude !== null
    ) {
      totalDistance += haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude,
      );
    }
  }

  return totalDistance;
}

/**
 * Check if a group of samples represents movement (unstable position).
 * Movement is detected when samples don't match any single place consistently.
 */
function isMovementGroup(
  samples: EvidenceLocationSample[],
  userPlaces: UserPlaceRow[],
): boolean {
  if (samples.length < 2) return false;

  // Count how many unique places are matched
  const matchedPlaces = new Set<string | null>();
  for (const sample of samples) {
    if (sample.latitude === null || sample.longitude === null) continue;
    const match = findMatchingPlace(sample.latitude, sample.longitude, userPlaces);
    matchedPlaces.add(match?.id ?? null);
  }

  // If we see 2+ different places (including null for unknown), it's movement
  // OR if no samples match any place (all null), check distance traveled
  if (matchedPlaces.size >= 2) return true;

  // Also check if the total distance suggests movement
  const distance = calculatePathDistance(samples);
  return distance >= MIN_COMMUTE_DISTANCE_M;
}

/**
 * Find the first and last stable place in a sequence of samples.
 * Used to determine commute origin and destination.
 */
function findBoundaryPlaces(
  samples: EvidenceLocationSample[],
  userPlaces: UserPlaceRow[],
): {
  fromPlace: { id: string | null; label: string | null } | null;
  toPlace: { id: string | null; label: string | null } | null;
} {
  if (samples.length === 0) {
    return { fromPlace: null, toPlace: null };
  }

  // Find first matched place
  let fromPlace: { id: string | null; label: string | null } | null = null;
  for (const sample of samples) {
    if (sample.latitude === null || sample.longitude === null) continue;
    const match = findMatchingPlace(sample.latitude, sample.longitude, userPlaces);
    if (match) {
      fromPlace = { id: match.id, label: match.label };
      break;
    }
  }

  // Find last matched place (iterate backwards)
  let toPlace: { id: string | null; label: string | null } | null = null;
  for (let i = samples.length - 1; i >= 0; i--) {
    const sample = samples[i];
    if (sample.latitude === null || sample.longitude === null) continue;
    const match = findMatchingPlace(sample.latitude, sample.longitude, userPlaces);
    if (match) {
      toPlace = { id: match.id, label: match.label };
      break;
    }
  }

  return { fromPlace, toPlace };
}

/**
 * Detect commute in a sequence of location samples.
 *
 * A commute is detected when:
 * - The location is changing between places without a stable position
 * - There is significant distance traveled (> 200m)
 *
 * Returns:
 * - If commute >= 10 minutes: isLongCommute = true (create separate segment)
 * - If commute < 10 minutes: travelAnnotation is set (add to next segment)
 *
 * @param locationSamples - Raw GPS samples to analyze
 * @param startTime - Start of the analysis window
 * @param endTime - End of the analysis window
 * @param userPlaces - User's labeled places for matching
 * @returns Commute detection result
 */
export function detectCommute(
  locationSamples: EvidenceLocationSample[],
  startTime: Date,
  endTime: Date,
  userPlaces: UserPlaceRow[],
): CommuteDetectionResult {
  // Filter samples to the specified time window
  const windowSamples = locationSamples.filter((s) => {
    const timestamp = new Date(s.recorded_at).getTime();
    return timestamp >= startTime.getTime() && timestamp <= endTime.getTime();
  });

  // Sort by timestamp
  const sortedSamples = [...windowSamples].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  if (sortedSamples.length < 2) {
    return {
      isCommute: false,
      durationMs: 0,
      isLongCommute: false,
      travelAnnotation: null,
      fromPlace: null,
      toPlace: null,
      distanceM: 0,
      samples: [],
    };
  }

  // Check if this group represents movement
  if (!isMovementGroup(sortedSamples, userPlaces)) {
    return {
      isCommute: false,
      durationMs: 0,
      isLongCommute: false,
      travelAnnotation: null,
      fromPlace: null,
      toPlace: null,
      distanceM: 0,
      samples: [],
    };
  }

  // Calculate duration
  const firstTimestamp = new Date(sortedSamples[0].recorded_at).getTime();
  const lastTimestamp = new Date(sortedSamples[sortedSamples.length - 1].recorded_at).getTime();
  const durationMs = lastTimestamp - firstTimestamp;

  // Calculate distance
  const distanceM = calculatePathDistance(sortedSamples);

  // Find boundary places
  const { fromPlace, toPlace } = findBoundaryPlaces(sortedSamples, userPlaces);

  // Determine if this is a long commute (>= 10 min)
  const isLongCommute = durationMs >= MIN_COMMUTE_DURATION_MS;

  // Generate travel annotation for short commutes
  let travelAnnotation: string | null = null;
  if (!isLongCommute && durationMs > 0) {
    const durationMinutes = Math.round(durationMs / (60 * 1000));
    const destinationLabel = toPlace?.label ?? "destination";
    travelAnnotation = `Traveled ${durationMinutes} min to ${destinationLabel}`;
  }

  return {
    isCommute: true,
    durationMs,
    isLongCommute,
    travelAnnotation,
    fromPlace,
    toPlace,
    distanceM,
    samples: sortedSamples,
  };
}

/**
 * Generate a commute source ID.
 * Format: commute:{windowStartMs}:{segmentStartMs}
 */
function generateCommuteSourceId(windowStart: Date, segmentStart: Date): string {
  const windowStartMs = windowStart.getTime();
  const segmentStartMs = segmentStart.getTime();
  return `commute:${windowStartMs}:${segmentStartMs}`;
}

/**
 * Create a commute segment from a commute detection result.
 */
export function createCommuteSegment(
  commute: CommuteDetectionResult,
  windowStart: Date,
): LocationSegment | null {
  if (!commute.isCommute || !commute.isLongCommute || commute.samples.length === 0) {
    return null;
  }

  const firstSample = commute.samples[0];
  const lastSample = commute.samples[commute.samples.length - 1];
  const segmentStart = new Date(firstSample.recorded_at);
  const segmentEnd = new Date(lastSample.recorded_at);

  // Calculate centroid
  const centroid = calculateCentroid(commute.samples);

  // Generate source ID
  const sourceId = generateCommuteSourceId(windowStart, segmentStart);

  // Calculate confidence based on sample count
  const confidence = calculateSegmentConfidence(commute.samples.length, 1.0);

  return {
    sourceId,
    start: segmentStart,
    end: segmentEnd,
    placeId: null, // Commutes don't have a single place
    placeLabel: null,
    latitude: centroid.latitude,
    longitude: centroid.longitude,
    sampleCount: commute.samples.length,
    confidence,
    meta: {
      kind: "commute",
      place_id: null,
      place_label: null,
      sample_count: commute.samples.length,
      confidence,
      intent: "commute",
      destination_place_id: commute.toPlace?.id ?? null,
      destination_place_label: commute.toPlace?.label ?? null,
      distance_m: commute.distanceM,
    },
  };
}

/**
 * Apply travel annotations from short commutes to the following segment.
 * Modifies the segments array in place.
 */
export function applyTravelAnnotations(
  segments: LocationSegment[],
  commutes: CommuteDetectionResult[],
): void {
  // For each short commute (not long enough for its own segment),
  // find the next segment and add the travel annotation
  for (const commute of commutes) {
    if (!commute.isCommute || commute.isLongCommute || !commute.travelAnnotation) {
      continue;
    }

    if (commute.samples.length === 0) continue;

    // Find the end time of this commute
    const commuteEndTime = new Date(
      commute.samples[commute.samples.length - 1].recorded_at,
    ).getTime();

    // Find the next segment that starts after or near this commute end
    let bestMatch: LocationSegment | null = null;
    let bestGap = Infinity;

    for (const segment of segments) {
      const segmentStart = segment.start.getTime();
      const gap = segmentStart - commuteEndTime;

      // Look for segments starting after the commute (within 5 min)
      if (gap >= 0 && gap < 5 * 60 * 1000 && gap < bestGap) {
        bestMatch = segment;
        bestGap = gap;
      }
    }

    // Apply the annotation
    if (bestMatch) {
      bestMatch.meta.travel_annotation = commute.travelAnnotation;
    }
  }
}

/**
 * Process location segments with commute detection.
 * This function:
 * 1. Identifies gaps between location segments that might be commutes
 * 2. Detects commutes in those gaps
 * 3. For long commutes (>= 10 min), creates commute segments
 * 4. For short commutes (< 10 min), adds travel annotation to next segment
 *
 * @param segments - Location segments from generateLocationSegments
 * @param locationSamples - All location samples for commute analysis
 * @param userPlaces - User's labeled places
 * @param windowStart - Window start time for source ID generation
 * @returns Array of segments including any detected commute segments
 */
export function processSegmentsWithCommutes(
  segments: LocationSegment[],
  locationSamples: EvidenceLocationSample[],
  userPlaces: UserPlaceRow[],
  windowStart: Date,
): LocationSegment[] {
  if (segments.length === 0) {
    // If no segments but we have samples, check if entire window is a commute
    if (locationSamples.length >= 2) {
      const sortedSamples = [...locationSamples].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );
      const startTime = new Date(sortedSamples[0].recorded_at);
      const endTime = new Date(sortedSamples[sortedSamples.length - 1].recorded_at);

      const commute = detectCommute(locationSamples, startTime, endTime, userPlaces);
      if (commute.isCommute && commute.isLongCommute) {
        const commuteSegment = createCommuteSegment(commute, windowStart);
        if (commuteSegment) {
          return [commuteSegment];
        }
      }
    }
    return segments;
  }

  // Sort segments by start time
  const sortedSegments = [...segments].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const result: LocationSegment[] = [];
  const detectedCommutes: CommuteDetectionResult[] = [];

  // Check for commutes in gaps between segments
  for (let i = 0; i < sortedSegments.length; i++) {
    const currentSegment = sortedSegments[i];

    if (i === 0) {
      // Check for commute before first segment
      const firstSampleTime = locationSamples.length > 0
        ? Math.min(...locationSamples.map((s) => new Date(s.recorded_at).getTime()))
        : currentSegment.start.getTime();

      if (currentSegment.start.getTime() - firstSampleTime > 60 * 1000) {
        const commute = detectCommute(
          locationSamples,
          new Date(firstSampleTime),
          currentSegment.start,
          userPlaces,
        );
        if (commute.isCommute) {
          detectedCommutes.push(commute);
          if (commute.isLongCommute) {
            const commuteSegment = createCommuteSegment(commute, windowStart);
            if (commuteSegment) {
              result.push(commuteSegment);
            }
          }
        }
      }
    }

    result.push(currentSegment);

    // Check for commute after this segment (gap to next segment)
    if (i < sortedSegments.length - 1) {
      const nextSegment = sortedSegments[i + 1];
      const gapStart = currentSegment.end;
      const gapEnd = nextSegment.start;
      const gapMs = gapEnd.getTime() - gapStart.getTime();

      // Only check for commute if there's a meaningful gap (> 1 min)
      if (gapMs > 60 * 1000) {
        const commute = detectCommute(locationSamples, gapStart, gapEnd, userPlaces);
        if (commute.isCommute) {
          detectedCommutes.push(commute);
          if (commute.isLongCommute) {
            const commuteSegment = createCommuteSegment(commute, windowStart);
            if (commuteSegment) {
              result.push(commuteSegment);
            }
          }
        }
      }
    }
  }

  // Apply travel annotations from short commutes
  applyTravelAnnotations(result, detectedCommutes);

  // Sort final result by start time
  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ============================================================================
// Sessionization
// ============================================================================

/**
 * A session block representing a contiguous block of time at a place
 * with classified intent based on screen-time during that period.
 */
export interface SessionBlock {
  /** Deterministic source ID for reconciliation */
  sourceId: string;
  /** Session title: '[Place] - [Intent]' */
  title: string;
  /** Start timestamp of this session */
  start: Date;
  /** End timestamp of this session */
  end: Date;
  /** Place ID if known */
  placeId: string | null;
  /** Place label if known */
  placeLabel: string | null;
  /** Classified intent for this session */
  intent: Intent;
  /** Intent classification result with reasoning */
  intentClassification: IntentClassificationResult;
  /** IDs of child events (granular screen-time/location events) within this session */
  childEventIds: string[];
  /** Confidence score 0-1 based on location data quality */
  confidence: number;
  /** True if the location label is fuzzy (low confidence, uses "Near [Area]" format) */
  fuzzyLocation: boolean;
  /** Metadata for event creation */
  meta: {
    kind: "session_block";
    place_id: string | null;
    place_label: string | null;
    intent: Intent;
    children: string[];
    confidence: number;
    /** Summary of top apps used in this session */
    summary?: Array<{ label: string; seconds: number }>;
    /** Full app usage summary for this session */
    app_summary?: Array<{ app_id: string; seconds: number }>;
    /** Human-readable reasoning for intent classification */
    intent_reasoning?: string;
    /** True if this session occurred during scheduled sleep time */
    during_scheduled_sleep?: boolean;
    /** Latitude centroid for location (used for adding new places) */
    latitude?: number | null;
    /** Longitude centroid for location (used for adding new places) */
    longitude?: number | null;
    /** True if the location label is fuzzy (low confidence, uses "Near [Area]" format) */
    fuzzy_location?: boolean;
  };
}

/**
 * Input event for sessionization. Can be either:
 * - ReconciliationEvent (from database)
 * - DerivedEvent (from evidence processing)
 * - A generic event with required fields
 */
export interface SessionizableEvent {
  /** Event ID (for child linking) */
  id?: string;
  /** Source ID (for derived events without database IDs) */
  sourceId?: string;
  /** Event title */
  title: string;
  /** Start time */
  scheduledStart: Date;
  /** End time */
  scheduledEnd: Date;
  /** Event metadata */
  meta: Record<string, unknown>;
}

/**
 * Generate a deterministic source ID for a session block.
 * Format: session:{windowStartMs}:{placeId}:{sessionStartMs}
 */
function generateSessionSourceId(
  windowStart: Date,
  placeId: string | null,
  sessionStart: Date,
): string {
  const windowStartMs = windowStart.getTime();
  const sessionStartMs = sessionStart.getTime();
  const placeIdPart = placeId ?? "unknown";
  return `session:${windowStartMs}:${placeIdPart}:${sessionStartMs}`;
}

/**
 * Extract place_id from an event's metadata.
 */
function getEventPlaceId(event: SessionizableEvent): string | null {
  const placeId = event.meta?.place_id;
  if (typeof placeId === "string" && placeId.trim().length > 0) {
    return placeId.trim();
  }
  return null;
}

/**
 * Extract place_label from an event's metadata.
 */
function getEventPlaceLabel(event: SessionizableEvent): string | null {
  const placeLabel = event.meta?.place_label;
  if (typeof placeLabel === "string" && placeLabel.trim().length > 0) {
    return placeLabel.trim();
  }
  return null;
}

/**
 * Get the event identifier (id or sourceId) for child linking.
 */
function getEventIdentifier(event: SessionizableEvent): string {
  return event.id ?? event.sourceId ?? `event:${event.scheduledStart.getTime()}`;
}

/**
 * Check if an event is a screen-time event (has app_id in meta).
 */
function isScreenTimeEvent(event: SessionizableEvent): boolean {
  const appId = event.meta?.app_id;
  return typeof appId === "string" && appId.trim().length > 0;
}

/**
 * Check if an event is a commute event.
 */
function isEventCommute(event: SessionizableEvent): boolean {
  return event.meta?.kind === "commute";
}

/**
 * Check if two events have the same location context.
 * Returns true if:
 * 1. Same place_id (including both null for unknown)
 * 2. Both are commutes
 */
function haveSameLocationContext(
  event1: SessionizableEvent,
  event2: SessionizableEvent,
): boolean {
  const place1 = getEventPlaceId(event1);
  const place2 = getEventPlaceId(event2);

  // Commute events are their own location context
  if (isEventCommute(event1) || isEventCommute(event2)) {
    // Commutes can only group with other events of same commute
    // For now, commutes don't merge with other events
    return isEventCommute(event1) && isEventCommute(event2);
  }

  // Same place_id (both can be null for unknown locations)
  return place1 === place2;
}

/**
 * Build app usage summary from child events.
 * Aggregates screen-time by app_id for intent classification.
 */
function buildAppSummary(events: SessionizableEvent[]): AppSummary[] {
  const appDurations = new Map<string, number>();

  for (const event of events) {
    if (!isScreenTimeEvent(event)) continue;

    const appId = event.meta?.app_id as string;
    const durationMs =
      event.scheduledEnd.getTime() - event.scheduledStart.getTime();
    const durationSec = Math.round(durationMs / 1000);

    const existing = appDurations.get(appId) ?? 0;
    appDurations.set(appId, existing + durationSec);
  }

  // Convert to AppSummary array sorted by duration descending
  return Array.from(appDurations.entries())
    .map(([appId, seconds]) => ({ appId, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

/**
 * Format intent for display in session title.
 * Capitalizes and cleans up the intent string.
 */
function formatIntentForTitle(intent: Intent): string {
  switch (intent) {
    case "work":
      return "Work";
    case "leisure":
      return "Leisure";
    case "distracted_work":
      return "Distracted Work";
    case "offline":
      return "Offline";
    case "mixed":
      return "Mixed";
    case "sleep":
      return "Sleep";
    default:
      return "Unknown";
  }
}

/**
 * Generate session title: '[Place] - [Intent]'
 */
function generateSessionTitle(
  placeLabel: string | null,
  intent: Intent,
  isCommute: boolean,
): string {
  if (isCommute) {
    return "Commute";
  }

  const placePart = placeLabel ?? "Unknown Location";
  const intentPart = formatIntentForTitle(intent);
  return `${placePart} - ${intentPart}`;
}

/**
 * Group events by location to form session boundaries.
 * A new session starts when:
 * 1. Place changes (different place_id)
 * 2. There's a commute event (acts as its own session)
 */
function groupEventsByLocation(
  events: SessionizableEvent[],
): SessionizableEvent[][] {
  if (events.length === 0) return [];

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime(),
  );

  const groups: SessionizableEvent[][] = [];
  let currentGroup: SessionizableEvent[] = [];

  for (const event of sortedEvents) {
    if (currentGroup.length === 0) {
      currentGroup.push(event);
      continue;
    }

    const lastEvent = currentGroup[currentGroup.length - 1];

    // Check if we should start a new group
    const shouldStartNewGroup =
      // Commute events are their own group
      isEventCommute(event) ||
      isEventCommute(lastEvent) ||
      // Place changed
      !haveSameLocationContext(lastEvent, event);

    if (shouldStartNewGroup) {
      groups.push(currentGroup);
      currentGroup = [event];
    } else {
      currentGroup.push(event);
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Check if a location should be marked as fuzzy based on confidence.
 * A location is fuzzy when confidence is below the threshold (70%).
 */
function shouldUseFuzzyLocation(
  confidence: number,
  placeId: string | null
): boolean {
  // Only mark as fuzzy if confidence is below threshold
  // User-defined places (with place_id) should not be marked fuzzy
  // as the user explicitly defined them
  return confidence < FUZZY_LOCATION_CONFIDENCE_THRESHOLD && placeId === null;
}

/**
 * Create a session block from a group of events.
 */
function createSessionBlock(
  events: SessionizableEvent[],
  windowStart: Date,
  userOverrides?: UserAppCategoryOverrides | null,
): SessionBlock | null {
  if (events.length === 0) return null;

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime(),
  );

  // Determine session boundaries
  const sessionStart = sortedEvents[0].scheduledStart;
  const sessionEnd = sortedEvents[sortedEvents.length - 1].scheduledEnd;

  // Get location info from the first location event, or first event
  let placeId: string | null = null;
  let placeLabel: string | null = null;
  let confidence = 0.5; // Default confidence
  let latitude: number | null = null;
  let longitude: number | null = null;

  // Find the first event with location info
  for (const event of sortedEvents) {
    const eventPlaceId = getEventPlaceId(event);
    const eventPlaceLabel = getEventPlaceLabel(event);
    const eventConfidence = event.meta?.confidence;
    const eventLat = event.meta?.latitude;
    const eventLon = event.meta?.longitude;

    if (eventPlaceId !== null || eventPlaceLabel !== null) {
      placeId = eventPlaceId;
      placeLabel = eventPlaceLabel;
      if (typeof eventConfidence === "number") {
        confidence = eventConfidence;
      }
      // Extract coordinates for "Add Place" functionality
      if (typeof eventLat === "number" && typeof eventLon === "number") {
        latitude = eventLat;
        longitude = eventLon;
      }
      break;
    }
    // Also capture coordinates from events without place info (unknown location)
    if (latitude === null && typeof eventLat === "number" && typeof eventLon === "number") {
      latitude = eventLat;
      longitude = eventLon;
    }
  }

  // Check if this is a commute session
  const isCommute = sortedEvents.length === 1 && isEventCommute(sortedEvents[0]);

  // Determine if this location should be marked as fuzzy
  const isFuzzyLocation = !isCommute && shouldUseFuzzyLocation(confidence, placeId);

  // Build app summary from screen-time events
  const appSummary = buildAppSummary(sortedEvents);

  // Classify intent based on app usage
  const intentClassification = classifyIntent(appSummary, userOverrides);
  const intent = isCommute ? "offline" : intentClassification.intent;

  // Build top 3 app summary for display
  const summary = appSummary.slice(0, 3).map((app) => ({
    label: app.appId,
    seconds: app.seconds,
  }));
  const fullSummary =
    appSummary.length > 0
      ? appSummary.map((app) => ({ app_id: app.appId, seconds: app.seconds }))
      : undefined;

  // Collect child event IDs
  const childEventIds = sortedEvents.map(getEventIdentifier);

  // Generate source ID
  const sourceId = generateSessionSourceId(windowStart, placeId, sessionStart);

  // Generate title
  const title = generateSessionTitle(placeLabel, intent, isCommute);

  return {
    sourceId,
    title,
    start: sessionStart,
    end: sessionEnd,
    placeId,
    placeLabel,
    intent,
    intentClassification,
    childEventIds,
    confidence,
    fuzzyLocation: isFuzzyLocation,
    meta: {
      kind: "session_block",
      place_id: placeId,
      place_label: placeLabel,
      intent,
      children: childEventIds,
      confidence,
      summary: summary.length > 0 ? summary : undefined,
      app_summary: fullSummary,
      intent_reasoning: intentClassification.reasoning,
      // Include coordinates for "Add Place" functionality at unknown locations
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      // Mark fuzzy location for UI styling
      fuzzy_location: isFuzzyLocation || undefined,
    },
  };
}

/**
 * Convert a SessionBlock to a DerivedEvent for reconciliation.
 */
export function sessionBlockToDerivedEvent(session: SessionBlock): DerivedEvent {
  return {
    sourceId: session.sourceId,
    title: session.title,
    scheduledStart: session.start,
    scheduledEnd: session.end,
    meta: {
      ...session.meta,
      source: "derived",
      source_id: session.sourceId,
    },
  };
}

/** Type for the fuzzy label getter function */
export type FuzzyLabelGetter = (latitude: number, longitude: number) => Promise<string | null>;

/**
 * Enhance session blocks with fuzzy location labels using reverse geocoding.
 * This function asynchronously updates the place_label for sessions that:
 * 1. Have fuzzy_location = true
 * 2. Have coordinates available
 * 3. Don't already have a place_label (unknown location)
 *
 * @param sessions - Array of SessionBlock objects to enhance
 * @param getFuzzyLabel - Function to get a fuzzy label from coordinates (import from google-places.ts)
 * @returns Array of SessionBlock objects with fuzzy labels applied where appropriate
 *
 * @example
 * import { getFuzzyLocationLabel } from './google-places';
 * const enhanced = await applyFuzzyLocationLabels(sessions, getFuzzyLocationLabel);
 */
export async function applyFuzzyLocationLabels(
  sessions: SessionBlock[],
  getFuzzyLabel?: FuzzyLabelGetter | null
): Promise<SessionBlock[]> {
  // If no label getter provided, just return sessions unchanged
  if (!getFuzzyLabel) {
    return sessions;
  }

  const enhancedSessions: SessionBlock[] = [];

  for (const session of sessions) {
    // Skip if not fuzzy or already has a place label
    if (!session.fuzzyLocation || session.placeLabel !== null) {
      enhancedSessions.push(session);
      continue;
    }

    // Skip if no coordinates available
    const lat = session.meta.latitude;
    const lon = session.meta.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") {
      enhancedSessions.push(session);
      continue;
    }

    // Try to get a fuzzy label via reverse geocoding
    try {
      const fuzzyLabel = await getFuzzyLabel(lat, lon);

      if (fuzzyLabel) {
        // Update the session with the fuzzy label
        const updatedSession: SessionBlock = {
          ...session,
          placeLabel: fuzzyLabel,
          title: generateSessionTitle(fuzzyLabel, session.intent, false),
          meta: {
            ...session.meta,
            place_label: fuzzyLabel,
          },
        };
        enhancedSessions.push(updatedSession);
      } else {
        // No fuzzy label available, keep original
        enhancedSessions.push(session);
      }
    } catch (error) {
      // On error, keep original session
      if (__DEV__) {
        console.warn("[applyFuzzyLocationLabels] Error getting fuzzy label:", error);
      }
      enhancedSessions.push(session);
    }
  }

  return enhancedSessions;
}

/**
 * Merge sessions that have small gaps (< 5 minutes) between them.
 * The gap is absorbed into the preceding session block.
 *
 * @param sessions - Array of session blocks to merge
 * @param windowStart - Window start time for sourceId regeneration
 * @param userOverrides - User category overrides for re-classification
 * @returns Array of sessions with micro-gaps merged
 */
export function mergeSessionMicroGaps(
  sessions: SessionBlock[],
  windowStart: Date,
  userOverrides?: UserAppCategoryOverrides | null,
): SessionBlock[] {
  if (sessions.length <= 1) {
    return sessions;
  }

  // Sort sessions by start time
  const sortedSessions = [...sessions].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const merged: SessionBlock[] = [];
  let current = sortedSessions[0];

  for (let i = 1; i < sortedSessions.length; i++) {
    const next = sortedSessions[i];
    const gap = next.start.getTime() - current.end.getTime();

    // Check if gap is small enough to merge AND sessions are at the same place
    const canMerge =
      gap > 0 &&
      gap <= MAX_MICRO_GAP_MS &&
      current.placeId === next.placeId &&
      !isSessionCommute(current) &&
      !isSessionCommute(next);

    if (canMerge) {
      // Merge by extending current session to include next
      current = mergeSessionBlocks(current, next, windowStart, userOverrides);
    } else {
      // Cannot merge - push current and move to next
      merged.push(current);
      current = next;
    }
  }

  // Don't forget the last session
  merged.push(current);

  return merged;
}

/**
 * Check if a session is a commute session.
 */
function isSessionCommute(session: SessionBlock): boolean {
  return session.meta.kind === "session_block" && session.meta.intent === "offline" &&
    session.title === "Commute";
}

/**
 * Merge two session blocks into one.
 * Combines child events and recalculates intent.
 */
function mergeSessionBlocks(
  first: SessionBlock,
  second: SessionBlock,
  windowStart: Date,
  userOverrides?: UserAppCategoryOverrides | null,
): SessionBlock {
  // Combine child event IDs
  const combinedChildIds = [...first.childEventIds, ...second.childEventIds];

  // Combine app summaries for re-classification
  const combinedSummary = combineAppSummaries(first, second);

  // Re-classify intent with combined data
  const intentClassification = classifyIntent(combinedSummary, userOverrides);

  // Calculate new confidence (average weighted by duration)
  const firstDuration = first.end.getTime() - first.start.getTime();
  const secondDuration = second.end.getTime() - second.start.getTime();
  const totalDuration = firstDuration + secondDuration;
  const newConfidence =
    totalDuration > 0
      ? (first.confidence * firstDuration + second.confidence * secondDuration) /
        totalDuration
      : first.confidence;

  // Use place info from first session (they should be the same)
  const placeId = first.placeId;
  const placeLabel = first.placeLabel;

  // Generate new source ID
  const sourceId = generateSessionSourceId(windowStart, placeId, first.start);

  // Generate new title
  const title = generateSessionTitle(placeLabel, intentClassification.intent, false);

  // Build top 3 app summary for display
  const summary = combinedSummary.slice(0, 3).map((app) => ({
    label: app.appId,
    seconds: app.seconds,
  }));

  // Determine fuzzy location (merge inherits fuzzy status if either was fuzzy)
  const isFuzzyLocation = first.fuzzyLocation || second.fuzzyLocation;

  return {
    sourceId,
    title,
    start: first.start,
    end: second.end, // Extended to include gap and second session
    placeId,
    placeLabel,
    intent: intentClassification.intent,
    intentClassification,
    childEventIds: combinedChildIds,
    confidence: newConfidence,
    fuzzyLocation: isFuzzyLocation,
    meta: {
      kind: "session_block",
      place_id: placeId,
      place_label: placeLabel,
      intent: intentClassification.intent,
      children: combinedChildIds,
      confidence: newConfidence,
      summary: summary.length > 0 ? summary : undefined,
      intent_reasoning: intentClassification.reasoning,
      fuzzy_location: isFuzzyLocation || undefined,
    },
  };
}

/**
 * Combine app summaries from two sessions for re-classification.
 */
function combineAppSummaries(
  first: SessionBlock,
  second: SessionBlock,
): AppSummary[] {
  const appDurations = new Map<string, number>();

  // Add from first session's summary
  if (first.meta.summary) {
    for (const app of first.meta.summary) {
      const existing = appDurations.get(app.label) ?? 0;
      appDurations.set(app.label, existing + app.seconds);
    }
  }

  // Add from second session's summary
  if (second.meta.summary) {
    for (const app of second.meta.summary) {
      const existing = appDurations.get(app.label) ?? 0;
      appDurations.set(app.label, existing + app.seconds);
    }
  }

  // Convert to AppSummary array sorted by duration descending
  return Array.from(appDurations.entries())
    .map(([appId, seconds]) => ({ appId, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

/**
 * Absorb short sessions (< 10 minutes) into adjacent longer sessions.
 * Short sessions are merged into the preceding session if possible,
 * otherwise into the following session.
 *
 * @param sessions - Array of session blocks to process
 * @param windowStart - Window start time for sourceId regeneration
 * @param userOverrides - User category overrides for re-classification
 * @returns Array of sessions with short sessions absorbed
 */
export function absorbShortSessions(
  sessions: SessionBlock[],
  windowStart: Date,
  userOverrides?: UserAppCategoryOverrides | null,
): SessionBlock[] {
  if (sessions.length <= 1) {
    return sessions;
  }

  // Sort sessions by start time
  let workingSessions = [...sessions].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // Keep iterating until no more short sessions can be absorbed
  let changed = true;
  while (changed) {
    changed = false;
    const result: SessionBlock[] = [];
    let skipNext = false;

    for (let i = 0; i < workingSessions.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }

      const current = workingSessions[i];
      const duration = current.end.getTime() - current.start.getTime();
      const isShort = duration < MIN_SESSION_DURATION_MS;

      // Commutes are never absorbed regardless of duration
      if (isSessionCommute(current)) {
        result.push(current);
        continue;
      }

      if (!isShort) {
        result.push(current);
        continue;
      }

      // Current session is short - try to absorb it
      const prev = result.length > 0 ? result[result.length - 1] : null;
      const next = i < workingSessions.length - 1 ? workingSessions[i + 1] : null;

      // Can we merge into previous?
      const canMergeIntoPrev =
        prev !== null &&
        prev.placeId === current.placeId &&
        !isSessionCommute(prev);

      // Can we merge into next?
      const canMergeIntoNext =
        next !== null &&
        current.placeId === next.placeId &&
        !isSessionCommute(next);

      if (canMergeIntoPrev) {
        // Merge into previous
        const merged = mergeSessionBlocks(prev, current, windowStart, userOverrides);
        result[result.length - 1] = merged;
        changed = true;
      } else if (canMergeIntoNext) {
        // Merge into next
        const merged = mergeSessionBlocks(current, next, windowStart, userOverrides);
        result.push(merged);
        skipNext = true;
        changed = true;
      } else {
        // Cannot merge - keep the short session
        result.push(current);
      }
    }

    workingSessions = result;
  }

  return workingSessions;
}

/**
 * Sessionize events within a time window.
 *
 * This function groups granular events (screen-time, location blocks) into
 * place-anchored session blocks. Session boundaries are created when:
 * 1. The place changes (different place_id)
 * 2. A commute event occurs (commutes are their own sessions)
 *
 * After initial grouping, the function:
 * 1. Merges sessions with small gaps (< 5 minutes) at the same place
 * 2. Absorbs short sessions (< 10 minutes) into adjacent longer sessions
 *
 * Each session block:
 * - Has meta.kind = 'session_block'
 * - Links to child events via meta.children array
 * - Has title format: '[Place] - [Intent]' (e.g., 'Cafe - Work')
 * - Has classified intent based on screen-time during the session
 *
 * @param userId - The user's ID (for potential future database queries)
 * @param windowStart - Start of the ingestion window
 * @param windowEnd - End of the ingestion window
 * @param events - Granular events to sessionize (screen-time, location, etc.)
 * @param userOverrides - Optional user category overrides for intent classification
 * @returns Array of session blocks
 */
export function sessionizeWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  events: SessionizableEvent[],
  userOverrides?: UserAppCategoryOverrides | null,
): SessionBlock[] {
  // Filter events to those within the window
  const windowEvents = events.filter((event) => {
    const eventStart = event.scheduledStart.getTime();
    const eventEnd = event.scheduledEnd.getTime();
    const winStart = windowStart.getTime();
    const winEnd = windowEnd.getTime();

    // Event overlaps with window
    return eventStart < winEnd && eventEnd > winStart;
  });

  if (windowEvents.length === 0) {
    return [];
  }

  // Group events by location (place changes = session boundary)
  const eventGroups = groupEventsByLocation(windowEvents);

  // Create session blocks from groups
  let sessions: SessionBlock[] = [];
  for (const group of eventGroups) {
    const session = createSessionBlock(group, windowStart, userOverrides);
    if (session) {
      sessions.push(session);
    }
  }

  // Sort sessions by start time
  sessions = sessions.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge sessions with small gaps (< 5 minutes) at the same place
  sessions = mergeSessionMicroGaps(sessions, windowStart, userOverrides);

  // Absorb short sessions (< 10 minutes) into adjacent longer sessions
  sessions = absorbShortSessions(sessions, windowStart, userOverrides);

  return sessions;
}

// ============================================================================
// Sleep Detection
// ============================================================================

/**
 * Check if a place is likely the user's home based on the label.
 * Uses case-insensitive matching against common home-related labels.
 */
export function isHomePlace(placeLabel: string | null): boolean {
  if (!placeLabel) return false;
  const normalized = placeLabel.toLowerCase().trim();
  return HOME_PLACE_LABELS.some(
    (homeLabel) =>
      normalized === homeLabel ||
      normalized.includes(homeLabel) ||
      homeLabel.includes(normalized),
  );
}

/**
 * Parse a time string in HH:MM format to hours and minutes.
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Check if a time falls within the scheduled sleep window.
 * Handles overnight sleep (e.g., 22:00 to 07:00).
 *
 * @param timestamp - The time to check
 * @param schedule - The sleep schedule
 * @returns true if the timestamp falls within scheduled sleep time
 */
export function isWithinSleepSchedule(
  timestamp: Date,
  schedule: SleepSchedule,
): boolean {
  const bedtime = parseTimeString(schedule.bedtime);
  const wakeTime = parseTimeString(schedule.wakeTime);

  if (!bedtime || !wakeTime) {
    // Invalid schedule - fall back to default
    return isWithinSleepSchedule(timestamp, DEFAULT_SLEEP_SCHEDULE);
  }

  // Use UTC hours/minutes for consistency with ISO date strings
  const hours = timestamp.getUTCHours();
  const minutes = timestamp.getUTCMinutes();
  const timeMinutes = hours * 60 + minutes;
  const bedtimeMinutes = bedtime.hours * 60 + bedtime.minutes;
  const wakeTimeMinutes = wakeTime.hours * 60 + wakeTime.minutes;

  // Handle overnight sleep (bedtime > wake time)
  if (bedtimeMinutes > wakeTimeMinutes) {
    // Overnight: e.g., 22:00 to 07:00
    // Sleep time is from bedtime to midnight OR from midnight to wake time
    return timeMinutes >= bedtimeMinutes || timeMinutes < wakeTimeMinutes;
  } else {
    // Same day: e.g., 01:00 to 09:00 (unusual but handle it)
    return timeMinutes >= bedtimeMinutes && timeMinutes < wakeTimeMinutes;
  }
}

/**
 * Generate a deterministic source ID for a sleep session block.
 * Format: sleep:{windowStartMs}:{placeId}:{sessionStartMs}
 */
function generateSleepSourceId(
  windowStart: Date,
  placeId: string | null,
  sessionStart: Date,
): string {
  const windowStartMs = windowStart.getTime();
  const sessionStartMs = sessionStart.getTime();
  const placeIdPart = placeId ?? "unknown";
  return `sleep:${windowStartMs}:${placeIdPart}:${sessionStartMs}`;
}

/**
 * Create a sleep session block.
 *
 * @param start - Sleep start time
 * @param end - Sleep end time
 * @param placeId - Place ID (typically home)
 * @param placeLabel - Place label (typically "Home")
 * @param windowStart - Window start for source ID generation
 * @param childEventIds - IDs of child events (if any)
 * @param confidence - Confidence score
 */
export function createSleepSession(
  start: Date,
  end: Date,
  placeId: string | null,
  placeLabel: string | null,
  windowStart: Date,
  childEventIds: string[] = [],
  confidence: number = 0.5,
): SessionBlock {
  const sourceId = generateSleepSourceId(windowStart, placeId, start);
  const displayLabel = placeLabel ?? "Home";
  const title = `${displayLabel} - Sleep`;

  const sleepIntentClassification: IntentClassificationResult = {
    intent: "sleep",
    breakdown: { work: 0, social: 0, entertainment: 0, comms: 0, utility: 0, ignore: 0 },
    totalSeconds: Math.round((end.getTime() - start.getTime()) / 1000),
    reasoning: "Detected as sleep session based on time and location",
  };

  // Sleep sessions at home are not fuzzy (we know it's at home)
  // Only mark as fuzzy if we don't have a place
  const isFuzzyLocation = placeId === null && confidence < FUZZY_LOCATION_CONFIDENCE_THRESHOLD;

  return {
    sourceId,
    title,
    start,
    end,
    placeId,
    placeLabel,
    intent: "sleep",
    intentClassification: sleepIntentClassification,
    childEventIds,
    confidence,
    fuzzyLocation: isFuzzyLocation,
    meta: {
      kind: "session_block",
      place_id: placeId,
      place_label: placeLabel,
      intent: "sleep",
      children: childEventIds,
      confidence,
      fuzzy_location: isFuzzyLocation || undefined,
    },
  };
}

/**
 * Detect sleep sessions in a time range.
 *
 * This function detects overnight gaps at home as sleep sessions.
 * If screen-time is detected during scheduled sleep, it splits the sleep
 * into multiple sessions with the screen-time interruption in between.
 *
 * @param userId - User ID
 * @param windowStart - Start of the time range
 * @param windowEnd - End of the time range
 * @param events - Existing events in the window
 * @param homePlace - User's home place (placeId and placeLabel)
 * @param schedule - User's sleep schedule (optional, uses default if not provided)
 * @returns Sleep detection result with sleep sessions and screen-time interruptions
 */
export function detectSleepSessions(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  events: SessionizableEvent[],
  homePlace: { placeId: string | null; placeLabel: string | null } | null,
  schedule?: SleepSchedule | null,
): SleepDetectionResult {
  const sleepSchedule = schedule ?? DEFAULT_SLEEP_SCHEDULE;
  const result: SleepDetectionResult = {
    isSleep: false,
    sleepSessions: [],
    screenTimeInterruptions: [],
  };

  // If no home place is defined, we can't reliably detect sleep
  if (!homePlace) {
    return result;
  }

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime(),
  );

  // Find events at home during scheduled sleep time
  const eventsAtHome = sortedEvents.filter((event) => {
    const eventPlaceId = getEventPlaceId(event);
    const eventPlaceLabel = getEventPlaceLabel(event);

    // Check if at home
    const isAtHome =
      (homePlace.placeId && eventPlaceId === homePlace.placeId) ||
      (homePlace.placeLabel && isHomePlace(eventPlaceLabel));

    return isAtHome;
  });

  // Find screen-time events during scheduled sleep
  const screenTimeDuringSleep = sortedEvents.filter((event) => {
    if (!isScreenTimeEvent(event)) return false;

    // Check if event is during scheduled sleep time
    const eventMidpoint = new Date(
      (event.scheduledStart.getTime() + event.scheduledEnd.getTime()) / 2,
    );
    return isWithinSleepSchedule(eventMidpoint, sleepSchedule);
  });

  // Determine the sleep window
  // Look for gaps at home during typical sleep hours
  const windowStartTime = windowStart.getTime();
  const windowEndTime = windowEnd.getTime();
  const windowDurationMs = windowEndTime - windowStartTime;

  // Check if this window is during scheduled sleep time
  const windowMidpoint = new Date((windowStartTime + windowEndTime) / 2);
  const isDuringSleepTime = isWithinSleepSchedule(windowMidpoint, sleepSchedule);

  if (!isDuringSleepTime) {
    return result;
  }

  // Check if we have a long enough gap at home to consider it sleep
  // Calculate total screen-time during the window
  let totalScreenTimeMs = 0;
  for (const event of screenTimeDuringSleep) {
    const eventStart = Math.max(event.scheduledStart.getTime(), windowStartTime);
    const eventEnd = Math.min(event.scheduledEnd.getTime(), windowEndTime);
    if (eventEnd > eventStart) {
      totalScreenTimeMs += eventEnd - eventStart;
    }
  }

  // The gap (potential sleep time) is the window minus screen-time
  const potentialSleepMs = windowDurationMs - totalScreenTimeMs;

  // If potential sleep time is less than minimum, not a sleep session
  if (potentialSleepMs < MIN_OVERNIGHT_GAP_MS) {
    return result;
  }

  result.isSleep = true;

  // If no screen-time during sleep, create a single sleep session
  if (screenTimeDuringSleep.length === 0) {
    const sleepSession = createSleepSession(
      windowStart,
      windowEnd,
      homePlace.placeId,
      homePlace.placeLabel,
      windowStart,
      [],
      0.7, // Higher confidence for uninterrupted sleep
    );
    result.sleepSessions.push(sleepSession);
    return result;
  }

  // Split sleep around screen-time interruptions
  // Sort screen-time events by start time
  const sortedScreenTime = [...screenTimeDuringSleep].sort(
    (a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime(),
  );

  // Track screen-time interruptions
  for (const event of sortedScreenTime) {
    result.screenTimeInterruptions.push({
      ...event,
      meta: {
        ...event.meta,
        during_scheduled_sleep: true,
      },
    });
  }

  // Create sleep sessions around interruptions
  let currentStart = windowStart;

  for (const screenTimeEvent of sortedScreenTime) {
    const eventStart = screenTimeEvent.scheduledStart;
    const eventEnd = screenTimeEvent.scheduledEnd;

    // Create sleep session before this screen-time if gap is significant
    const gapBeforeMs = eventStart.getTime() - currentStart.getTime();
    if (gapBeforeMs >= MIN_SESSION_DURATION_MS) {
      const sleepBefore = createSleepSession(
        currentStart,
        eventStart,
        homePlace.placeId,
        homePlace.placeLabel,
        windowStart,
        [],
        0.5, // Lower confidence for interrupted sleep
      );
      result.sleepSessions.push(sleepBefore);
    }

    // Move current start past this screen-time event
    currentStart = eventEnd;
  }

  // Create final sleep session after last screen-time if gap is significant
  const finalGapMs = windowEnd.getTime() - currentStart.getTime();
  if (finalGapMs >= MIN_SESSION_DURATION_MS) {
    const sleepAfter = createSleepSession(
      currentStart,
      windowEnd,
      homePlace.placeId,
      homePlace.placeLabel,
      windowStart,
      [],
      0.5, // Lower confidence for interrupted sleep
    );
    result.sleepSessions.push(sleepAfter);
  }

  return result;
}

/**
 * Apply sleep detection to sessionized events.
 *
 * This function takes existing sessions and:
 * 1. Identifies overnight gaps at home that should be sleep
 * 2. Converts those gaps to sleep sessions
 * 3. Marks screen-time during sleep with meta.during_scheduled_sleep = true
 *
 * @param userId - User ID
 * @param sessions - Existing session blocks
 * @param windowStart - Start of the time range
 * @param windowEnd - End of the time range
 * @param homePlace - User's home place
 * @param schedule - User's sleep schedule
 * @returns Updated sessions with sleep detection applied
 */
export function applySleepDetection(
  userId: string,
  sessions: SessionBlock[],
  windowStart: Date,
  windowEnd: Date,
  homePlace: { placeId: string | null; placeLabel: string | null } | null,
  schedule?: SleepSchedule | null,
): SessionBlock[] {
  if (!homePlace) {
    return sessions;
  }

  const sleepSchedule = schedule ?? DEFAULT_SLEEP_SCHEDULE;
  const result: SessionBlock[] = [];

  // Sort sessions by start time
  const sortedSessions = [...sessions].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // Process each session
  for (let i = 0; i < sortedSessions.length; i++) {
    const session = sortedSessions[i];

    // Check if this session is at home during scheduled sleep
    const isAtHome =
      (homePlace.placeId && session.placeId === homePlace.placeId) ||
      (homePlace.placeLabel && isHomePlace(session.placeLabel));

    const sessionMidpoint = new Date(
      (session.start.getTime() + session.end.getTime()) / 2,
    );
    const isDuringSleep = isWithinSleepSchedule(sessionMidpoint, sleepSchedule);

    // If session is already a sleep session, keep it
    if (session.intent === "sleep") {
      result.push(session);
      continue;
    }

    // If at home during sleep time and no screen-time (offline), convert to sleep
    if (isAtHome && isDuringSleep && session.intent === "offline") {
      const duration = session.end.getTime() - session.start.getTime();
      if (duration >= MIN_OVERNIGHT_GAP_MS) {
        // Convert to sleep session
        const sleepSession = createSleepSession(
          session.start,
          session.end,
          session.placeId,
          session.placeLabel,
          windowStart,
          session.childEventIds,
          session.confidence,
        );
        result.push(sleepSession);
        continue;
      }
    }

    // If at home during sleep time but has screen-time, mark it
    if (isAtHome && isDuringSleep && session.intent !== "offline") {
      // Mark session as during scheduled sleep
      result.push({
        ...session,
        meta: {
          ...session.meta,
          during_scheduled_sleep: true,
        },
      });
      continue;
    }

    // Otherwise, keep session as-is
    result.push(session);
  }

  return result;
}

/**
 * Find the user's home place from their labeled places.
 *
 * @param userPlaces - Array of user's labeled places
 * @returns The home place if found, null otherwise
 */
export function findHomePlace(
  userPlaces: Array<{ id: string; label: string; category?: string | null }>,
): { placeId: string; placeLabel: string } | null {
  // First, look for a place with "home" category
  const homeByCategory = userPlaces.find(
    (p) => p.category?.toLowerCase() === "home",
  );
  if (homeByCategory) {
    return { placeId: homeByCategory.id, placeLabel: homeByCategory.label };
  }

  // Fall back to looking for "Home" label
  const homeByLabel = userPlaces.find((p) => isHomePlace(p.label));
  if (homeByLabel) {
    return { placeId: homeByLabel.id, placeLabel: homeByLabel.label };
  }

  return null;
}

// ============================================================================
// Session Split
// ============================================================================

/**
 * Result of a session split operation.
 */
export interface SessionSplitResult {
  /** The first (earlier) session block after split */
  firstSession: SessionBlock;
  /** The second (later) session block after split */
  secondSession: SessionBlock;
  /** ID of the original session that was split (now soft-deleted) */
  originalSessionId: string;
}

/**
 * Generate a deterministic source ID for a user-created session block.
 * Format: user_session:{timestamp}:{placeId}:{sessionStartMs}
 */
function generateUserSessionSourceId(
  placeId: string | null,
  sessionStart: Date,
): string {
  const timestamp = Date.now();
  const sessionStartMs = sessionStart.getTime();
  const placeIdPart = placeId ?? "unknown";
  return `user_session:${timestamp}:${placeIdPart}:${sessionStartMs}`;
}

/**
 * Split a session block at the specified split point.
 *
 * This function:
 * 1. Creates two new session blocks from the original
 * 2. Redistributes child events to the appropriate new parent based on time
 * 3. Recalculates intent for each new block based on its child events
 * 4. Marks new blocks with meta.source = 'user' (protected from future ingestion)
 *
 * @param session - The session block to split (can be SessionBlock or ScheduledEvent with session meta)
 * @param splitPoint - The time point at which to split (must be between session start and end)
 * @param childEvents - Optional array of child events for redistributing (if not provided, uses session.childEventIds)
 * @param userOverrides - Optional user app category overrides for intent classification
 * @returns Result containing the two new session blocks
 * @throws Error if split point is outside session bounds
 */
export function splitSession(
  session: SessionBlock,
  splitPoint: Date,
  childEvents?: SessionizableEvent[],
  userOverrides?: UserAppCategoryOverrides | null,
): SessionSplitResult {
  const sessionStart = session.start;
  const sessionEnd = session.end;
  const splitTime = splitPoint.getTime();

  // Validate split point is within session bounds
  if (splitTime <= sessionStart.getTime()) {
    throw new Error("Split point must be after session start");
  }
  if (splitTime >= sessionEnd.getTime()) {
    throw new Error("Split point must be before session end");
  }

  // Redistribute child events based on their time relative to split point
  const firstChildIds: string[] = [];
  const secondChildIds: string[] = [];
  const firstChildEvents: SessionizableEvent[] = [];
  const secondChildEvents: SessionizableEvent[] = [];

  if (childEvents && childEvents.length > 0) {
    for (const event of childEvents) {
      const eventMidpoint =
        (event.scheduledStart.getTime() + event.scheduledEnd.getTime()) / 2;
      const eventId = getEventIdentifier(event);

      if (eventMidpoint < splitTime) {
        firstChildIds.push(eventId);
        firstChildEvents.push(event);
      } else {
        secondChildIds.push(eventId);
        secondChildEvents.push(event);
      }
    }
  } else {
    // If no child events provided, split the childEventIds list
    // Events before split point go to first session, after go to second
    // Since we don't have actual event times, we can't redistribute properly
    // In this case, all children go to first session
    firstChildIds.push(...session.childEventIds);
  }

  // Build app summaries for each new session
  const firstAppSummary = buildAppSummary(firstChildEvents);
  const secondAppSummary = buildAppSummary(secondChildEvents);

  // Classify intent for each new session
  const firstIntentClassification = classifyIntent(firstAppSummary, userOverrides);
  const secondIntentClassification = classifyIntent(secondAppSummary, userOverrides);

  // Use offline intent if no screen-time in the session
  const firstIntent = firstChildEvents.length === 0 || firstAppSummary.length === 0
    ? "offline"
    : firstIntentClassification.intent;
  const secondIntent = secondChildEvents.length === 0 || secondAppSummary.length === 0
    ? "offline"
    : secondIntentClassification.intent;

  // Build top 3 app summaries for display
  const firstSummary = firstAppSummary.slice(0, 3).map((app) => ({
    label: app.appId,
    seconds: app.seconds,
  }));
  const secondSummary = secondAppSummary.slice(0, 3).map((app) => ({
    label: app.appId,
    seconds: app.seconds,
  }));

  // Generate new source IDs
  const firstSourceId = generateUserSessionSourceId(session.placeId, sessionStart);
  const secondSourceId = generateUserSessionSourceId(session.placeId, splitPoint);

  // Generate titles
  const firstTitle = generateSessionTitle(session.placeLabel, firstIntent, false);
  const secondTitle = generateSessionTitle(session.placeLabel, secondIntent, false);

  // Inherit fuzzy location status from original session
  const isFuzzyLocation = session.fuzzyLocation;

  // Create first session block
  const firstSession: SessionBlock = {
    sourceId: firstSourceId,
    title: firstTitle,
    start: sessionStart,
    end: splitPoint,
    placeId: session.placeId,
    placeLabel: session.placeLabel,
    intent: firstIntent,
    intentClassification: firstIntentClassification,
    childEventIds: firstChildIds,
    confidence: session.confidence,
    fuzzyLocation: isFuzzyLocation,
    meta: {
      kind: "session_block",
      place_id: session.placeId,
      place_label: session.placeLabel,
      intent: firstIntent,
      children: firstChildIds,
      confidence: session.confidence,
      summary: firstSummary.length > 0 ? firstSummary : undefined,
      intent_reasoning: firstIntentClassification.reasoning,
      fuzzy_location: isFuzzyLocation || undefined,
    },
  };

  // Create second session block
  const secondSession: SessionBlock = {
    sourceId: secondSourceId,
    title: secondTitle,
    start: splitPoint,
    end: sessionEnd,
    placeId: session.placeId,
    placeLabel: session.placeLabel,
    intent: secondIntent,
    intentClassification: secondIntentClassification,
    childEventIds: secondChildIds,
    confidence: session.confidence,
    fuzzyLocation: isFuzzyLocation,
    meta: {
      kind: "session_block",
      place_id: session.placeId,
      place_label: session.placeLabel,
      intent: secondIntent,
      children: secondChildIds,
      confidence: session.confidence,
      summary: secondSummary.length > 0 ? secondSummary : undefined,
      intent_reasoning: secondIntentClassification.reasoning,
      fuzzy_location: isFuzzyLocation || undefined,
    },
  };

  return {
    firstSession,
    secondSession,
    originalSessionId: session.sourceId,
  };
}

/**
 * Split a session from a ScheduledEvent (calendar event format).
 *
 * This is a convenience function for splitting sessions directly from
 * the calendar view where events are in ScheduledEvent format.
 *
 * @param event - The scheduled event to split (must have meta.kind === 'session_block')
 * @param splitPoint - The time point at which to split
 * @param dayStart - The start of the day (for converting startMinutes to actual time)
 * @param childEvents - Optional array of child events
 * @param userOverrides - Optional user app category overrides
 * @returns Result containing the two new session blocks
 * @throws Error if event is not a session block or split point is invalid
 */
export function splitScheduledEventSession(
  event: {
    id: string;
    title: string;
    startMinutes: number;
    duration: number;
    meta?: {
      kind?: string;
      place_id?: string | null;
      place_label?: string | null;
      intent?: Intent;
      children?: string[];
      confidence?: number;
      summary?: Array<{ label: string; seconds: number }>;
      intent_reasoning?: string;
      [key: string]: unknown;
    };
  },
  splitPoint: Date,
  dayStart: Date,
  childEvents?: SessionizableEvent[],
  userOverrides?: UserAppCategoryOverrides | null,
): SessionSplitResult {
  if (event.meta?.kind !== "session_block") {
    throw new Error("Cannot split: event is not a session block");
  }

  // Convert ScheduledEvent to SessionBlock
  const sessionStart = new Date(dayStart.getTime() + event.startMinutes * 60 * 1000);
  const sessionEnd = new Date(sessionStart.getTime() + event.duration * 60 * 1000);

  // Extract fuzzy location status from event meta
  const isFuzzyLocation = event.meta.fuzzy_location === true;

  const session: SessionBlock = {
    sourceId: event.id,
    title: event.title,
    start: sessionStart,
    end: sessionEnd,
    placeId: event.meta.place_id ?? null,
    placeLabel: event.meta.place_label ?? null,
    intent: event.meta.intent ?? "mixed",
    intentClassification: {
      intent: event.meta.intent ?? "mixed",
      breakdown: { work: 0, social: 0, entertainment: 0, comms: 0, utility: 0, ignore: 0 },
      totalSeconds: event.duration * 60,
      reasoning: event.meta.intent_reasoning ?? "",
    },
    childEventIds: event.meta.children ?? [],
    confidence: event.meta.confidence ?? 0.5,
    fuzzyLocation: isFuzzyLocation,
    meta: {
      kind: "session_block",
      place_id: event.meta.place_id ?? null,
      place_label: event.meta.place_label ?? null,
      intent: event.meta.intent ?? "mixed",
      children: event.meta.children ?? [],
      confidence: event.meta.confidence ?? 0.5,
      summary: event.meta.summary,
      intent_reasoning: event.meta.intent_reasoning,
      fuzzy_location: isFuzzyLocation || undefined,
    },
  };

  return splitSession(session, splitPoint, childEvents, userOverrides);
}

// ============================================================================
// Session Merge
// ============================================================================

/**
 * Result of a session merge operation.
 */
export interface SessionMergeResult {
  /** The merged session block */
  mergedSession: SessionBlock;
  /** IDs of the original sessions that were merged (now soft-deleted) */
  originalSessionIds: string[];
}

/**
 * Merge two or more sessions into a single session block.
 *
 * This function:
 * 1. Combines all child events from the source sessions
 * 2. Recalculates intent based on combined app usage
 * 3. Creates a new session block spanning all time ranges
 * 4. Marks the new block with meta.source = 'user' (protected from future ingestion)
 *
 * @param sessions - Array of session blocks to merge (must be at least 2)
 * @param userOverrides - Optional user app category overrides for intent classification
 * @returns Result containing the merged session block
 * @throws Error if fewer than 2 sessions are provided
 */
export function mergeSessions(
  sessions: SessionBlock[],
  userOverrides?: UserAppCategoryOverrides | null,
): SessionMergeResult {
  if (sessions.length < 2) {
    throw new Error("At least two sessions are required to merge");
  }

  // Sort sessions by start time
  const sortedSessions = [...sessions].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // Determine merged session boundaries
  const mergedStart = sortedSessions[0].start;
  const mergedEnd = sortedSessions[sortedSessions.length - 1].end;

  // Combine all child event IDs
  const allChildEventIds: string[] = [];
  for (const session of sortedSessions) {
    allChildEventIds.push(...session.childEventIds);
  }

  // Combine all app summaries
  const appDurations = new Map<string, number>();
  for (const session of sortedSessions) {
    if (session.meta.summary) {
      for (const app of session.meta.summary) {
        const existing = appDurations.get(app.label) ?? 0;
        appDurations.set(app.label, existing + app.seconds);
      }
    }
  }

  // Convert to AppSummary array sorted by duration descending
  const combinedAppSummary: AppSummary[] = Array.from(appDurations.entries())
    .map(([appId, seconds]) => ({ appId, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  // Classify intent based on combined app usage
  const intentClassification = classifyIntent(combinedAppSummary, userOverrides);
  const intent = combinedAppSummary.length === 0 ? "offline" : intentClassification.intent;

  // Calculate weighted average confidence
  let totalConfidence = 0;
  let totalDuration = 0;
  for (const session of sortedSessions) {
    const duration = session.end.getTime() - session.start.getTime();
    totalConfidence += session.confidence * duration;
    totalDuration += duration;
  }
  const mergedConfidence = totalDuration > 0 ? totalConfidence / totalDuration : 0.5;

  // Use place info from the first session (or the dominant place if different)
  // For merge, we typically merge adjacent sessions at the same place,
  // so using the first session's place is appropriate
  const placeId = sortedSessions[0].placeId;
  const placeLabel = sortedSessions[0].placeLabel;

  // Generate new source ID
  const sourceId = generateUserSessionSourceId(placeId, mergedStart);

  // Generate title
  const title = generateSessionTitle(placeLabel, intent, false);

  // Build top 3 app summary for display
  const summary = combinedAppSummary.slice(0, 3).map((app) => ({
    label: app.appId,
    seconds: app.seconds,
  }));

  // Merged session is fuzzy if any of the source sessions was fuzzy
  const isFuzzyLocation = sortedSessions.some((s) => s.fuzzyLocation);

  // Create merged session block
  const mergedSession: SessionBlock = {
    sourceId,
    title,
    start: mergedStart,
    end: mergedEnd,
    placeId,
    placeLabel,
    intent,
    intentClassification,
    childEventIds: allChildEventIds,
    confidence: mergedConfidence,
    fuzzyLocation: isFuzzyLocation,
    meta: {
      kind: "session_block",
      place_id: placeId,
      place_label: placeLabel,
      intent,
      children: allChildEventIds,
      confidence: mergedConfidence,
      summary: summary.length > 0 ? summary : undefined,
      intent_reasoning: intentClassification.reasoning,
      fuzzy_location: isFuzzyLocation || undefined,
    },
  };

  // Collect original session IDs
  const originalSessionIds = sortedSessions.map((s) => s.sourceId);

  return {
    mergedSession,
    originalSessionIds,
  };
}

/**
 * Merge two sessions from ScheduledEvent (calendar event format).
 *
 * This is a convenience function for merging sessions directly from
 * the calendar view where events are in ScheduledEvent format.
 *
 * @param primaryEvent - The primary session event (the one the user initiated merge from)
 * @param secondaryEvent - The session event to merge into the primary
 * @param dayStart - The start of the day (for converting startMinutes to actual time)
 * @param userOverrides - Optional user app category overrides
 * @returns Result containing the merged session block
 * @throws Error if events are not session blocks
 */
export function mergeScheduledEventSessions(
  primaryEvent: {
    id: string;
    title: string;
    startMinutes: number;
    duration: number;
    meta?: {
      kind?: string;
      place_id?: string | null;
      place_label?: string | null;
      intent?: Intent;
      children?: string[];
      confidence?: number;
      summary?: Array<{ label: string; seconds: number }>;
      intent_reasoning?: string;
      [key: string]: unknown;
    };
  },
  secondaryEvent: {
    id: string;
    title: string;
    startMinutes: number;
    duration: number;
    meta?: {
      kind?: string;
      place_id?: string | null;
      place_label?: string | null;
      intent?: Intent;
      children?: string[];
      confidence?: number;
      summary?: Array<{ label: string; seconds: number }>;
      intent_reasoning?: string;
      [key: string]: unknown;
    };
  },
  dayStart: Date,
  userOverrides?: UserAppCategoryOverrides | null,
): SessionMergeResult {
  if (primaryEvent.meta?.kind !== "session_block") {
    throw new Error("Cannot merge: primary event is not a session block");
  }
  if (secondaryEvent.meta?.kind !== "session_block") {
    throw new Error("Cannot merge: secondary event is not a session block");
  }

  // Helper function to convert ScheduledEvent to SessionBlock
  const toSessionBlock = (
    event: typeof primaryEvent,
  ): SessionBlock => {
    const sessionStart = new Date(dayStart.getTime() + event.startMinutes * 60 * 1000);
    const sessionEnd = new Date(sessionStart.getTime() + event.duration * 60 * 1000);
    const isFuzzyLocation = event.meta?.fuzzy_location === true;

    return {
      sourceId: event.id,
      title: event.title,
      start: sessionStart,
      end: sessionEnd,
      placeId: event.meta?.place_id ?? null,
      placeLabel: event.meta?.place_label ?? null,
      intent: event.meta?.intent ?? "mixed",
      intentClassification: {
        intent: event.meta?.intent ?? "mixed",
        breakdown: { work: 0, social: 0, entertainment: 0, comms: 0, utility: 0, ignore: 0 },
        totalSeconds: event.duration * 60,
        reasoning: event.meta?.intent_reasoning ?? "",
      },
      childEventIds: event.meta?.children ?? [],
      confidence: event.meta?.confidence ?? 0.5,
      fuzzyLocation: isFuzzyLocation,
      meta: {
        kind: "session_block",
        place_id: event.meta?.place_id ?? null,
        place_label: event.meta?.place_label ?? null,
        intent: event.meta?.intent ?? "mixed",
        children: event.meta?.children ?? [],
        confidence: event.meta?.confidence ?? 0.5,
        summary: event.meta?.summary,
        intent_reasoning: event.meta?.intent_reasoning,
        fuzzy_location: isFuzzyLocation || undefined,
      },
    };
  };

  const primarySession = toSessionBlock(primaryEvent);
  const secondarySession = toSessionBlock(secondaryEvent);

  return mergeSessions([primarySession, secondarySession], userOverrides);
}
