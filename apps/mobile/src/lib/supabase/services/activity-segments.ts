/**
 * Activity Segments Service (BRAVO Layer)
 *
 * Transforms ALPHA layer data (location samples, screen time sessions)
 * into enriched activity segments for the hourly summary pipeline.
 *
 * This is purely algorithmic - no AI calls.
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

import {
  type EvidenceLocationSample,
  type ScreenTimeSessionRow,
  type HealthWorkoutRow,
  type UserPlaceRow,
  fetchUserPlaces,
} from "./evidence-data";

import {
  generateLocationSegments,
  mergeAdjacentSegments,
  type LocationSegment,
} from "./actual-ingestion";

import {
  type AppCategory,
  type AppSummary,
  type UserAppCategoryOverrides,
  getAppCategory,
} from "./app-categories";

import { fetchUserAppCategoryOverridesForIntent } from "./user-app-categories";

// ============================================================================
// Types
// ============================================================================

/**
 * App usage breakdown within a segment.
 */
export interface AppBreakdownItem {
  /** App identifier (bundle id or app name) */
  appId: string;
  /** Display name of the app */
  displayName: string;
  /** App category */
  category: AppCategory;
  /** Duration in seconds */
  seconds: number;
}

/**
 * Evidence tracking for confidence calculation.
 */
export interface SegmentEvidence {
  /** Number of location samples used */
  locationSamples: number;
  /** Number of screen time sessions used */
  screenSessions: number;
  /** Whether health data was available */
  hasHealthData: boolean;
}

/**
 * Activity types that can be inferred from data.
 */
export type InferredActivityType =
  | "workout"
  | "sleep"
  | "commute"
  | "deep_work"
  | "collaborative_work"
  | "meeting"
  | "distracted_time"
  | "leisure"
  | "extended_social"
  | "social_break"
  | "personal_time"
  | "away_from_desk"
  | "offline_activity"
  | "mixed_activity";

/**
 * Activity segment for the BRAVO layer.
 * Enriched activity block derived from raw telemetry.
 */
export interface ActivitySegment {
  /** Unique identifier */
  id: string;
  /** User ID */
  userId: string;
  /** Start timestamp */
  startedAt: Date;
  /** End timestamp */
  endedAt: Date;
  /** Hour bucket for indexing (floor to hour) */
  hourBucket: Date;
  /** User place ID if matched */
  placeId: string | null;
  /** Denormalized place label */
  placeLabel: string | null;
  /** Place category (work, home, gym, etc.) or 'commute' */
  placeCategory: string | null;
  /** Centroid latitude */
  locationLat: number | null;
  /** Centroid longitude */
  locationLng: number | null;
  /** Inferred activity type */
  inferredActivity: InferredActivityType;
  /** Confidence score (0.00 to 1.00) */
  activityConfidence: number;
  /** Top apps used (up to 5) */
  topApps: AppBreakdownItem[];
  /** Total screen time in seconds */
  totalScreenSeconds: number;
  /** Evidence tracking */
  evidence: SegmentEvidence;
  /** Source IDs from ALPHA layer */
  sourceIds: string[];
}

/**
 * Health data context for activity inference.
 */
export interface HealthDataContext {
  /** Whether a workout was detected in this period */
  hasWorkout: boolean;
  /** Workout activity type if available */
  workoutType: string | null;
  /** Whether user is sleeping (based on health data) */
  isSleeping: boolean;
}

/**
 * Context for inferring activity type.
 */
interface ActivityContext {
  placeCategory: string | null;
  appBreakdown: AppBreakdownItem[];
  timeOfDay: number;
  dayOfWeek: number;
  healthData: HealthDataContext | null;
}

/**
 * Evidence for confidence calculation.
 */
interface ConfidenceEvidence {
  locationSampleCount: number;
  screenSessionCount: number;
  placeMatchRatio: number;
  appCategoryConsensus: number;
}

// ============================================================================
// Helpers
// ============================================================================

// Helper to get the tm schema client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

/**
 * Generate a UUID v4.
 */
function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get hour of day from a date (0-23).
 */
function getHourOfDay(date: Date): number {
  return date.getHours();
}

/**
 * Get day of week from a date (0 = Sunday, 6 = Saturday).
 */
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Floor a date to the start of the hour.
 */
function floorToHour(date: Date): Date {
  const result = new Date(date);
  result.setMinutes(0, 0, 0);
  return result;
}

/**
 * Check if a screen time session overlaps with a time range.
 */
