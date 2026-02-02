/**
 * Activity Feedback Service
 *
 * Records user feedback and corrections for the learning loop.
 * Enables the system to learn from user edits and improve future inferences.
 *
 * See docs/data-pipeline-plan.md section 5.3 for pseudocode reference.
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

import {
  type HourlySummary,
  type SummaryAppBreakdown,
  updateHourlySummary,
} from "./hourly-summaries";
import type { InferredActivityType } from "./activity-segments";

// ============================================================================
// Types
// ============================================================================

/**
 * User corrections to a summary.
 */
export interface UserCorrections {
  /** Corrected activity type */
  activity?: InferredActivityType;
  /** Corrected place label */
  placeLabel?: string;
  /** Corrected title */
  title?: string;
  /** Corrected description */
  description?: string;
}

/**
 * User feedback payload.
 */
export interface UserFeedback {
  /** Whether the summary was accurate */
  accurate: boolean;
  /** Optional corrections if not accurate */
  corrections?: UserCorrections;
}

/**
 * Context data stored for learning.
 */
export interface FeedbackContext {
  /** Hour of day (0-23) */
  hourOfDay: number;
  /** Day of week (0 = Sunday, 6 = Saturday) */
  dayOfWeek: number;
  /** Top app IDs used during the hour */
  topApps: string[];
  /** Original confidence score */
  confidence: number;
}

/**
 * Activity feedback record.
 */
export interface ActivityFeedback {
  /** Unique identifier */
  id: string;
  /** User ID */
  userId: string;
  /** Reference to hourly summary */
  hourlySummaryId: string | null;
  /** Reference to activity segment */
  segmentId: string | null;
  /** Original activity type */
  originalActivity: string | null;
  /** Corrected activity type */
  correctedActivity: string | null;
  /** Original place label */
  originalPlaceLabel: string | null;
  /** Corrected place label */
  correctedPlaceLabel: string | null;
  /** Original title */
  originalTitle: string | null;
  /** Corrected title */
  correctedTitle: string | null;
  /** Context data for learning */
  contextData: FeedbackContext | null;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Input for inserting activity feedback.
 */
export interface InsertActivityFeedbackInput {
  userId: string;
  hourlySummaryId?: string | null;
  segmentId?: string | null;
  originalActivity?: string | null;
  correctedActivity?: string | null;
  originalPlaceLabel?: string | null;
  correctedPlaceLabel?: string | null;
  originalTitle?: string | null;
  correctedTitle?: string | null;
  contextData?: FeedbackContext | null;
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
 * Get day of week from a date (0 = Sunday, 6 = Saturday).
 */
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Extract top app IDs from app breakdown.
 */
function extractTopAppIds(appBreakdown: SummaryAppBreakdown[]): string[] {
  return appBreakdown.slice(0, 3).map((app) => app.appId);
}

/**
 * Build context data from a summary.
 */
function buildContextData(summary: HourlySummary): FeedbackContext {
  return {
    hourOfDay: summary.hourOfDay,
    dayOfWeek: getDayOfWeek(summary.hourStart),
    topApps: extractTopAppIds(summary.appBreakdown),
    confidence: summary.confidenceScore,
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Record user feedback and corrections for a summary.
 *
 * This function:
 * 1. Updates the hourly_summaries table with the feedback
 * 2. Locks the summary (sets lockedAt timestamp)
 * 3. If corrections were made, stores them in activity_feedback table
 * 4. Applies corrections to the summary if provided
 *
 * @param userId - User ID
 * @param summaryId - Hourly summary ID
 * @param feedback - User feedback with optional corrections
 * @returns true if feedback was recorded successfully
 */
export async function recordUserFeedback(
  userId: string,
  summaryId: string,
  feedback: UserFeedback,
): Promise<boolean> {
  try {
    // 1. Fetch the existing summary to get original values
    const summary = await fetchHourlySummaryById(userId, summaryId);
    if (!summary) {
      if (__DEV__) {
        console.warn(
          "[ActivityFeedback] Summary not found:",
          summaryId,
        );
      }
      return false;
    }

    // 2. Update the summary with user feedback and lock it
    const feedbackValue = feedback.accurate ? "accurate" : "inaccurate";
    const lockedAt = new Date();

    // Build update object
    const updateFields: Parameters<typeof updateHourlySummary>[1] = {
      userFeedback: feedbackValue,
      lockedAt,
    };

    // 3. If corrections were made, store for learning and apply to summary
    if (feedback.corrections) {
      const corrections = feedback.corrections;

      // Insert feedback record for learning
      await insertActivityFeedback({
        userId,
        hourlySummaryId: summaryId,
        originalActivity: summary.primaryActivity ?? null,
        correctedActivity: corrections.activity ?? summary.primaryActivity ?? null,
        originalPlaceLabel: summary.primaryPlaceLabel ?? null,
        correctedPlaceLabel: corrections.placeLabel ?? summary.primaryPlaceLabel ?? null,
        originalTitle: summary.title,
        correctedTitle: corrections.title ?? summary.title,
        contextData: buildContextData(summary),
      });

      // Apply corrections to the summary
      if (corrections.title !== undefined) {
        updateFields.title = corrections.title;
      }
      if (corrections.activity !== undefined) {
        updateFields.primaryActivity = corrections.activity;
      }
      if (corrections.placeLabel !== undefined) {
        updateFields.primaryPlaceLabel = corrections.placeLabel;
      }

      // Store the user edits for reference
      updateFields.userEdits = corrections as Record<string, unknown>;
    }

    // 4. Update the summary
    const updated = await updateHourlySummary(summaryId, updateFields);
    if (!updated) {
      if (__DEV__) {
        console.warn(
          "[ActivityFeedback] Failed to update summary with feedback",
        );
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivityFeedback] Failed to record feedback:", error);
    }
    return false;
  }
}

/**
 * Record feedback marking a summary as accurate.
 * Convenience function for positive feedback.
 *
 * @param userId - User ID
 * @param summaryId - Hourly summary ID
 * @returns true if feedback was recorded successfully
 */
export async function markSummaryAsAccurate(
  userId: string,
  summaryId: string,
): Promise<boolean> {
  return recordUserFeedback(userId, summaryId, { accurate: true });
}

/**
 * Record feedback marking a summary as inaccurate with corrections.
 * Convenience function for negative feedback with corrections.
 *
 * @param userId - User ID
 * @param summaryId - Hourly summary ID
 * @param corrections - User corrections
 * @returns true if feedback was recorded successfully
 */
export async function submitCorrection(
  userId: string,
  summaryId: string,
  corrections: UserCorrections,
): Promise<boolean> {
  return recordUserFeedback(userId, summaryId, {
    accurate: false,
    corrections,
  });
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetch a hourly summary by ID.
 */
async function fetchHourlySummaryById(
  userId: string,
  summaryId: string,
): Promise<HourlySummary | null> {
  try {
    const { data, error } = await tmSchema()
      .from("hourly_summaries")
      .select("*")
      .eq("id", summaryId)
      .eq("user_id", userId)
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
      console.warn("[ActivityFeedback] Failed to fetch summary:", error);
    }
    return null;
  }
}

/**
 * Insert activity feedback record for learning.
 */
export async function insertActivityFeedback(
  input: InsertActivityFeedbackInput,
): Promise<boolean> {
  try {
    const row = {
      user_id: input.userId,
      hourly_summary_id: input.hourlySummaryId ?? null,
      segment_id: input.segmentId ?? null,
      original_activity: input.originalActivity ?? null,
      corrected_activity: input.correctedActivity ?? null,
      original_place_label: input.originalPlaceLabel ?? null,
      corrected_place_label: input.correctedPlaceLabel ?? null,
      original_title: input.originalTitle ?? null,
      corrected_title: input.correctedTitle ?? null,
      context_data: input.contextData ?? {},
    };

    const { error } = await tmSchema()
      .from("activity_feedback")
      .insert(row);

    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivityFeedback] Failed to insert feedback:", error);
    }
    return false;
  }
}

/**
 * Fetch activity feedback records for a user.
 * Used for learning patterns from past corrections.
 *
 * @param userId - User ID
 * @param options - Query options
 * @returns Array of feedback records
 */
export async function fetchActivityFeedback(
  userId: string,
  options: { limit?: number } = {},
): Promise<ActivityFeedback[]> {
  try {
    const limit = options.limit ?? 100;

    const { data, error } = await tmSchema()
      .from("activity_feedback")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }

    return (data ?? []).map(mapRowToFeedback);
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivityFeedback] Failed to fetch feedback:", error);
    }
    return [];
  }
}

