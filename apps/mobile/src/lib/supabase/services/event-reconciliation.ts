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

function getPlaceId(event: ReconciliationEvent): string | null {
  const placeId = event.meta?.place_id;
  if (typeof placeId === "string" && placeId.trim().length > 0) {
    return placeId.trim();
  }
  return null;
}

function isLocationEvent(event: ReconciliationEvent): boolean {
  const kind = event.meta?.kind;
  return kind === "location_block" || kind === "commute";
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
// Location Trailing Edge Extension Logic
// ============================================================================

/**
 * Find an extendable location event for a given place.
 * An event is extendable if:
 * 1. It has the same place_id as the new event (including null for unknown)
 * 2. It ends near the start of the window (within 60 seconds)
 * 3. It is a location_block kind event
 *
 * @param existingEvents - Events to search through (typically from the previous window)
 * @param windowStart - Start of the current window
 * @param placeId - The place ID to match (can be null for unknown locations)
 * @returns The extendable event, or null if none found
 */
export function findExtendableLocationEvent(
  existingEvents: ReconciliationEvent[],
  windowStart: Date,
  placeId: string | null,
): ReconciliationEvent | null {
  const windowStartMs = windowStart.getTime();

  // Find location events that end near the window start (within threshold)
  const candidates = existingEvents.filter((event) => {
    // Must be a location event
    if (!isLocationEvent(event)) {
      return false;
    }

    const eventPlaceId = getPlaceId(event);

    // Match place_id (both can be null for unknown locations)
    if (eventPlaceId !== placeId) {
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
 * Check if a derived location event can extend an existing location event.
 * Returns true if:
 * 1. The derived event starts within 60 seconds of an existing event's end
 * 2. They have the same place_id (including null for unknown)
 * 3. Both are location events (kind = 'location_block' or 'commute')
 *
 * @param derived - The derived event to check
 * @param existing - The existing event to check against
 * @returns Whether the derived event can extend the existing event
 */
export function canExtendLocationEvent(
  derived: DerivedEvent,
  existing: ReconciliationEvent,
): boolean {
  // Check if both are location events
  const derivedKind = derived.meta?.kind;
  if (derivedKind !== "location_block" && derivedKind !== "commute") {
    return false;
  }
  if (!isLocationEvent(existing)) {
    return false;
  }

  // Match place_id (both can be null for unknown locations)
  const derivedPlaceId = derived.meta?.place_id as string | null | undefined;
  const existingPlaceId = getPlaceId(existing);

  // Handle the null/undefined comparison for unknown locations
  const normalizedDerivedPlaceId = derivedPlaceId ?? null;
  if (normalizedDerivedPlaceId !== existingPlaceId) {
    return false;
  }

  const gap = derived.scheduledStart.getTime() - existing.scheduledEnd.getTime();
  return gap >= 0 && gap <= EXTENSION_GAP_THRESHOLD_MS;
}

/**
 * Compute reconciliation operations with trailing edge extension for location events.
 * This is similar to computeReconciliationOpsWithExtension but specifically handles
 * location events, matching by place_id instead of app_id.
 *
 * When a user stays at the same place across multiple windows, instead of creating
 * duplicate location events, this extends the existing event's scheduled_end.
 *
 * @param existingEvents - Events currently in the database
 * @param derivedEvents - New events derived from evidence
 * @param previousWindowEvents - Events from the previous window (for extension candidates)
 * @returns Operations to perform including extensions
 */
export function computeReconciliationOpsWithLocationExtension(
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
    // Try location extension first (for location events)
    const derivedKind = derived.meta?.kind;
    if (derivedKind === "location_block" || derivedKind === "commute") {
      const derivedPlaceId = (derived.meta?.place_id as string | null) ?? null;

      // Look for an extendable location event in the previous window
      const extendable = findExtendableLocationEvent(
        previousWindowEvents,
        derived.scheduledStart,
        derivedPlaceId,
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
        continue;
      }
    }

    // Try app extension for screen-time events
    const derivedAppId = derived.meta?.app_id;
    if (typeof derivedAppId === "string") {
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
 * Unlock all events in a time window by clearing their locked_at timestamp.
 * Intended for dev-only forced reprocessing.
 */
export async function unlockEventsInWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<{ unlockedCount: number }> {
  try {
    const { data, error } = await tmSchema()
      .from("events")
      .update({ locked_at: null })
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .lt("scheduled_start", windowEnd.toISOString())
      .gt("scheduled_end", windowStart.toISOString())
      .not("locked_at", "is", null)
      .select("id");

    if (error) throw handleSupabaseError(error);

    const unlockedCount = data?.length ?? 0;
    if (__DEV__ && unlockedCount > 0) {
      console.log(
        `[Reconciliation] Unlocked ${unlockedCount} events in window ${windowStart.toISOString()} - ${windowEnd.toISOString()}`,
      );
    }
    return { unlockedCount };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("locked_at")
    ) {
      if (__DEV__) {
        console.warn(
          "[Reconciliation] locked_at column not found, skipping unlock operation",
        );
      }
      return { unlockedCount: 0 };
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

// ============================================================================
// Session Block Extension Logic
// ============================================================================

/**
 * Check if an event is a session block.
 */
function isSessionBlock(event: ReconciliationEvent | DerivedEvent): boolean {
  return event.meta?.kind === "session_block";
}

/**
 * Get the place_id from a session block's metadata.
 */
function getSessionBlockPlaceId(event: ReconciliationEvent | DerivedEvent): string | null {
  if (!isSessionBlock(event)) return null;
  const placeId = event.meta?.place_id;
  if (typeof placeId === "string" && placeId.trim().length > 0) {
    return placeId.trim();
  }
  return null;
}

/**
 * Find an extendable session block from the previous window.
 * A session block is extendable if:
 * 1. It has meta.kind === 'session_block'
 * 2. It has the same place_id (including null for unknown locations)
 * 3. It ends near the start of the new session (within 60 seconds)
 * 4. It is not locked
 *
 * @param previousWindowEvents - Events from the previous window (extension candidates)
 * @param newSessionStart - Start time of the new session block
 * @param placeId - The place ID to match (can be null for unknown locations)
 * @returns The extendable session block, or null if none found
 */
export function findExtendableSessionBlock(
  previousWindowEvents: ReconciliationEvent[],
  newSessionStart: Date,
  placeId: string | null,
): ReconciliationEvent | null {
  const newSessionStartMs = newSessionStart.getTime();

  // Find session blocks that end near the new session start (within threshold)
  const candidates = previousWindowEvents.filter((event) => {
    // Must be a session block
    if (!isSessionBlock(event)) {
      return false;
    }

    // Cannot extend locked events
    if (isEventLocked(event)) {
      return false;
    }

    // Match place_id (both can be null for unknown locations)
    const eventPlaceId = getSessionBlockPlaceId(event);
    if (eventPlaceId !== placeId) {
      return false;
    }

    // Check if session block ends near the new session start
    const eventEndMs = event.scheduledEnd.getTime();
    const gap = newSessionStartMs - eventEndMs;

    // Event must end before or at new session start, and within threshold
    return gap >= 0 && gap <= EXTENSION_GAP_THRESHOLD_MS;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Return the most recent session block (closest to new session start)
  return candidates.reduce((latest, current) =>
    current.scheduledEnd.getTime() > latest.scheduledEnd.getTime()
      ? current
      : latest,
  );
}

/**
 * Fetch session blocks from the previous window that could be extended.
 * Returns only session_block events that end near the window start.
 *
 * @param userId - The user's ID
 * @param windowStart - Start of the current window
 * @returns Array of session blocks that could be extended
 */
export async function fetchSessionBlockExtensionCandidates(
  userId: string,
  windowStart: Date,
): Promise<ReconciliationEvent[]> {
  // Look for session blocks that end within 60 seconds before the window start
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

    // Filter to only session blocks
    return (data ?? [])
      .filter((row: Record<string, unknown>) => {
        const meta = row.meta as Record<string, unknown> | undefined;
        return meta?.kind === "session_block";
      })
      .map((row: Record<string, unknown>) => ({
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

      return (data ?? [])
        .filter((row: Record<string, unknown>) => {
          const meta = row.meta as Record<string, unknown> | undefined;
          return meta?.kind === "session_block";
        })
        .map((row: Record<string, unknown>) => ({
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
 * Result of extending a session block.
 */
export interface SessionBlockExtensionResult {
  success: boolean;
  error?: string;
  /** The updated session block after extension */
  extendedBlock?: ReconciliationEvent;
}

/**
 * Extend a session block by updating its end time, children, and recalculating metadata.
 *
 * @param existingBlockId - ID of the existing session block to extend
 * @param newEnd - New scheduled_end timestamp
 * @param additionalChildren - Child event IDs to add to the existing children
 * @param newTitle - Optional new title (if intent changed after merging)
 * @param newMeta - Optional updated metadata (summary, intent, etc.)
 * @returns Result of the extension operation
 */
export async function extendSessionBlock(
  existingBlockId: string,
  newEnd: Date,
  additionalChildren: string[],
  newTitle?: string,
  newMeta?: Partial<Record<string, unknown>>,
): Promise<SessionBlockExtensionResult> {
  try {
    // First fetch the existing session block to get its current children
    const { data: existingData, error: fetchError } = await tmSchema()
      .from("events")
      .select("id, title, scheduled_start, scheduled_end, meta")
      .eq("id", existingBlockId)
      .single();

    if (fetchError) throw handleSupabaseError(fetchError);
    if (!existingData) {
      return { success: false, error: "Session block not found" };
    }

    const existingMeta = (existingData.meta as Record<string, unknown>) ?? {};
    const existingChildren = Array.isArray(existingMeta.children)
      ? (existingMeta.children as string[])
      : [];

    // Merge children, avoiding duplicates
    const mergedChildren = [...new Set([...existingChildren, ...additionalChildren])];

    // Build updated metadata
    const updatedMeta: Record<string, unknown> = {
      ...existingMeta,
      children: mergedChildren,
      ...(newMeta ?? {}),
    };

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      scheduled_end: newEnd.toISOString(),
      meta: updatedMeta,
    };

    if (newTitle) {
      updatePayload.title = newTitle;
    }

    // Update the session block
    const { error: updateError } = await tmSchema()
      .from("events")
      .update(updatePayload)
      .eq("id", existingBlockId)
      .is("locked_at", null); // Only extend unlocked events

    if (updateError) throw handleSupabaseError(updateError);

    if (__DEV__) {
      console.log(
        `[Reconciliation] Extended session block ${existingBlockId} to ${newEnd.toISOString()}, ` +
        `merged ${additionalChildren.length} new children (total: ${mergedChildren.length})`,
      );
    }

    // Return the updated block info
    return {
      success: true,
      extendedBlock: {
        id: existingBlockId,
        userId: "",
        title: newTitle ?? String(existingData.title ?? ""),
        scheduledStart: new Date(String(existingData.scheduled_start)),
        scheduledEnd: newEnd,
        meta: updatedMeta,
        lockedAt: null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (__DEV__) {
      console.warn(`[Reconciliation] Failed to extend session block: ${message}`);
    }
    return { success: false, error: message };
  }
}

/**
 * Delete session blocks in a window that are not in the protected list.
 * Used to clean up orphaned session blocks before creating new ones.
 *
 * @param userId - The user's ID
 * @param windowStart - Start of the window
 * @param windowEnd - End of the window
 * @param protectedIds - IDs of session blocks that should NOT be deleted (extended ones)
 * @returns Number of deleted session blocks
 */
export async function deleteOrphanedSessionBlocks(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  protectedIds: string[],
): Promise<{ deletedCount: number }> {
  try {
    // Since we can't directly filter by meta.kind in Supabase, we need to:
    // 1. Select all unlocked events in the window
    // 2. Filter to session blocks that are not protected
    // 3. Delete those specific IDs

    const { data: candidates, error: selectError } = await tmSchema()
      .from("events")
      .select("id, meta")
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .lt("scheduled_start", windowEnd.toISOString())
      .gt("scheduled_end", windowStart.toISOString())
      .is("locked_at", null);

    if (selectError) throw handleSupabaseError(selectError);

    // Filter to session blocks that are not protected
    const idsToDelete = (candidates ?? [])
      .filter((row: Record<string, unknown>) => {
        const meta = row.meta as Record<string, unknown> | undefined;
        const isSession = meta?.kind === "session_block";
        const isProtected = protectedIds.includes(String(row.id));
        return isSession && !isProtected;
      })
      .map((row: Record<string, unknown>) => String(row.id));

    if (idsToDelete.length === 0) {
      return { deletedCount: 0 };
    }

    // Delete the orphaned session blocks
    const { error: deleteError } = await tmSchema()
      .from("events")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) throw handleSupabaseError(deleteError);

    if (__DEV__ && idsToDelete.length > 0) {
      console.log(
        `[Reconciliation] Deleted ${idsToDelete.length} orphaned session blocks in window`,
      );
    }

    return { deletedCount: idsToDelete.length };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("locked_at")
    ) {
      if (__DEV__) {
        console.warn(
          "[Reconciliation] locked_at column not found, skipping orphaned session block deletion",
        );
      }
      return { deletedCount: 0 };
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

// ============================================================================
// Priority-Based Reconciliation (US-011)
// ============================================================================

/**
 * Event type for priority ordering.
 * Priority order: protected > screen_time > location > unknown
 */
export type EventPriority = "protected" | "screen_time" | "location" | "unknown";

/**
 * Get the priority of a reconciliation event.
 * Higher priority events take precedence and can overlap lower priority.
 */
export function getEventPriority(event: ReconciliationEvent | DerivedEvent): EventPriority {
  // Protected events have highest priority
  if ("lockedAt" in event && isEventLocked(event as ReconciliationEvent)) {
    return "protected";
  }

  // Check for user-edited events (also protected)
  const meta = event.meta;
  if (meta?.source === "user" || meta?.source === "actual_adjust") {
    return "protected";
  }

  // Check for screen-time events (have app_id)
  if (meta?.app_id) {
    return "screen_time";
  }

  // Check for location events (have kind = 'location_block' or 'commute')
  if (meta?.kind === "location_block" || meta?.kind === "commute") {
    return "location";
  }

  // Unknown/other events have lowest priority
  return "unknown";
}

/**
 * Get the priority of a derived event.
 */
export function getDerivedEventPriority(event: DerivedEvent): EventPriority {
  const meta = event.meta;

  // Check for screen-time events (have app_id)
  if (meta?.app_id) {
    return "screen_time";
  }

  // Check for location events (have kind = 'location_block' or 'commute')
  if (meta?.kind === "location_block" || meta?.kind === "commute") {
    return "location";
  }

  // Unknown/other events have lowest priority
  return "unknown";
}

/**
 * Check if event A has higher or equal priority than event B.
 */
function hasHigherOrEqualPriority(
  priorityA: EventPriority,
  priorityB: EventPriority,
): boolean {
  const order: Record<EventPriority, number> = {
    protected: 4,
    screen_time: 3,
    location: 2,
    unknown: 1,
  };
  return order[priorityA] >= order[priorityB];
}

/**
 * Check if an event is a commute event.
 */
function isCommuteEvent(event: ReconciliationEvent | DerivedEvent): boolean {
  return event.meta?.kind === "commute";
}

/**
 * Trim a derived event to fill only the gaps not covered by higher-priority events.
 * Returns null if the event is completely covered.
 * Returns an array of events if the event needs to be split around higher-priority events.
 */
export function trimEventToGaps(
  event: DerivedEvent,
  higherPriorityEvents: Array<{ start: Date; end: Date }>,
): DerivedEvent[] {
  // Sort higher priority events by start time
  const sortedHigher = [...higherPriorityEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // Find gaps that the event can fill
  const eventStart = event.scheduledStart.getTime();
  const eventEnd = event.scheduledEnd.getTime();

  // Collect occupied ranges within the event's time span
  const occupiedRanges: Array<{ start: number; end: number }> = [];
  for (const higher of sortedHigher) {
    const overlapStart = Math.max(eventStart, higher.start.getTime());
    const overlapEnd = Math.min(eventEnd, higher.end.getTime());
    if (overlapStart < overlapEnd) {
      occupiedRanges.push({ start: overlapStart, end: overlapEnd });
    }
  }

  // Merge overlapping occupied ranges
  const mergedOccupied: Array<{ start: number; end: number }> = [];
  for (const range of occupiedRanges) {
    if (mergedOccupied.length === 0) {
      mergedOccupied.push(range);
    } else {
      const last = mergedOccupied[mergedOccupied.length - 1];
      if (range.start <= last.end) {
        last.end = Math.max(last.end, range.end);
      } else {
        mergedOccupied.push(range);
      }
    }
  }

  // Find free ranges within the event
  const freeRanges: Array<{ start: number; end: number }> = [];
  let cursor = eventStart;

  for (const occupied of mergedOccupied) {
    if (cursor < occupied.start) {
      freeRanges.push({ start: cursor, end: occupied.start });
    }
    cursor = Math.max(cursor, occupied.end);
  }

  // Add final free range if any
  if (cursor < eventEnd) {
    freeRanges.push({ start: cursor, end: eventEnd });
  }

  // No free space - event is completely covered
  if (freeRanges.length === 0) {
    return [];
  }

  // Create trimmed events for each free range
  return freeRanges.map((range, index) => ({
    ...event,
    // Modify source ID to include segment index if split
    sourceId: freeRanges.length > 1 ? `${event.sourceId}:${index}` : event.sourceId,
    scheduledStart: new Date(range.start),
    scheduledEnd: new Date(range.end),
  }));
}

/**
 * Compute reconciliation operations with priority-based handling.
 *
 * Priority order: Protected > Screen-time > Location > Unknown
 *
 * Key rules:
 * 1. Protected events (locked or user-edited) are never modified or deleted
 * 2. Screen-time events take precedence over location blocks
 * 3. Location blocks fill gaps where no screen-time exists
 * 4. When screen-time occurs during a commute, both are kept (commute acts as container)
 * 5. Unknown events have lowest priority
 *
 * @param existingEvents - Events currently in the database
 * @param screenTimeEvents - Derived events from screen-time evidence
 * @param locationEvents - Derived events from location evidence
 * @param previousWindowEvents - Events from the previous window (for extension candidates)
 * @returns Operations to perform including extensions
 */
export function computeReconciliationOpsWithPriority(
  existingEvents: ReconciliationEvent[],
  screenTimeEvents: DerivedEvent[],
  locationEvents: DerivedEvent[],
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

  // Collect all occupied time ranges by priority level
  const protectedRanges: Array<{ start: Date; end: Date; eventId: string }> = [];
  const screenTimeRanges: Array<{ start: Date; end: Date; eventId?: string }> = [];
  const commuteRanges: Array<{ start: Date; end: Date; eventId?: string }> = [];

  // Add existing protected events to protected ranges
  for (const event of existingEvents) {
    if (isEventLocked(event) || isUserEditedEvent(event)) {
      protectedRanges.push({
        start: event.scheduledStart,
        end: event.scheduledEnd,
        eventId: event.id,
      });
      ops.protectedIds.push(event.id);
    }
  }

  // ============================================================================
  // Pass 1: Process screen-time events first (higher priority)
  // ============================================================================
  for (const derived of screenTimeEvents) {
    // Try app extension for screen-time events
    const derivedAppId = derived.meta?.app_id;
    if (typeof derivedAppId === "string") {
      const extendable = findExtendableEvent(
        previousWindowEvents,
        derived.scheduledStart,
        derivedAppId,
      );

      if (extendable) {
        if (isEventLocked(extendable)) {
          ops.protectedIds.push(extendable.id);
        } else {
          ops.extensions.push({
            eventId: extendable.id,
            newEnd: derived.scheduledEnd,
          });
          extendedDerivedSourceIds.add(derived.sourceId);
          // Add to screen-time ranges
          screenTimeRanges.push({
            start: extendable.scheduledStart,
            end: derived.scheduledEnd,
            eventId: extendable.id,
          });
          continue;
        }
      }
    }

    // Skip if handled by extension
    if (extendedDerivedSourceIds.has(derived.sourceId)) {
      continue;
    }

    const existingMatch = existingBySourceId.get(derived.sourceId);

    if (existingMatch) {
      matchedExistingIds.add(existingMatch.id);

      if (isEventLocked(existingMatch)) {
        ops.protectedIds.push(existingMatch.id);
        continue;
      }

      // Check if update is needed
      const timesMatch =
        existingMatch.scheduledStart.getTime() === derived.scheduledStart.getTime() &&
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

      // Add to screen-time ranges
      screenTimeRanges.push({
        start: derived.scheduledStart,
        end: derived.scheduledEnd,
        eventId: existingMatch.id,
      });
    } else {
      // Check for overlap with protected events
      const hasProtectedOverlap = protectedRanges.some((range) =>
        eventsOverlap(
          derived.scheduledStart,
          derived.scheduledEnd,
          range.start,
          range.end,
        ),
      );

      if (!hasProtectedOverlap) {
        ops.inserts.push({ event: derived });
        // Add to screen-time ranges
        screenTimeRanges.push({
          start: derived.scheduledStart,
          end: derived.scheduledEnd,
        });
      }
    }
  }

  // ============================================================================
  // Pass 2: Process location events (fill gaps around screen-time)
  // ============================================================================
  for (const derived of locationEvents) {
    const isCommute = isCommuteEvent(derived);

    // Try location extension
    const derivedPlaceId = (derived.meta?.place_id as string | null) ?? null;
    const derivedKind = derived.meta?.kind;

    if (derivedKind === "location_block" || derivedKind === "commute") {
      const extendable = findExtendableLocationEvent(
        previousWindowEvents,
        derived.scheduledStart,
        derivedPlaceId,
      );

      if (extendable) {
        if (isEventLocked(extendable)) {
          ops.protectedIds.push(extendable.id);
        } else {
          ops.extensions.push({
            eventId: extendable.id,
            newEnd: derived.scheduledEnd,
          });
          extendedDerivedSourceIds.add(derived.sourceId);

          if (isCommute) {
            commuteRanges.push({
              start: extendable.scheduledStart,
              end: derived.scheduledEnd,
              eventId: extendable.id,
            });
          }
          continue;
        }
      }
    }

    // Skip if handled by extension
    if (extendedDerivedSourceIds.has(derived.sourceId)) {
      continue;
    }

    const existingMatch = existingBySourceId.get(derived.sourceId);

    if (existingMatch) {
      matchedExistingIds.add(existingMatch.id);

      if (isEventLocked(existingMatch)) {
        ops.protectedIds.push(existingMatch.id);
        continue;
      }

      // Check if update is needed
      const timesMatch =
        existingMatch.scheduledStart.getTime() === derived.scheduledStart.getTime() &&
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

      if (isCommute) {
        commuteRanges.push({
          start: derived.scheduledStart,
          end: derived.scheduledEnd,
          eventId: existingMatch.id,
        });
      }
    } else {
      // Check for overlap with protected events
      const hasProtectedOverlap = protectedRanges.some((range) =>
        eventsOverlap(
          derived.scheduledStart,
          derived.scheduledEnd,
          range.start,
          range.end,
        ),
      );

      if (hasProtectedOverlap) {
        continue;
      }

      // For commute events: keep both commute and screen-time (screen-time inside commute)
      // Don't trim commutes, just insert them
      if (isCommute) {
        ops.inserts.push({ event: derived });
        commuteRanges.push({
          start: derived.scheduledStart,
          end: derived.scheduledEnd,
        });
        continue;
      }

      // For location_block events: trim to fill gaps around screen-time
      const combinedHigherPriority = [
        ...protectedRanges,
        ...screenTimeRanges,
      ];

      const trimmedEvents = trimEventToGaps(derived, combinedHigherPriority);

      for (const trimmed of trimmedEvents) {
        // Only insert if there's meaningful duration (> 1 minute)
        const durationMs =
          trimmed.scheduledEnd.getTime() - trimmed.scheduledStart.getTime();
        if (durationMs > 60 * 1000) {
          ops.inserts.push({ event: trimmed });
        }
      }
    }
  }

  // ============================================================================
  // Pass 3: Clean up orphaned derived events
  // ============================================================================
  for (const existing of existingEvents) {
    // Skip if matched
    if (matchedExistingIds.has(existing.id)) {
      continue;
    }

    // Skip if not a derived event
    if (!isDerivedEvent(existing)) {
      continue;
    }

    // Skip if locked
    if (isEventLocked(existing)) {
      ops.protectedIds.push(existing.id);
      continue;
    }

    // Delete orphaned derived events
    ops.deletes.push({ eventId: existing.id });
  }

  return ops;
}
