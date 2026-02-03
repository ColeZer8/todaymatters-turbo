import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import { ensureGooglePlaceNamesForDay } from "./location-place-lookup";

/**
 * Evidence data services for fetching location, screen time, and health data
 * used for verifying planned calendar events.
 *
 * NOTE: These tables/views may not be in the generated TypeScript types yet.
 * We use raw queries and handle errors gracefully.
 */

// ============================================================================
// Types
// ============================================================================

export interface LocationHourlyRow {
  user_id: string;
  hour_start: string; // timestamptz
  sample_count: number;
  avg_accuracy_m: number | null;
  geohash7: string | null;
  radius_m: number | null;
  place_id: string | null;
  place_label: string | null;
  place_category: string | null;
  // Extra fields returned by tm.location_hourly
  centroid?: unknown;
  // Convenience values extracted client-side from centroid
  centroid_latitude?: number | null;
  centroid_longitude?: number | null;
  // Google Places join fields (from tm.location_place_cache)
  google_place_id?: string | null;
  google_place_name?: string | null;
  google_place_vicinity?: string | null;
  google_place_types?: unknown;
}

export interface ScreenTimeSessionRow {
  id: string;
  user_id: string;
  screen_time_daily_id: string;
  local_date: string; // date
  app_id: string;
  display_name: string | null;
  started_at: string; // timestamptz
  ended_at: string; // timestamptz
  duration_seconds: number;
  pickups: number | null;
}

export interface HealthWorkoutRow {
  id: string;
  user_id: string;
  platform: string;
  provider: string;
  started_at: string; // timestamptz
  ended_at: string; // timestamptz
  duration_seconds: number;
  activity_type: string | null;
  total_energy_kcal: number | null;
  distance_meters: number | null;
  avg_heart_rate_bpm: number | null;
}

export interface HealthDailyRow {
  id: string;
  user_id: string;
  local_date: string;
  window_start?: string | null;
  window_end?: string | null;
  steps: number | null;
  active_energy_kcal?: number | null;
  distance_meters?: number | null;
  sleep_asleep_seconds: number | null;
  sleep_in_bed_seconds?: number | null;
  sleep_awake_seconds?: number | null;
  sleep_deep_seconds?: number | null;
  sleep_rem_seconds?: number | null;
  sleep_light_seconds?: number | null;
  heart_rate_avg_bpm?: number | null;
  resting_heart_rate_avg_bpm?: number | null;
  hrv_sdnn_seconds?: number | null;
  workouts_count: number | null;
  workouts_duration_seconds: number | null;
}

export interface UserPlaceRow {
  id: string;
  user_id: string;
  label: string;
  category: string | null;
  category_id: string | null;
  radius_m: number;
  latitude: number | null;
  longitude: number | null;
}

export interface EvidenceLocationSample {
  recorded_at: string; // timestamptz — precise timestamp
  latitude: number | null;
  longitude: number | null;
}

