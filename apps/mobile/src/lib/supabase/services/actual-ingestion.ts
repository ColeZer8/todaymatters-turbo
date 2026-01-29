/**
 * Actual ingestion service for converting evidence data into calendar events.
 * Handles location segment generation and sessionization.
 */

import type {
  EvidenceLocationSample,
  UserPlaceRow,
} from "./evidence-data";

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
    kind: "location_block";
    place_id: string | null;
    place_label: string | null;
    sample_count: number;
    confidence: number;
  };
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

/** Default radius in meters for user place matching */
const DEFAULT_PLACE_RADIUS_M = 150;

/** Minimum percentage of samples that must match a place for the segment to be labeled as that place */
const PLACE_MATCH_THRESHOLD = 0.7;

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
  if (locationSamples.length === 0) {
    return [];
  }

  const segments: LocationSegment[] = [];

  // Sort samples by timestamp
  const sortedSamples = [...locationSamples].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  // Group consecutive samples by their matched place
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
    } else if (currentGroup.placeId === currentPlaceId) {
      // Same place - extend current group
      currentGroup.samples.push(sample);
    } else {
      // Different place - finalize current group and start new one
      groups.push(currentGroup);
      currentGroup = {
        samples: [sample],
        placeId: currentPlaceId,
        place: matchedPlace,
      };
    }
  }

  // Don't forget the last group
  if (currentGroup && currentGroup.samples.length > 0) {
    groups.push(currentGroup);
  }

  // Convert groups to segments, applying the 70% threshold
  for (const group of groups) {
    if (group.samples.length === 0) continue;

    // Find the dominant place in this group (may differ from initial grouping)
    const { placeId, place, matchRatio } = findDominantPlace(group.samples, userPlaces);

    // Calculate segment boundaries
    const firstSample = group.samples[0];
    const lastSample = group.samples[group.samples.length - 1];
    const segmentStart = new Date(firstSample.recorded_at);
    const segmentEnd = new Date(lastSample.recorded_at);

    // Clamp to window boundaries
    const clampedStart = new Date(Math.max(segmentStart.getTime(), windowStart.getTime()));
    const clampedEnd = new Date(Math.min(segmentEnd.getTime(), windowEnd.getTime()));

    // Skip if segment is invalid after clamping
    if (clampedStart >= clampedEnd) {
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
    if (current.placeId === next.placeId && gap <= maxGapMs) {
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
    title: segment.placeLabel
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
