import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

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
    return (data ?? []) as LocationHourlyRow[];
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
  if (!center || typeof center !== "object")
    return { latitude: null, longitude: null };
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
  const [
    locationHourly,
    locationSamples,
    screenTimeSessions,
    healthWorkouts,
    healthDaily,
    userPlaces,
  ] = await Promise.all([
    fetchLocationHourlyForDay(userId, ymd),
    fetchLocationSamplesForDay(userId, ymd),
    fetchScreenTimeSessionsForDay(userId, ymd),
    fetchHealthWorkoutsForDay(userId, ymd),
    fetchHealthDailyForDay(userId, ymd),
    fetchUserPlaces(userId),
  ]);

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