function sessionOverlapsRange(
  session: ScreenTimeSessionRow,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const sessionStart = new Date(session.started_at);
  const sessionEnd = new Date(session.ended_at);
  return sessionStart < rangeEnd && sessionEnd > rangeStart;
}

/**
 * Calculate the overlap duration in seconds between a session and a time range.
 */
function calculateOverlapSeconds(
  session: ScreenTimeSessionRow,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const sessionStart = new Date(session.started_at);
  const sessionEnd = new Date(session.ended_at);

  const overlapStart = Math.max(sessionStart.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(sessionEnd.getTime(), rangeEnd.getTime());

  if (overlapEnd <= overlapStart) return 0;

  return Math.round((overlapEnd - overlapStart) / 1000);
}

/**
 * Calculate app breakdown from overlapping screen time sessions.
 */
function calculateAppBreakdown(
  sessions: ScreenTimeSessionRow[],
  rangeStart: Date,
  rangeEnd: Date,
  userOverrides: UserAppCategoryOverrides | null,
): AppBreakdownItem[] {
  const appUsage = new Map<
    string,
    { displayName: string; category: AppCategory; seconds: number }
  >();

  for (const session of sessions) {
    const overlapSeconds = calculateOverlapSeconds(session, rangeStart, rangeEnd);
    if (overlapSeconds <= 0) continue;

    const appId = session.app_id;
    const displayName = session.display_name || appId;
    const category = getAppCategory(appId, userOverrides);

    // Skip ignored apps
    if (category === "ignore") continue;

    const existing = appUsage.get(appId);
    if (existing) {
      existing.seconds += overlapSeconds;
    } else {
      appUsage.set(appId, { displayName, category, seconds: overlapSeconds });
    }
  }

  // Convert to array and sort by duration descending
  const breakdown: AppBreakdownItem[] = [];
  for (const [appId, usage] of appUsage) {
    breakdown.push({
      appId,
      displayName: usage.displayName,
      category: usage.category,
      seconds: usage.seconds,
    });
  }

  breakdown.sort((a, b) => b.seconds - a.seconds);

  return breakdown;
}

/**
 * Get the dominant app category from a breakdown.
 */
function getDominantAppCategory(breakdown: AppBreakdownItem[]): AppCategory | null {
  if (breakdown.length === 0) return null;

  const categorySeconds = new Map<AppCategory, number>();

  for (const app of breakdown) {
    const current = categorySeconds.get(app.category) || 0;
    categorySeconds.set(app.category, current + app.seconds);
  }

  let dominant: AppCategory | null = null;
  let maxSeconds = 0;

  for (const [category, seconds] of categorySeconds) {
    if (seconds > maxSeconds) {
      maxSeconds = seconds;
      dominant = category;
    }
  }

  return dominant;
}

/**
 * Get total screen time in minutes from a breakdown.
 */
function getTotalMinutes(breakdown: AppBreakdownItem[]): number {
  const totalSeconds = breakdown.reduce((sum, app) => sum + app.seconds, 0);
  return Math.round(totalSeconds / 60);
}

/**
 * Get percentage of a specific category in the breakdown.
 */
function getCategoryPercentage(
  breakdown: AppBreakdownItem[],
  category: AppCategory,
): number {
  const totalSeconds = breakdown.reduce((sum, app) => sum + app.seconds, 0);
  if (totalSeconds === 0) return 0;

  const categorySeconds = breakdown
    .filter((app) => app.category === category)
    .reduce((sum, app) => sum + app.seconds, 0);

  return categorySeconds / totalSeconds;
}

/**
 * Check if the time is during typical work hours (9 AM - 6 PM on weekdays).
 */
function isWorkHours(timeOfDay: number, dayOfWeek: number): boolean {
  // Weekends are not work hours
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // 9 AM to 6 PM is work hours
  return timeOfDay >= 9 && timeOfDay < 18;
}

/**
 * Calculate app category consensus (how much agreement there is).
 * Higher consensus means more confidence in the activity type inference.
 */
function calculateCategoryConsensus(breakdown: AppBreakdownItem[]): number {
  if (breakdown.length === 0) return 0;

  const totalSeconds = breakdown.reduce((sum, app) => sum + app.seconds, 0);
  if (totalSeconds === 0) return 0;

  const categorySeconds = new Map<AppCategory, number>();

  for (const app of breakdown) {
    const current = categorySeconds.get(app.category) || 0;
    categorySeconds.set(app.category, current + app.seconds);
  }

  // Find the dominant category's percentage
  let maxPercentage = 0;
  for (const seconds of categorySeconds.values()) {
    const percentage = seconds / totalSeconds;
    if (percentage > maxPercentage) {
      maxPercentage = percentage;
    }
  }

  return maxPercentage;
}

/**
 * Infer activity type from enriched data.
 * Pure algorithmic logic - no AI.
 */
export function inferActivityType(context: ActivityContext): InferredActivityType {
  const { placeCategory, appBreakdown, timeOfDay, dayOfWeek, healthData } = context;

  // Priority 1: Health data trumps everything
  if (healthData?.hasWorkout) {
    return "workout";
  }
  if (healthData?.isSleeping) {
    return "sleep";
  }

  // Priority 2: Commute detection
  if (placeCategory === "commute") {
    return "commute";
  }

  // Priority 3: Infer from app usage
  const dominantCategory = getDominantAppCategory(appBreakdown);
  const screenMinutes = getTotalMinutes(appBreakdown);

  // High screen time with work apps = deep work
  if (dominantCategory === "work" && screenMinutes > 30) {
    // Check for comms mixed in
    const commsPercent = getCategoryPercentage(appBreakdown, "comms");
    if (commsPercent > 0.4) {
      return "collaborative_work"; // Meetings, pair programming
    }
    return "deep_work";
  }

  // High comms with low work = meetings/calls
  if (dominantCategory === "comms" && screenMinutes > 20) {
    return "meeting";
  }

  // Entertainment during typical work hours = distracted
  if (dominantCategory === "entertainment") {
    if (isWorkHours(timeOfDay, dayOfWeek)) {
      return "distracted_time";
    }
    return "leisure";
  }

  // Social media
  if (dominantCategory === "social") {
    if (screenMinutes > 30) {
      return "extended_social";
    }
    return "social_break";
  }

  // Low screen time at known places
  if (screenMinutes < 5) {
    if (placeCategory === "home") {
      return "personal_time";
    }
    if (placeCategory === "work") {
      return "away_from_desk";
    }
    return "offline_activity";
  }

  // Fallback
  return "mixed_activity";
}

/**
 * Calculate confidence score (0-1) for an activity segment.
 */
export function calculateConfidenceScore(evidence: ConfidenceEvidence): number {
  let score = 0;

  // Location confidence (0-0.4)
  if (evidence.locationSampleCount >= 10) {
    score += 0.4 * Math.min(1, evidence.placeMatchRatio);
  } else if (evidence.locationSampleCount >= 5) {
    score += 0.2 * Math.min(1, evidence.placeMatchRatio);
  }

  // Screen time confidence (0-0.3)
  if (evidence.screenSessionCount >= 5) {
    score += 0.3;
  } else if (evidence.screenSessionCount >= 2) {
    score += 0.15;
  }

  // Category consensus (0-0.3)
  score += 0.3 * evidence.appCategoryConsensus;

  return Math.min(1, Math.max(0, score));
}

// ============================================================================
// Data Fetchers
// ============================================================================

/**
 * Fetch location samples for a specific hour.
 */
export async function fetchLocationSamplesForHour(
  userId: string,
  hourStart: Date,
  hourEnd: Date,
): Promise<EvidenceLocationSample[]> {
  try {
    const { data, error } = await tmSchema()
      .from("location_samples")
      .select("recorded_at, latitude, longitude")
      .eq("user_id", userId)
      .gte("recorded_at", hourStart.toISOString())
      .lt("recorded_at", hourEnd.toISOString())
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
      console.warn("[ActivitySegments] Failed to fetch location samples:", error);
    }
    return [];
  }
}

