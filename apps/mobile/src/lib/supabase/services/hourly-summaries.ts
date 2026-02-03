/**
 * Hourly Summaries Service (CHARLIE Layer)
 *
 * Generates user-facing hourly summaries from BRAVO layer activity segments.
 * Uses template-based title/description generation (no AI for now).
 *
 * This respects locked summaries (user edits) and won't overwrite them.
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

import {
  type ActivitySegment,
  type AppBreakdownItem,
  type InferredActivityType,
  fetchActivitySegmentsForHour,
} from "./activity-segments";

// ============================================================================
// Types
// ============================================================================

/**
 * Evidence strength levels for data quality indication.
 */
export type EvidenceStrength = "low" | "medium" | "high";

/**
 * App breakdown item for hourly summary (in minutes).
 */
export interface SummaryAppBreakdown {
  /** App identifier */
  appId: string;
  /** Display name */
  displayName: string;
  /** App category */
  category: string;
  /** Duration in minutes */
  minutes: number;
}

/**
 * Aggregated data from multiple segments.
 */
export interface AggregatedData {
  /** Dominant place ID (most time spent) */
  dominantPlaceId: string | null;
  /** Dominant place label */
  dominantPlaceLabel: string | null;
  /** Destination place label (for commutes) */
  destinationPlaceLabel: string | null;
  /** Dominant activity type */
  dominantActivity: InferredActivityType;
  /** Total duration in seconds */
  durationSeconds: number;
  /** Combined app breakdown (in minutes) */
  appBreakdown: SummaryAppBreakdown[];
  /** Total screen time in seconds */
  totalScreenSeconds: number;
  /** Average confidence across segments */
  averageConfidence: number;
  /** Total location samples */
  totalLocationSamples: number;
  /** Total screen sessions */
  totalScreenSessions: number;
}

/**
 * Hourly summary for the CHARLIE layer.
 * User-facing summary with feedback capabilities.
 */