/**
 * Fetch feedback records for a specific summary.
 *
 * @param summaryId - Hourly summary ID
 * @returns Array of feedback records for the summary
 */
export async function fetchFeedbackForSummary(
  summaryId: string,
): Promise<ActivityFeedback[]> {
  try {
    const { data, error } = await tmSchema()
      .from("activity_feedback")
      .select("*")
      .eq("hourly_summary_id", summaryId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST204" || error.code === "42P01") {
        return [];
      }
      throw handleSupabaseError(error);
    }

    return (data ?? []).map(mapRowToFeedback);
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivityFeedback] Failed to fetch feedback for summary:", error);
    }
    return [];
  }
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map a database row to an ActivityFeedback object.
 */
function mapRowToFeedback(row: Record<string, unknown>): ActivityFeedback {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    hourlySummaryId: (row.hourly_summary_id as string) ?? null,
    segmentId: (row.segment_id as string) ?? null,
    originalActivity: (row.original_activity as string) ?? null,
    correctedActivity: (row.corrected_activity as string) ?? null,
    originalPlaceLabel: (row.original_place_label as string) ?? null,
    correctedPlaceLabel: (row.corrected_place_label as string) ?? null,
    originalTitle: (row.original_title as string) ?? null,
    correctedTitle: (row.corrected_title as string) ?? null,
    contextData: (row.context_data as FeedbackContext) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

/**
 * Map a database row to a HourlySummary object.
 * Duplicated from hourly-summaries.ts to avoid circular imports.
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
    evidenceStrength: (row.evidence_strength as "low" | "medium" | "high") ?? "low",
    userFeedback: (row.user_feedback as string) ?? null,
    userEdits: (row.user_edits as Record<string, unknown>) ?? null,
    lockedAt: row.locked_at ? new Date(row.locked_at as string) : null,
    aiGenerated: (row.ai_generated as boolean) ?? false,
    aiModel: (row.ai_model as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