export interface EvidenceBundle {
  locationHourly: LocationHourlyRow[];
  locationSamples: EvidenceLocationSample[];
  screenTimeSessions: ScreenTimeSessionRow[];
  healthWorkouts: HealthWorkoutRow[];
  healthDaily: HealthDailyRow | null;
  userPlaces: UserPlaceRow[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Converts YYYY-MM-DD to start/end timestamps for a day.
 */
function ymdToDayRange(ymd: string): { startIso: string; endIso: string } {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(year, month, day, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// Helper to get the tm schema client (bypass strict typing since schema may not be in types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

// ============================================================================
// Fetchers
// ============================================================================

/**
 * Fetch location hourly data for a day (from the location_hourly view).
 * This view automatically joins with user_places to provide place labels.
 */
export async function fetchLocationHourlyForDay(
  userId: string,
  ymd: string,
): Promise<LocationHourlyRow[]> {
  const { startIso, endIso } = ymdToDayRange(ymd);

  try {
    const { data, error } = await tmSchema()
      .from("location_hourly")
      .select("*")
      .eq("user_id", userId)
      .gte("hour_start", startIso)
      .lt("hour_start", endIso)
      .order("hour_start", { ascending: true });

    if (error) {
      // View might not exist yet or no data - return empty array
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map(coerceLocationHourlyRow);
  } catch (error) {
    if (__DEV__) {
      console.warn("[Evidence] Failed to fetch location hourly:", error);
    }
    return [];
  }
}

/**
 * Fetch screen time app sessions for a day.
 */
export async function fetchScreenTimeSessionsForDay(
  userId: string,
  ymd: string,
): Promise<ScreenTimeSessionRow[]> {
  const { startIso, endIso } = ymdToDayRange(ymd);

  try {
    const { data, error } = await tmSchema()
      .from("screen_time_app_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", startIso)
      .lt("started_at", endIso)
      .order("started_at", { ascending: true });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }
    return (data ?? []) as ScreenTimeSessionRow[];
  } catch (error) {
    if (__DEV__) {
      console.warn("[Evidence] Failed to fetch screen time sessions:", error);
    }
    return [];
  }
}

/**
 * Fetch health workouts for a day.
 */
export async function fetchHealthWorkoutsForDay(
  userId: string,
  ymd: string,
): Promise<HealthWorkoutRow[]> {
  const { startIso, endIso } = ymdToDayRange(ymd);

  try {
    const { data, error } = await tmSchema()
      .from("health_workouts")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", startIso)
      .lt("started_at", endIso)
      .order("started_at", { ascending: true });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }
    return (data ?? []) as HealthWorkoutRow[];
  } catch (error) {
    if (__DEV__) {
      console.warn("[Evidence] Failed to fetch health workouts:", error);
    }
    return [];
  }
}

/**
 * Fetch health daily metrics for a day.
 */
export async function fetchHealthDailyForDay(
  userId: string,
  ymd: string,
): Promise<HealthDailyRow | null> {
  try {
    const { data, error } = await tmSchema()
      .from("health_daily_metrics")
      .select("*")
      .eq("user_id", userId)
      .eq("local_date", ymd)
      .limit(1);

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return null;
      }
      throw handleSupabaseError(error);
    }
    const rows = data as HealthDailyRow[] | null;
    return rows?.[0] ?? null;
  } catch (error) {
    if (__DEV__) {
      console.warn("[Evidence] Failed to fetch health daily:", error);
    }
    return null;
  }
}

/**
 * Fetch user's labeled places.
 */
export async function fetchUserPlaces(userId: string): Promise<UserPlaceRow[]> {
  try {
    // Select lat/lng from center geography using PostGIS ST_Y/ST_X for haversine matching
    const { data, error } = await tmSchema()
      .from("user_places")
      .select("id, user_id, label, category, category_id, radius_m, center")
      .eq("user_id", userId)
      .order("label", { ascending: true });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }
    // Extract lat/lng from center GeoJSON (PostGIS returns geography as GeoJSON)
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      label: row.label as string,
      category: (row.category as string) ?? null,
      category_id: (row.category_id as string) ?? null,
      radius_m: row.radius_m as number,
      ...extractLatLngFromCenter(row.center),
    }));
  } catch (error) {
    if (__DEV__) {
      console.warn("[Evidence] Failed to fetch user places:", error);
    }
    return [];
  }
}

/**
 * Extract latitude/longitude from a PostGIS geography center field.
 * PostGIS returns geography as GeoJSON: { type: "Point", coordinates: [lng, lat] }
 */
function extractLatLngFromCenter(center: unknown): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!center) return { latitude: null, longitude: null };
  if (typeof center === "string") {
    // Accept WKT like "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
    const match = center.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (match) {
      return { longitude: Number(match[1]), latitude: Number(match[2]) };
    }
    return { latitude: null, longitude: null };
  }
  if (typeof center !== "object") return { latitude: null, longitude: null };
  const geo = center as { type?: string; coordinates?: number[] };
  if (
    geo.type === "Point" &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length >= 2
  ) {
    return { latitude: geo.coordinates[1], longitude: geo.coordinates[0] };
  }
  return { latitude: null, longitude: null };
}

