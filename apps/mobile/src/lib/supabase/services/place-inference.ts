/**
 * Smart Place Inference Service
 *
 * Analyzes location patterns over time to automatically infer place types:
 * - Home: Where user spends overnight hours (10pm - 6am)
 * - Work: Where user spends weekday business hours (9am - 5pm)
 * - Frequent: Any location visited 3+ times
 *
 * Returns suggested places that users can confirm, dismiss, or edit.
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

// ============================================================================
// Types
// ============================================================================

export type InferredPlaceType = "home" | "work" | "frequent" | "unknown";

export interface GeohashCluster {
  geohash7: string;
  /** Total hours spent at this geohash */
  totalHours: number;
  /** Hours spent during overnight (10pm-6am) */
  overnightHours: number;
  /** Hours spent during weekday work hours (9am-5pm Mon-Fri) */
  workHours: number;
  /** Hours spent during weekend */
  weekendHours: number;
  /** Number of distinct days visited */
  distinctDays: number;
  /** Average centroid latitude */
  avgLatitude: number | null;
  /** Average centroid longitude */
  avgLongitude: number | null;
  /** Existing place_label if matched */
  existingPlaceLabel: string | null;
  /** Google place name if available */
  googlePlaceName: string | null;
}

export interface InferredPlace {
  geohash7: string;
  inferredType: InferredPlaceType;
  confidence: number; // 0-1
  suggestedLabel: string;
  reasoning: string;
  latitude: number | null;
  longitude: number | null;
  /** If there's already a user place matching this location */
  existingPlaceLabel: string | null;
  /** Google Places name if available */
  googlePlaceName: string | null;
  /** Stats used for inference */
  stats: {
    totalHours: number;
    overnightHours: number;
    workHours: number;
    distinctDays: number;
  };
}

export interface PlaceInferenceResult {
  /** All inferred places, sorted by confidence */
  inferredPlaces: InferredPlace[];
  /** Summary stats */
  stats: {
    totalGeohashes: number;
    daysAnalyzed: number;
    hoursAnalyzed: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract lat/lng from a PostGIS geography/geometry value.
 * Handles GeoJSON Point format and WKT POINT format.
 */
function extractLatLngFromCentroid(centroid: unknown): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!centroid) return { latitude: null, longitude: null };

  // Handle WKT format: "POINT(longitude latitude)" or "SRID=4326;POINT(...)"
  if (typeof centroid === "string") {
    const match = centroid.match(
      /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i,
    );
    if (match) {
      return { longitude: Number(match[1]), latitude: Number(match[2]) };
    }
    return { latitude: null, longitude: null };
  }

  // Handle GeoJSON format: { type: "Point", coordinates: [lng, lat] }
  if (typeof centroid === "object") {
    const geo = centroid as { type?: string; coordinates?: number[] };
    if (
      geo.type === "Point" &&
      Array.isArray(geo.coordinates) &&
      geo.coordinates.length >= 2
    ) {
      return { latitude: geo.coordinates[1], longitude: geo.coordinates[0] };
    }
  }

