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
  applyFuzzyLocationLabels,
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
  findExtendableSessionBlock,
  fetchSessionBlockExtensionCandidates,
  extendSessionBlock,
  deleteOrphanedSessionBlocks,
  type ReconciliationEvent,
  type DerivedEvent,
  type ReconciliationOps,
} from "../services/event-reconciliation";

// App categories
import {
  classifyIntent,
  type UserAppCategoryOverrides,
  type AppCategory,
  type AppSummary,
  type Intent,
} from "../services/app-categories";

// Google Places (fuzzy reverse-geocoding labels)
import { getFuzzyLocationLabel, isGooglePlacesAvailable } from "../services/google-places";

// NEW PIPELINE: Activity segments (BRAVO layer) and hourly summaries (CHARLIE layer)
import {
  generateActivitySegments,
  saveActivitySegments,
} from "../services/activity-segments";
import { processHourlySummary } from "../services/hourly-summaries";

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

export interface ProcessActualIngestionWindowInput {
  userId: string | null;
  windowStart: Date;
  windowEnd: Date;
  sleepSchedule?: SleepSchedule | null;
  onError?: (error: Error) => void;
  logStats?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

export function getCurrentIngestionWindow(
  now: Date = new Date(),
): { start: Date; end: Date } {
  const minutes = now.getMinutes();
  const windowStartMinutes = minutes >= 30 ? 30 : 0;

  const windowStart = new Date(now);
  windowStart.setMinutes(windowStartMinutes, 0, 0);

  const windowEnd = new Date(windowStart);
  windowEnd.setMinutes(windowEnd.getMinutes() + 30);

  return { start: windowStart, end: windowEnd };
}

export function getPreviousIngestionWindow(
  now: Date = new Date(),
): { start: Date; end: Date } {
  const current = getCurrentIngestionWindow(now);
  const previousStart = new Date(current.start);
  previousStart.setMinutes(previousStart.getMinutes() - 30);

  return { start: previousStart, end: current.start };
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

export async function processActualIngestionWindow(
  input: ProcessActualIngestionWindowInput,
): Promise<IngestionWindowResult> {
  const {
    userId,
    windowStart,
    windowEnd,
    sleepSchedule,
    onError,
    logStats,
  } = input;

  if (!userId) {
    console.log("🔥 [ActualIngestion] processWindow called but no userId!");
    return { skipped: true, reason: "no_user" };
  }

  console.log(`🔥 [ActualIngestion] Starting processWindow for ${windowStart.toISOString()}`);

  // Step 1: Check if window is already locked
  try {
    const locked = await isWindowLocked(userId, windowStart);
    if (locked) {
      return {
        skipped: true,
        reason: "already_locked",
      };
    }
  } catch (error) {
    // Non-fatal - continue with processing
    if (__DEV__) {
      console.warn("[ActualIngestion] Failed to check window lock:", error);
    }
  }

  // Track if we're using screen-time only fallback
  let locationFallback = false;

  try {
    // Step 1.5: Check if location is available (permission granted)
    const locationAvailable = await isLocationAvailableForIngestion();
    if (!locationAvailable) {
      locationFallback = true;
      if (__DEV__) {
        console.log(
          "[ActualIngestion] Location not available, using screen-time only fallback",
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
      fetchUserAppCategoryOverrides(userId).catch(
        () => ({}) as UserAppCategoryOverrides,
      ),
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

    // DEBUG: Log location events before reconciliation
    if (__DEV__ && locationEvents.length > 0) {
      console.log(`[ActualIngestion] Generated ${locationEvents.length} location events:`);
      for (const evt of locationEvents) {
        const kind = evt.meta?.kind;
        const placeLabel = evt.meta?.place_label || 'unknown';
        const duration = Math.round((evt.scheduledEnd.getTime() - evt.scheduledStart.getTime()) / 60000);
        console.log(`  - ${kind} @ ${placeLabel}: ${duration} min`);
      }
    }

    // Step 4: Run priority-based reconciliation
    const reconciliationOps = computeReconciliationOpsWithPriority(
      existingEvents,
      screenTimeEvents,
      locationEvents,
      previousWindowEvents,
    );

    // DEBUG: Log reconciliation operations
    if (__DEV__) {
      console.log(`[ActualIngestion] Reconciliation ops: insert=${reconciliationOps.inserts.length}, update=${reconciliationOps.updates.length}, delete=${reconciliationOps.deletes.length}, extend=${reconciliationOps.extensions.length}`);
      if (reconciliationOps.inserts.length > 0) {
        console.log('[ActualIngestion] Inserts:');
        for (const insert of reconciliationOps.inserts) {
          const kind = insert.event.meta?.kind;
          const title = insert.event.title;
          const duration = Math.round((insert.event.scheduledEnd.getTime() - insert.event.scheduledStart.getTime()) / 60000);
          console.log(`  - ${kind}: "${title}" (${duration} min)`);
        }
      }
    }

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
    const updatedEvents = await fetchEventsInWindow(
      userId,
      windowStart,
      windowEnd,
    );

    // Convert to sessionizable events
    // IMPORTANT: Filter out existing session_block events to prevent:
    // 1. Session blocks being nested inside other session blocks
    // 2. Session blocks from previous windows being re-sessionized
    // Only granular events (screen_time, location_block, commute) should be sessionized
    const sessionizableEvents = updatedEvents
      .filter((event) => event.meta?.kind !== "session_block")
      .map((event) => ({
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

    // Apply fuzzy location labels (reverse geocoding) when available.
    if (isGooglePlacesAvailable()) {
      sessions = await applyFuzzyLocationLabels(sessions, getFuzzyLocationLabel);
    }

    // Step 5.5: Handle session block extension and insertion
    // Instead of just inserting, we check if existing session blocks can be extended
    const extendedSessionIds: string[] = [];
    const sessionsToInsert: SessionBlock[] = [];
    let sessionsExtended = 0;

    if (sessions.length > 0) {
      // Fetch session block extension candidates from previous window
      let sessionBlockCandidates: ReconciliationEvent[] = [];
      try {
        sessionBlockCandidates = await fetchSessionBlockExtensionCandidates(
          userId,
          windowStart,
        );
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[ActualIngestion] Failed to fetch session block candidates:",
            error,
          );
        }
      }

      // Process each new session - either extend existing or prepare for insert
      for (const session of sessions) {
        const placeId = session.placeId;

        // Try to find an extendable session block
        const extendable = findExtendableSessionBlock(
          sessionBlockCandidates,
          session.start,
          placeId,
        );

        if (extendable) {
          // Extend the existing session block
          try {
            // Merge app summaries for intent recalculation
            const existingAppSummary = (extendable.meta?.app_summary ?? []) as Array<{
              app_id: string;
              seconds: number;
            }>;
            const newAppSummary = session.meta.app_summary ?? [];

            // Combine app summaries by aggregating seconds per app
            const combinedAppMap = new Map<string, number>();
            for (const app of existingAppSummary) {
              combinedAppMap.set(
                app.app_id,
                (combinedAppMap.get(app.app_id) ?? 0) + app.seconds,
              );
            }
            for (const app of newAppSummary) {
              combinedAppMap.set(
                app.app_id,
                (combinedAppMap.get(app.app_id) ?? 0) + app.seconds,
              );
            }

            // Convert to AppSummary array for classification
            const mergedAppSummary: AppSummary[] = Array.from(
              combinedAppMap.entries(),
            )
              .map(([appId, seconds]) => ({ appId, seconds }))
              .sort((a, b) => b.seconds - a.seconds);

            // Reclassify intent based on merged usage
            const newIntentResult = classifyIntent(mergedAppSummary, userAppOverrides);
            const newIntent = newIntentResult.intent;

            // Generate new title if intent changed
            const placeLabel = session.placeLabel ?? "Unknown Location";
            const intentLabel = newIntent === "offline" ? "Offline" :
              newIntent === "work" ? "Work" :
              newIntent === "leisure" ? "Leisure" :
              newIntent === "distracted_work" ? "Distracted" :
              newIntent === "sleep" ? "Sleep" : "Mixed";
            const newTitle = `${placeLabel} - ${intentLabel}`;

            // Build top 3 summary for display
            const topThreeSummary = mergedAppSummary.slice(0, 3).map((app) => ({
              label: app.appId,
              seconds: app.seconds,
            }));

            // Build full app summary for storage
            const fullAppSummary = mergedAppSummary.map((app) => ({
              app_id: app.appId,
              seconds: app.seconds,
            }));

            // Extend the session block
            const extendResult = await extendSessionBlock(
              extendable.id,
              session.end,
              session.childEventIds,
              newTitle,
              {
                intent: newIntent,
                summary: topThreeSummary,
                app_summary: fullAppSummary,
                intent_reasoning: newIntentResult.reasoning,
              },
            );

            if (extendResult.success) {
              extendedSessionIds.push(extendable.id);
              sessionsExtended++;
              if (__DEV__) {
                console.log(
                  `[ActualIngestion] Extended session block ${extendable.id} to ${session.end.toISOString()}`,
                );
              }
            } else {
              // Extension failed, fall back to inserting
              sessionsToInsert.push(session);
              if (__DEV__) {
                console.warn(
                  `[ActualIngestion] Failed to extend session block: ${extendResult.error}`,
                );
              }
            }
          } catch (error) {
            // Extension failed, fall back to inserting
            sessionsToInsert.push(session);
            if (__DEV__) {
              console.warn("[ActualIngestion] Session extension error:", error);
            }
          }
        } else {
          // No extendable session block found, prepare for insert
          sessionsToInsert.push(session);
        }
      }

      // Delete orphaned session blocks in the current window
      // (session blocks that weren't extended and will be replaced by new ones)
      try {
        await deleteOrphanedSessionBlocks(
          userId,
          windowStart,
          windowEnd,
          extendedSessionIds,
        );
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[ActualIngestion] Failed to delete orphaned session blocks:",
            error,
          );
        }
      }

      // Insert remaining session blocks
      if (sessionsToInsert.length > 0) {
        const sessionEvents = sessionsToInsert.map((session) =>
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
            stats.sessionsCreated = (data?.length ?? 0) + sessionsExtended;
          }
        } catch (error) {
          if (__DEV__) {
            console.warn("[ActualIngestion] Failed to insert sessions:", error);
          }
        }
      } else {
        // All sessions were extended
        stats.sessionsCreated = sessionsExtended;
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

    // =========================================================================
    // NEW PIPELINE: BRAVO layer (activity segments) + CHARLIE layer (summaries)
    // This runs in parallel with the existing pipeline. Eventually this will
    // replace the messy events with clean hourly blocks.
    //
    // Flow: ALPHA (raw data) → BRAVO (activity_segments) → CHARLIE (hourly_summaries)
    // =========================================================================
    try {
      // Truncate window start to the hour
      const hourStart = new Date(windowStart);
      hourStart.setMinutes(0, 0, 0);
      
      // Step 1: Generate BRAVO layer segments from ALPHA data
      const activitySegments = await generateActivitySegments(userId, hourStart);
      
      if (__DEV__) {
        console.log(`[ActualIngestion] 🔷 NEW PIPELINE: Generated ${activitySegments.length} activity segments for hour ${hourStart.toISOString()}`);
      }
      
      // Step 2: Save BRAVO segments to database
      if (activitySegments.length > 0) {
        const saved = await saveActivitySegments(activitySegments);
        if (__DEV__) {
          console.log(`[ActualIngestion] 🔷 NEW PIPELINE: Saved activity segments: ${saved ? 'success' : 'failed'}`);
        }
      }
      
      // Step 3: Generate CHARLIE layer summary (reads from BRAVO)
      const summary = await processHourlySummary(userId, hourStart);
      
      if (__DEV__ && summary) {
        console.log(`[ActualIngestion] ✨ NEW PIPELINE: Generated hourly summary: "${summary.title}" (${Math.round(summary.confidenceScore * 100)}% confidence)`);
      }
    } catch (error) {
      // Non-fatal - new pipeline failure shouldn't break existing flow
      if (__DEV__) {
        console.warn("[ActualIngestion] NEW PIPELINE: Failed to generate activity segments/summary:", error);
      }
    }

    return {
      skipped: false,
      stats: lockStats,
      locationFallback,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (__DEV__) {
      console.error("[ActualIngestion] Processing failed:", error);
    }

    onError?.(error instanceof Error ? error : new Error(errorMessage));

    return {
      skipped: true,
      reason: "error",
      error: errorMessage,
    };
  }
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
// Day Reprocessing Utilities
// ============================================================================

/**
 * Delete all actual events for a day.
 * Used for dev-only full day reprocessing.
 */
async function deleteActualEventsForDay(
  userId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<{ deletedCount: number }> {
  try {
    const { data, error } = await tmSchema()
      .from("events")
      .delete()
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .gte("scheduled_start", dayStart.toISOString())
      .lt("scheduled_start", dayEnd.toISOString())
      .select("id");

    if (error) throw handleSupabaseError(error);
    return { deletedCount: data?.length ?? 0 };
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActualIngestion] Failed to delete events:", error);
    }
    return { deletedCount: 0 };
  }
}

/**
 * Delete all window locks for a day.
 */
async function deleteWindowLocksForDay(
  userId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<{ deletedCount: number }> {
  try {
    const { data, error } = await tmSchema()
      .from("actual_ingestion_window_locks")
      .delete()
      .eq("user_id", userId)
      .gte("window_start", dayStart.toISOString())
      .lt("window_start", dayEnd.toISOString())
      .select("id");

    if (error) throw handleSupabaseError(error);
    return { deletedCount: data?.length ?? 0 };
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActualIngestion] Failed to delete window locks:", error);
    }
    return { deletedCount: 0 };
  }
}

/**
 * Build all 30-minute windows for a day up to the current time.
 */
function buildWindowsForDay(dayStart: Date, upToTime: Date): Array<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [];
  const current = new Date(dayStart);

  while (current < upToTime) {
    const windowEnd = new Date(current.getTime() + 30 * 60 * 1000);
    // Only include windows that have fully completed
    if (windowEnd <= upToTime) {
      windows.push({ start: new Date(current), end: windowEnd });
    }
    current.setMinutes(current.getMinutes() + 30);
  }

  return windows;
}

export interface ReprocessDayResult {
  /** Whether the reprocessing was successful */
  success: boolean;
  /** Number of events deleted */
  eventsDeleted: number;
  /** Number of window locks deleted */
  locksDeleted: number;
  /** Number of windows processed */
  windowsProcessed: number;
  /** Number of windows skipped (errors) */
  windowsSkipped: number;
  /** Total sessions created */
  totalSessionsCreated: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Reprocess an entire day's actual events from scratch.
 *
 * WARNING: This is a destructive operation that:
 * 1. Deletes ALL actual events for the day
 * 2. Deletes ALL window locks for the day
 * 3. Re-runs ingestion for ALL windows from midnight to now
 *
 * Only use this for dev/debugging purposes.
 */
export async function reprocessDay(
  userId: string,
  date: Date = new Date(),
): Promise<ReprocessDayResult> {
  // Calculate day boundaries
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const now = new Date();
  const upToTime = date.toDateString() === now.toDateString() ? now : dayEnd;

  if (__DEV__) {
    console.log(`[ActualIngestion] Reprocessing day ${dayStart.toISOString()} to ${upToTime.toISOString()}`);
  }

  try {
    // Step 1: Delete all actual events for the day
    const { deletedCount: eventsDeleted } = await deleteActualEventsForDay(
      userId,
      dayStart,
      dayEnd,
    );

    if (__DEV__) {
      console.log(`[ActualIngestion] Deleted ${eventsDeleted} events`);
    }

    // Step 2: Delete all window locks for the day
    const { deletedCount: locksDeleted } = await deleteWindowLocksForDay(
      userId,
      dayStart,
      dayEnd,
    );

    if (__DEV__) {
      console.log(`[ActualIngestion] Deleted ${locksDeleted} window locks`);
    }

    // Step 3: Build all windows for the day
    const windows = buildWindowsForDay(dayStart, upToTime);

    if (__DEV__) {
      console.log(`[ActualIngestion] Processing ${windows.length} windows`);
    }

    // Step 4: Process each window in sequence
    let windowsProcessed = 0;
    let windowsSkipped = 0;
    let totalSessionsCreated = 0;

    for (const window of windows) {
      try {
        const result = await processActualIngestionWindow({
          userId,
          windowStart: window.start,
          windowEnd: window.end,
          logStats: __DEV__,
        });

        if (result.skipped) {
          windowsSkipped++;
        } else {
          windowsProcessed++;
          totalSessionsCreated += result.stats?.eventsSessionized ?? 0;
        }
      } catch (error) {
        windowsSkipped++;
        if (__DEV__) {
          console.warn(
            `[ActualIngestion] Failed to process window ${window.start.toISOString()}:`,
            error,
          );
        }
      }
    }

    if (__DEV__) {
      console.log(
        `[ActualIngestion] Reprocess complete: ${windowsProcessed} processed, ${windowsSkipped} skipped, ${totalSessionsCreated} sessions`,
      );
    }

    return {
      success: true,
      eventsDeleted,
      locksDeleted,
      windowsProcessed,
      windowsSkipped,
      totalSessionsCreated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (__DEV__) {
      console.error("[ActualIngestion] Reprocess failed:", error);
    }
    return {
      success: false,
      eventsDeleted: 0,
      locksDeleted: 0,
      windowsProcessed: 0,
      windowsSkipped: 0,
      totalSessionsCreated: 0,
      error: message,
    };
  }
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
      if (!isAuthenticated || !user?.id) {
        const result: IngestionWindowResult = {
          skipped: true,
          reason: "no_user",
        };
        setLastResult(result);
        return result;
      }

      setIsProcessing(true);
      try {
        const result = await processActualIngestionWindow({
          userId: user.id,
          windowStart,
          windowEnd,
          sleepSchedule,
          onError,
          logStats,
        });
        setLastResult(result);
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [isAuthenticated, logStats, onError, user?.id],
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
  const getCurrentWindow = useCallback(
    () => getCurrentIngestionWindow(),
    [],
  );

  /**
   * Calculate the previous ingestion window (the one that just completed).
   * This is the window that should be processed.
   */
  const getPreviousWindow = useCallback(
    () => getPreviousIngestionWindow(),
    [],
  );

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
