/**
 * Build Timeline Events
 *
 * Merges app sessions, communication events, and calendar events into a
 * unified TimelineEvent[] array for rendering in the timeline feed.
 * Also handles overlap detection and productivity flagging.
 */

import type { LocationBlock } from "@/lib/types/location-block";
import type {
  TimelineEvent,
  TimelineEventKind,
  ProductivityFlag,
} from "@/lib/types/timeline-event";
import type { TmEventRow } from "@/lib/supabase/services/communication-events";
import type { ScheduledEvent } from "@/stores";
import { formatDuration } from "@/lib/utils/time-format";

// ============================================================================
// Helpers
// ============================================================================

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function scheduledEventToDate(
  event: ScheduledEvent,
  ymd: string,
): { start: Date; end: Date } {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const month = match ? Number(match[2]) - 1 : new Date().getMonth();
  const day = match ? Number(match[3]) : new Date().getDate();

  const dayStart = new Date(year, month, day);
  const start = new Date(dayStart.getTime() + event.startMinutes * 60_000);
  const end = new Date(start.getTime() + event.duration * 60_000);
  return { start, end };
}

function getProductivityFlag(category?: string): ProductivityFlag {
  if (!category) return "neutral";
  if (category === "work") return "productive";
  if (category === "social" || category === "entertainment")
    return "unproductive";
  return "neutral";
}

function parseMetaField(meta: unknown, field: string): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const val = (meta as Record<string, unknown>)[field];
  return typeof val === "string" ? val : undefined;
}

function parseMetaNumber(meta: unknown, field: string): number | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const val = (meta as Record<string, unknown>)[field];
  return typeof val === "number" ? val : undefined;
}

function parseMetaArray(meta: unknown, field: string): unknown[] | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const val = (meta as Record<string, unknown>)[field];
  return Array.isArray(val) ? val : undefined;
}

function commEventKind(type: string): TimelineEventKind {
  switch (type) {
    case "email":
      return "email";
    case "slack_message":
      return "slack_message";
    case "phone_call":
      return "phone_call";
    case "sms":
      return "sms";
    case "meeting":
      return "meeting";
    default:
      return "email";
  }
}

function commEventLabel(type: string): string {
  switch (type) {
    case "email":
      return "E-Mail";
    case "slack_message":
      return "Slack Message";
    case "phone_call":
      return "Phone Call";
    case "sms":
      return "SMS";
    case "meeting":
      return "Meeting";
    default:
      return "Message";
  }
}

// ============================================================================
// App Session Events
// ============================================================================

/** Max gap (ms) between two sessions to be merged as "back-to-back". */
const MERGE_GAP_MS = 2 * 60_000; // 2 minutes

function buildAppEvents(block: LocationBlock): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const app of block.apps) {
    // Sort sessions chronologically
    const sorted = [...app.sessions].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    // Merge back-to-back sessions of the same app
    const merged: { startTime: Date; endTime: Date; minutes: number }[] = [];
    for (const session of sorted) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        session.startTime.getTime() - prev.endTime.getTime() <= MERGE_GAP_MS
      ) {
        // Extend the previous merged session
        prev.endTime = session.endTime;
        prev.minutes += session.minutes;
      } else {
        merged.push({
          startTime: session.startTime,
          endTime: session.endTime,
          minutes: session.minutes,
        });
      }
    }

    for (const session of merged) {
      // Cap duration at actual time span to prevent over-counting from overlapping sessions
      const timeSpanMinutes = Math.round(
        (session.endTime.getTime() - session.startTime.getTime()) / 60_000,
      );
      const cappedMinutes = Math.min(session.minutes, Math.max(1, timeSpanMinutes));

      events.push({
        id: `app-${app.appId}-${session.startTime.getTime()}`,
        kind: "app",
        kindLabel: "App",
        title: app.displayName,
        startTime: session.startTime,
        endTime: session.endTime,
        durationMinutes: cappedMinutes,
        appCategory: app.category,
        productivity: getProductivityFlag(app.category),
        isPast: true, // will be updated later
        blockId: block.id,
        summaryIds: block.summaryIds,
      });
    }
  }
  return events;
}

// ============================================================================
// Communication Events
// ============================================================================

