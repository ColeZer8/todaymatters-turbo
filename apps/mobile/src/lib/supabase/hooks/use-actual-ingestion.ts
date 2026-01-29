/**
 * React hook for the actual ingestion pipeline.
 * Handles immutable window-based processing of screen-time and location data.
 *
 * Flow:
 * 1. Check if window is locked (skip if already processed)
 * 2. Fetch screen-time + location evidence
 * 3. Run reconciliation with priority (screen-time > location)
 * 4. Run sessionization pass
 * 5. Lock the window
 * 6. Update checkpoint
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "@/stores";

// Window lock services
import {
  isWindowLocked,
  lockWindow,
  type WindowLockStats,
} from "../services/actual-ingestion-window-locks";

// Evidence fetching
import {
  fetchLocationEvidenceForWindow,
  fetchUserPlaces,
  type EvidenceLocationSample,
  type UserPlaceRow,
} from "../services/evidence-data";

// Screen-time sessions are from evidence-data.ts
import { fetchScreenTimeSessionsForDay } from "../services/evidence-data";

// Location segment generation and sessionization
import {
  generateLocationSegments,
  segmentsToDerivedEvents,
  processSegmentsWithCommutes,
  sessionizeWindow,
  applySleepDetection,
  findHomePlace,
  sessionBlockToDerivedEvent,
  type SessionBlock,
  type SleepSchedule,
  DEFAULT_SLEEP_SCHEDULE,
} from "../services/actual-ingestion";

// Reconciliation
import {
  computeReconciliationOpsWithPriority,
  fetchEventsInWindow,
  fetchExtensionCandidates,
  lockEventsInWindow,
  extendEvent,
  type ReconciliationEvent,
  type DerivedEvent,
  type ReconciliationOps,
} from "../services/event-reconciliation";

// App categories
import {
  type UserAppCategoryOverrides,
  type AppCategory,
} from "../services/app-categories";

// User app category overrides (from calendar app-classification)
import { fetchUserAppCategoryOverrides as fetchCalendarAppOverrides } from "../services/user-app-categories";

/**
 * Convert AppCategoryOverrides (from calendar) to UserAppCategoryOverrides (for ingestion).
 * Maps EventCategory values to AppCategory values.
 */
function convertToUserAppCategoryOverrides(
  overrides: Record<string, { category: string; confidence: number }>,
): UserAppCategoryOverrides {
  const result: UserAppCategoryOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    // Map EventCategory to AppCategory
    // EventCategory: "work", "exercise", "relationship", "growth", "routine"
    // AppCategory: "work", "social", "entertainment", "comms", "utility", "ignore"
    let appCategory: AppCategory = "utility";
    const category = value.category.toLowerCase();
    if (category === "work") {
      appCategory = "work";
    } else if (category === "relationship" || category === "social") {
      appCategory = "social";
    } else if (category === "entertainment" || category === "growth") {
      appCategory = "entertainment";
    } else if (category === "comms") {
      appCategory = "comms";
    }
    result[key] = { category: appCategory, confidence: value.confidence };
  }
  return result;
}

/**
 * Fetch user app category overrides and convert to ingestion format.
 */
async function fetchUserAppCategoryOverrides(
  userId: string,
): Promise<UserAppCategoryOverrides> {
  const calendarOverrides = await fetchCalendarAppOverrides(userId);
  return convertToUserAppCategoryOverrides(calendarOverrides);
}

// Supabase client
import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Json } from "../database.types";

// Location permission check
import { isLocationAvailableForIngestion } from "@/lib/location-permission";

// ============================================================================
// Types
// ============================================================================

export interface IngestionWindowResult {
  /** Whether the window was skipped because it was already locked */
  skipped: boolean;
  /** Reason for skipping */
  reason?: "already_locked" | "no_user" | "error";
  /** Statistics about the processing */
  stats?: WindowLockStats;
  /** Error message if processing failed */
  error?: string;
  /** Whether location was unavailable and we fell back to screen-time only */
  locationFallback?: boolean;
}