  return { latitude: null, longitude: null };
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum hours at a location to consider it for inference */
const MIN_HOURS_FOR_INFERENCE = 3;

/** Minimum overnight hours to infer as home */
const MIN_OVERNIGHT_HOURS_FOR_HOME = 8;

/** Minimum work hours to infer as work */
const MIN_WORK_HOURS_FOR_WORK = 10;

/** Minimum distinct days to infer as frequent */
const MIN_DAYS_FOR_FREQUENT = 3;

/** Overnight hours range (10pm = 22, 6am = 6) */
const OVERNIGHT_START_HOUR = 22;
const OVERNIGHT_END_HOUR = 6;

/** Work hours range (9am - 5pm) */
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Analyze location history and infer place types.
 *
 * @param userId - User ID to analyze
 * @param daysBack - Number of days of history to analyze (default: 14)
 */
export async function inferPlacesFromHistory(
  userId: string,
  daysBack: number = 14,
): Promise<PlaceInferenceResult> {
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  // Fetch location hourly data for the window
  const { data: rows, error } = await supabase
    .schema("tm")
    .from("location_hourly")
    .select(
      `
      hour_start,
      geohash7,
      sample_count,
      place_id,
      place_label,
      centroid,
      google_place_name
    `,
    )
    .eq("user_id", userId)
    .gte("hour_start", startIso)
    .lte("hour_start", endIso)
    .not("geohash7", "is", null)
    .order("hour_start", { ascending: true });

  if (error) throw handleSupabaseError(error);
  if (!rows || rows.length === 0) {
    return {
      inferredPlaces: [],
      stats: { totalGeohashes: 0, daysAnalyzed: 0, hoursAnalyzed: 0 },
    };
  }

  // Build geohash clusters
  const clusters = buildGeohashClusters(rows);

  // Infer place types from clusters
  const inferredPlaces = inferPlaceTypes(clusters);

  // Calculate stats
  const distinctDays = new Set(
    rows.map((r) => new Date(r.hour_start as string).toISOString().slice(0, 10)),
  ).size;

  return {
    inferredPlaces,
    stats: {
      totalGeohashes: clusters.size,
      daysAnalyzed: distinctDays,
      hoursAnalyzed: rows.length,
    },
  };
}

/**
 * Build clusters of location data grouped by geohash7.
 */
function buildGeohashClusters(
  rows: Array<{
    hour_start: unknown;
    geohash7: unknown;
    sample_count: unknown;
    place_id: unknown;
    place_label: unknown;
    centroid: unknown;
    google_place_name: unknown;
  }>,
): Map<string, GeohashCluster> {
  const clusters = new Map<string, GeohashCluster>();

  for (const row of rows) {
    const geohash7 = typeof row.geohash7 === "string" ? row.geohash7 : null;
    if (!geohash7) continue;

    const hourStart = new Date(row.hour_start as string);
    const hour = hourStart.getUTCHours();
    const dayOfWeek = hourStart.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWeekday = !isWeekend;

    // Determine time category
    const isOvernight =
      hour >= OVERNIGHT_START_HOUR || hour < OVERNIGHT_END_HOUR;
    const isWorkHours =
      isWeekday && hour >= WORK_START_HOUR && hour < WORK_END_HOUR;

    // Get or create cluster
    let cluster = clusters.get(geohash7);
    if (!cluster) {
      cluster = {
        geohash7,
        totalHours: 0,
        overnightHours: 0,
        workHours: 0,
        weekendHours: 0,
        distinctDays: 0,
        avgLatitude: null,
        avgLongitude: null,
        existingPlaceLabel: null,
        googlePlaceName: null,
      };
      clusters.set(geohash7, cluster);
    }

    // Update counts
    cluster.totalHours += 1;
    if (isOvernight) cluster.overnightHours += 1;
    if (isWorkHours) cluster.workHours += 1;
    if (isWeekend) cluster.weekendHours += 1;

    // Track coordinates (extract from PostGIS centroid)
    const { latitude: lat, longitude: lng } = extractLatLngFromCentroid(row.centroid);
    if (lat !== null && lng !== null) {
      if (cluster.avgLatitude === null) {
        cluster.avgLatitude = lat;
        cluster.avgLongitude = lng;
      } else {
        // Running average
        const n = cluster.totalHours;
        cluster.avgLatitude = (cluster.avgLatitude * (n - 1) + lat) / n;
        cluster.avgLongitude = (cluster.avgLongitude! * (n - 1) + lng) / n;
      }
    }

    // Capture existing labels
    if (typeof row.place_label === "string" && row.place_label) {
      cluster.existingPlaceLabel = row.place_label;
    }
    if (typeof row.google_place_name === "string" && row.google_place_name) {
      cluster.googlePlaceName = row.google_place_name;
    }
  }

  // Calculate distinct days for each cluster
  const daysByGeohash = new Map<string, Set<string>>();
  for (const row of rows) {
    const geohash7 = typeof row.geohash7 === "string" ? row.geohash7 : null;
    if (!geohash7) continue;

    const dayKey = new Date(row.hour_start as string).toISOString().slice(0, 10);
    let days = daysByGeohash.get(geohash7);
    if (!days) {
      days = new Set();
      daysByGeohash.set(geohash7, days);
    }
    days.add(dayKey);
  }

  Array.from(daysByGeohash.entries()).forEach(([geohash7, days]) => {
    const cluster = clusters.get(geohash7);
    if (cluster) {
      cluster.distinctDays = days.size;
    }
  });

  return clusters;
}

/**
 * Infer place types from geohash clusters.
 */
function inferPlaceTypes(clusters: Map<string, GeohashCluster>): InferredPlace[] {
  const inferred: InferredPlace[] = [];

  // Sort clusters by total hours descending
  const sortedClusters = [...clusters.values()].sort(
    (a, b) => b.totalHours - a.totalHours,
  );

  // Track what we've already assigned (only one home, one work)
  let homeAssigned = false;
  let workAssigned = false;

  for (const cluster of sortedClusters) {
    // Skip if too few hours
    if (cluster.totalHours < MIN_HOURS_FOR_INFERENCE) continue;

    // Skip if already has a user-defined place
    if (cluster.existingPlaceLabel) {
      inferred.push({
        geohash7: cluster.geohash7,
        inferredType: "unknown",
        confidence: 1.0,
        suggestedLabel: cluster.existingPlaceLabel,
        reasoning: "Already has user-defined place label",
        latitude: cluster.avgLatitude,
        longitude: cluster.avgLongitude,
        existingPlaceLabel: cluster.existingPlaceLabel,
        googlePlaceName: cluster.googlePlaceName,
        stats: {
          totalHours: cluster.totalHours,
          overnightHours: cluster.overnightHours,
          workHours: cluster.workHours,
          distinctDays: cluster.distinctDays,
        },
      });
      continue;
    }

    // Try to infer type
    let inferredType: InferredPlaceType = "unknown";
    let confidence = 0;
    let suggestedLabel = "Unknown Location";
    let reasoning = "";

    // Check for HOME (highest overnight hours, not yet assigned)
    if (
      !homeAssigned &&
      cluster.overnightHours >= MIN_OVERNIGHT_HOURS_FOR_HOME
    ) {
      const overnightRatio = cluster.overnightHours / cluster.totalHours;
      if (overnightRatio >= 0.3) {
        inferredType = "home";
        confidence = Math.min(0.95, 0.5 + overnightRatio * 0.5);
        suggestedLabel = "Home";
        reasoning = `${cluster.overnightHours}h overnight across ${cluster.distinctDays} days (${Math.round(overnightRatio * 100)}% overnight ratio)`;
        homeAssigned = true;
      }
    }

    // Check for WORK (highest work hours, not yet assigned)
    if (
      inferredType === "unknown" &&
      !workAssigned &&
      cluster.workHours >= MIN_WORK_HOURS_FOR_WORK
    ) {
      const workRatio = cluster.workHours / cluster.totalHours;
      if (workRatio >= 0.3) {
        inferredType = "work";
        confidence = Math.min(0.9, 0.4 + workRatio * 0.5);
        suggestedLabel = cluster.googlePlaceName || "Work";
        reasoning = `${cluster.workHours}h during weekday work hours across ${cluster.distinctDays} days (${Math.round(workRatio * 100)}% work hours ratio)`;
        workAssigned = true;
      }
    }

    // Check for FREQUENT (visited multiple days)
    if (
      inferredType === "unknown" &&
      cluster.distinctDays >= MIN_DAYS_FOR_FREQUENT
    ) {
      inferredType = "frequent";
      confidence = Math.min(0.7, 0.3 + cluster.distinctDays * 0.1);
      suggestedLabel = cluster.googlePlaceName || "Frequent Location";
      reasoning = `Visited ${cluster.distinctDays} different days, ${cluster.totalHours}h total`;
    }

    // Only add if we inferred something
    if (inferredType !== "unknown" || cluster.totalHours >= 5) {
      inferred.push({
        geohash7: cluster.geohash7,
        inferredType,
        confidence,
        suggestedLabel,
        reasoning,
        latitude: cluster.avgLatitude,
        longitude: cluster.avgLongitude,
        existingPlaceLabel: cluster.existingPlaceLabel,
        googlePlaceName: cluster.googlePlaceName,
        stats: {
          totalHours: cluster.totalHours,
          overnightHours: cluster.overnightHours,
          workHours: cluster.workHours,
          distinctDays: cluster.distinctDays,
        },
      });
    }
  }

  // Sort by confidence descending
  return inferred.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Create a user place from an inferred place suggestion.
 * Returns the created place ID.
 */
export async function createPlaceFromInference(
  userId: string,
  inference: InferredPlace,
  overrideLabel?: string,
  overrideCategory?: string,
): Promise<string> {
  const label = overrideLabel || inference.suggestedLabel;
  const category = overrideCategory || mapInferredTypeToCategory(inference.inferredType);

  if (inference.latitude === null || inference.longitude === null) {
    throw new Error("Cannot create place without coordinates");
  }

  const { data, error } = await supabase
    .schema("tm")
    .from("user_places")
    .insert({
      user_id: userId,
      label,
      category,
      latitude: inference.latitude,
      longitude: inference.longitude,
      radius_m: 150, // Default radius matching geohash7 precision
    })
    .select("id")
    .single();

  if (error) throw handleSupabaseError(error);
  return data.id;
}

/**
 * Map inferred place type to user_places category.
 */
function mapInferredTypeToCategory(type: InferredPlaceType): string {
  switch (type) {
    case "home":
      return "home";
    case "work":
      return "work";
    case "frequent":
      return "other";
    default:
      return "other";
  }
}

// ============================================================================
// Utility: Get inference summary for display
// ============================================================================

export function formatInferenceSummary(result: PlaceInferenceResult): string {
  const lines: string[] = [];

  lines.push(`📍 Place Inference Results`);
  lines.push(`   Analyzed: ${result.stats.hoursAnalyzed}h across ${result.stats.daysAnalyzed} days`);
  lines.push(`   Found: ${result.inferredPlaces.length} locations\n`);

  for (const place of result.inferredPlaces) {
    const emoji = getTypeEmoji(place.inferredType);
    const conf = Math.round(place.confidence * 100);
    lines.push(`${emoji} ${place.suggestedLabel} (${conf}% confidence)`);
    lines.push(`   Type: ${place.inferredType}`);
    lines.push(`   Reason: ${place.reasoning}`);
    if (place.googlePlaceName && place.googlePlaceName !== place.suggestedLabel) {
      lines.push(`   Google: ${place.googlePlaceName}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function getTypeEmoji(type: InferredPlaceType): string {
  switch (type) {
    case "home":
      return "🏠";
    case "work":
      return "💼";
    case "frequent":
      return "📌";
    default:
      return "❓";
  }
}