function buildCommEvents(
  commRows: TmEventRow[],
  block: LocationBlock,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const row of commRows) {
    // Prefer actual email timestamp over sync time
    const startStr = row.sent_at ?? row.received_at ?? row.scheduled_start ?? row.created_at;
    if (!startStr) continue;
    const start = new Date(startStr);
    if (Number.isNaN(start.getTime())) continue;

    const endStr = row.scheduled_end;
    const end = endStr ? new Date(endStr) : new Date(start.getTime() + 5 * 60_000);

    const kind = commEventKind(row.type ?? "email");
    const kindLabel = commEventLabel(row.type ?? "email");
    const durationMin = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 60_000),
    );

    // Build subtitle from meta
    let subtitle: string | undefined;
    const meta = row.meta;
    if (kind === "email") {
      const toAddresses = parseMetaField(meta, "to_addresses");
      const recipients = parseMetaArray(meta, "recipients");
      const recipientCount = recipients?.length ?? (toAddresses ? 1 : 0);
      if (recipientCount > 0) {
        subtitle = `${recipientCount} Recipient${recipientCount > 1 ? "s" : ""}`;
      }
    } else if (kind === "meeting") {
      const attendees = parseMetaArray(meta, "attendees");
      const attendeeCount = attendees?.length ?? parseMetaNumber(meta, "attendee_count");
      if (attendeeCount && attendeeCount > 0) {
        subtitle = `${attendeeCount} Attendee${attendeeCount > 1 ? "s" : ""}`;
      }
    } else if (kind === "slack_message") {
      const channel = parseMetaField(meta, "channel");
      if (channel) subtitle = `#${channel}`;
    }

    events.push({
      id: `comm-${row.id}`,
      kind,
      kindLabel,
      title: row.title || kindLabel,
      subtitle,
      startTime: start,
      endTime: end,
      durationMinutes: durationMin,
      productivity: "neutral",
      isPast: true, // updated later
      blockId: block.id,
      summaryIds: block.summaryIds,
    });
  }
  return events;
}

// ============================================================================
// Calendar Events
// ============================================================================

/**
 * Derived event kinds from the activity pipeline that should NOT appear
 * as calendar "Meeting" events in the timeline. These are auto-generated
 * by the comprehensive calendar pipeline and stored as calendar_actual
 * events, but they represent inferred activity — not real user meetings.
 */
const DERIVED_KINDS = new Set([
  "session_block",
  "travel",
  "commute",
  "location_block",
  "location_inferred",
  "transition_commute",
  "transition_prep",
  "transition_wind_down",
  "sleep_schedule",
  "sleep_interrupted",
  "sleep_late",
  "screen_time",
  "unknown_gap",
  "pattern_gap",
  "evidence_block",
]);

function isDerivedEvent(event: ScheduledEvent): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = event.meta as any;
  if (!meta) return false;
  const kind = typeof meta.kind === "string" ? meta.kind : undefined;
  const source = typeof meta.source === "string" ? meta.source : undefined;
  if (kind && DERIVED_KINDS.has(kind)) return true;
  if (source === "derived" || source === "evidence") return true;
  return false;
}

function buildCalendarEvents(
  planned: ScheduledEvent[],
  actual: ScheduledEvent[],
  block: LocationBlock,
  ymd: string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const actualByPlannedId = new Map<string, ScheduledEvent>();

  // Index actual events by plannedEventId for matching (skip derived)
  for (const act of actual) {
    if (isDerivedEvent(act)) continue;
    const plannedId =
      typeof act.meta?.plannedEventId === "string"
        ? act.meta.plannedEventId
        : undefined;
    if (plannedId) {
      actualByPlannedId.set(plannedId, act);
    }
  }

  // Build a list of non-derived actual events for fallback title matching
  const unmatchedActuals = actual.filter(
    (a) => !isDerivedEvent(a) && !actualByPlannedId.has(
      typeof a.meta?.plannedEventId === "string" ? a.meta.plannedEventId : "__none__",
    ),
  );

  // Track which actual event IDs have been consumed (by ID match or title match)
  const consumedActualIds = new Set<string>();

  for (const planned_ev of planned) {
    // Skip derived planned events (defensive — unlikely but safe)
    if (isDerivedEvent(planned_ev)) continue;

    const { start, end } = scheduledEventToDate(planned_ev, ymd);
    const durationMin = Math.max(1, planned_ev.duration);

    // First try matching by plannedEventId
    let matchingActual = actualByPlannedId.get(planned_ev.id);

    // Fallback: match by title + overlapping time range
    if (!matchingActual) {
      const plannedStartMs = start.getTime();
      const plannedEndMs = end.getTime();
      matchingActual = unmatchedActuals.find((act) => {
        if (consumedActualIds.has(act.id)) return false;
        if (act.title !== planned_ev.title) return false;
        const { start: aStart, end: aEnd } = scheduledEventToDate(act, ymd);
        return aStart.getTime() < plannedEndMs && aEnd.getTime() > plannedStartMs;
      });
    }

    if (matchingActual) {
      consumedActualIds.add(matchingActual.id);
    }

    events.push({
      id: `cal-${planned_ev.id}`,
      kind: matchingActual ? "meeting" : "scheduled",
      kindLabel: matchingActual ? "Meeting" : "Scheduled",
      title: planned_ev.title,
      subtitle: planned_ev.location,
      startTime: start,
      endTime: end,
      durationMinutes: durationMin,
      productivity: "neutral",
      isPast: true, // updated later
      scheduledEvent: planned_ev,
      actualEvent: matchingActual,
      blockId: block.id,
      summaryIds: block.summaryIds,
    });
  }

  // Also add actual events that have no planned counterpart
  const usedActualIds = new Set([
    ...consumedActualIds,
    ...[...actualByPlannedId.values()].map((v) => v.id),
  ]);
  for (const act of actual) {
    // Skip derived/pipeline events — they aren't real calendar meetings
    if (isDerivedEvent(act)) continue;

    if (usedActualIds.has(act.id)) continue;

    const { start, end } = scheduledEventToDate(act, ymd);
    events.push({
      id: `cal-actual-${act.id}`,
      kind: "meeting",
      kindLabel: "Meeting",
      title: act.title,
      subtitle: act.location,
      startTime: start,
      endTime: end,
      durationMinutes: Math.max(1, act.duration),
      productivity: "neutral",
      isPast: true,
      scheduledEvent: undefined,
      actualEvent: act,
      blockId: block.id,
      summaryIds: block.summaryIds,
    });
  }

  return events;
}

