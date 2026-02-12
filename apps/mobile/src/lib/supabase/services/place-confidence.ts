/**
 * Place Confidence Scoring
 *
 * Scores how confident we are that a place label is correct based on:
 * - Distance from segment centroid to returned place
 * - Dwell time at the location
 * - Number of location samples
 * - Type of place (specific business vs area)
 *
 * This is the CLIENT-SIDE solution for the place mis-tagging issue.
 * The Edge Function returns one place from Google Places (500m radius),
 * but we verify it's actually close enough before using it.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum distance in meters to accept a place label without modification.
 * Places within this distance are considered "high confidence" matches.
 * 50m is roughly half a city block - you're definitely AT the place.
 */
export const PLACE_MAX_CONFIDENT_DISTANCE_M = 50;

/**
 * Maximum distance in meters to use a place label at all (with "Near X" format).
 * Places between 75-150m get the "Near X" treatment.
 * Places beyond 150m are rejected entirely.
 */
export const PLACE_MAX_FUZZY_DISTANCE_M = 150;

/**
 * Minimum dwell time in minutes to consider a place match valid.
 * This helps filter out "drive-by" scenarios.
 */
export const PLACE_MIN_DWELL_MINUTES = 5;

// ============================================================================
// Types
// ============================================================================

export interface PlaceConfidenceFactors {
  /** Distance from segment centroid to the returned place in meters */
  distanceM: number;
  /** Dwell time at the location in milliseconds */
  dwellTimeMs: number;
  /** Number of location samples in the segment */
  sampleCount: number;
  /** Whether this is from reverse geocoding ("Near X" format already) */
  isReverseGeocode: boolean;
  /** Place types from Google (e.g., "restaurant", "cafe", "gas_station") */
  placeTypes: string[] | null;
}

export interface PlaceConfidenceResult {
  /** Overall confidence score 0-1 */
  score: number;
  /** Human-readable confidence level */
  level: "high" | "medium" | "low" | "very_low";
  /** Whether to show the place label at all */
  shouldShow: boolean;
  /** Whether to use "Near X" fuzzy format */
  useFuzzyFormat: boolean;
  /** Reasoning for the score (for debugging) */
  reasoning: string;
}

// ============================================================================
// Haversine Distance Calculation
// ============================================================================

/**
 * Calculate the haversine distance between two points in meters.
 * This is duplicated from actual-ingestion.ts for module independence.
 */