export interface IngestionStats {
  /** Number of events created (inserts) */
  eventsCreated: number;
  /** Number of events extended (trailing edge) */
  eventsExtended: number;
  /** Number of events updated */
  eventsUpdated: number;
  /** Number of events deleted */
  eventsDeleted: number;
  /** Number of session blocks created */
  sessionsCreated: number;
  /** Number of screen-time sessions processed */
  screenTimeSessions: number;
  /** Number of location segments processed */
  locationSegments: number;
  /** Whether location was skipped due to permission denied */
  locationSkipped?: boolean;
}

interface UseActualIngestionOptions {
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Whether to log stats to console in development */
  logStats?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

/**
 * Fetch screen-time sessions for a time window.
 * Uses the existing fetchScreenTimeSessionsForDay but filters to window.
 */
async function fetchScreenTimeForWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<Array<{
  id: string;
  appId: string;
  displayName: string | null;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
}>> {
  // Convert window to YMD format (may span two days at midnight)
  const startYmd = windowStart.toISOString().slice(0, 10);
  const endYmd = windowEnd.toISOString().slice(0, 10);

  // Fetch sessions for both days if they differ
  const sessions = await fetchScreenTimeSessionsForDay(userId, startYmd);
  if (startYmd !== endYmd) {
    const endDaySessions = await fetchScreenTimeSessionsForDay(userId, endYmd);
    sessions.push(...endDaySessions);
  }

  // Filter to window and convert
  return sessions
    .filter((session) => {
      const sessionStart = new Date(session.started_at);
      const sessionEnd = new Date(session.ended_at);
      // Session overlaps with window
      return sessionStart < windowEnd && sessionEnd > windowStart;
    })
    .map((session) => ({
      id: session.id,
      appId: session.app_id,
      displayName: session.display_name,
      startedAt: new Date(session.started_at),
      endedAt: new Date(session.ended_at),
      durationSeconds: session.duration_seconds,
    }));
}

/**
 * Convert screen-time sessions to derived events.
 */
function screenTimeToDerivedEvents(
  sessions: Array<{
    id: string;
    appId: string;
    displayName: string | null;
    startedAt: Date;
    endedAt: Date;
    durationSeconds: number;
  }>,
  windowStart: Date,
): DerivedEvent[] {
  return sessions.map((session) => {
    const sourceId = `screentime:${windowStart.getTime()}:${session.appId}:${session.startedAt.getTime()}`;
    return {
      sourceId,
      title: session.displayName ?? session.appId,
      scheduledStart: session.startedAt,
      scheduledEnd: session.endedAt,
      meta: {
        kind: "screen_time",
        source: "derived",
        source_id: sourceId,
        app_id: session.appId,
        display_name: session.displayName,
        duration_seconds: session.durationSeconds,
      },
    };
  });
}

/**
 * Fetch location samples for a time window.
 */
async function fetchLocationSamplesForWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<EvidenceLocationSample[]> {
  try {
    const { data, error } = await tmSchema()
      .from("location_samples")
      .select("recorded_at, latitude, longitude")
      .eq("user_id", userId)
      .gte("recorded_at", windowStart.toISOString())
      .lt("recorded_at", windowEnd.toISOString())
      .order("recorded_at", { ascending: true });

    if (error) {
      // Table might not exist yet
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
      console.warn("[ActualIngestion] Failed to fetch location samples:", error);
    }
    return [];
  }
}

/**
 * Execute reconciliation operations (inserts, updates, deletes, extensions).
 */
async function executeReconciliationOps(
  userId: string,
  ops: ReconciliationOps,
): Promise<{ stats: IngestionStats; errors: string[] }> {
  const stats: IngestionStats = {
    eventsCreated: 0,
    eventsExtended: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    sessionsCreated: 0,
    screenTimeSessions: 0,
    locationSegments: 0,
  };
  const errors: string[] = [];

  // Execute extensions
  for (const ext of ops.extensions) {
    try {
      const { error } = await tmSchema()
        .from("events")
        .update({ scheduled_end: ext.newEnd.toISOString() })
        .eq("id", ext.eventId)
        .is("locked_at", null);

      if (error) {
        errors.push(`Extension failed for ${ext.eventId}: ${error.message}`);
      } else {
        stats.eventsExtended++;
      }
    } catch (error) {
      errors.push(
        `Extension failed for ${ext.eventId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Execute inserts
  if (ops.inserts.length > 0) {
    const insertPayloads = ops.inserts.map(({ event }) => ({
      user_id: userId,
      type: "calendar_actual",
      title: event.title,
      description: "",
      scheduled_start: event.scheduledStart.toISOString(),
      scheduled_end: event.scheduledEnd.toISOString(),
      meta: event.meta as Json,
    }));

    try {
      const { data, error } = await tmSchema()
        .from("events")
        .insert(insertPayloads)
        .select("id");

      if (error) {
        errors.push(`Batch insert failed: ${error.message}`);
      } else {
        stats.eventsCreated = data?.length ?? 0;
      }
    } catch (error) {
      errors.push(
        `Batch insert failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Execute updates
  for (const update of ops.updates) {
    try {
      const updatePayload: Record<string, unknown> = {};
      if (update.updates.scheduledStart) {
        updatePayload.scheduled_start = update.updates.scheduledStart.toISOString();
      }
      if (update.updates.scheduledEnd) {
        updatePayload.scheduled_end = update.updates.scheduledEnd.toISOString();
      }
      if (update.updates.meta) {
        updatePayload.meta = update.updates.meta as Json;
      }

      const { error } = await tmSchema()
        .from("events")
        .update(updatePayload)
        .eq("id", update.eventId)
        .is("locked_at", null);

      if (error) {
        errors.push(`Update failed for ${update.eventId}: ${error.message}`);
      } else {
        stats.eventsUpdated++;
      }
    } catch (error) {
      errors.push(
        `Update failed for ${update.eventId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Execute deletes
  for (const del of ops.deletes) {
    try {
      const { error } = await tmSchema()
        .from("events")
        .delete()
        .eq("id", del.eventId)
        .is("locked_at", null);

      if (error) {
        errors.push(`Delete failed for ${del.eventId}: ${error.message}`);
      } else {
        stats.eventsDeleted++;
      }
    } catch (error) {
      errors.push(
        `Delete failed for ${del.eventId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return { stats, errors };
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for the actual ingestion pipeline.
 * Provides a function to process a 30-minute ingestion window.
 */
export function useActualIngestion(options: UseActualIngestionOptions = {}) {
  const { onError, logStats = true } = options;
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<IngestionWindowResult | null>(null);

  /**
   * Process a single 30-minute ingestion window.
   *
   * This function:
   * 1. Checks if the window is already locked (skip if so)
   * 2. Fetches screen-time and location evidence
   * 3. Runs priority-based reconciliation
   * 4. Runs sessionization pass
   * 5. Applies sleep detection
   * 6. Locks the window after successful processing
   *
   * @param windowStart - Start of the 30-minute window
   * @param windowEnd - End of the 30-minute window
   * @param sleepSchedule - Optional sleep schedule for sleep detection
   * @returns Result of the ingestion process
   */
  const processWindow = useCallback(
    async (
      windowStart: Date,
      windowEnd: Date,
      sleepSchedule?: SleepSchedule | null,
    ): Promise<IngestionWindowResult> => {
      // Check if authenticated
      if (!isAuthenticated || !user?.id) {
        return { skipped: true, reason: "no_user" };
      }

      const userId = user.id;

      // Step 1: Check if window is already locked
      try {
        const locked = await isWindowLocked(userId, windowStart);
        if (locked) {
          const result: IngestionWindowResult = {
            skipped: true,
            reason: "already_locked",
          };
          setLastResult(result);
          return result;
        }
      } catch (error) {
        // Non-fatal - continue with processing
        if (__DEV__) {
          console.warn("[ActualIngestion] Failed to check window lock:", error);
        }
      }

      setIsProcessing(true);

      // Track if we're using screen-time only fallback
      let locationFallback = false;

      try {
        // Step 1.5: Check if location is available (permission granted)
        const locationAvailable = await isLocationAvailableForIngestion();
        if (!locationAvailable) {
          locationFallback = true;
          if (__DEV__) {
            console.log(
              "[ActualIngestion] Location not available, using screen-time only fallback"
            );
          }
        }

        // Step 2: Fetch evidence data in parallel
        // Skip location fetches if location is not available
        const [
          screenTimeSessions,
          locationSamples,
          userPlaces,
          userAppOverrides,
          existingEvents,
          previousWindowEvents,
        ] = await Promise.all([
          fetchScreenTimeForWindow(userId, windowStart, windowEnd),
          // Skip location samples if location not available
          locationFallback
            ? Promise.resolve([])
            : fetchLocationSamplesForWindow(userId, windowStart, windowEnd),
          // Still fetch user places (needed for sleep detection)
          fetchUserPlaces(userId),
          fetchUserAppCategoryOverrides(userId).catch(() => ({} as UserAppCategoryOverrides)),
          fetchEventsInWindow(userId, windowStart, windowEnd),
          fetchExtensionCandidates(userId, windowStart),
        ]);

        // Step 3: Generate derived events from evidence

        // Screen-time derived events
        const screenTimeEvents = screenTimeToDerivedEvents(
          screenTimeSessions,
          windowStart,
        );

        // Location segments and derived events (empty if location not available)
        let locationSegments = locationFallback
          ? []
          : generateLocationSegments(
              locationSamples,
              userPlaces,
              windowStart,
              windowEnd,
            );

        // Process with commute detection (skip if location not available)
        if (!locationFallback && locationSegments.length > 0) {
          locationSegments = processSegmentsWithCommutes(
            locationSegments,
            locationSamples,
            userPlaces,
            windowStart,
          );
        }

        const locationEvents = segmentsToDerivedEvents(locationSegments);

        // Step 4: Run priority-based reconciliation
        const reconciliationOps = computeReconciliationOpsWithPriority(
          existingEvents,
          screenTimeEvents,
          locationEvents,
          previousWindowEvents,
        );

        // Execute reconciliation operations
        const { stats, errors } = await executeReconciliationOps(
          userId,
          reconciliationOps,
        );

        // Log any reconciliation errors
        if (errors.length > 0 && __DEV__) {
          console.warn("[ActualIngestion] Reconciliation errors:", errors);
        }

        // Step 5: Run sessionization pass
        // Fetch updated events after reconciliation
        const updatedEvents = await fetchEventsInWindow(userId, windowStart, windowEnd);

        // Convert to sessionizable events
        const sessionizableEvents = updatedEvents.map((event) => ({
          id: event.id,
          title: event.title,
          scheduledStart: event.scheduledStart,
          scheduledEnd: event.scheduledEnd,
          meta: event.meta,
        }));

        // Run sessionization
        let sessions = sessionizeWindow(
          userId,
          windowStart,
          windowEnd,
          sessionizableEvents,
          userAppOverrides,
        );

        // Apply sleep detection
        const homePlace = findHomePlace(
          userPlaces.map((p) => ({ id: p.id, label: p.label, category: p.category })),
        );

        sessions = applySleepDetection(
          userId,
          sessions,
          windowStart,
          windowEnd,
          homePlace,
          sleepSchedule ?? DEFAULT_SLEEP_SCHEDULE,
        );

        // Insert session blocks as events
        if (sessions.length > 0) {
          const sessionEvents = sessions.map((session) =>
            sessionBlockToDerivedEvent(session),
          );

          const sessionInserts = sessionEvents.map((event) => ({
            user_id: userId,
            type: "calendar_actual",
            title: event.title,
            description: "",
            scheduled_start: event.scheduledStart.toISOString(),
            scheduled_end: event.scheduledEnd.toISOString(),
            meta: event.meta as Json,
          }));

          try {
            const { data, error } = await tmSchema()
              .from("events")
              .insert(sessionInserts)
              .select("id");

            if (error) {
              if (__DEV__) {
                console.warn("[ActualIngestion] Failed to insert sessions:", error);
              }
            } else {
              stats.sessionsCreated = data?.length ?? 0;
            }
          } catch (error) {
            if (__DEV__) {
              console.warn("[ActualIngestion] Failed to insert sessions:", error);
            }
          }
        }

        // Update stats
        stats.screenTimeSessions = screenTimeSessions.length;
        stats.locationSegments = locationSegments.length;
        stats.locationSkipped = locationFallback;

        // Step 6: Lock events in window
        try {
          await lockEventsInWindow(userId, windowStart, windowEnd);
        } catch (error) {
          // Non-fatal - continue
          if (__DEV__) {
            console.warn("[ActualIngestion] Failed to lock events:", error);
          }
        }

        // Step 7: Lock the window
        const lockStats: WindowLockStats = {
          eventsCreated: stats.eventsCreated,
          eventsExtended: stats.eventsExtended,
          eventsSessionized: stats.sessionsCreated,
          screenTimeSessions: stats.screenTimeSessions,
          locationSegments: stats.locationSegments,
        };

        try {
          await lockWindow({
            userId,
            windowStart,
            windowEnd,
            stats: lockStats,
          });
        } catch (error) {
          // Non-fatal - window lock failure doesn't invalidate processing
          if (__DEV__) {
            console.warn("[ActualIngestion] Failed to lock window:", error);
          }
        }

        // Log stats in development
        if (logStats && __DEV__) {
          console.log("[ActualIngestion] Window processed:", {
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString(),
            locationFallback,
            ...stats,
          });
        }

        const result: IngestionWindowResult = {
          skipped: false,
          stats: lockStats,
          locationFallback,
        };

        setLastResult(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        if (__DEV__) {
          console.error("[ActualIngestion] Processing failed:", error);
        }

        onError?.(
          error instanceof Error ? error : new Error(errorMessage),
        );

        const result: IngestionWindowResult = {
          skipped: true,
          reason: "error",
          error: errorMessage,
        };

        setLastResult(result);
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [isAuthenticated, user?.id, onError, logStats],
  );

  /**
   * Process multiple windows in sequence.
   * Useful for catching up on missed windows.
   *
   * @param windows - Array of window boundaries to process
   * @param sleepSchedule - Optional sleep schedule for sleep detection
   * @returns Array of results for each window
   */
  const processWindows = useCallback(
    async (
      windows: Array<{ start: Date; end: Date }>,
      sleepSchedule?: SleepSchedule | null,
    ): Promise<IngestionWindowResult[]> => {
      const results: IngestionWindowResult[] = [];

      for (const window of windows) {
        const result = await processWindow(window.start, window.end, sleepSchedule);
        results.push(result);

        // Stop processing if we hit an error (except for locked windows)
        if (result.reason === "error") {
          break;
        }
      }

      return results;
    },
    [processWindow],
  );

  /**
   * Calculate the current ingestion window based on the current time.
   * Windows are 30-minute aligned (00:00, 00:30, 01:00, etc.).
   */
  const getCurrentWindow = useCallback((): { start: Date; end: Date } => {
    const now = new Date();
    const minutes = now.getMinutes();
    const windowStartMinutes = minutes >= 30 ? 30 : 0;

    const windowStart = new Date(now);
    windowStart.setMinutes(windowStartMinutes, 0, 0);

    const windowEnd = new Date(windowStart);
    windowEnd.setMinutes(windowEnd.getMinutes() + 30);

    return { start: windowStart, end: windowEnd };
  }, []);

  /**
   * Calculate the previous ingestion window (the one that just completed).
   * This is the window that should be processed.
   */
  const getPreviousWindow = useCallback((): { start: Date; end: Date } => {
    const current = getCurrentWindow();
    const previousStart = new Date(current.start);
    previousStart.setMinutes(previousStart.getMinutes() - 30);

    return { start: previousStart, end: current.start };
  }, [getCurrentWindow]);

  return {
    /** Process a single ingestion window */
    processWindow,
    /** Process multiple windows in sequence */
    processWindows,
    /** Get the current 30-minute window */
    getCurrentWindow,
    /** Get the previous 30-minute window (the one to process) */
    getPreviousWindow,
    /** Whether processing is currently in progress */
    isProcessing,
    /** Result of the last processing operation */
    lastResult,
  };
}
