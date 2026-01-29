/**
 * ActualIngestionService
 *
 * Implements incremental ingestion of screen time evidence into calendar_actual events.
 * Processes 30-minute windows and reconciles evidence into the Actual timeline.
 *
 * Core responsibilities:
 * - Query screen_time_app_sessions for a given time window
 * - Build candidate segments from usage sessions
 * - Compute deterministic source_id for idempotency
 * - Handle window alignment to 30-minute boundaries
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Json } from "../database.types";
import type { ScreenTimeSessionRow } from "./evidence-data";
import { getReadableAppName } from "@/lib/app-names";

// ============================================================================
// Types
// ============================================================================

/**
 * Checkpoint row from tm.actual_ingestion_checkpoints
 */
export interface IngestionCheckpoint {
  userId: string;
  timezone: string;
  lastProcessedAt: Date | null;
  lastProcessedWindowStart: Date | null;
  lastProcessedWindowEnd: Date | null;
  lastRunStats: IngestionRunStats;
}

export interface IngestionRunStats {
  sessionsProcessed?: number;
  segmentsCreated?: number;
  errorsEncountered?: number;
  processingTimeMs?: number;
}

/**
 * A candidate segment derived from screen time evidence.
 * Represents a contiguous block of app usage that can be reconciled into an Actual event.
 */
export interface EvidenceSegment {
  /** Deterministic ID for idempotency: `ingestion:${windowStart}:${appId}:${startMs}` */
  sourceId: string;
  /** App package name or bundle identifier */
  appId: string;
  /** Human-readable app name */
  displayName: string;
  /** Start timestamp of the segment */
  startAt: Date;
  /** End timestamp of the segment */
  endAt: Date;
  /** Duration in seconds */
  durationSeconds: number;
  /** Session IDs that contributed to this segment (for debugging) */
  sessionIds: string[];
}

/**
 * Configuration for the ingestion service.
 */
export interface IngestionConfig {
  /** Window size in minutes (default: 30) */
  windowMinutes: number;
  /** Buffer minutes to look back for incomplete sessions (default: 10) */
  bufferMinutes: number;
  /** Cutoff in minutes - events older than this are not mutated (default: 120) */
  mutableCutoffMinutes: number;
  /** Minimum session duration in seconds to consider (default: 60) */
  minSessionDurationSeconds: number;
}

const DEFAULT_CONFIG: IngestionConfig = {
  windowMinutes: 30,
  bufferMinutes: 10,
  mutableCutoffMinutes: 120,
  minSessionDurationSeconds: 60,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the tm schema client (bypass strict typing since schema may not be in generated types)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

/**
 * Align a timestamp to a 30-minute boundary (floor).
 * E.g., 10:47 -> 10:30, 11:15 -> 11:00
 */
export function alignToWindowBoundary(
  date: Date,
  windowMinutes: number = 30,
): Date {
  const aligned = new Date(date);
  const minutes = aligned.getMinutes();
  const alignedMinutes = Math.floor(minutes / windowMinutes) * windowMinutes;
  aligned.setMinutes(alignedMinutes, 0, 0);
  return aligned;
}

/**
 * Compute the previous 30-minute window boundaries.
 * E.g., at 10:47, returns { start: 10:00, end: 10:30 }
 */
export function computePreviousWindow(
  now: Date,
  config: IngestionConfig = DEFAULT_CONFIG,
): { windowStart: Date; windowEnd: Date } {
  const windowEnd = alignToWindowBoundary(now, config.windowMinutes);
  const windowStart = new Date(windowEnd);
  windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);
  return { windowStart, windowEnd };
}

/**
 * Compute a deterministic source_id for a segment.
 * Format: `ingestion:{windowStartMs}:{appId}:{sessionStartMs}`
 *
 * This ensures the same evidence produces the same ID, enabling idempotent upserts.
 */
export function computeSourceId(
  windowStart: Date,
  appId: string,
  sessionStartMs: number,
): string {
  return `ingestion:${windowStart.getTime()}:${appId}:${sessionStartMs}`;
}

/**
 * Parse a database timestamp string to a Date object.
 * Handles both timestamptz (with Z or offset) and timestamp without timezone.
 */
