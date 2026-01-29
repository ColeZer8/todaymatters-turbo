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

export interface ExtendableEvent {
  id: string;
  userId: string;
  title: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  meta: Record<string, unknown>;
  appId: string;
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

function getAppId(event: ReconciliationEvent): string | null {
  const appId = event.meta?.app_id;
  if (typeof appId === "string" && appId.trim().length > 0) {
    return appId.trim();
  }
  return null;
}

/** Maximum gap in milliseconds for events to be considered extendable (60 seconds) */
const EXTENSION_GAP_THRESHOLD_MS = 60 * 1000;

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
// Trailing Edge Extension Logic
// ============================================================================

/**
 * Find an extendable event for a given app.
 * An event is extendable if:
 * 1. It has the same app_id as the new event
 * 2. It ends near the start of the window (within 60 seconds)
 *
 * @param existingEvents - Events to search through (typically from the previous window)
 * @param windowStart - Start of the current window
 * @param appId - The app ID to match
 * @returns The extendable event, or null if none found
 */
export function findExtendableEvent(
  existingEvents: ReconciliationEvent[],
  windowStart: Date,
  appId: string,
): ReconciliationEvent | null {
  const windowStartMs = windowStart.getTime();

  // Find events that end near the window start (within threshold)
  const candidates = existingEvents.filter((event) => {
    const eventAppId = getAppId(event);
    if (eventAppId !== appId) {
      return false;
    }

    // Check if event ends near the window start
    const eventEndMs = event.scheduledEnd.getTime();
    const gap = windowStartMs - eventEndMs;

    // Event must end before or at window start, and within threshold
    return gap >= 0 && gap <= EXTENSION_GAP_THRESHOLD_MS;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Return the most recent event (closest to window start)
  return candidates.reduce((latest, current) =>
    current.scheduledEnd.getTime() > latest.scheduledEnd.getTime()
      ? current
      : latest,
  );
}

/**
 * Compute reconciliation operations with trailing edge extension.
 * Instead of creating new events for continuous sessions, this extends
 * the scheduled_end of existing events.
 *
 * @param existingEvents - Events currently in the database
 * @param derivedEvents - New events derived from evidence
 * @param previousWindowEvents - Events from the previous window (for extension candidates)
 * @returns Operations to perform including extensions
 */
export function computeReconciliationOpsWithExtension(
  existingEvents: ReconciliationEvent[],
  derivedEvents: DerivedEvent[],
  previousWindowEvents: ReconciliationEvent[] = [],
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

  // Track which derived events were handled by extension
  const extendedDerivedSourceIds = new Set<string>();

  // First pass: check for extension opportunities
  for (const derived of derivedEvents) {
    const derivedAppId = derived.meta?.app_id;
    if (typeof derivedAppId !== "string") {
      continue;
    }

    // Look for an extendable event in the previous window
    const extendable = findExtendableEvent(
      previousWindowEvents,
      derived.scheduledStart,
      derivedAppId,
    );

    if (extendable) {
      // Check if the event is locked - cannot extend locked events
      if (isEventLocked(extendable)) {
        ops.protectedIds.push(extendable.id);
        continue;
      }

      // Create extension operation
      ops.extensions.push({
        eventId: extendable.id,
        newEnd: derived.scheduledEnd,
      });

      extendedDerivedSourceIds.add(derived.sourceId);
    }
  }

  // Second pass: process derived events not handled by extension
  for (const derived of derivedEvents) {
    // Skip if this derived event was handled by extension
    if (extendedDerivedSourceIds.has(derived.sourceId)) {
      continue;
    }

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

/**
 * Check if a derived event can extend an existing event.
 * Returns true if the derived event starts within 60 seconds of an existing event's end
 * and they have the same app_id.
 *
 * @param derived - The derived event to check
 * @param existing - The existing event to check against
 * @returns Whether the derived event can extend the existing event
 */
export function canExtendEvent(
  derived: DerivedEvent,
  existing: ReconciliationEvent,
): boolean {
  const derivedAppId = derived.meta?.app_id;
  const existingAppId = getAppId(existing);

  if (typeof derivedAppId !== "string" || derivedAppId !== existingAppId) {
    return false;
  }

  const gap = derived.scheduledStart.getTime() - existing.scheduledEnd.getTime();
  return gap >= 0 && gap <= EXTENSION_GAP_THRESHOLD_MS;
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

/**
 * Fetch events that end near a window start for potential extension.
 * Finds events that end within 60 seconds before the window start.
 *
 * @param userId - The user's ID
 * @param windowStart - Start of the current window
 * @returns Array of events that could be extended
 */
export async function fetchExtensionCandidates(
  userId: string,
  windowStart: Date,
): Promise<ReconciliationEvent[]> {
  // Look for events that end within 60 seconds before the window start
  const windowStartMs = windowStart.getTime();
  const lookbackStart = new Date(windowStartMs - EXTENSION_GAP_THRESHOLD_MS);

  try {
    const { data, error } = await tmSchema()
      .from("events")
      .select("id, user_id, title, scheduled_start, scheduled_end, meta, locked_at")
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .gte("scheduled_end", lookbackStart.toISOString())
      .lte("scheduled_end", windowStart.toISOString())
      .order("scheduled_end", { ascending: false });

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
        .gte("scheduled_end", lookbackStart.toISOString())
        .lte("scheduled_end", windowStart.toISOString())
        .order("scheduled_end", { ascending: false });

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
 * Extend an event by updating its scheduled_end.
 * Used when continuous screen-time sessions span multiple windows.
 *
 * @param eventId - The ID of the event to extend
 * @param newEnd - The new scheduled_end timestamp
 * @returns Whether the extension was successful
 */
export async function extendEvent(
  eventId: string,
  newEnd: Date,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await tmSchema()
      .from("events")
      .update({ scheduled_end: newEnd.toISOString() })
      .eq("id", eventId)
      .is("locked_at", null); // Only extend unlocked events

    if (error) throw handleSupabaseError(error);

    if (__DEV__) {
      console.log(
        `[Reconciliation] Extended event ${eventId} to ${newEnd.toISOString()}`,
      );
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (__DEV__) {
      console.warn(`[Reconciliation] Failed to extend event: ${message}`);
    }
    return { success: false, error: message };
  }
}

/**
 * Execute all extension operations from a ReconciliationOps object.
 *
 * @param extensions - Array of extension operations
 * @returns Number of successful extensions
 */
export async function executeExtensions(
  extensions: ReconciliationOps["extensions"],
): Promise<{ extendedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let extendedCount = 0;

  for (const ext of extensions) {
    const result = await extendEvent(ext.eventId, ext.newEnd);
    if (result.success) {
      extendedCount++;
    } else if (result.error) {
      errors.push(`Event ${ext.eventId}: ${result.error}`);
    }
  }

  return { extendedCount, errors };
}
