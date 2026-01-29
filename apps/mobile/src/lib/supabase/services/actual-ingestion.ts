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

/** Default radius in meters for user place matching */
const DEFAULT_PLACE_RADIUS_M = 150;

/** Minimum percentage of samples that must match a place for the segment to be labeled as that place */
const PLACE_MATCH_THRESHOLD = 0.7;

/** Minimum commute duration in milliseconds to create a separate commute segment */
const MIN_COMMUTE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/** Maximum movement speed in m/s to be considered stationary (walking pace ~1.4 m/s) */
const STATIONARY_SPEED_THRESHOLD_MS = 0.5; // 0.5 m/s = very slow walk

/** Minimum total distance traveled to consider as movement */
const MIN_COMMUTE_DISTANCE_M = 200; // 200 meters

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