/**
 * Fetch screen time sessions for a specific hour.
 */
export async function fetchScreenTimeSessionsForHour(
  userId: string,
  hourStart: Date,
  hourEnd: Date,
): Promise<ScreenTimeSessionRow[]> {
  try {
    const { data, error } = await tmSchema()
      .from("screen_time_app_sessions")
      .select("*")
      .eq("user_id", userId)
      // Sessions that overlap with this hour
      .lt("started_at", hourEnd.toISOString())
      .gt("ended_at", hourStart.toISOString())
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
      console.warn("[ActivitySegments] Failed to fetch screen time sessions:", error);
    }
    return [];
  }
}

/**
 * Fetch health workouts for a specific hour.
 */
export async function fetchHealthWorkoutsForHour(
  userId: string,
  hourStart: Date,
  hourEnd: Date,
): Promise<HealthWorkoutRow[]> {
  try {
    const { data, error } = await tmSchema()
      .from("health_workouts")
      .select("*")
      .eq("user_id", userId)
      // Workouts that overlap with this hour
      .lt("started_at", hourEnd.toISOString())
      .gt("ended_at", hourStart.toISOString())
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
      console.warn("[ActivitySegments] Failed to fetch health workouts:", error);
    }
    return [];
  }
}

/**
 * Build health data context from workouts.
 */