function parseDbTimestamp(timestamp: string): Date {
  const normalized = timestamp.includes(" ")
    ? timestamp.replace(" ", "T")
    : timestamp;
  // If the timestamp already has timezone info (Z or offset), parse normally
  if (/Z$|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  // Otherwise, append Z to treat as UTC (database timestamps are UTC)
  return new Date(normalized + "Z");
}

// ============================================================================
// Checkpoint Operations
// ============================================================================

/**
 * Fetch the current ingestion checkpoint for a user.
 */
export async function fetchIngestionCheckpoint(
  userId: string,
): Promise<IngestionCheckpoint | null> {
  try {
    const { data, error } = await tmSchema()
      .from("actual_ingestion_checkpoints")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01") {
        return null;
      }
      throw handleSupabaseError(error);
    }

    if (!data) return null;

    return {
      userId: data.user_id,
      timezone: data.timezone,
      lastProcessedAt: data.last_processed_at
        ? parseDbTimestamp(data.last_processed_at)
        : null,
      lastProcessedWindowStart: data.last_processed_window_start
        ? parseDbTimestamp(data.last_processed_window_start)
        : null,
      lastProcessedWindowEnd: data.last_processed_window_end
        ? parseDbTimestamp(data.last_processed_window_end)
        : null,
      lastRunStats: (data.last_run_stats ?? {}) as IngestionRunStats,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn("[Ingestion] Failed to fetch checkpoint:", error);
    }
    return null;
  }
}

/**
 * Upsert the ingestion checkpoint for a user.
 */
export async function upsertIngestionCheckpoint(
  userId: string,
  timezone: string,
  windowStart: Date,
  windowEnd: Date,
  stats: IngestionRunStats,
): Promise<void> {
  try {
    const { error } = await tmSchema()
      .from("actual_ingestion_checkpoints")
      .upsert(
        {
          user_id: userId,
          timezone,
          last_processed_at: new Date().toISOString(),
          last_processed_window_start: windowStart.toISOString(),
          last_processed_window_end: windowEnd.toISOString(),
          last_run_stats: stats as unknown as Json,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      throw handleSupabaseError(error);
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[Ingestion] Failed to upsert checkpoint:", error);
    }
    throw error;
  }
}

// ============================================================================
// Screen Time Session Queries
// ============================================================================

/**
 * Fetch screen time sessions that overlap with the given time window.
 * Includes sessions that started in the window or extend into it.
 */
export async function fetchSessionsForWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  config: IngestionConfig = DEFAULT_CONFIG,
): Promise<ScreenTimeSessionRow[]> {
  // Extend the query window by the buffer to catch sessions that started before
  // but extend into our window
  const queryStart = new Date(windowStart);
  queryStart.setMinutes(queryStart.getMinutes() - config.bufferMinutes);

  const startIso = queryStart.toISOString();
  const endIso = windowEnd.toISOString();

  try {
    // Query sessions where:
    // 1. Session started within our extended window, OR
    // 2. Session ended within our window
    const { data, error } = await tmSchema()
      .from("screen_time_app_sessions")
      .select("*")
      .eq("user_id", userId)
      .or(`started_at.gte.${startIso},ended_at.gt.${windowStart.toISOString()}`)
      .lt("started_at", endIso)
      .gte("duration_seconds", config.minSessionDurationSeconds)
      .order("started_at", { ascending: true });

    if (error) {
      if (error.code === "42P01") {
        // Table doesn't exist
        return [];
      }
      throw handleSupabaseError(error);
    }

    return (data ?? []) as ScreenTimeSessionRow[];
  } catch (error) {
    if (__DEV__) {
      console.warn("[Ingestion] Failed to fetch sessions:", error);
    }
    return [];
  }
}

// ============================================================================
// Segment Building
// ============================================================================

/**
 * Build evidence segments from screen time sessions.
 * Groups and clips sessions to the window boundaries.
 *
 * @param sessions - Raw screen time sessions from the database
 * @param windowStart - Start of the processing window
 * @param windowEnd - End of the processing window
 * @returns Array of evidence segments, clipped to window boundaries
 */
export function buildSegmentsFromSessions(
  sessions: ScreenTimeSessionRow[],
  windowStart: Date,
  windowEnd: Date,
): EvidenceSegment[] {
  const segments: EvidenceSegment[] = [];
  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();

  for (const session of sessions) {
    const sessionStart = parseDbTimestamp(session.started_at);
    const sessionEnd = parseDbTimestamp(session.ended_at);
    const sessionStartMs = sessionStart.getTime();
    const sessionEndMs = sessionEnd.getTime();

    // Skip sessions that don't overlap with the window
    if (sessionEndMs <= windowStartMs || sessionStartMs >= windowEndMs) {
      continue;
    }

    // Clip session to window boundaries
    const clippedStartMs = Math.max(sessionStartMs, windowStartMs);
    const clippedEndMs = Math.min(sessionEndMs, windowEndMs);
    const clippedDurationMs = clippedEndMs - clippedStartMs;

    // Skip very short clipped segments (less than 30 seconds)
    if (clippedDurationMs < 30_000) {
      continue;
    }

    const clippedStart = new Date(clippedStartMs);
    const clippedEnd = new Date(clippedEndMs);

    const sourceId = computeSourceId(
      windowStart,
      session.app_id,
      clippedStartMs,
    );

    const displayName =
      session.display_name ??
      getReadableAppName({
        appId: session.app_id,
        displayName: session.display_name,
      });

    segments.push({
      sourceId,
      appId: session.app_id,
      displayName,
      startAt: clippedStart,
      endAt: clippedEnd,
      durationSeconds: Math.round(clippedDurationMs / 1000),
      sessionIds: [session.id],
    });
  }

  // Sort by start time
  segments.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return segments;
}