function coerceLocationHourlyRow(row: Record<string, unknown>): LocationHourlyRow {
  // Prefer direct lat/lng columns from view, fall back to parsing centroid
  let latitude: number | null = typeof row.centroid_latitude === "number" ? row.centroid_latitude : null;
  let longitude: number | null = typeof row.centroid_longitude === "number" ? row.centroid_longitude : null;
  
  // If direct columns are null, try parsing the centroid geography
  if (latitude === null || longitude === null) {
    const latLng = extractLatLngFromCenter(row.centroid);
    latitude = latitude ?? latLng.latitude;
    longitude = longitude ?? latLng.longitude;
  }
  
  return {
    user_id: String(row.user_id ?? ""),
    hour_start: String(row.hour_start ?? ""),
    sample_count: typeof row.sample_count === "number" ? row.sample_count : 0,
    avg_accuracy_m:
      typeof row.avg_accuracy_m === "number" ? row.avg_accuracy_m : null,
    geohash7: typeof row.geohash7 === "string" ? row.geohash7 : null,
    radius_m: typeof row.radius_m === "number" ? row.radius_m : null,
    place_id: typeof row.place_id === "string" ? row.place_id : null,
    place_label: typeof row.place_label === "string" ? row.place_label : null,
    place_category:
      typeof row.place_category === "string" ? row.place_category : null,
    centroid: row.centroid ?? null,
    centroid_latitude: latitude,
    centroid_longitude: longitude,
    google_place_id:
      typeof row.google_place_id === "string" ? row.google_place_id : null,
    google_place_name:
      typeof row.google_place_name === "string" ? row.google_place_name : null,
    google_place_vicinity:
      typeof row.google_place_vicinity === "string"
        ? row.google_place_vicinity
        : null,
    google_place_types: row.google_place_types ?? null,
  };
}

/**
 * Fetch raw location samples for a day, ordered by recorded_at.
 * Used to refine hourly location block boundaries to precise minute-level timestamps.
 */
export async function fetchLocationSamplesForDay(
  userId: string,
  ymd: string,
): Promise<EvidenceLocationSample[]> {
  const { startIso, endIso } = ymdToDayRange(ymd);

  try {
    const { data, error } = await tmSchema()
      .from("location_samples")
      .select("recorded_at, latitude, longitude")
      .eq("user_id", userId)
      .gte("recorded_at", startIso)
      .lt("recorded_at", endIso)
      .order("recorded_at", { ascending: true });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }
    return (data ?? []).map(
      (row: {
        recorded_at: string;
        latitude: number | null;
        longitude: number | null;
      }) => ({
        recorded_at: row.recorded_at,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
      }),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn("[Evidence] Failed to fetch location samples:", error);
    }
    return [];
  }
}

/**
 * Fetch all evidence data for a day in parallel.
 */
export async function fetchAllEvidenceForDay(
  userId: string,
  ymd: string,
): Promise<EvidenceBundle> {
  // Early return if no userId (user not authenticated)
  if (!userId) {
    if (__DEV__) {
      console.warn("[Evidence] fetchAllEvidenceForDay called without userId");
    }
    return {
      locationHourly: [],
      locationSamples: [],
      screenTimeSessions: [],
      healthWorkouts: [],
      healthDaily: [],
      userPlaces: [],
    };
  }

  // Fetch location hourly first (so we can opportunistically resolve place names).
  const initialLocationHourly = await fetchLocationHourlyForDay(userId, ymd);

  const [
    locationSamples,
    screenTimeSessions,
    healthWorkouts,
    healthDaily,
    userPlaces,
    didLookup,
  ] = await Promise.all([
    fetchLocationSamplesForDay(userId, ymd),
    fetchScreenTimeSessionsForDay(userId, ymd),
    fetchHealthWorkoutsForDay(userId, ymd),
    fetchHealthDailyForDay(userId, ymd),
    fetchUserPlaces(userId),
    ensureGooglePlaceNamesForDay({
      userId,
      ymd,
      locationHourly: initialLocationHourly,
    }),
  ]);

  // If we successfully populated the cache, re-fetch hourly rows so the joined
  // google_place_name fields are present immediately.
  const locationHourly = didLookup
    ? await fetchLocationHourlyForDay(userId, ymd)
    : initialLocationHourly;

  return {
    locationHourly,
    locationSamples,
    screenTimeSessions,
    healthWorkouts,
    healthDaily,
    userPlaces,
  };
}

// ============================================================================
// Evidence Analysis Helpers
// ============================================================================

/**
 * Find location data that overlaps with an event's time window.
 */
export function findOverlappingLocations(
  eventStartMinutes: number,
  eventEndMinutes: number,
  locationHourly: LocationHourlyRow[],
): LocationHourlyRow[] {
  return locationHourly.filter((loc) => {
    const hourStart = new Date(loc.hour_start);
    const hourStartMinutes = hourStart.getHours() * 60 + hourStart.getMinutes();
    const hourEndMinutes = hourStartMinutes + 60;

    // Check overlap
    return (
      hourStartMinutes < eventEndMinutes && hourEndMinutes > eventStartMinutes
    );
  });
}