// ============================================================================
// Overlap Detection
// ============================================================================

function detectOverlaps(events: TimelineEvent[]): void {
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (events[j].startTime.getTime() < events[i].endTime.getTime()) {
        if (!events[i].overlaps) events[i].overlaps = [];
        if (!events[j].overlaps) events[j].overlaps = [];
        events[i].overlaps.push(events[j].id);
        events[j].overlaps.push(events[i].id);
      } else {
        break; // sorted by startTime, so no more overlaps possible
      }
    }
  }
}

// ============================================================================
// Time Range Filters
// ============================================================================

export function filterCommEventsToTimeRange(
  events: TmEventRow[],
  start: Date,
  end: Date,
): TmEventRow[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return events.filter((e) => {
    // Prefer actual email timestamp over sync time
    const ts = e.sent_at ?? e.received_at ?? e.scheduled_start ?? e.created_at;
    if (!ts) return false;
    const evStartMs = new Date(ts).getTime();
    const endStr = e.scheduled_end;
    const evEndMs = endStr
      ? new Date(endStr).getTime()
      : evStartMs + 5 * 60_000;
    return evStartMs < endMs && evEndMs > startMs;
  });
}

export function filterScheduledToTimeRange(
  events: ScheduledEvent[],
  start: Date,
  end: Date,
  ymd: string,
): ScheduledEvent[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return events.filter((e) => {
    const { start: evStart, end: evEnd } = scheduledEventToDate(e, ymd);
    const evStartMs = evStart.getTime();
    const evEndMs = evEnd.getTime();
    return evStartMs < endMs && evEndMs > startMs;
  });
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build a unified timeline event array from all data sources.
 *
 * @param block - The location block containing app sessions and segments
 * @param commEvents - Communication events (email, slack, phone, sms) filtered to block range
 * @param plannedEvents - Planned calendar events filtered to block range
 * @param actualEvents - Actual calendar events filtered to block range
 * @param currentMinutes - Current time as minutes from midnight (-1 if not today)
 * @param ymd - Date string YYYY-MM-DD
 */
export function buildTimelineEvents(
  block: LocationBlock,
  commEvents: TmEventRow[],
  plannedEvents: ScheduledEvent[],
  actualEvents: ScheduledEvent[],
  currentMinutes: number,
  ymd: string,
): TimelineEvent[] {
  // 1. Build events from each source
  const appEvents = buildAppEvents(block);
  const commTimelineEvents = buildCommEvents(commEvents, block);
  const calEvents = buildCalendarEvents(
    plannedEvents,
    actualEvents,
    block,
    ymd,
  );

  // 2. Merge and sort
  const all = [...appEvents, ...commTimelineEvents, ...calEvents];
  all.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // 3. Mark isPast based on currentMinutes
  if (currentMinutes >= 0) {
    for (const event of all) {
      const eventEndMinutes = minuteOfDay(event.endTime);
      event.isPast = eventEndMinutes <= currentMinutes;
    }
  }
  // If currentMinutes < 0 (not today), all events are past (keep default true)

  // 4. Detect overlaps
  detectOverlaps(all);

  return all;
}
