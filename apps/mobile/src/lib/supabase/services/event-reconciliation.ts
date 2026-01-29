import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

/**
 * Event reconciliation service for actual ingestion pipeline.
 * Handles computing what operations are needed to sync derived events
 * while respecting locked (immutable) events.
 */

// ============================================================================
// Types
// ============================================================================

export interface ReconciliationEvent {
  id: string;
  userId: string;
  title: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  meta: Record<string, unknown>;
  lockedAt?: Date | null;
}

export interface DerivedEvent {
  sourceId: string;
  title: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  meta: Record<string, unknown>;
}

export type ReconciliationOp =
  | { type: "insert"; event: DerivedEvent }
  | { type: "update"; eventId: string; updates: Partial<DerivedEvent> }
  | { type: "delete"; eventId: string }
  | { type: "extend"; eventId: string; newEnd: Date };

export interface ReconciliationOps {
  inserts: Array<{ event: DerivedEvent }>;
  updates: Array<{ eventId: string; updates: Partial<DerivedEvent> }>;
  deletes: Array<{ eventId: string }>;
  extensions: Array<{ eventId: string; newEnd: Date }>;
  /** IDs of events that were skipped because they're locked */
  protectedIds: string[];
}

// ============================================================================
// Helpers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

function eventsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function isEventLocked(event: ReconciliationEvent): boolean {
  return event.lockedAt !== null && event.lockedAt !== undefined;
}

function getSourceId(event: ReconciliationEvent): string | null {
  const sourceId = event.meta?.source_id;
  if (typeof sourceId === "string" && sourceId.trim().length > 0) {
    return sourceId.trim();
  }
  return null;
}

function isDerivedEvent(event: ReconciliationEvent): boolean {
  const source = event.meta?.source;
  return source === "derived" || source === "system";
}

function isUserEditedEvent(event: ReconciliationEvent): boolean {
  const source = event.meta?.source;
  return source === "user" || source === "actual_adjust";
}

// ============================================================================
// Core Reconciliation Logic
// ============================================================================

/**
 * Compute reconciliation operations needed to sync derived events with existing events.
 *
 * Key rules:
 * 1. Locked events (where locked_at IS NOT NULL) are protected - they cannot be deleted or modified
 * 2. User-edited events (source = 'user' or 'actual_adjust') are protected from deletion
 * 3. Derived events can be updated or deleted if they're not locked
 * 4. New derived events are inserted if they don't overlap with existing events of same source
 *
 * @param existingEvents - Events currently in the database for this window
 * @param derivedEvents - New events derived from evidence (screen-time, location, etc.)
 * @returns Operations to perform (inserts, updates, deletes, extensions)
 */
export function computeReconciliationOps(
  existingEvents: ReconciliationEvent[],
  derivedEvents: DerivedEvent[],
): ReconciliationOps {
  const ops: ReconciliationOps = {
    inserts: [],
    updates: [],
    deletes: [],
    extensions: [],
    protectedIds: [],
  };

  // Build a map of existing events by source_id for fast lookup
  const existingBySourceId = new Map<string, ReconciliationEvent>();
  for (const event of existingEvents) {
    const sourceId = getSourceId(event);
    if (sourceId) {
      existingBySourceId.set(sourceId, event);
    }
  }

  // Track which existing events are matched by derived events
  const matchedExistingIds = new Set<string>();

  // Process each derived event
  for (const derived of derivedEvents) {
    const existingMatch = existingBySourceId.get(derived.sourceId);

    if (existingMatch) {
      matchedExistingIds.add(existingMatch.id);

      // Check if the existing event is locked
      if (isEventLocked(existingMatch)) {
        // Locked event - cannot be modified
        ops.protectedIds.push(existingMatch.id);
        continue;
      }

      // Check if update is needed (times changed)
      const timesMatch =
        existingMatch.scheduledStart.getTime() ===
          derived.scheduledStart.getTime() &&
        existingMatch.scheduledEnd.getTime() === derived.scheduledEnd.getTime();

      if (!timesMatch) {
        ops.updates.push({
          eventId: existingMatch.id,
          updates: {
            scheduledStart: derived.scheduledStart,
            scheduledEnd: derived.scheduledEnd,
            meta: derived.meta,
          },
        });
      }
    } else {
      // No existing event with this source_id - check for overlaps with protected events
      const hasProtectedOverlap = existingEvents.some(
        (existing) =>
          (isEventLocked(existing) || isUserEditedEvent(existing)) &&
          eventsOverlap(
            derived.scheduledStart,
            derived.scheduledEnd,
            existing.scheduledStart,
            existing.scheduledEnd,
          ),
      );

      if (!hasProtectedOverlap) {
        ops.inserts.push({ event: derived });
      }
    }
  }

  // Find existing derived events that are no longer in the derived set - candidates for deletion
  for (const existing of existingEvents) {
    // Skip if this event was matched by a derived event
    if (matchedExistingIds.has(existing.id)) {
      continue;
    }

    // Skip if not a derived event (user-created events should never be auto-deleted)
    if (!isDerivedEvent(existing)) {
      continue;
    }

    // Skip if locked - locked events cannot be deleted
    if (isEventLocked(existing)) {
      ops.protectedIds.push(existing.id);
      continue;
    }

    // This derived event is no longer in the derived set - delete it
    ops.deletes.push({ eventId: existing.id });
  }

  return ops;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetch existing actual events for a time window.
 * Returns events with their locked_at status.
 *
 * @param userId - The user's ID
 * @param windowStart - Start of the window
 * @param windowEnd - End of the window
 * @returns Array of events in the window
 */
export async function fetchEventsInWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<ReconciliationEvent[]> {
  try {
    const { data, error } = await tmSchema()
      .from("events")
      .select("id, user_id, title, scheduled_start, scheduled_end, meta, locked_at")
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .lt("scheduled_start", windowEnd.toISOString())
      .gt("scheduled_end", windowStart.toISOString());

    if (error) throw handleSupabaseError(error);

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title ?? ""),
      scheduledStart: new Date(String(row.scheduled_start)),
      scheduledEnd: new Date(String(row.scheduled_end)),
      meta: (row.meta as Record<string, unknown>) ?? {},
      lockedAt: row.locked_at ? new Date(String(row.locked_at)) : null,
    }));
  } catch (error) {
    // Handle case where locked_at column doesn't exist yet
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("locked_at")
    ) {
      if (__DEV__) {
        console.warn(
          "[Reconciliation] locked_at column not found, fetching without it",
        );
      }
      // Retry without locked_at
      const { data, error: retryError } = await tmSchema()
        .from("events")
        .select("id, user_id, title, scheduled_start, scheduled_end, meta")
        .eq("user_id", userId)
        .eq("type", "calendar_actual")
        .lt("scheduled_start", windowEnd.toISOString())
        .gt("scheduled_end", windowStart.toISOString());

      if (retryError) throw handleSupabaseError(retryError);

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: String(row.user_id),
        title: String(row.title ?? ""),
        scheduledStart: new Date(String(row.scheduled_start)),
        scheduledEnd: new Date(String(row.scheduled_end)),
        meta: (row.meta as Record<string, unknown>) ?? {},
        lockedAt: null,
      }));
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Lock all events in a time window by setting their locked_at timestamp.
 * This marks events as immutable - they cannot be modified or deleted in future reconciliation.
 *
 * @param userId - The user's ID
 * @param windowStart - Start of the window
 * @param windowEnd - End of the window
 * @returns Number of events locked
 */