/**
 * Find screen time sessions that overlap with an event's time window.
 */
export function findOverlappingSessions(
  eventStartMinutes: number,
  eventEndMinutes: number,
  ymd: string,
  screenTimeSessions: ScreenTimeSessionRow[],
): ScreenTimeSessionRow[] {
  const dayStart = ymdToDate(ymd);

  return screenTimeSessions.filter((session) => {
    const sessionStart = new Date(session.started_at);
    const sessionEnd = new Date(session.ended_at);

    // Convert to minutes from midnight of the target day
    const sessionStartMinutes =
      (sessionStart.getTime() - dayStart.getTime()) / (60 * 1000);
    const sessionEndMinutes =
      (sessionEnd.getTime() - dayStart.getTime()) / (60 * 1000);

    // Check overlap
    return (
      sessionStartMinutes < eventEndMinutes &&
      sessionEndMinutes > eventStartMinutes
    );
  });
}

/**
 * Find workouts that overlap with an event's time window.
 */
export function findOverlappingWorkouts(
  eventStartMinutes: number,
  eventEndMinutes: number,
  ymd: string,
  healthWorkouts: HealthWorkoutRow[],
): HealthWorkoutRow[] {
  const dayStart = ymdToDate(ymd);

  return healthWorkouts.filter((workout) => {
    const workoutStart = new Date(workout.started_at);
    const workoutEnd = new Date(workout.ended_at);

    // Convert to minutes from midnight of the target day
    const workoutStartMinutes =
      (workoutStart.getTime() - dayStart.getTime()) / (60 * 1000);
    const workoutEndMinutes =
      (workoutEnd.getTime() - dayStart.getTime()) / (60 * 1000);

    // Check overlap
    return (
      workoutStartMinutes < eventEndMinutes &&
      workoutEndMinutes > eventStartMinutes
    );
  });
}

/**
 * Calculate overlap duration between an event and a session/workout.
 */
export function calculateOverlapMinutes(
  eventStartMinutes: number,
  eventEndMinutes: number,
  itemStartMinutes: number,
  itemEndMinutes: number,
): number {
  const overlapStart = Math.max(eventStartMinutes, itemStartMinutes);
  const overlapEnd = Math.min(eventEndMinutes, itemEndMinutes);
  return Math.max(0, overlapEnd - overlapStart);
}

function ymdToDate(ymd: string): Date {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day, 0, 0, 0, 0);
}

// ============================================================================
// Location Evidence for Window (Ingestion Pipeline)
// ============================================================================

/**
 * Processed location evidence for a single time segment within the window.
 * Used by the ingestion pipeline to create location-based events.
 */
export interface LocationEvidence {
  /** Start timestamp of this location evidence segment */
  start: string;
  /** End timestamp of this location evidence segment */
  end: string;
  /** User place ID if location matches a labeled place, null otherwise */
  place_id: string | null;
  /** User place label if matched, null otherwise */
  place_label: string | null;
  /** Latitude of the location (centroid or sample point) */
  latitude: number | null;
  /** Longitude of the location (centroid or sample point) */
  longitude: number | null;
  /** Confidence score 0-1 based on sample count and accuracy */
  confidence: number;
}

/**
 * Raw location sample within a window.
 */
interface WindowLocationSample {
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
}

/**
 * Fetch location evidence for an ingestion window.
 *
 * This function combines data from:
 * 1. tm.location_samples - raw GPS points for precise timestamps
 * 2. tm.location_hourly - aggregated hourly data with place matching
 * 3. tm.user_places - for ST_DWithin matching of samples to labeled places
 *
 * @param userId - User ID to fetch location data for
 * @param windowStart - Start of the ingestion window (ISO timestamp)
 * @param windowEnd - End of the ingestion window (ISO timestamp)
 * @returns Array of LocationEvidence segments with place matching and confidence
 */