/**
 * Merge adjacent segments for the same app.
 * If two segments for the same app are within 60 seconds of each other, merge them.
 */
export function mergeAdjacentSegments(
  segments: EvidenceSegment[],
  mergeThresholdMs: number = 60_000,
): EvidenceSegment[] {
  if (segments.length === 0) return [];

  const merged: EvidenceSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    const gap = next.startAt.getTime() - current.endAt.getTime();

    // Merge if same app and small gap
    if (next.appId === current.appId && gap <= mergeThresholdMs) {
      current.endAt = next.endAt;
      current.durationSeconds = Math.round(
        (current.endAt.getTime() - current.startAt.getTime()) / 1000,
      );
      current.sessionIds = [...current.sessionIds, ...next.sessionIds];
      // Keep the first segment's sourceId for stability
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

// ============================================================================
// Main Service Functions
// ============================================================================

export interface ProcessWindowResult {
  success: boolean;
  windowStart: Date;
  windowEnd: Date;
  sessionsProcessed: number;
  segmentsCreated: number;
  segments: EvidenceSegment[];
  error?: string;
}

/**
 * Process a single time window for a user.
 * This is the core entry point for the ingestion service.
 *
 * Steps:
 * 1. Fetch sessions that overlap with the window
 * 2. Build candidate segments from sessions
 * 3. Merge adjacent segments for the same app
 * 4. Return segments for reconciliation
 *
 * Note: This function does NOT persist events - that's handled by the reconciliation
 * step in US-003.
 */
export async function processIngestionWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  config: IngestionConfig = DEFAULT_CONFIG,
): Promise<ProcessWindowResult> {
  const startTime = Date.now();

  try {
    // Step 1: Fetch sessions
    const sessions = await fetchSessionsForWindow(
      userId,
      windowStart,
      windowEnd,
      config,
    );

    // Step 2: Build segments
    const rawSegments = buildSegmentsFromSessions(
      sessions,
      windowStart,
      windowEnd,
    );

    // Step 3: Merge adjacent segments
    const segments = mergeAdjacentSegments(rawSegments);

    const processingTimeMs = Date.now() - startTime;

    if (__DEV__) {
      console.log(
        `[Ingestion] Processed window ${windowStart.toISOString()} - ${windowEnd.toISOString()}:`,
        {
          sessionsFound: sessions.length,
          rawSegments: rawSegments.length,
          mergedSegments: segments.length,
          processingTimeMs,
        },
      );
    }

    return {
      success: true,
      windowStart,
      windowEnd,
      sessionsProcessed: sessions.length,
      segmentsCreated: segments.length,
      segments,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (__DEV__) {
      console.error("[Ingestion] Failed to process window:", error);
    }

    return {
      success: false,
      windowStart,
      windowEnd,
      sessionsProcessed: 0,
      segmentsCreated: 0,
      segments: [],
      error: errorMessage,
    };
  }
}

/**
 * Determine if enough time has passed since the last checkpoint to run ingestion.
 * Returns the window to process if ready, or null if not ready.
 */
export function shouldRunIngestion(
  checkpoint: IngestionCheckpoint | null,
  now: Date,
  config: IngestionConfig = DEFAULT_CONFIG,
): { windowStart: Date; windowEnd: Date } | null {
  const { windowStart, windowEnd } = computePreviousWindow(now, config);

  // If no checkpoint, always run
  if (!checkpoint || !checkpoint.lastProcessedWindowEnd) {
    return { windowStart, windowEnd };
  }

  // If the window we'd process is different from the last processed window, run
  const lastWindowEndMs = checkpoint.lastProcessedWindowEnd.getTime();
  const currentWindowEndMs = windowEnd.getTime();

  if (currentWindowEndMs > lastWindowEndMs) {
    return { windowStart, windowEnd };
  }

  // Same window or earlier - don't run
  return null;
}