export async function lockEventsInWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<{ lockedCount: number }> {
  const now = new Date().toISOString();

  try {
    // Update all unlocked actual events in the window
    const { data, error } = await tmSchema()
      .from("events")
      .update({ locked_at: now })
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .lt("scheduled_start", windowEnd.toISOString())
      .gt("scheduled_end", windowStart.toISOString())
      .is("locked_at", null)
      .select("id");

    if (error) throw handleSupabaseError(error);

    const lockedCount = data?.length ?? 0;

    if (__DEV__ && lockedCount > 0) {
      console.log(
        `[Reconciliation] Locked ${lockedCount} events in window ${windowStart.toISOString()} - ${windowEnd.toISOString()}`,
      );
    }

    return { lockedCount };
  } catch (error) {
    // Handle case where locked_at column doesn't exist yet
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("locked_at")
    ) {
      if (__DEV__) {
        console.warn(
          "[Reconciliation] locked_at column not found, skipping lock operation",
        );
      }
      return { lockedCount: 0 };
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Check if any events in a window are locked.
 *
 * @param userId - The user's ID
 * @param windowStart - Start of the window
 * @param windowEnd - End of the window
 * @returns Whether any events in the window are locked
 */
export async function hasLockedEventsInWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<boolean> {
  try {
    const { data, error } = await tmSchema()
      .from("events")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .lt("scheduled_start", windowEnd.toISOString())
      .gt("scheduled_end", windowStart.toISOString())
      .not("locked_at", "is", null)
      .limit(1);

    if (error) throw handleSupabaseError(error);

    return (data?.length ?? 0) > 0;
  } catch (error) {
    // Handle case where locked_at column doesn't exist yet
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("locked_at")
    ) {
      return false;
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch all locked events for a user within a time range.
 * Useful for debugging and understanding what's protected.
 *
 * @param userId - The user's ID
 * @param startTime - Start of the range
 * @param endTime - End of the range
 * @returns Array of locked events
 */
export async function getLockedEventsInRange(
  userId: string,
  startTime: Date,
  endTime: Date,
): Promise<ReconciliationEvent[]> {
  try {
    const { data, error } = await tmSchema()
      .from("events")
      .select("id, user_id, title, scheduled_start, scheduled_end, meta, locked_at")
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .lt("scheduled_start", endTime.toISOString())
      .gt("scheduled_end", startTime.toISOString())
      .not("locked_at", "is", null)
      .order("scheduled_start", { ascending: true });

    if (error) throw handleSupabaseError(error);

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title ?? ""),
      scheduledStart: new Date(String(row.scheduled_start)),
      scheduledEnd: new Date(String(row.scheduled_end)),
      meta: (row.meta as Record<string, unknown>) ?? {},
      lockedAt: row.locked_at ? new Date(String(row.locked_at)) : null,
    }));
  } catch (error) {
    // Handle case where locked_at column doesn't exist yet
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("locked_at")
    ) {
      return [];
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