export interface HourlySummary {
  /** Unique identifier */
  id: string;
  /** User ID */
  userId: string;
  /** Start of the hour (e.g., 2026-02-01T09:00:00Z) */
  hourStart: Date;
  /** Local date for easy day queries */
  localDate: string; // YYYY-MM-DD format
  /** Hour of day (0-23) */
  hourOfDay: number;
  /** Summary title (e.g., "Office - Deep Work") */
  title: string;
  /** Summary description */
  description: string | null;
  /** Primary place ID */
  primaryPlaceId: string | null;
  /** Primary place label */
  primaryPlaceLabel: string | null;
  /** Primary activity type */
  primaryActivity: InferredActivityType | null;
  /** App usage breakdown */
  appBreakdown: SummaryAppBreakdown[];
  /** Total screen time in minutes */
  totalScreenMinutes: number;
  /** Confidence score (0.00 to 1.00) */
  confidenceScore: number;
  /** Evidence strength (low, medium, high) */
  evidenceStrength: EvidenceStrength;
  /** User feedback (accurate, inaccurate, null) */
  userFeedback: string | null;
  /** User edits tracking */
  userEdits: Record<string, unknown> | null;
  /** When user confirmed/edited (locked) */
  lockedAt: Date | null;
  /** Whether AI was used to generate */
  aiGenerated: boolean;
  /** AI model used (if any) */
  aiModel: string | null;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
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
 * Format date as YYYY-MM-DD in local timezone.
 */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Human-readable activity names.
 */
export const ACTIVITY_LABELS: Record<InferredActivityType, string> = {
  workout: "Workout",
  sleep: "Sleep",
  commute: "Commute",
  deep_work: "Deep Work",
  collaborative_work: "Collaborative Work",
  meeting: "Meeting",
  distracted_time: "Distracted Time",
  leisure: "Leisure",
  extended_social: "Social Time",
  social_break: "Social Break",
  personal_time: "Personal Time",
  away_from_desk: "Away from Desk",
  offline_activity: "Offline Activity",
  mixed_activity: "Mixed Activity",
};

/**
 * Convert activity type to human-readable label.
 */
export function humanizeActivity(activity: InferredActivityType | null): string {
  if (!activity) return "Activity";
  return ACTIVITY_LABELS[activity] || "Activity";
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Aggregate multiple segments into combined data.
 */
export function aggregateSegments(segments: ActivitySegment[]): AggregatedData {
  if (segments.length === 0) {
    return {
      dominantPlaceId: null,
      dominantPlaceLabel: null,
      destinationPlaceLabel: null,
      dominantActivity: "mixed_activity",
      durationSeconds: 0,
      appBreakdown: [],
      totalScreenSeconds: 0,
      averageConfidence: 0,
      totalLocationSamples: 0,
      totalScreenSessions: 0,
    };
  }

  // Calculate duration per place
  const placeDurations = new Map<string | null, number>();
  const placeLabels = new Map<string | null, string | null>();

  // Calculate duration per activity
  const activityDurations = new Map<InferredActivityType, number>();

  // Combine app usage
  const appUsage = new Map<
    string,
    { displayName: string; category: string; seconds: number }
  >();

  let totalDuration = 0;
  let totalScreenSeconds = 0;
  let totalConfidence = 0;
  let totalLocationSamples = 0;
  let totalScreenSessions = 0;

  // Track last place for commute destination
  let lastPlaceLabel: string | null = null;

  for (const segment of segments) {
    const duration =
      (segment.endedAt.getTime() - segment.startedAt.getTime()) / 1000;
    totalDuration += duration;
    totalScreenSeconds += segment.totalScreenSeconds;
    totalConfidence += segment.activityConfidence;
    totalLocationSamples += segment.evidence.locationSamples;
    totalScreenSessions += segment.evidence.screenSessions;

    // Track place durations
    const currentDuration = placeDurations.get(segment.placeId) || 0;
    placeDurations.set(segment.placeId, currentDuration + duration);
    placeLabels.set(segment.placeId, segment.placeLabel);

    // Track activity durations
    const currentActivityDuration =
      activityDurations.get(segment.inferredActivity) || 0;
    activityDurations.set(
      segment.inferredActivity,
      currentActivityDuration + duration,
    );

    // Track app usage
    for (const app of segment.topApps) {
      const existing = appUsage.get(app.appId);
      if (existing) {
        existing.seconds += app.seconds;
      } else {
        appUsage.set(app.appId, {
          displayName: app.displayName,
          category: app.category,
          seconds: app.seconds,
        });
      }
    }

    // Track last place for commute destination
    if (segment.placeLabel) {
      lastPlaceLabel = segment.placeLabel;
    }
  }

  // Find dominant place (most time)
  let dominantPlaceId: string | null = null;
  let maxPlaceDuration = 0;
  for (const [placeId, duration] of placeDurations) {
    if (duration > maxPlaceDuration) {
      maxPlaceDuration = duration;
      dominantPlaceId = placeId;
    }
  }

  // Find dominant activity (most time)
  let dominantActivity: InferredActivityType = "mixed_activity";
  let maxActivityDuration = 0;
  for (const [activity, duration] of activityDurations) {
    if (duration > maxActivityDuration) {
      maxActivityDuration = duration;
      dominantActivity = activity;
    }
  }

  // Convert app usage to breakdown (in minutes)
  const appBreakdown: SummaryAppBreakdown[] = [];
  for (const [appId, usage] of appUsage) {
    appBreakdown.push({
      appId,
      displayName: usage.displayName,
      category: usage.category,
      minutes: Math.round(usage.seconds / 60),
    });
  }
  // Sort by minutes descending
  appBreakdown.sort((a, b) => b.minutes - a.minutes);

  return {
    dominantPlaceId,
    dominantPlaceLabel: placeLabels.get(dominantPlaceId) ?? null,
    destinationPlaceLabel: lastPlaceLabel,
    dominantActivity,
    durationSeconds: totalDuration,
    appBreakdown,
    totalScreenSeconds,
    averageConfidence: totalConfidence / segments.length,
    totalLocationSamples,
    totalScreenSessions,
  };
}

/**
 * Calculate aggregate confidence from segments.
 * Weighted by segment duration.
 */
export function calculateAggregateConfidence(
  segments: ActivitySegment[],
): number {
  if (segments.length === 0) return 0;

  let totalWeight = 0;
  let weightedConfidence = 0;

  for (const segment of segments) {
    const duration =
      (segment.endedAt.getTime() - segment.startedAt.getTime()) / 1000;
    weightedConfidence += segment.activityConfidence * duration;
    totalWeight += duration;
  }

  if (totalWeight === 0) return 0;
  return Math.min(1, Math.max(0, weightedConfidence / totalWeight));
}

/**
 * Categorize evidence strength based on data coverage.
 */
export function categorizeEvidenceStrength(
  segments: ActivitySegment[],
): EvidenceStrength {
  if (segments.length === 0) return "low";

  let totalLocationSamples = 0;
  let totalScreenSessions = 0;

  for (const segment of segments) {
    totalLocationSamples += segment.evidence.locationSamples;
    totalScreenSessions += segment.evidence.screenSessions;
  }

  // High: 10+ location samples AND 5+ screen sessions
  if (totalLocationSamples >= 10 && totalScreenSessions >= 5) {
    return "high";
  }

  // Medium: 5+ location samples OR 3+ screen sessions
  if (totalLocationSamples >= 5 || totalScreenSessions >= 3) {
    return "medium";
  }

  return "low";
}

// ============================================================================
// Template-Based Generation
// ============================================================================

/**
 * Generate title from template (no AI needed).
 */
export function generateTitleFromTemplate(aggregated: AggregatedData): string {
  const place = aggregated.dominantPlaceLabel ?? "Unknown Location";
  const activity = humanizeActivity(aggregated.dominantActivity);

  // Special case for commute
  if (aggregated.dominantActivity === "commute") {
    if (aggregated.destinationPlaceLabel) {
      return `Commute to ${aggregated.destinationPlaceLabel}`;
    }
    return "Commute";
  }

  // Standard format: "Place - Activity"
  return `${place} - ${activity}`;
}

/**
 * Generate description from template (no AI needed).
 */
export function generateTemplateDescription(
  aggregated: AggregatedData,
): string {
  const parts: string[] = [];

  // Time at place
  if (aggregated.dominantPlaceLabel && aggregated.durationSeconds > 0) {
    const minutes = Math.round(aggregated.durationSeconds / 60);
    if (minutes >= 1) {
      parts.push(`${minutes} min at ${aggregated.dominantPlaceLabel}`);
    }
  }

  // Top apps (filter to apps with at least 1 minute)
  const topApps = aggregated.appBreakdown
    .slice(0, 3)
    .filter((app) => app.minutes >= 1)
    .map((app) => `${app.displayName} (${app.minutes}m)`)
    .join(", ");

  if (topApps) {
    parts.push(topApps);
  }

  return parts.join(". ") || "No activity data";
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate CHARLIE layer hourly summary from BRAVO layer segments.
 * Uses template-based generation (no AI).
 *
 * @param userId - User ID
 * @param hourStart - Start of the hour to summarize
 * @returns HourlySummary object
 */
export async function generateHourlySummary(
  userId: string,
  hourStart: Date,
): Promise<HourlySummary> {
  // 1. Check if already locked (user confirmed/edited)
  const existing = await fetchHourlySummary(userId, hourStart);
  if (existing?.lockedAt) {
    return existing; // Don't overwrite user edits
  }

  // 2. Fetch BRAVO layer segments for this hour
  const segments = await fetchActivitySegmentsForHour(userId, hourStart);

  // 3. Handle empty case
  if (segments.length === 0) {
    return createEmptySummary(userId, hourStart, existing?.id);
  }

  // 4. Aggregate segments
  const aggregated = aggregateSegments(segments);

  // 5. Generate title (template-based)
  const title = generateTitleFromTemplate(aggregated);

  // 6. Generate description (template-based)
  const description = generateTemplateDescription(aggregated);

  // 7. Calculate aggregate confidence
  const confidence = calculateAggregateConfidence(segments);

  // 8. Determine evidence strength
  const evidenceStrength = categorizeEvidenceStrength(segments);

  return {
    id: existing?.id ?? generateUuid(),
    userId,
    hourStart,
    localDate: toLocalDateString(hourStart),
    hourOfDay: getHourOfDay(hourStart),
    title,
    description,
    primaryPlaceId: aggregated.dominantPlaceId,
    primaryPlaceLabel: aggregated.dominantPlaceLabel,
    primaryActivity: aggregated.dominantActivity,
    appBreakdown: aggregated.appBreakdown,
    totalScreenMinutes: Math.round(aggregated.totalScreenSeconds / 60),
    confidenceScore: confidence,
    evidenceStrength,
    userFeedback: existing?.userFeedback ?? null,
    userEdits: existing?.userEdits ?? null,
    lockedAt: null,
    aiGenerated: false,
    aiModel: null,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create an empty summary for hours with no data.
 */
function createEmptySummary(
  userId: string,
  hourStart: Date,
  existingId?: string,
): HourlySummary {
  return {
    id: existingId ?? generateUuid(),
    userId,
    hourStart,
    localDate: toLocalDateString(hourStart),
    hourOfDay: getHourOfDay(hourStart),
    title: "No Activity Data",
    description: "No activity data available for this hour",
    primaryPlaceId: null,
    primaryPlaceLabel: null,
    primaryActivity: null,
    appBreakdown: [],
    totalScreenMinutes: 0,
    confidenceScore: 0,
    evidenceStrength: "low",
    userFeedback: null,
    userEdits: null,
    lockedAt: null,
    aiGenerated: false,
    aiModel: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetch an existing hourly summary.
 */
export async function fetchHourlySummary(
  userId: string,
  hourStart: Date,
): Promise<HourlySummary | null> {
  try {
    const { data, error } = await tmSchema()
      .from("hourly_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("hour_start", hourStart.toISOString())
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return null;
      }
      throw handleSupabaseError(error);
    }

    if (!data) return null;

    return mapRowToSummary(data);
  } catch (error) {
    if (__DEV__) {
      console.warn("[HourlySummaries] Failed to fetch summary:", error);
    }
    return null;
  }
}

/**
 * Fetch hourly summaries for a specific date.
 */
export async function fetchHourlySummariesForDate(
  userId: string,
  localDate: string, // YYYY-MM-DD format
): Promise<HourlySummary[]> {
  try {
    const { data, error } = await tmSchema()
      .from("hourly_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .order("hour_start", { ascending: false });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }

    return (data ?? []).map(mapRowToSummary);
  } catch (error) {
    if (__DEV__) {
      console.warn("[HourlySummaries] Failed to fetch summaries for date:", error);
    }
    return [];
  }
}

/**
 * Save a hourly summary to the database.
 * Uses upsert to handle re-processing.
 */
export async function saveHourlySummary(
  summary: HourlySummary,
): Promise<boolean> {
  try {
    const row = {
      id: summary.id,
      user_id: summary.userId,
      hour_start: summary.hourStart.toISOString(),
      local_date: summary.localDate,
      hour_of_day: summary.hourOfDay,
      title: summary.title,
      description: summary.description,
      primary_place_id: summary.primaryPlaceId,
      primary_place_label: summary.primaryPlaceLabel,
      primary_activity: summary.primaryActivity,
      app_breakdown: summary.appBreakdown,
      total_screen_minutes: summary.totalScreenMinutes,
      confidence_score: summary.confidenceScore,
      evidence_strength: summary.evidenceStrength,
      user_feedback: summary.userFeedback,
      user_edits: summary.userEdits,
      locked_at: summary.lockedAt?.toISOString() ?? null,
      ai_generated: summary.aiGenerated,
      ai_model: summary.aiModel,
      updated_at: new Date().toISOString(),
    };

    const { error } = await tmSchema()
      .from("hourly_summaries")
      .upsert(row, { onConflict: "user_id,hour_start" });

    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[HourlySummaries] Failed to save summary:", error);
    }
    return false;
  }
}

/**
 * Update an existing hourly summary.
 */
export async function updateHourlySummary(
  summaryId: string,
  updates: Partial<
    Pick<
      HourlySummary,
      | "title"
      | "description"
      | "primaryActivity"
      | "primaryPlaceLabel"
      | "userFeedback"
      | "userEdits"
      | "lockedAt"
    >
  >,
): Promise<boolean> {
  try {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) row.title = updates.title;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.primaryActivity !== undefined)
      row.primary_activity = updates.primaryActivity;
    if (updates.primaryPlaceLabel !== undefined)
      row.primary_place_label = updates.primaryPlaceLabel;
    if (updates.userFeedback !== undefined)
      row.user_feedback = updates.userFeedback;
    if (updates.userEdits !== undefined) row.user_edits = updates.userEdits;
    if (updates.lockedAt !== undefined)
      row.locked_at = updates.lockedAt?.toISOString() ?? null;

    const { error } = await tmSchema()
      .from("hourly_summaries")
      .update(row)
      .eq("id", summaryId);

    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[HourlySummaries] Failed to update summary:", error);
    }
    return false;
  }
}

/**
 * Delete a hourly summary.
 */
export async function deleteHourlySummary(summaryId: string): Promise<boolean> {
  try {
    const { error } = await tmSchema()
      .from("hourly_summaries")
      .delete()
      .eq("id", summaryId);

    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[HourlySummaries] Failed to delete summary:", error);
    }
    return false;
  }
}

/**
 * Map a database row to a HourlySummary object.
 */
function mapRowToSummary(row: Record<string, unknown>): HourlySummary {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    hourStart: new Date(row.hour_start as string),
    localDate: row.local_date as string,
    hourOfDay: row.hour_of_day as number,
    title: row.title as string,
    description: (row.description as string) ?? null,
    primaryPlaceId: (row.primary_place_id as string) ?? null,
    primaryPlaceLabel: (row.primary_place_label as string) ?? null,
    primaryActivity: (row.primary_activity as InferredActivityType) ?? null,
    appBreakdown: (row.app_breakdown as SummaryAppBreakdown[]) ?? [],
    totalScreenMinutes: (row.total_screen_minutes as number) ?? 0,
    confidenceScore: (row.confidence_score as number) ?? 0,
    evidenceStrength: (row.evidence_strength as EvidenceStrength) ?? "low",
    userFeedback: (row.user_feedback as string) ?? null,
    userEdits: (row.user_edits as Record<string, unknown>) ?? null,
    lockedAt: row.locked_at ? new Date(row.locked_at as string) : null,
    aiGenerated: (row.ai_generated as boolean) ?? false,
    aiModel: (row.ai_model as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Generate and save hourly summary for a specific hour.
 * Convenience function that combines generate + save.
 */
export async function processHourlySummary(
  userId: string,
  hourStart: Date,
): Promise<HourlySummary | null> {
  try {
    const summary = await generateHourlySummary(userId, hourStart);
    const saved = await saveHourlySummary(summary);
    if (!saved) {
      if (__DEV__) {
        console.warn("[HourlySummaries] Failed to save processed summary");
      }
      return null;
    }
    return summary;
  } catch (error) {
    if (__DEV__) {
      console.warn("[HourlySummaries] Failed to process summary:", error);
    }
    return null;
  }
}
