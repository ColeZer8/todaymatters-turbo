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

// ============================================================================
// Reconciliation Types and Functions (US-003)
// ============================================================================

/**
 * Represents an existing Actual event from the database.
 */
export interface ExistingActualEvent {
  id: string;
  title: string;
  description: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
  meta: {
    source?: string;
    kind?: string;
    category?: string;
    source_id?: string;
    [key: string]: Json | undefined;
  } | null;
}

/**
 * Sources that indicate user-edited events which should never be overwritten.
 */
const PROTECTED_SOURCES = ["user", "actual_adjust"];

/**
 * Sources that indicate derived/evidence events which can be replaced.
 */
const REPLACEABLE_SOURCES = ["derived", "evidence", "ingestion", "system"];

/**
 * Result of the reconciliation process.
 */
export interface ReconciliationResult {
  success: boolean;
  eventsInserted: number;
  eventsUpdated: number;
  eventsDeleted: number;
  error?: string;
}

/**
 * An operation to perform during reconciliation.
 */
type ReconciliationOp =
  | { type: "insert"; segment: EvidenceSegment }
  | { type: "update"; eventId: string; segment: EvidenceSegment }
  | { type: "delete"; eventId: string };

/**
 * Check if an event is protected (user-edited) and should not be overwritten.
 */
function isProtectedEvent(event: ExistingActualEvent): boolean {
  const source = event.meta?.source;
  return typeof source === "string" && PROTECTED_SOURCES.includes(source);
}

/**
 * Check if an event can be replaced by evidence segments.
 */
function isReplaceableEvent(event: ExistingActualEvent): boolean {
  const source = event.meta?.source;
  // If no source, consider it replaceable (old events)
  if (!source) return true;
  // If it's a protected source, don't replace
  if (PROTECTED_SOURCES.includes(source)) return false;
  // If it's explicitly replaceable or unknown kind, allow replacement
  const kind = event.meta?.kind;
  if (kind === "unknown_gap" || kind === "evidence_block") return true;
  return REPLACEABLE_SOURCES.includes(source);
}

/**
 * Fetch existing actual events that overlap with the given time window.
 */
export async function fetchExistingActualEvents(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<ExistingActualEvent[]> {
  try {
    const startIso = windowStart.toISOString();
    const endIso = windowEnd.toISOString();

    const { data, error } = await tmSchema()
      .from("events")
      .select("id, title, description, scheduled_start, scheduled_end, meta")
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      // Events that overlap with the window:
      // Event starts before window ends AND event ends after window starts
      .lt("scheduled_start", endIso)
      .gt("scheduled_end", startIso)
      .order("scheduled_start", { ascending: true });

    if (error) {
      if (error.code === "42P01") {
        // Table doesn't exist
        return [];
      }
      throw handleSupabaseError(error);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      scheduledStart: parseDbTimestamp(row.scheduled_start),
      scheduledEnd: parseDbTimestamp(row.scheduled_end),
      meta: row.meta as ExistingActualEvent["meta"],
    }));
  } catch (error) {
    if (__DEV__) {
      console.warn("[Ingestion] Failed to fetch existing events:", error);
    }
    return [];
  }
}

/**
 * Check if two time ranges overlap.
 */
function rangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean {
  return start1.getTime() < end2.getTime() && end1.getTime() > start2.getTime();
}

/**
 * Compute reconciliation operations for evidence segments against existing events.
 *
 * Rules:
 * 1. User-edited events (source='user' or 'actual_adjust') are never touched
 * 2. Evidence segments can replace derived/evidence segments
 * 3. If an evidence segment overlaps with a protected event, clip or skip it
 * 4. No overlapping events after reconciliation
 */
