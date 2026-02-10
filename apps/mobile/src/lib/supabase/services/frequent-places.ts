/**
 * Frequent Places Discovery Service
 *
 * Automatically analyzes activity segments to find locations the user visits frequently.
 * Used for suggesting places to label in the UI.
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

// ============================================================================
// Types
// ============================================================================

export interface FrequentPlace {
  /** Auto-discovered place name from Google Places */
  placeLabel: string;
  /** Number of times visited */
  visitCount: number;
  /** Total hours spent here */
  totalHours: number;
  /** Average coordinates (centroid of all visits) */
  avgLat: number;
  avgLng: number;
  /** Average confidence score */
  avgConfidence: number;
  /** Most recent visit timestamp */
  lastVisit: Date;
  /** Whether user has already labeled this place */
  isLabeled: boolean;
  /** Geohash7 for this location cluster */
  geohash7: string | null;
}

export interface PlaceSuggestion {
  place: FrequentPlace;
  /** Suggested category based on visit patterns */
  suggestedCategory: string | null;
  /** Suggested label (cleaned up version of placeLabel) */
  suggestedLabel: string;
  /** Confidence in the suggestion (0-1) */
  suggestionConfidence: number;
  /** Reason for suggestion */
  reason: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer a category from visit patterns.
 * Returns one of: work, home, gym, social, shopping, restaurant, coffee, other
 */
function inferCategoryFromPattern(
  visitCount: number,
  totalHours: number,
  placeLabel: string,
): { category: string | null; confidence: number } {
  const avgDuration = totalHours / visitCount;
  const label = placeLabel.toLowerCase();

  // High confidence patterns
  if (label.includes("gym") || label.includes("fitness") || label.includes("yoga")) {
    return { category: "gym", confidence: 0.9 };
  }
  if (label.includes("starbucks") || label.includes("coffee") || label.includes("café")) {
    return { category: "coffee", confidence: 0.9 };
  }
  if (label.includes("grocery") || label.includes("whole foods") || label.includes("trader joe")) {
    return { category: "shopping", confidence: 0.9 };
  }

  // Medium confidence patterns (based on visit frequency + duration)
  if (visitCount >= 10 && avgDuration >= 2) {
    // Visited often, long sessions = likely work/home
    if (avgDuration >= 6) {
      return { category: "work", confidence: 0.7 };
    }
    return { category: "work", confidence: 0.5 };
  }

  if (visitCount >= 3 && avgDuration >= 0.5 && avgDuration < 2) {
    // Short frequent visits = coffee shop, gym, etc.
    return { category: "coffee", confidence: 0.4 };
  }

  // Low confidence fallback
  return { category: null, confidence: 0.0 };
}

/**
 * Clean up a Google Places name to make a better user-facing label.
 * Examples:
 * - "Starbucks Coffee" → "Starbucks"
 * - "Total Home Inspection LLC" → "Total Home Inspection"
 * - "Believe Candle Co." → "Believe Candle Co"
 */
function cleanPlaceLabel(placeLabel: string): string {
  let cleaned = placeLabel.trim();

  // Remove common business suffixes
  cleaned = cleaned
    .replace(/\s+(LLC|Inc\.|Inc|Corp\.|Corp|Ltd\.|Ltd|Co\.)$/i, "")
    .replace(/\s+Coffee$/i, "")
    .replace(/\s+Fitness$/i, "")
    .trim();

  return cleaned;
}

/**
 * Generate a human-readable reason for the suggestion.
 */
function generateSuggestionReason(place: FrequentPlace): string {
  const { visitCount, totalHours } = place;

  if (visitCount >= 20) {
    return `Visited ${visitCount} times (${Math.round(totalHours)}h total)`;
  }
  if (visitCount >= 10) {
    return `Frequently visited (${visitCount} times, ${Math.round(totalHours)}h)`;
  }
  if (totalHours >= 10) {
    return `${Math.round(totalHours)} hours spent here`;
  }
  if (visitCount >= 5) {
    return `${visitCount} visits detected`;
  }
  return `Visited ${visitCount} times`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Find frequent places the user visits based on activity segments.
 *
 * @param userId - User ID
 * @param options - Query options
 * @returns Array of frequent places, sorted by total hours descending
 */
export async function findFrequentPlaces(
  userId: string,
  options?: {
    /** Minimum number of visits required (default: 3) */
    minVisits?: number;
    /** Days to look back (default: 30) */
    daysBack?: number;
    /** Maximum results to return (default: 20) */
    limit?: number;
    /** Whether to exclude already-labeled places (default: false) */
    excludeLabeled?: boolean;
  },
): Promise<FrequentPlace[]> {
  const minVisits = options?.minVisits ?? 3;
  const daysBack = options?.daysBack ?? 30;
  const limit = options?.limit ?? 20;

  try {
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Query activity segments
    const { data: segments, error } = await tmSchema()
      .from("activity_segments")
      .select(
        "place_label, place_id, location_lat, location_lng, activity_confidence, started_at, ended_at"
      )
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString())
      .not("place_label", "is", null)
      .order("started_at", { ascending: false });

    if (error) throw handleSupabaseError(error);

    if (!segments || segments.length === 0) {
      return [];
    }

    // Group by place_label and aggregate stats
    const placeStats = new Map<
      string,
      {
        visitCount: number;
        totalSeconds: number;
        lats: number[];
        lngs: number[];
        confidences: number[];
        lastVisit: Date;
        isLabeled: boolean;
      }
    >();

    for (const seg of segments) {
      const label = seg.place_label as string;
      const hasPlaceId = seg.place_id !== null;

      const stats = placeStats.get(label) ?? {
        visitCount: 0,
        totalSeconds: 0,
        lats: [],
        lngs: [],
        confidences: [],
        lastVisit: new Date(seg.started_at),
        isLabeled: hasPlaceId,
      };

      stats.visitCount++;

      const duration =
        new Date(seg.ended_at).getTime() - new Date(seg.started_at).getTime();
      stats.totalSeconds += duration / 1000;

      if (seg.location_lat !== null) stats.lats.push(seg.location_lat as number);
      if (seg.location_lng !== null) stats.lngs.push(seg.location_lng as number);
      if (seg.activity_confidence !== null) {
        stats.confidences.push(seg.activity_confidence as number);
      }

      const visitDate = new Date(seg.started_at);
      if (visitDate > stats.lastVisit) {
        stats.lastVisit = visitDate;
      }

      placeStats.set(label, stats);
    }

    // Convert to FrequentPlace objects
    const places: FrequentPlace[] = [];

    for (const [label, stats] of Array.from(placeStats.entries())) {
      // Filter by minVisits
      if (stats.visitCount < minVisits) continue;

      // Optionally exclude labeled places
      if (options?.excludeLabeled && stats.isLabeled) continue;

      const avgLat = stats.lats.length > 0
        ? stats.lats.reduce((a, b) => a + b, 0) / stats.lats.length
        : 0;
      const avgLng = stats.lngs.length > 0
        ? stats.lngs.reduce((a, b) => a + b, 0) / stats.lngs.length
        : 0;
      const avgConfidence =
        stats.confidences.length > 0
          ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length
          : 0;

      // Generate geohash7 from average coordinates
      let geohash7: string | null = null;
      if (avgLat !== 0 && avgLng !== 0) {
        // We'll need to query PostGIS to generate geohash
        // For now, set null and let the caller compute if needed
        geohash7 = null;
      }

      places.push({
        placeLabel: label,
        visitCount: stats.visitCount,
        totalHours: stats.totalSeconds / 3600,
        avgLat,
        avgLng,
        avgConfidence,
        lastVisit: stats.lastVisit,
        isLabeled: stats.isLabeled,
        geohash7,
      });
    }

    // Sort by total hours descending, then by visit count
    places.sort((a, b) => {
      if (Math.abs(b.totalHours - a.totalHours) > 0.1) {
        return b.totalHours - a.totalHours;
      }
      return b.visitCount - a.visitCount;
    });

    // Limit results
    return places.slice(0, limit);
  } catch (error) {
    if (__DEV__) {
      console.warn("[FrequentPlaces] Failed to find frequent places:", error);
    }
    throw error instanceof Error ? error : new Error("Failed to find frequent places");
  }
}

/**
 * Generate smart suggestions for labeling frequent places.
 *
 * @param userId - User ID
 * @param options - Query options
 * @returns Array of place suggestions with inferred categories and reasons
 */
export async function suggestPlacesToLabel(
  userId: string,
  options?: {
    /** Minimum visits to suggest (default: 5) */
    minVisits?: number;
    /** Days to look back (default: 14) */
    daysBack?: number;
    /** Max suggestions (default: 5) */
    limit?: number;
  },
): Promise<PlaceSuggestion[]> {
  const places = await findFrequentPlaces(userId, {
    minVisits: options?.minVisits ?? 5,
    daysBack: options?.daysBack ?? 14,
    limit: options?.limit ?? 5,
    excludeLabeled: true, // Only suggest unlabeled places
  });

  return places.map((place) => {
    const { category, confidence } = inferCategoryFromPattern(
      place.visitCount,
      place.totalHours,
      place.placeLabel,
    );

    return {
      place,
      suggestedCategory: category,
      suggestedLabel: cleanPlaceLabel(place.placeLabel),
      suggestionConfidence: confidence,
      reason: generateSuggestionReason(place),
    };
  });
}

/**
 * Check if there are any frequent places that need labeling.
 * This is a lightweight check for showing badges/prompts in the UI.
 *
 * @returns Number of unlabeled frequent places (min 5 visits, last 14 days)
 */
export async function getUnlabeledFrequentPlaceCount(
  userId: string,
): Promise<number> {
  try {
    const places = await findFrequentPlaces(userId, {
      minVisits: 5,
      daysBack: 14,
      excludeLabeled: true,
    });
    return places.length;
  } catch {
    return 0;
  }
}