export async function fetchLocationEvidenceForWindow(
  userId: string,
  windowStart: string,
  windowEnd: string,
): Promise<LocationEvidence[]> {
  if (!userId) {
    if (__DEV__) {
      console.warn(
        "[Evidence] fetchLocationEvidenceForWindow called without userId",
      );
    }
    return [];
  }

  try {
    // Fetch all three data sources in parallel
    const [locationSamples, locationHourly, userPlaces] = await Promise.all([
      fetchLocationSamplesForWindow(userId, windowStart, windowEnd),
      fetchLocationHourlyForWindow(userId, windowStart, windowEnd),
      fetchUserPlaces(userId),
    ]);

    // If we have no location data, return empty array
    if (locationSamples.length === 0 && locationHourly.length === 0) {
      return [];
    }

    // Build location evidence from the data
    return buildLocationEvidence(
      locationSamples,
      locationHourly,
      userPlaces,
      windowStart,
      windowEnd,
    );
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[Evidence] Failed to fetch location evidence for window:",
        error,
      );
    }
    return [];
  }
}

/**
 * Fetch raw location samples for a specific time window.
 */
async function fetchLocationSamplesForWindow(
  userId: string,
  windowStart: string,
  windowEnd: string,
): Promise<WindowLocationSample[]> {
  try {
    const { data, error } = await tmSchema()
      .from("location_samples")
      .select("recorded_at, latitude, longitude, accuracy_m")
      .eq("user_id", userId)
      .gte("recorded_at", windowStart)
      .lt("recorded_at", windowEnd)
      .order("recorded_at", { ascending: true });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }

    return (data ?? []).map(
      (row: {
        recorded_at: string;
        latitude: number;
        longitude: number;
        accuracy_m: number | null;
      }) => ({
        recorded_at: row.recorded_at,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy_m: row.accuracy_m ?? null,
      }),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[Evidence] Failed to fetch location samples for window:",
        error,
      );
    }
    return [];
  }
}

/**
 * Fetch location hourly aggregates that overlap with a specific time window.
 * The hourly view already joins with user_places for place matching.
 */
async function fetchLocationHourlyForWindow(
  userId: string,
  windowStart: string,
  windowEnd: string,
): Promise<LocationHourlyRow[]> {
  // Expand to include hours that might overlap with the window
  const windowStartDate = new Date(windowStart);
  const windowEndDate = new Date(windowEnd);

  // Floor windowStart to the hour
  const hourStart = new Date(windowStartDate);
  hourStart.setMinutes(0, 0, 0);

  // Ceil windowEnd to the next hour
  const hourEnd = new Date(windowEndDate);
  if (hourEnd.getMinutes() > 0 || hourEnd.getSeconds() > 0) {
    hourEnd.setHours(hourEnd.getHours() + 1);
    hourEnd.setMinutes(0, 0, 0);
  }

  try {
    const { data, error } = await tmSchema()
      .from("location_hourly")
      .select("*")
      .eq("user_id", userId)
      .gte("hour_start", hourStart.toISOString())
      .lt("hour_start", hourEnd.toISOString())
      .order("hour_start", { ascending: true });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map(coerceLocationHourlyRow);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[Evidence] Failed to fetch location hourly for window:",
        error,
      );
    }
    return [];
  }
}

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
 * Uses haversine distance to replicate ST_DWithin behavior.
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

    // Check if within radius and closer than current best
    if (distance <= place.radius_m && distance < bestDistance) {
      bestMatch = place;
      bestDistance = distance;
    }
  }

  return bestMatch;
}

/**
 * Calculate confidence score based on sample count and accuracy.
 * Higher sample count and better accuracy = higher confidence.
 */
function calculateConfidence(
  sampleCount: number,
  avgAccuracyM: number | null,
): number {
  // Base confidence from sample count (0.3-0.7)
  // More samples = higher confidence, up to ~10 samples per 30-min window
  const countConfidence = Math.min(0.7, 0.3 + (sampleCount / 10) * 0.4);

  // Accuracy bonus (0-0.3)
  // Under 20m = excellent, under 50m = good, under 100m = okay
  let accuracyBonus = 0;
  if (avgAccuracyM !== null) {
    if (avgAccuracyM <= 20) {
      accuracyBonus = 0.3;
    } else if (avgAccuracyM <= 50) {
      accuracyBonus = 0.2;
    } else if (avgAccuracyM <= 100) {
      accuracyBonus = 0.1;
    }
  }

  return Math.min(1, countConfidence + accuracyBonus);
}

/**
 * Build location evidence from raw samples, hourly aggregates, and user places.
 *
 * Strategy:
 * 1. If we have raw samples, group them into segments by place matching
 * 2. Fall back to hourly aggregates if no raw samples
 * 3. Match each segment to user places using ST_DWithin logic (haversine distance)
 */
