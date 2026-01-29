import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Json } from "../database.types";

/**
 * Service for managing actual ingestion window locks.
 * Windows that have been processed are locked to prevent reprocessing.
 */

// ============================================================================
// Types
// ============================================================================

export interface WindowLockStats {
  eventsCreated?: number;
  eventsExtended?: number;
  eventsSessionized?: number;
  screenTimeSessions?: number;
  locationSegments?: number;
  [key: string]: unknown;
}

export interface WindowLock {
  id: string;
  userId: string;
  windowStart: Date;
  windowEnd: Date;
  lockedAt: Date;
  stats: WindowLockStats;
}

export interface WindowLockInsert {
  userId: string;
  windowStart: Date;
  windowEnd: Date;
  stats?: WindowLockStats;
}

export interface ProcessIngestionWindowResult {
  skipped: boolean;
  reason?: "already_locked";
  lockId?: string;
  stats?: WindowLockStats;
}

// ============================================================================
// Helpers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

function rowToWindowLock(row: Record<string, unknown>): WindowLock {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    windowStart: new Date(String(row.window_start)),
    windowEnd: new Date(String(row.window_end)),
    lockedAt: new Date(String(row.locked_at)),
    stats: (row.stats as WindowLockStats) ?? {},
  };
}

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("actual_ingestion_window_locks") &&
    (message.includes("schema cache") ||
      message.includes("relation") ||
      message.includes("does not exist"))
  );
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a window has already been locked (processed).
 *
 * @param userId - The user's ID
 * @param windowStart - The start of the 30-min window (as Date or ISO string)
 * @returns true if the window is already locked, false otherwise
 */
export async function isWindowLocked(
  userId: string,
  windowStart: Date | string,
): Promise<boolean> {
  const windowStartIso =
    windowStart instanceof Date ? windowStart.toISOString() : windowStart;

  try {
    const { data, error } = await tmSchema()
      .from("actual_ingestion_window_locks")
      .select("id")
      .eq("user_id", userId)
      .eq("window_start", windowStartIso)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    return data !== null;
  } catch (error) {
    if (isMissingTableError(error)) {
      // Table doesn't exist yet - treat as not locked
      if (__DEV__) {
        console.warn(
          "[WindowLocks] Table doesn't exist yet, treating as unlocked",
        );
      }
      return false;
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Lock a window to mark it as processed.
 * This uses upsert with the UNIQUE constraint to ensure idempotency.
 *
 * @param params - The lock parameters
 * @returns The created/updated lock record
 */
export async function lockWindow(
  params: WindowLockInsert,
): Promise<WindowLock> {
  const { userId, windowStart, windowEnd, stats = {} } = params;

  const payload = {
    user_id: userId,
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    locked_at: new Date().toISOString(),
    stats: stats as Json,
  };

  try {
    const { data, error } = await tmSchema()
      .from("actual_ingestion_window_locks")
      .upsert(payload, { onConflict: "user_id,window_start" })
      .select("*")
      .single();

    if (error) throw handleSupabaseError(error);
    return rowToWindowLock(data as Record<string, unknown>);
  } catch (error) {
    if (isMissingTableError(error)) {
      // If table doesn't exist, throw a more descriptive error
      throw new Error(
        "Window locks table does not exist. Please run migrations.",
      );
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Get the lock record for a specific window, if it exists.
 *
 * @param userId - The user's ID
 * @param windowStart - The start of the 30-min window
 * @returns The lock record or null if not found
 */
export async function getWindowLock(
  userId: string,
  windowStart: Date | string,
): Promise<WindowLock | null> {
  const windowStartIso =
    windowStart instanceof Date ? windowStart.toISOString() : windowStart;

  try {
    const { data, error } = await tmSchema()
      .from("actual_ingestion_window_locks")
      .select("*")
      .eq("user_id", userId)
      .eq("window_start", windowStartIso)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    if (!data) return null;
    return rowToWindowLock(data as Record<string, unknown>);
  } catch (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Get all locked windows for a user within a time range.
 *
 * @param userId - The user's ID
 * @param startTime - Start of the range
 * @param endTime - End of the range
 * @returns Array of lock records
 */
export async function getLockedWindowsInRange(
  userId: string,
  startTime: Date,
  endTime: Date,
): Promise<WindowLock[]> {
  try {
    const { data, error } = await tmSchema()
      .from("actual_ingestion_window_locks")
      .select("*")
      .eq("user_id", userId)
      .gte("window_start", startTime.toISOString())
      .lt("window_start", endTime.toISOString())
      .order("window_start", { ascending: true });

    if (error) throw handleSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) =>
      rowToWindowLock(row),
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Wrapper function to check lock before processing a window.
 * Returns early with { skipped: true } if window is already locked.
 *
 * @param userId - The user's ID
 * @param windowStart - The start of the 30-min window
 * @returns Result indicating if the window was skipped
 */
export async function checkWindowLockBeforeProcessing(
  userId: string,
  windowStart: Date | string,
): Promise<ProcessIngestionWindowResult | null> {
  const locked = await isWindowLocked(userId, windowStart);

  if (locked) {
    return {
      skipped: true,
      reason: "already_locked",
    };
  }

  // Window is not locked, return null to indicate processing should continue
  return null;
}

/**
 * Process an ingestion window with lock checking.
 * This is the main entry point for window-based actual ingestion.
 *
 * Flow:
 * 1. Check if window is already locked
 * 2. If locked, return { skipped: true }
 * 3. Otherwise, run the processing callback
 * 4. Lock the window after successful processing
 *
 * @param params - Processing parameters
 * @param params.userId - The user's ID
 * @param params.windowStart - The start of the 30-min window
 * @param params.windowEnd - The end of the 30-min window
 * @param params.process - Callback that performs the actual ingestion work
 * @returns Result of the processing
 */
export async function processIngestionWindow(params: {
  userId: string;
  windowStart: Date;
  windowEnd: Date;
  process: () => Promise<WindowLockStats>;
}): Promise<ProcessIngestionWindowResult> {
  const { userId, windowStart, windowEnd, process } = params;

  // Step 1: Check if window is already locked
  const skipResult = await checkWindowLockBeforeProcessing(userId, windowStart);
  if (skipResult) {
    return skipResult;
  }

  // Step 2: Process the window
  const stats = await process();

  // Step 3: Lock the window after successful processing
  const lock = await lockWindow({
    userId,
    windowStart,
    windowEnd,
    stats,
  });

  return {
    skipped: false,
    lockId: lock.id,
    stats,
  };
}