export function computeReconciliationOps(
  segments: EvidenceSegment[],
  existingEvents: ExistingActualEvent[],
): ReconciliationOp[] {
  const ops: ReconciliationOp[] = [];

  // Separate protected and replaceable events
  const protectedEvents = existingEvents.filter(isProtectedEvent);
  const replaceableEvents = existingEvents.filter(isReplaceableEvent);

  // Track which replaceable events will be deleted
  const eventsToDelete = new Set<string>();

  // Track existing source_ids to avoid duplicates
  const existingSourceIds = new Set<string>();
  for (const event of existingEvents) {
    if (event.meta?.source_id) {
      existingSourceIds.add(event.meta.source_id);
    }
  }

  for (const segment of segments) {
    // Skip if we already have this segment (idempotency)
    if (existingSourceIds.has(segment.sourceId)) {
      continue;
    }

    let segmentStart = segment.startAt.getTime();
    let segmentEnd = segment.endAt.getTime();

    // Clip segment against protected events
    for (const protectedEvent of protectedEvents) {
      const protectedStart = protectedEvent.scheduledStart.getTime();
      const protectedEnd = protectedEvent.scheduledEnd.getTime();

      if (!rangesOverlap(
        new Date(segmentStart),
        new Date(segmentEnd),
        protectedEvent.scheduledStart,
        protectedEvent.scheduledEnd,
      )) {
        continue;
      }

      // Segment overlaps with protected event - clip it
      if (segmentStart >= protectedStart && segmentEnd <= protectedEnd) {
        // Segment is fully contained in protected event - skip it entirely
        segmentStart = segmentEnd; // Mark as empty
        break;
      } else if (segmentStart < protectedStart && segmentEnd > protectedEnd) {
        // Segment spans the protected event - take the earlier portion only
        // (could split into two, but for simplicity we take the first part)
        segmentEnd = protectedStart;
      } else if (segmentStart < protectedStart) {
        // Segment starts before and overlaps - clip the end
        segmentEnd = protectedStart;
      } else {
        // Segment starts during and extends past - clip the start
        segmentStart = protectedEnd;
      }
    }

    // Skip if segment was clipped to nothing
    if (segmentEnd <= segmentStart) {
      continue;
    }

    // Skip if clipped segment is too short (< 30 seconds)
    if (segmentEnd - segmentStart < 30_000) {
      continue;
    }

    // Find replaceable events that this segment overlaps with
    for (const replaceableEvent of replaceableEvents) {
      if (rangesOverlap(
        new Date(segmentStart),
        new Date(segmentEnd),
        replaceableEvent.scheduledStart,
        replaceableEvent.scheduledEnd,
      )) {
        eventsToDelete.add(replaceableEvent.id);
      }
    }

    // Create clipped segment if necessary
    const clippedSegment: EvidenceSegment =
      segmentStart === segment.startAt.getTime() &&
      segmentEnd === segment.endAt.getTime()
        ? segment
        : {
            ...segment,
            startAt: new Date(segmentStart),
            endAt: new Date(segmentEnd),
            durationSeconds: Math.round((segmentEnd - segmentStart) / 1000),
          };

    ops.push({ type: "insert", segment: clippedSegment });
  }

  // Add delete operations for replaced events
  for (const eventId of eventsToDelete) {
    ops.push({ type: "delete", eventId });
  }

  return ops;
}

/**
 * Execute reconciliation operations to persist changes to the database.
 */
export async function executeReconciliation(
  userId: string,
  ops: ReconciliationOp[],
): Promise<ReconciliationResult> {
  let eventsInserted = 0;
  const eventsUpdated = 0; // Reserved for future use when update operations are added
  let eventsDeleted = 0;

  try {
    // Batch delete operations
    const deleteIds = ops
      .filter((op): op is Extract<ReconciliationOp, { type: "delete" }> =>
        op.type === "delete"
      )
      .map((op) => op.eventId);

    if (deleteIds.length > 0) {
      const { error: deleteError } = await tmSchema()
        .from("events")
        .delete()
        .eq("user_id", userId)
        .eq("type", "calendar_actual")
        .in("id", deleteIds);

      if (deleteError) {
        throw handleSupabaseError(deleteError);
      }
      eventsDeleted = deleteIds.length;
    }

    // Batch insert operations
    const insertOps = ops.filter(
      (op): op is Extract<ReconciliationOp, { type: "insert" }> =>
        op.type === "insert",
    );

    if (insertOps.length > 0) {
      const inserts = insertOps.map((op) => ({
        user_id: userId,
        type: "calendar_actual",
        title: op.segment.displayName,
        description: `App usage: ${op.segment.appId}`,
        scheduled_start: op.segment.startAt.toISOString(),
        scheduled_end: op.segment.endAt.toISOString(),
        meta: {
          category: "digital",
          source: "ingestion",
          source_id: op.segment.sourceId,
          actual: true,
          kind: "screen_time",
          app_id: op.segment.appId,
          session_ids: op.segment.sessionIds,
          duration_seconds: op.segment.durationSeconds,
        } as unknown as Json,
      }));

      const { error: insertError } = await tmSchema()
        .from("events")
        .insert(inserts);

      if (insertError) {
        throw handleSupabaseError(insertError);
      }
      eventsInserted = inserts.length;
    }

    if (__DEV__) {
      console.log("[Ingestion] Reconciliation complete:", {
        eventsInserted,
        eventsUpdated,
        eventsDeleted,
      });
    }

    return {
      success: true,
      eventsInserted,
      eventsUpdated,
      eventsDeleted,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (__DEV__) {
      console.error("[Ingestion] Reconciliation failed:", error);
    }

    return {
      success: false,
      eventsInserted,
      eventsUpdated,
      eventsDeleted,
      error: errorMessage,
    };
  }
}

/**
 * Full reconciliation pipeline: fetch existing, compute ops, execute.
 * This is the main entry point for US-003.
 */
export async function reconcileWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  segments: EvidenceSegment[],
): Promise<ReconciliationResult> {
  // Step 1: Fetch existing events that overlap with the window
  const existingEvents = await fetchExistingActualEvents(
    userId,
    windowStart,
    windowEnd,
  );

  // Step 2: Compute reconciliation operations
  const ops = computeReconciliationOps(segments, existingEvents);

  if (ops.length === 0) {
    return {
      success: true,
      eventsInserted: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
    };
  }

  // Step 3: Execute the operations
  return executeReconciliation(userId, ops);
}