function buildLocationEvidence(
  samples: WindowLocationSample[],
  hourlyData: LocationHourlyRow[],
  userPlaces: UserPlaceRow[],
  windowStart: string,
  windowEnd: string,
): LocationEvidence[] {
  const evidence: LocationEvidence[] = [];

  if (samples.length > 0) {
    // Build evidence from raw samples
    // Group consecutive samples that match the same place
    let currentSegment: {
      start: string;
      end: string;
      place: UserPlaceRow | null;
      samples: WindowLocationSample[];
    } | null = null;

    for (const sample of samples) {
      const matchingPlace = findMatchingPlace(
        sample.latitude,
        sample.longitude,
        userPlaces,
      );
      const placeId = matchingPlace?.id ?? null;

      if (currentSegment === null) {
        // Start first segment
        currentSegment = {
          start: sample.recorded_at,
          end: sample.recorded_at,
          place: matchingPlace,
          samples: [sample],
        };
      } else if (
        currentSegment.place?.id === placeId ||
        (currentSegment.place === null && placeId === null)
      ) {
        // Same place, extend segment
        currentSegment.end = sample.recorded_at;
        currentSegment.samples.push(sample);
      } else {
        // Different place, finalize current segment and start new one
        evidence.push(
          createEvidenceFromSegment(currentSegment, windowStart, windowEnd),
        );
        currentSegment = {
          start: sample.recorded_at,
          end: sample.recorded_at,
          place: matchingPlace,
          samples: [sample],
        };
      }
    }

    // Finalize last segment
    if (currentSegment) {
      evidence.push(
        createEvidenceFromSegment(currentSegment, windowStart, windowEnd),
      );
    }
  } else if (hourlyData.length > 0) {
    // Fall back to hourly aggregates
    for (const hourly of hourlyData) {
      const hourStart = new Date(hourly.hour_start);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);

      // Clamp to window boundaries
      const windowStartDate = new Date(windowStart);
      const windowEndDate = new Date(windowEnd);
      const segmentStart = new Date(
        Math.max(hourStart.getTime(), windowStartDate.getTime()),
      );
      const segmentEnd = new Date(
        Math.min(hourEnd.getTime(), windowEndDate.getTime()),
      );

      // Skip if segment doesn't overlap with window
      if (segmentStart >= segmentEnd) continue;

      evidence.push({
        start: segmentStart.toISOString(),
        end: segmentEnd.toISOString(),
        place_id: hourly.place_id,
        place_label: hourly.place_label,
        latitude: hourly.centroid_latitude ?? null,
        longitude: hourly.centroid_longitude ?? null,
        confidence: calculateConfidence(
          hourly.sample_count,
          hourly.avg_accuracy_m,
        ),
      });
    }
  }

  return evidence;
}

/**
 * Create a LocationEvidence object from a segment of samples.
 */
function createEvidenceFromSegment(
  segment: {
    start: string;
    end: string;
    place: UserPlaceRow | null;
    samples: WindowLocationSample[];
  },
  windowStart: string,
  windowEnd: string,
): LocationEvidence {
  // Calculate centroid from samples
  let latSum = 0;
  let lonSum = 0;
  let accuracySum = 0;
  let accuracyCount = 0;

  for (const sample of segment.samples) {
    latSum += sample.latitude;
    lonSum += sample.longitude;
    if (sample.accuracy_m !== null) {
      accuracySum += sample.accuracy_m;
      accuracyCount++;
    }
  }

  const avgLat = latSum / segment.samples.length;
  const avgLon = lonSum / segment.samples.length;
  const avgAccuracy = accuracyCount > 0 ? accuracySum / accuracyCount : null;

  // Clamp segment boundaries to window
  const windowStartDate = new Date(windowStart);
  const windowEndDate = new Date(windowEnd);
  const segmentStartDate = new Date(segment.start);
  const segmentEndDate = new Date(segment.end);

  const clampedStart = new Date(
    Math.max(segmentStartDate.getTime(), windowStartDate.getTime()),
  );
  const clampedEnd = new Date(
    Math.min(segmentEndDate.getTime(), windowEndDate.getTime()),
  );

  return {
    start: clampedStart.toISOString(),
    end: clampedEnd.toISOString(),
    place_id: segment.place?.id ?? null,
    place_label: segment.place?.label ?? null,
    latitude: avgLat,
    longitude: avgLon,
    confidence: calculateConfidence(segment.samples.length, avgAccuracy),
  };
}