function buildHealthDataContext(
  workouts: HealthWorkoutRow[],
  hourStart: Date,
  hourEnd: Date,
): HealthDataContext | null {
  if (workouts.length === 0) {
    return null;
  }

  // Find a workout that overlaps with this hour
  const overlappingWorkout = workouts.find((w) => {
    const workoutStart = new Date(w.started_at);
    const workoutEnd = new Date(w.ended_at);
    return workoutStart < hourEnd && workoutEnd > hourStart;
  });

  if (!overlappingWorkout) {
    return null;
  }

  return {
    hasWorkout: true,
    workoutType: overlappingWorkout.activity_type,
    isSleeping: false, // Would need sleep data from health_daily_metrics
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate BRAVO layer activity segments from ALPHA layer data.
 * This is PURELY ALGORITHMIC - no AI calls.
 *
 * @param userId - User ID
 * @param hourStart - Start of the hour to process
 * @returns Array of ActivitySegment objects for the hour
 */
export async function generateActivitySegments(
  userId: string,
  hourStart: Date,
): Promise<ActivitySegment[]> {
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

  // 1. Fetch ALPHA layer data for this hour
  const [locationSamples, screenSessions, healthWorkouts, userPlaces, userAppOverrides] =
    await Promise.all([
      fetchLocationSamplesForHour(userId, hourStart, hourEnd),
      fetchScreenTimeSessionsForHour(userId, hourStart, hourEnd),
      fetchHealthWorkoutsForHour(userId, hourStart, hourEnd),
      fetchUserPlaces(userId),
      fetchUserAppCategoryOverridesForIntent(userId),
    ]);

  // 2. Generate location segments using existing algorithm
  const locationSegments = generateLocationSegments(
    locationSamples,
    userPlaces,
    hourStart,
    hourEnd,
  );

  // 3. Merge adjacent segments
  const mergedSegments = mergeAdjacentSegments(locationSegments);

  // If no location segments, create a single segment for the hour
  // based on screen time data alone
  if (mergedSegments.length === 0 && screenSessions.length > 0) {
    const appBreakdown = calculateAppBreakdown(
      screenSessions,
      hourStart,
      hourEnd,
      userAppOverrides,
    );

    if (appBreakdown.length > 0) {
      const healthContext = buildHealthDataContext(healthWorkouts, hourStart, hourEnd);
      const inferredActivity = inferActivityType({
        placeCategory: null,
        appBreakdown,
        timeOfDay: getHourOfDay(hourStart),
        dayOfWeek: getDayOfWeek(hourStart),
        healthData: healthContext,
      });

      const confidence = calculateConfidenceScore({
        locationSampleCount: 0,
        screenSessionCount: screenSessions.length,
        placeMatchRatio: 0,
        appCategoryConsensus: calculateCategoryConsensus(appBreakdown),
      });

      return [
        {
          id: generateUuid(),
          userId,
          startedAt: hourStart,
          endedAt: hourEnd,
          hourBucket: floorToHour(hourStart),
          placeId: null,
          placeLabel: null,
          placeCategory: null,
          locationLat: null,
          locationLng: null,
          inferredActivity,
          activityConfidence: confidence,
          topApps: appBreakdown.slice(0, 5),
          totalScreenSeconds: appBreakdown.reduce((sum, app) => sum + app.seconds, 0),
          evidence: {
            locationSamples: 0,
            screenSessions: screenSessions.length,
            hasHealthData: healthContext !== null,
          },
          sourceIds: screenSessions.map((s) => s.id),
        },
      ];
    }
  }

  // 4. Enrich each segment with screen time data
  const enrichedSegments: ActivitySegment[] = [];

  for (const segment of mergedSegments) {
    // Find screen sessions overlapping this segment
    const overlappingSessions = screenSessions.filter((session) =>
      sessionOverlapsRange(session, segment.start, segment.end),
    );

    // Calculate app breakdown
    const appBreakdown = calculateAppBreakdown(
      overlappingSessions,
      segment.start,
      segment.end,
      userAppOverrides,
    );

    // Build health data context
    const healthContext = buildHealthDataContext(healthWorkouts, segment.start, segment.end);

    // Get place category from user places
    const userPlace = segment.placeId
      ? userPlaces.find((p) => p.id === segment.placeId)
      : null;
    const placeCategory =
      segment.meta.kind === "commute"
        ? "commute"
        : userPlace?.category ?? null;

    // Infer activity type from app usage + location
    const inferredActivity = inferActivityType({
      placeCategory,
      appBreakdown,
      timeOfDay: getHourOfDay(segment.start),
      dayOfWeek: getDayOfWeek(segment.start),
      healthData: healthContext,
    });

    // Calculate confidence score
    const confidence = calculateConfidenceScore({
      locationSampleCount: segment.sampleCount,
      screenSessionCount: overlappingSessions.length,
      placeMatchRatio: segment.confidence, // Use segment's match ratio
      appCategoryConsensus: calculateCategoryConsensus(appBreakdown),
    });

    enrichedSegments.push({
      id: generateUuid(),
      userId,
      startedAt: segment.start,
      endedAt: segment.end,
      hourBucket: floorToHour(hourStart),
      placeId: segment.placeId,
      placeLabel: segment.placeLabel,
      placeCategory,
      locationLat: segment.latitude,
      locationLng: segment.longitude,
      inferredActivity,
      activityConfidence: confidence,
      topApps: appBreakdown.slice(0, 5),
      totalScreenSeconds: appBreakdown.reduce((sum, app) => sum + app.seconds, 0),
      evidence: {
        locationSamples: segment.sampleCount,
        screenSessions: overlappingSessions.length,
        hasHealthData: healthContext !== null,
      },
      sourceIds: [
        segment.sourceId,
        ...overlappingSessions.map((s) => s.id),
      ],
    });
  }

  return enrichedSegments;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Save activity segments to the database.
 * Uses upsert to handle re-processing of the same hour.
 */
export async function saveActivitySegments(
  segments: ActivitySegment[],
): Promise<boolean> {
  if (segments.length === 0) return true;

  try {
    const rows = segments.map((seg) => ({
      id: seg.id,
      user_id: seg.userId,
      started_at: seg.startedAt.toISOString(),
      ended_at: seg.endedAt.toISOString(),
      hour_bucket: seg.hourBucket.toISOString(),
      place_id: seg.placeId,
      place_label: seg.placeLabel,
      place_category: seg.placeCategory,
      location_lat: seg.locationLat,
      location_lng: seg.locationLng,
      inferred_activity: seg.inferredActivity,
      activity_confidence: seg.activityConfidence,
      top_apps: seg.topApps,
      total_screen_seconds: seg.totalScreenSeconds,
      evidence: seg.evidence,
      source_ids: seg.sourceIds,
    }));

    const { error } = await tmSchema()
      .from("activity_segments")
      .upsert(rows, { onConflict: "id" });

    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivitySegments] Failed to save segments:", error);
    }
    return false;
  }
}

/**
 * Fetch activity segments for a specific hour.
 */
export async function fetchActivitySegmentsForHour(
  userId: string,
  hourStart: Date,
): Promise<ActivitySegment[]> {
  try {
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const { data, error } = await tmSchema()
      .from("activity_segments")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", hourStart.toISOString())
      .lt("started_at", hourEnd.toISOString())
      .order("started_at", { ascending: true });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      userId: row.user_id as string,
      startedAt: new Date(row.started_at as string),
      endedAt: new Date(row.ended_at as string),
      hourBucket: new Date(row.hour_bucket as string),
      placeId: (row.place_id as string) ?? null,
      placeLabel: (row.place_label as string) ?? null,
      placeCategory: (row.place_category as string) ?? null,
      locationLat: (row.location_lat as number) ?? null,
      locationLng: (row.location_lng as number) ?? null,
      inferredActivity: row.inferred_activity as InferredActivityType,
      activityConfidence: row.activity_confidence as number,
      topApps: (row.top_apps as AppBreakdownItem[]) ?? [],
      totalScreenSeconds: (row.total_screen_seconds as number) ?? 0,
      evidence: (row.evidence as SegmentEvidence) ?? {
        locationSamples: 0,
        screenSessions: 0,
        hasHealthData: false,
      },
      sourceIds: (row.source_ids as string[]) ?? [],
    }));
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivitySegments] Failed to fetch segments:", error);
    }
    return [];
  }
}

/**
 * Delete activity segments for a specific hour (for re-processing).
 */
export async function deleteActivitySegmentsForHour(
  userId: string,
  hourStart: Date,
): Promise<boolean> {
  try {
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const { error } = await tmSchema()
      .from("activity_segments")
      .delete()
      .eq("user_id", userId)
      .gte("started_at", hourStart.toISOString())
      .lt("started_at", hourEnd.toISOString());

    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivitySegments] Failed to delete segments:", error);
    }
    return false;
  }
}