export function haversineDistance(
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

// ============================================================================
// Confidence Scoring
// ============================================================================

/**
 * Score the confidence of a place label match.
 *
 * The key factors are:
 * 1. Distance (most important) - closer is better
 * 2. Dwell time - longer stays are more confident
 * 3. Sample count - more samples = more accurate centroid
 * 4. Place type - specific businesses vs general areas
 *
 * @param factors - The factors to consider for scoring
 * @returns PlaceConfidenceResult with score, level, and recommendations
 */
export function scorePlaceConfidence(
  factors: PlaceConfidenceFactors,
): PlaceConfidenceResult {
  let score = 1.0;
  const reasons: string[] = [];

  // =========================================================================
  // Factor 1: Distance (most important - up to 60% weight)
  // =========================================================================
  if (factors.distanceM <= 25) {
    // Very close - high confidence (essentially "at" the place)
    score *= 1.0;
  } else if (factors.distanceM <= 50) {
    // Close - good confidence
    score *= 0.9;
    reasons.push(`${Math.round(factors.distanceM)}m away`);
  } else if (factors.distanceM <= PLACE_MAX_CONFIDENT_DISTANCE_M) {
    // Acceptable - medium confidence
    score *= 0.75;
    reasons.push(`${Math.round(factors.distanceM)}m away`);
  } else if (factors.distanceM <= 100) {
    // Getting far - low confidence, consider fuzzy
    score *= 0.55;
    reasons.push(`${Math.round(factors.distanceM)}m away (borderline)`);
  } else if (factors.distanceM <= PLACE_MAX_FUZZY_DISTANCE_M) {
    // Far - very low confidence, definitely fuzzy
    score *= 0.35;
    reasons.push(`${Math.round(factors.distanceM)}m away (far)`);
  } else {
    // Too far - should not use
    score *= 0.1;
    reasons.push(`${Math.round(factors.distanceM)}m away (too far)`);
  }

  // =========================================================================
  // Factor 2: Dwell Time (up to 20% weight)
  // =========================================================================
  const dwellMinutes = factors.dwellTimeMs / (1000 * 60);
  if (dwellMinutes >= 30) {
    // Long dwell - bonus confidence
    score *= 1.1;
  } else if (dwellMinutes >= 15) {
    // Good dwell time
    score *= 1.0;
  } else if (dwellMinutes >= PLACE_MIN_DWELL_MINUTES) {
    // Acceptable dwell time
    score *= 0.95;
  } else if (dwellMinutes >= 3) {
    // Short dwell - penalty
    score *= 0.85;
    reasons.push(`short dwell (${Math.round(dwellMinutes)}min)`);
  } else {
    // Very short - likely passing through
    score *= 0.7;
    reasons.push(`very short dwell (${Math.round(dwellMinutes)}min)`);
  }

  // =========================================================================
  // Factor 3: Sample Count (up to 10% weight)
  // =========================================================================
  if (factors.sampleCount >= 10) {
    // Good sample coverage - bonus
    score *= 1.05;
  } else if (factors.sampleCount >= 5) {
    // Acceptable
    score *= 1.0;
  } else if (factors.sampleCount >= 3) {
    // Low samples
    score *= 0.95;
    reasons.push(`low samples (${factors.sampleCount})`);
  } else {
    // Very few samples - centroid may be inaccurate
    score *= 0.85;
    reasons.push(`very few samples (${factors.sampleCount})`);
  }

  // =========================================================================
  // Factor 4: Reverse Geocode (10% penalty)
  // =========================================================================
  if (factors.isReverseGeocode) {
    score *= 0.9;
    reasons.push("area label (not specific place)");
  }

  // =========================================================================
  // Factor 5: Place Type Adjustments (bonus/penalty)
  // =========================================================================
  if (factors.placeTypes && factors.placeTypes.length > 0) {
    // Large venues get distance bonus (airports, malls, etc.)
    const largeVenueTypes = [
      "airport",
      "shopping_mall",
      "university",
      "hospital",
      "stadium",
      "amusement_park",
    ];
    const hasLargeVenue = factors.placeTypes.some((t) =>
      largeVenueTypes.some((lt) => t.includes(lt)),
    );
    if (hasLargeVenue && factors.distanceM > PLACE_MAX_CONFIDENT_DISTANCE_M) {
      // Large venues can be matched at greater distances
      score *= 1.15;
      reasons.push("large venue (distance OK)");
    }

    // Small specific venues need closer matches
    const smallVenueTypes = ["cafe", "coffee", "fast_food", "restaurant"];
    const hasSmallVenue = factors.placeTypes.some((t) =>
      smallVenueTypes.some((st) => t.includes(st)),
    );
    if (hasSmallVenue && factors.distanceM > 50) {
      // Penalize cafes/restaurants that are far away
      score *= 0.85;
      reasons.push("small venue far away");
    }
  }

  // Clamp score to 0-1
  score = Math.max(0, Math.min(1, score));

  // =========================================================================
  // Determine Level and Recommendations
  // =========================================================================
  let level: PlaceConfidenceResult["level"];
  let shouldShow = true;
  let useFuzzyFormat = false;

  if (score >= 0.7) {
    level = "high";
    // High confidence - use the label as-is
  } else if (score >= 0.5) {
    level = "medium";
    // Medium confidence - use label but maybe show indicator
  } else if (score >= 0.3) {
    level = "low";
    // Low confidence - use "Near X" format
    useFuzzyFormat = true;
  } else {
    level = "very_low";
    // Very low confidence
    useFuzzyFormat = true;
    if (score < 0.15) {
      // Below threshold - don't show at all
      shouldShow = false;
    }
  }

  return {
    score,
    level,
    shouldShow,
    useFuzzyFormat,
    reasoning: reasons.length > 0 ? reasons.join(", ") : "good match",
  };
}

// ============================================================================
// Quick Distance Check
// ============================================================================

/**
 * Quick check if a place is close enough to use.
 * Returns the recommended action without full confidence scoring.
 *
 * @param distanceM - Distance from segment centroid to place in meters
 * @returns "accept" | "fuzzy" | "reject"
 */
export function quickDistanceCheck(
  distanceM: number,
): "accept" | "fuzzy" | "reject" {
  if (distanceM <= PLACE_MAX_CONFIDENT_DISTANCE_M) {
    return "accept";
  } else if (distanceM <= PLACE_MAX_FUZZY_DISTANCE_M) {
    return "fuzzy";
  } else {
    return "reject";
  }
}

/**
 * Format a place name with "Near" prefix if needed.
 *
 * @param placeName - Original place name
 * @param useFuzzy - Whether to add "Near" prefix
 * @returns Formatted place name
 */
export function formatPlaceName(
  placeName: string,
  useFuzzy: boolean,
): string {
  if (!useFuzzy) {
    return placeName;
  }

  // Don't double-prefix if already "Near X"
  if (placeName.startsWith("Near ")) {
    return placeName;
  }

  return `Near ${placeName}`;
}
