import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Database, Json } from "../database.types";
import type {
  CalendarEventMeta,
  EventCategory,
  ScheduledEvent,
} from "@/stores";
import { formatLocalIso, ymdToLocalDayStart } from "@/lib/calendar/local-time";

const PLANNED_EVENT_TYPE = "calendar_planned";
const ACTUAL_EVENT_TYPE = "calendar_actual";

type TmEventRow = Database["tm"]["Tables"]["events"]["Row"];
type TmEventInsert = Database["tm"]["Tables"]["events"]["Insert"];
type TmEventUpdate = Database["tm"]["Tables"]["events"]["Update"];
type PublicEventRow = Database["public"]["Tables"]["events"]["Row"];

export type PlannedCalendarMeta = CalendarEventMeta & Record<string, Json>;

function isPlannedCalendarMeta(value: Json): value is PlannedCalendarMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Record<string, Json>;
  const category = rec.category;
  return typeof category === "string" && category.length > 0;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function ymdToDate(ymd: string): Date {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

/**
 * Parse a database timestamp string to a Date object.
 * Ensures timestamps without timezone are treated as local time.
 */
function parseDbTimestamp(timestamp: string): Date {
  const normalized = timestamp.includes(" ")
    ? timestamp.replace(" ", "T")
    : timestamp;
  // If the timestamp already has timezone info (Z or offset), parse normally
  if (/Z$|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  // Otherwise, treat it as local time
  return new Date(normalized);
}

function isoToLocalYmd(iso: string): string {
  const date = parseDbTimestamp(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseTimeIsoToHoursMinutes(timeIso: string): {
  hours: number;
  minutes: number;
} {
  const parsed = parseDbTimestamp(timeIso);
  if (Number.isNaN(parsed.getTime())) return { hours: 22, minutes: 30 };
  return { hours: parsed.getHours(), minutes: parsed.getMinutes() };
}

function dateToMinutesFromMidnightLocal(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function rowToScheduledEventForDay(
  row: TmEventRow,
  dayStart: Date,
  dayEnd: Date,
): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = parseDbTimestamp(row.scheduled_start);
  const end = parseDbTimestamp(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs)
    return null;

  // Clip to the visible day window so cross-midnight events render correctly on both days.
  const clippedStart = new Date(Math.max(startMs, dayStart.getTime()));
  const clippedEnd = new Date(Math.min(endMs, dayEnd.getTime()));
  const clippedStartMs = clippedStart.getTime();
  const clippedEndMs = clippedEnd.getTime();
  if (clippedEndMs <= clippedStartMs) return null;

  const startMinutes = Math.max(
    0,
    Math.round((clippedStartMs - dayStart.getTime()) / 60_000),
  );
  const duration = Math.max(
    Math.round((clippedEndMs - clippedStartMs) / 60_000),
    1,
  );

  const meta = row.meta as Json;
  const metaParsed: PlannedCalendarMeta | null =
    meta && isPlannedCalendarMeta(meta) ? meta : null;
  const suggestedCategory =
    typeof metaParsed?.suggested_category === "string"
      ? metaParsed.suggested_category
      : null;
  const fallbackCategory = metaParsed?.category ?? "work";
  const category = (
    fallbackCategory === "unknown" && suggestedCategory
      ? suggestedCategory
      : fallbackCategory
  ) as EventCategory;
  const locationFromMeta =
    typeof metaParsed?.location === "string" &&
    metaParsed.location.trim().length > 0
      ? metaParsed.location
      : undefined;

  const actualFlag = row.type === ACTUAL_EVENT_TYPE;
  const metaWithActual: PlannedCalendarMeta = {
    ...(metaParsed ?? {}),
    ...(actualFlag
      ? { actual: true, source: metaParsed?.source ?? "user" }
      : {}),
  };

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    location: locationFromMeta,
    startMinutes,
    duration,
    category,
    isBig3: metaParsed?.isBig3 ?? false,
    meta: Object.keys(metaWithActual).length > 0 ? metaWithActual : undefined,
  };
}

function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === "string" &&
    [
      "routine",
      "work",
      "meal",
      "meeting",
      "health",
      "family",
      "social",
      "travel",
      "finance",
      "comm",
      "digital",
      "sleep",
      "unknown",
      "free",
    ].includes(value)
  );
}

function mapPublicEventTypeToCategory(
  type: Database["public"]["Enums"]["event_type"] | string | null,
  fallback?: EventCategory | null,
): EventCategory {
  if (fallback && isEventCategory(fallback)) return fallback;
  switch (type) {
    case "calendar_planned":
    case "calendar_actual":
    case "meeting":
    case "call":
    case "video_call":
    case "phone_call":
      return "meeting";
    case "drive":
      return "travel";
    case "sleep":
      return "sleep";
    case "message":
    case "email":
    case "chat":
    case "slack_message":
    case "sms":
    case "communication":
      return "social";
    case "task":
    case "project":
    case "goal":
    case "category":
    case "tag":
      return "work";
    case "note":
    case "other":
    default:
      return "work";
  }
}

function rowToScheduledEventForDayFromPublic(
  row: PublicEventRow,
  dayStart: Date,
  dayEnd: Date,
): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = parseDbTimestamp(row.scheduled_start);
  const end = parseDbTimestamp(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs)
    return null;

  const clippedStart = new Date(Math.max(startMs, dayStart.getTime()));
  const clippedEnd = new Date(Math.min(endMs, dayEnd.getTime()));
  const clippedStartMs = clippedStart.getTime();
  const clippedEndMs = clippedEnd.getTime();
  if (clippedEndMs <= clippedStartMs) return null;

  const startMinutes = Math.max(
    0,
    Math.round((clippedStartMs - dayStart.getTime()) / 60_000),
  );
  const duration = Math.max(
    Math.round((clippedEndMs - clippedStartMs) / 60_000),
    1,
  );

  const meta = row.meta as Json;
  const metaParsed =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, Json>)
      : null;
  const metaCategory = metaParsed?.category;
  const category = mapPublicEventTypeToCategory(
    row.type,
    isEventCategory(metaCategory) ? metaCategory : null,
  );

  const title =
    row.title?.trim() ||
    row.subject?.trim() ||
    (typeof metaParsed?.title === "string" ? metaParsed.title : "") ||
    "Calendar event";
  const description =
    row.description?.trim() ||
    row.preview?.trim() ||
    (typeof metaParsed?.description === "string"
      ? metaParsed.description
      : "") ||
    "";

  const location =
    row.location?.trim() ||
    (typeof metaParsed?.location === "string" ? metaParsed.location : "") ||
    undefined;

  const isActual = row.type === ACTUAL_EVENT_TYPE;
  const metaForDisplay: PlannedCalendarMeta = {
    ...(metaParsed ?? {}),
    category,
    source: isActual ? "user" : "system",
    actual: isActual ? true : undefined,
    tags: ["external_calendar"],
    source_provider: row.source_provider ?? null,
    external_id: row.external_id ?? null,
    source_id: row.source_id ?? undefined,
    ...(location ? { location } : {}),
  };

  return {
    id: row.id,
    title,
    description,
    location,
    startMinutes,
    duration,
    category,
    isBig3: Boolean((metaParsed?.isBig3 as boolean | undefined) ?? false),
    meta: metaForDisplay,
  };
}

function buildDedupKey(event: ScheduledEvent): string {
  const sourceId = event.meta?.source_id;
  const externalId = event.meta?.external_id;
  if (typeof sourceId === "string" && sourceId.trim())
    return `source:${sourceId.trim()}`;
  if (typeof externalId === "string" && externalId.trim())
    return `external:${externalId.trim()}`;
  return `time:${event.startMinutes}-${event.duration}-${event.title.trim().toLowerCase()}`;
}

function rowToScheduledEvent(row: TmEventRow): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = parseDbTimestamp(row.scheduled_start);
  const end = parseDbTimestamp(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs)
    return null;

  const startMinutes = dateToMinutesFromMidnightLocal(start);
  const duration = Math.max(Math.round((endMs - startMs) / 60_000), 1);
  const meta = row.meta as Json;

  const metaParsed: PlannedCalendarMeta | null =
    meta && isPlannedCalendarMeta(meta) ? meta : null;
  const suggestedCategory =
    typeof metaParsed?.suggested_category === "string"
      ? metaParsed.suggested_category
      : null;
  const fallbackCategory = metaParsed?.category ?? "work";
  const category = (
    fallbackCategory === "unknown" && suggestedCategory
      ? suggestedCategory
      : fallbackCategory
  ) as EventCategory;
  const locationFromMeta =
    typeof metaParsed?.location === "string" &&
    metaParsed.location.trim().length > 0
      ? metaParsed.location
      : undefined;

  const actualFlag = row.type === ACTUAL_EVENT_TYPE;
  const metaWithActual: PlannedCalendarMeta = {
    ...(metaParsed ?? {}),
    ...(actualFlag
      ? { actual: true, source: metaParsed?.source ?? "user" }
      : {}),
  };

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    location: locationFromMeta,
    startMinutes,
    duration,
    category,
    isBig3: metaParsed?.isBig3 ?? false,
    meta: Object.keys(metaWithActual).length > 0 ? metaWithActual : undefined,
  };
}

interface GoogleCalendarMeta extends Record<string, Json> {
  calendar_id: string;
  ical_uid: string;
  conference_url?: string;
}

function isGoogleCalendarMeta(meta: Json): meta is GoogleCalendarMeta {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const rec = meta as Record<string, Json>;
  // Google Calendar rows we ingest today include `calendar_id` + `ical_uid`.
  return (
    typeof rec.calendar_id === "string" && typeof rec.ical_uid === "string"
  );
}

function rowToScheduledEventForDayFromTmGoogleMeeting(
  row: TmEventRow,
  dayStart: Date,
  dayEnd: Date,
): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = parseDbTimestamp(row.scheduled_start);
  const end = parseDbTimestamp(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs)
    return null;

  // Clip to visible day window so cross-midnight meetings render correctly.
  const clippedStart = new Date(Math.max(startMs, dayStart.getTime()));
  const clippedEnd = new Date(Math.min(endMs, dayEnd.getTime()));
  const clippedStartMs = clippedStart.getTime();
  const clippedEndMs = clippedEnd.getTime();
  if (clippedEndMs <= clippedStartMs) return null;

  const startMinutes = Math.max(
    0,
    Math.round((clippedStartMs - dayStart.getTime()) / 60_000),
  );
  const duration = Math.max(
    Math.round((clippedEndMs - clippedStartMs) / 60_000),
    1,
  );

  const metaRaw = row.meta as Json;
  if (!isGoogleCalendarMeta(metaRaw)) return null;

  // Prod `tm.events` has `location`, but our generated types don't. Pull it cautiously.
  // If absent, fall back to the Meet URL inside meta.
  const rowWithLocation = row as unknown as { location?: string | null };
  const location =
    typeof rowWithLocation.location === "string" &&
    rowWithLocation.location.trim().length > 0
      ? rowWithLocation.location
      : typeof metaRaw.conference_url === "string" &&
          metaRaw.conference_url.trim().length > 0
        ? metaRaw.conference_url
        : undefined;

  const sourceId = metaRaw.ical_uid;

  const metaForDisplay: PlannedCalendarMeta = {
    category: "meeting",
    source: "system",
    source_provider: "google",
    source_id: sourceId,
    tags: ["external_calendar"],
    // Preserve raw calendar metadata for debugging/inspection
    raw: metaRaw,
    ...(location ? { location } : {}),
  };

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    location,
    startMinutes,
    duration,
    category: "meeting",
    isBig3: false,
    meta: metaForDisplay,
  };
}

export async function fetchPlannedCalendarEventsForDay(
  userId: string,
  ymd: string,
): Promise<ScheduledEvent[]> {
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = formatLocalIso(dayStart);
    const endIso = formatLocalIso(dayEnd);

    const [tmResult, publicResult, tmGoogleMeetingsResult] = await Promise.all([
      supabase
        .schema("tm")
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .eq("type", PLANNED_EVENT_TYPE)
        .lt("scheduled_start", endIso)
        .gt("scheduled_end", startIso)
        .order("scheduled_start", { ascending: true }),
      supabase
        .schema("public")
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .eq("type", PLANNED_EVENT_TYPE)
        .lt("scheduled_start", endIso)
        .gt("scheduled_end", startIso)
        .order("scheduled_start", { ascending: true }),
      // Google Calendar ingestion currently stores meetings as `tm.events.type = 'meeting'`.
      // We want those to show up in the PLANNED column, but only for Google Calendar rows.
      supabase
        .schema("tm")
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "meeting")
        .lt("scheduled_start", endIso)
        .gt("scheduled_end", startIso)
        .order("scheduled_start", { ascending: true }),
    ]);

    if (tmResult.error) throw handleSupabaseError(tmResult.error);
    if (publicResult.error) throw handleSupabaseError(publicResult.error);
    if (tmGoogleMeetingsResult.error)
      throw handleSupabaseError(tmGoogleMeetingsResult.error);

    const tmEvents = (tmResult.data ?? [])
      .map((row) =>
        rowToScheduledEventForDay(row as TmEventRow, dayStart, dayEnd),
      )
      .filter((e): e is ScheduledEvent => !!e);

    const externalEvents = (publicResult.data ?? [])
      .map((row) =>
        rowToScheduledEventForDayFromPublic(
          row as PublicEventRow,
          dayStart,
          dayEnd,
        ),
      )
      .filter((e): e is ScheduledEvent => !!e);

    const googleMeetingEvents = (tmGoogleMeetingsResult.data ?? [])
      .map((row) =>
        rowToScheduledEventForDayFromTmGoogleMeeting(
          row as TmEventRow,
          dayStart,
          dayEnd,
        ),
      )
      .filter((e): e is ScheduledEvent => !!e);

    const seen = new Set<string>();
    const merged: ScheduledEvent[] = [];

    for (const event of tmEvents) {
      const key = buildDedupKey(event);
      seen.add(key);
      merged.push(event);
    }

    for (const event of externalEvents) {
      const key = buildDedupKey(event);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(event);
    }

    for (const event of googleMeetingEvents) {
      const key = buildDedupKey(event);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(event);
    }

    return merged.sort((a, b) => a.startMinutes - b.startMinutes);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function fetchActualCalendarEventsForDay(
  userId: string,
  ymd: string,
): Promise<ScheduledEvent[]> {
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = formatLocalIso(dayStart);
    const endIso = formatLocalIso(dayEnd);

    const [tmResult, publicResult] = await Promise.all([
      supabase
        .schema("tm")
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .eq("type", ACTUAL_EVENT_TYPE)
        .lt("scheduled_start", endIso)
        .gt("scheduled_end", startIso)
        .order("scheduled_start", { ascending: true }),
      supabase
        .schema("public")
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .eq("type", ACTUAL_EVENT_TYPE)
        .lt("scheduled_start", endIso)
        .gt("scheduled_end", startIso)
        .order("scheduled_start", { ascending: true }),
    ]);

    if (tmResult.error) throw handleSupabaseError(tmResult.error);
    if (publicResult.error) throw handleSupabaseError(publicResult.error);

    const tmEvents = (tmResult.data ?? [])
      .map((row) =>
        rowToScheduledEventForDay(row as TmEventRow, dayStart, dayEnd),
      )
      .filter((e): e is ScheduledEvent => !!e);

    const externalEvents = (publicResult.data ?? [])
      .map((row) =>
        rowToScheduledEventForDayFromPublic(
          row as PublicEventRow,
          dayStart,
          dayEnd,
        ),
      )
      .filter((e): e is ScheduledEvent => !!e);

    const seen = new Set<string>();
    const merged: ScheduledEvent[] = [];

    for (const event of tmEvents) {
      const key = buildDedupKey(event);
      seen.add(key);
      merged.push(event);
    }

    for (const event of externalEvents) {
      const key = buildDedupKey(event);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(event);
    }

    return merged.sort((a, b) => a.startMinutes - b.startMinutes);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface ActualPatternSourceEvent {
  ymd: string;
  event: ScheduledEvent;
}

export async function fetchActualCalendarEventsForRange(
  userId: string,
  startYmd: string,
  endYmd: string,
): Promise<ActualPatternSourceEvent[]> {
  try {
    const rangeStart = ymdToLocalDayStart(startYmd);
    const rangeEnd = addDays(ymdToLocalDayStart(endYmd), 1);
    const startIso = formatLocalIso(rangeStart);
    const endIso = formatLocalIso(rangeEnd);

    const { data, error } = await supabase
      .schema("tm")
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .eq("type", ACTUAL_EVENT_TYPE)
      .lt("scheduled_start", endIso)
      .gt("scheduled_end", startIso)
      .order("scheduled_start", { ascending: true });

    if (error) throw handleSupabaseError(error);

    return (data ?? [])
      .map((row) => {
        if (!row.scheduled_start) return null;
        const ymd = isoToLocalYmd(row.scheduled_start);
        if (!ymd) return null;
        const dayStart = ymdToLocalDayStart(ymd);
        const dayEnd = addDays(dayStart, 1);
        const mapped = rowToScheduledEventForDay(
          row as TmEventRow,
          dayStart,
          dayEnd,
        );
        if (!mapped) return null;
        return { ymd, event: mapped };
      })
      .filter((item): item is ActualPatternSourceEvent => Boolean(item));
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface CreatePlannedCalendarEventInput {
  userId: string;
  title: string;
  description?: string;
  location?: string;
  scheduledStartIso: string;
  scheduledEndIso: string;
  meta: PlannedCalendarMeta;
}

export async function createPlannedCalendarEvent(
  input: CreatePlannedCalendarEventInput,
): Promise<ScheduledEvent> {
  try {
    const trimmedLocation =
      typeof input.location === "string" ? input.location.trim() : "";
    const metaWithLocation: PlannedCalendarMeta = {
      ...input.meta,
      ...(trimmedLocation ? { location: trimmedLocation } : {}),
    };
    const insert: TmEventInsert = {
      user_id: input.userId,
      type: PLANNED_EVENT_TYPE,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      scheduled_start: input.scheduledStartIso,
      scheduled_end: input.scheduledEndIso,
      meta: metaWithLocation as unknown as Json,
    };

    if (__DEV__) {
      console.log("[Supabase] Inserting planned calendar event:", {
        userId: input.userId,
        title: insert.title,
        scheduled_start: insert.scheduled_start,
        scheduled_end: insert.scheduled_end,
        type: insert.type,
      });
    }

    const { data, error } = await supabase
      .schema("tm")
      .from("events")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      if (__DEV__) {
        console.error("[Supabase] ❌ Error inserting planned event:", error);
      }
      throw handleSupabaseError(error);
    }

    if (__DEV__) {
      console.log(
        "[Supabase] ✅ Successfully inserted planned event:",
        data.id,
      );
    }

    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) {
      throw new Error("Failed to map created planned event");
    }
    return mapped;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface CreateActualCalendarEventInput
  extends CreatePlannedCalendarEventInput {}

export async function createActualCalendarEvent(
  input: CreateActualCalendarEventInput,
): Promise<ScheduledEvent> {
  try {
    const trimmedLocation =
      typeof input.location === "string" ? input.location.trim() : "";
    const metaWithLocation: PlannedCalendarMeta = {
      ...input.meta,
      ...(trimmedLocation ? { location: trimmedLocation } : {}),
    };
    const insert: TmEventInsert = {
      user_id: input.userId,
      type: ACTUAL_EVENT_TYPE,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      scheduled_start: input.scheduledStartIso,
      scheduled_end: input.scheduledEndIso,
      meta: metaWithLocation as unknown as Json,
    };

    if (__DEV__) {
      console.log("[Supabase] Inserting actual calendar event:", {
        userId: input.userId,
        title: insert.title,
        scheduled_start: insert.scheduled_start,
        scheduled_end: insert.scheduled_end,
        type: insert.type,
      });
    }

    const { data, error } = await supabase
      .schema("tm")
      .from("events")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      if (__DEV__) {
        console.error("[Supabase] ❌ Error inserting actual event:", error);
      }
      throw handleSupabaseError(error);
    }

    if (__DEV__) {
      console.log("[Supabase] ✅ Successfully inserted actual event:", data.id);
    }

    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) {
      throw new Error("Failed to map created actual event");
    }
    return mapped;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface EnsureSleepScheduleInput {
  userId: string;
  startYmd: string;
  wakeTimeIso: string;
  sleepTimeIso: string;
}

/**
 * Ensures there is a single "system" sleep schedule planned event for the given start day.
 * Creates (or updates) a cross-midnight event from sleepTime -> wakeTime.
 */
export async function ensurePlannedSleepScheduleForDay(
  input: EnsureSleepScheduleInput,
): Promise<ScheduledEvent> {
  const { userId, startYmd, wakeTimeIso, sleepTimeIso } = input;
  try {
    const day = ymdToDate(startYmd);
    const wake = parseTimeIsoToHoursMinutes(wakeTimeIso);
    const sleep = parseTimeIsoToHoursMinutes(sleepTimeIso);

    const start = new Date(day);
    start.setHours(sleep.hours, sleep.minutes, 0, 0);

    const end = new Date(day);
    end.setHours(wake.hours, wake.minutes, 0, 0);

    const sleepMinutes = sleep.hours * 60 + sleep.minutes;
    const wakeMinutes = wake.hours * 60 + wake.minutes;
    if (sleepMinutes >= wakeMinutes) {
      end.setDate(end.getDate() + 1);
    }

    const desiredStartIso = formatLocalIso(start);
    const desiredEndIso = formatLocalIso(end);

    const targetMeta: PlannedCalendarMeta = {
      category: "sleep",
      isBig3: false,
      source: "system",
      kind: "sleep_schedule",
      startYmd,
    };

    const { data: existing, error: existingError } = await supabase
      .schema("tm")
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .eq("type", PLANNED_EVENT_TYPE)
      .eq("meta->>kind", "sleep_schedule")
      .eq("meta->>startYmd", startYmd)
      .maybeSingle();

    if (existingError) throw handleSupabaseError(existingError);

    if (existing?.id) {
      const needsUpdate =
        existing.scheduled_start !== desiredStartIso ||
        existing.scheduled_end !== desiredEndIso ||
        existing.title !== "Sleep" ||
        existing.description !== "Sleep schedule";

      if (!needsUpdate) {
        const mapped = rowToScheduledEvent(existing as TmEventRow);
        if (!mapped)
          throw new Error("Failed to map existing sleep schedule event");
        return mapped;
      }

      const updates: TmEventUpdate = {
        title: "Sleep",
        description: "Sleep schedule",
        scheduled_start: desiredStartIso,
        scheduled_end: desiredEndIso,
        meta: targetMeta as unknown as Json,
      };

      const { data, error } = await supabase
        .schema("tm")
        .from("events")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw handleSupabaseError(error);
      const mapped = rowToScheduledEvent(data as TmEventRow);
      if (!mapped)
        throw new Error("Failed to map updated sleep schedule event");
      return mapped;
    }

    const insert: TmEventInsert = {
      user_id: userId,
      type: PLANNED_EVENT_TYPE,
      title: "Sleep",
      description: "Sleep schedule",
      scheduled_start: desiredStartIso,
      scheduled_end: desiredEndIso,
      meta: targetMeta as unknown as Json,
    };

    const { data, error } = await supabase
      .schema("tm")
      .from("events")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw handleSupabaseError(error);
    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) throw new Error("Failed to map created sleep schedule event");
    return mapped;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface UpdatePlannedCalendarEventInput {
  eventId: string;
  title?: string;
  description?: string;
  location?: string;
  scheduledStartIso?: string;
  scheduledEndIso?: string;
  meta?: PlannedCalendarMeta;
}

export async function updatePlannedCalendarEvent(
  input: UpdatePlannedCalendarEventInput,
): Promise<ScheduledEvent> {
  try {
    const updates: TmEventUpdate = {};
    if (typeof input.title === "string") updates.title = input.title.trim();
    if (typeof input.description === "string")
      updates.description = input.description.trim();
    if (typeof input.scheduledStartIso === "string")
      updates.scheduled_start = input.scheduledStartIso;
    if (typeof input.scheduledEndIso === "string")
      updates.scheduled_end = input.scheduledEndIso;

    const locationWasProvided = typeof input.location === "string";
    const trimmedLocation = locationWasProvided ? input.location.trim() : null;

    if (input.meta && locationWasProvided) {
      // If meta is provided, apply the location override into meta in the same update.
      updates.meta = {
        ...input.meta,
        location: trimmedLocation || null,
      } as unknown as Json;
    } else if (input.meta) {
      updates.meta = input.meta as unknown as Json;
    } else if (locationWasProvided) {
      // If only location was provided, merge it into existing meta so we don't wipe category/isBig3.
      const { data: existing, error: existingError } = await supabase
        .schema("tm")
        .from("events")
        .select("meta")
        .eq("id", input.eventId)
        .single();
      if (existingError) throw handleSupabaseError(existingError);

      const existingMeta = (existing?.meta ?? {}) as Json;
      const nextMeta: Record<string, Json> =
        existingMeta &&
        typeof existingMeta === "object" &&
        !Array.isArray(existingMeta)
          ? (existingMeta as Record<string, Json>)
          : {};
      nextMeta.location =
        trimmedLocation && trimmedLocation.length > 0 ? trimmedLocation : null;
      updates.meta = nextMeta as unknown as Json;
    }

    const { data, error } = await supabase
      .schema("tm")
      .from("events")
      .update(updates)
      .eq("id", input.eventId)
      .select("*")
      .single();

    if (error) throw handleSupabaseError(error);

    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) {
      throw new Error("Failed to map updated planned event");
    }
    return mapped;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface UpdateActualCalendarEventInput
  extends UpdatePlannedCalendarEventInput {}

export async function updateActualCalendarEvent(
  input: UpdateActualCalendarEventInput,
): Promise<ScheduledEvent> {
  return await updatePlannedCalendarEvent(input);
}

export async function deletePlannedCalendarEvent(
  eventId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .schema("tm")
      .from("events")
      .delete()
      .eq("id", eventId);
    if (error) throw handleSupabaseError(error);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function deleteActualCalendarEvent(
  eventId: string,
): Promise<void> {
  return await deletePlannedCalendarEvent(eventId);
}

export async function deleteActualCalendarEventsByIds(
  userId: string,
  eventIds: string[],
): Promise<void> {
  if (eventIds.length === 0) return;
  try {
    const batchSize = 200;
    for (let start = 0; start < eventIds.length; start += batchSize) {
      const batch = eventIds.slice(start, start + batchSize);
      const { error } = await supabase
        .schema("tm")
        .from("events")
        .delete()
        .eq("user_id", userId)
        .eq("type", ACTUAL_EVENT_TYPE)
        .in("id", batch);
      if (error) throw handleSupabaseError(error);
    }
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface SyncDerivedActualEventsInput {
  userId: string;
  ymd: string;
  derivedEvents: ScheduledEvent[];
}

/**
 * Automatically saves derived actual events to Supabase.
 * Only saves events that don't already exist (checked by source_id in meta).
 */
export async function syncDerivedActualEvents(
  input: SyncDerivedActualEventsInput,
): Promise<ScheduledEvent[]> {
  const { userId, ymd, derivedEvents } = input;

  if (derivedEvents.length === 0) return [];

  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = formatLocalIso(dayStart);
    const endIso = formatLocalIso(dayEnd);

    // Fetch existing actual events for this day to check for duplicates
    const { data: existing, error: fetchError } = await supabase
      .schema("tm")
      .from("events")
      .select("id, scheduled_start, scheduled_end, meta")
      .eq("user_id", userId)
      .eq("type", ACTUAL_EVENT_TYPE)
      .lt("scheduled_start", endIso)
      .gt("scheduled_end", startIso);

    if (fetchError) throw handleSupabaseError(fetchError);

    const existingSourceIds = new Set<string>();
    // Track time ranges covered by user-edited events so we don't re-derive over them
    const userEditedRanges: Array<{ start: number; end: number }> = [];
    if (existing) {
      for (const row of existing) {
        const meta = row.meta as Record<string, Json> | null;
        if (meta?.source_id && typeof meta.source_id === "string") {
          existingSourceIds.add(meta.source_id);
        }
        // Also check for derived events by checking if meta.source is 'derived' and matching time ranges
        if (meta?.source === "derived" && meta?.kind) {
          const start = new Date(row.scheduled_start).getTime();
          const end = new Date(row.scheduled_end).getTime();
          existingSourceIds.add(`derived_${start}_${end}_${meta.kind}`);
        }
        // Track user-edited event time ranges to prevent re-derivation over them
        if (meta?.source === "actual_adjust" || meta?.source === "user") {
          const start = new Date(row.scheduled_start).getTime();
          const end = new Date(row.scheduled_end).getTime();
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            userEditedRanges.push({ start, end });
          }
        }
      }
    }

    const inserts: Array<Record<string, unknown>> = [];
    const savedEvents: ScheduledEvent[] = [];

    for (const event of derivedEvents) {
      // Skip if this is not a derived event (already saved)
      if (
        !event.id.startsWith("derived_actual:") &&
        !event.id.startsWith("derived_evidence:")
      ) {
        continue;
      }

      // Create a source_id based on the event's derived ID
      const sourceId = event.id;

      // Check if we already have this event saved
      if (existingSourceIds.has(sourceId)) {
        continue;
      }

      // Also check by time range and kind for derived events
      const startDate = new Date(dayStart);
      startDate.setHours(
        Math.floor(event.startMinutes / 60),
        event.startMinutes % 60,
        0,
        0,
      );
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + event.duration);

      const timeRangeKey = `derived_${startDate.getTime()}_${endDate.getTime()}_${event.meta?.kind ?? "unknown"}`;
      if (existingSourceIds.has(timeRangeKey)) {
        continue;
      }

      // Skip if a user-edited event already covers this time range (prevents re-deriving over user edits)
      const derivedStartMs = startDate.getTime();
      const derivedEndMs = endDate.getTime();
      const overlapsUserEdit = userEditedRanges.some(
        (range) => derivedStartMs < range.end && derivedEndMs > range.start,
      );
      if (overlapsUserEdit) {
        continue;
      }

      const meta: Record<string, Json> = {
        category: event.category,
        source: event.meta?.source ?? "derived",
        kind: event.meta?.kind ?? "unknown_gap",
        source_id: sourceId,
        actual: true,
        tags: ["actual"],
        confidence: event.meta?.confidence ?? 0.2,
        ...(event.meta?.evidence ? { evidence: event.meta.evidence } : {}),
        ...(event.meta?.dataQuality
          ? { dataQuality: event.meta.dataQuality }
          : {}),
        ...(event.meta?.verificationReport
          ? { verificationReport: event.meta.verificationReport }
          : {}),
        ...(event.meta?.patternSummary
          ? { patternSummary: event.meta.patternSummary }
          : {}),
        ...(event.meta?.evidenceFusion
          ? { evidenceFusion: event.meta.evidenceFusion }
          : {}),
        ...(event.meta?.plannedEventId
          ? { plannedEventId: event.meta.plannedEventId }
          : {}),
      };

      if (event.location) {
        meta.location = event.location;
      }

      inserts.push({
        user_id: userId,
        type: ACTUAL_EVENT_TYPE,
        title: event.title,
        description: event.description ?? "",
        scheduled_start: formatLocalIso(startDate),
        scheduled_end: formatLocalIso(endDate),
        meta: meta as unknown as Json,
      });
    }

    if (inserts.length === 0) return [];

    if (__DEV__) {
      console.log(
        `[Supabase] Syncing ${inserts.length} derived actual events for ${ymd}`,
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .schema("tm")
      .from("events")
      .insert(inserts)
      .select("*");

    if (insertError) throw handleSupabaseError(insertError);

    if (!inserted) return [];

    // Map inserted rows to ScheduledEvent format
    for (const row of inserted) {
      const mapped = rowToScheduledEventForDay(
        row as TmEventRow,
        dayStart,
        dayEnd,
      );
      if (mapped) {
        savedEvents.push(mapped);
      }
    }

    if (__DEV__) {
      console.log(
        `[Supabase] ✅ Successfully synced ${savedEvents.length} derived actual events`,
      );
    }

    return savedEvents;
  } catch (error) {
    if (__DEV__) {
      console.error(
        "[Supabase] ❌ Error syncing derived actual events:",
        error,
      );
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

// ============================================================================
// Session Split Operations
// ============================================================================

export interface SplitSessionInput {
  /** User ID */
  userId: string;
  /** ID of the original session event to split */
  originalEventId: string;
  /** Split point time in ISO format */
  splitPointIso: string;
  /** First session data (before split point) */
  firstSession: {
    title: string;
    scheduledStartIso: string;
    scheduledEndIso: string;
    meta: PlannedCalendarMeta;
  };
  /** Second session data (after split point) */
  secondSession: {
    title: string;
    scheduledStartIso: string;
    scheduledEndIso: string;
    meta: PlannedCalendarMeta;
  };
}

export interface SplitSessionResult {
  /** The first (earlier) session event after split */
  firstEvent: ScheduledEvent;
  /** The second (later) session event after split */
  secondEvent: ScheduledEvent;
  /** Whether the original was successfully soft-deleted */
  originalDeleted: boolean;
}

/**
 * Split a session event into two new events at the specified split point.
 *
 * This function:
 * 1. Soft-deletes the original event by setting meta.deleted_at and meta.deleted_reason
 * 2. Creates two new session events with meta.source = 'user' (protected from future ingestion)
 * 3. Links the new events to the original via meta.split_from
 *
 * @param input - Split session input containing original event ID and new session data
 * @returns Result containing the two new events
 */
export async function splitSessionEvent(
  input: SplitSessionInput,
): Promise<SplitSessionResult> {
  try {
    const {
      userId,
      originalEventId,
      splitPointIso,
      firstSession,
      secondSession,
    } = input;

    if (__DEV__) {
      console.log("[Supabase] Splitting session event:", {
        originalEventId,
        splitPoint: splitPointIso,
      });
    }

    // Step 1: Soft-delete the original event by updating its meta
    const { data: originalEvent, error: fetchError } = await supabase
      .schema("tm")
      .from("events")
      .select("*")
      .eq("id", originalEventId)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      if (__DEV__) {
        console.error("[Supabase] ❌ Error fetching original event:", fetchError);
      }
      throw handleSupabaseError(fetchError);
    }

    const originalMeta = (originalEvent.meta ?? {}) as Record<string, Json>;
    const updatedOriginalMeta: Record<string, Json> = {
      ...originalMeta,
      deleted_at: new Date().toISOString(),
      deleted_reason: "split",
      split_at: splitPointIso,
    };

    const { error: updateError } = await supabase
      .schema("tm")
      .from("events")
      .update({ meta: updatedOriginalMeta as unknown as Json })
      .eq("id", originalEventId)
      .eq("user_id", userId);

    if (updateError) {
      if (__DEV__) {
        console.error("[Supabase] ❌ Error soft-deleting original event:", updateError);
      }
      throw handleSupabaseError(updateError);
    }

    // Step 2: Create the first session event
    const firstMeta: PlannedCalendarMeta = {
      ...firstSession.meta,
      source: "user",
      split_from: originalEventId,
    };

    const firstInsert: TmEventInsert = {
      user_id: userId,
      type: ACTUAL_EVENT_TYPE,
      title: firstSession.title,
      description: "",
      scheduled_start: firstSession.scheduledStartIso,
      scheduled_end: firstSession.scheduledEndIso,
      meta: firstMeta as unknown as Json,
    };

    const { data: firstData, error: firstError } = await supabase
      .schema("tm")
      .from("events")
      .insert(firstInsert)
      .select("*")
      .single();

    if (firstError) {
      if (__DEV__) {
        console.error("[Supabase] ❌ Error creating first split event:", firstError);
      }
      throw handleSupabaseError(firstError);
    }

    // Step 3: Create the second session event
    const secondMeta: PlannedCalendarMeta = {
      ...secondSession.meta,
      source: "user",
      split_from: originalEventId,
    };

    const secondInsert: TmEventInsert = {
      user_id: userId,
      type: ACTUAL_EVENT_TYPE,
      title: secondSession.title,
      description: "",
      scheduled_start: secondSession.scheduledStartIso,
      scheduled_end: secondSession.scheduledEndIso,
      meta: secondMeta as unknown as Json,
    };

    const { data: secondData, error: secondError } = await supabase
      .schema("tm")
      .from("events")
      .insert(secondInsert)
      .select("*")
      .single();

    if (secondError) {
      if (__DEV__) {
        console.error("[Supabase] ❌ Error creating second split event:", secondError);
      }
      throw handleSupabaseError(secondError);
    }

    // Map the results to ScheduledEvent format
    const firstEvent = rowToScheduledEvent(firstData as TmEventRow);
    const secondEvent = rowToScheduledEvent(secondData as TmEventRow);

    if (!firstEvent || !secondEvent) {
      throw new Error("Failed to map split session events");
    }

    if (__DEV__) {
      console.log("[Supabase] ✅ Successfully split session:", {
        originalEventId,
        firstEventId: firstEvent.id,
        secondEventId: secondEvent.id,
      });
    }

    return {
      firstEvent,
      secondEvent,
      originalDeleted: true,
    };
  } catch (error) {
    if (__DEV__) {
      console.error("[Supabase] ❌ Error splitting session:", error);
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Check if an event has been soft-deleted (split or merged).
 */
export function isEventSoftDeleted(meta: Record<string, unknown> | null): boolean {
  if (!meta) return false;
  return typeof meta.deleted_at === "string" && meta.deleted_at.length > 0;
}

// ============================================================================
// Session Merge Operations
// ============================================================================

export interface MergeSessionInput {
  /** User ID */
  userId: string;
  /** IDs of the original session events to merge */
  originalEventIds: string[];
  /** Merged session data */
  mergedSession: {
    title: string;
    scheduledStartIso: string;
    scheduledEndIso: string;
    meta: PlannedCalendarMeta;
  };
}

export interface MergeSessionResult {
  /** The merged session event */
  mergedEvent: ScheduledEvent;
  /** Whether all originals were successfully soft-deleted */
  originalsDeleted: boolean;
}

/**
 * Merge multiple session events into a single new event.
 *
 * This function:
 * 1. Soft-deletes all original events by setting meta.deleted_at and meta.deleted_reason
 * 2. Creates a new merged session event with meta.source = 'user' (protected from future ingestion)
 * 3. Links the new event to the originals via meta.merged_from
 *
 * @param input - Merge session input containing original event IDs and merged session data
 * @returns Result containing the merged event
 */
export async function mergeSessionEvents(
  input: MergeSessionInput,
): Promise<MergeSessionResult> {
  try {
    const {
      userId,
      originalEventIds,
      mergedSession,
    } = input;

    if (originalEventIds.length < 2) {
      throw new Error("At least two events are required to merge");
    }

    if (__DEV__) {
      console.log("[Supabase] Merging session events:", {
        originalEventIds,
        mergedTitle: mergedSession.title,
      });
    }

    // Step 1: Soft-delete all original events
    const deletionTimestamp = new Date().toISOString();
    let allDeleted = true;

    for (const eventId of originalEventIds) {
      const { data: originalEvent, error: fetchError } = await supabase
        .schema("tm")
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("user_id", userId)
        .single();

      if (fetchError) {
        if (__DEV__) {
          console.error("[Supabase] ❌ Error fetching original event:", fetchError);
        }
        allDeleted = false;
        continue;
      }

      const originalMeta = (originalEvent.meta ?? {}) as Record<string, Json>;
      const updatedOriginalMeta: Record<string, Json> = {
        ...originalMeta,
        deleted_at: deletionTimestamp,
        deleted_reason: "merged",
      };

      const { error: updateError } = await supabase
        .schema("tm")
        .from("events")
        .update({ meta: updatedOriginalMeta as unknown as Json })
        .eq("id", eventId)
        .eq("user_id", userId);

      if (updateError) {
        if (__DEV__) {
          console.error("[Supabase] ❌ Error soft-deleting original event:", updateError);
        }
        allDeleted = false;
      }
    }

    // Step 2: Create the merged session event
    const mergedMeta: PlannedCalendarMeta = {
      ...mergedSession.meta,
      source: "user",
      merged_from: originalEventIds,
    };

    const mergedInsert: TmEventInsert = {
      user_id: userId,
      type: ACTUAL_EVENT_TYPE,
      title: mergedSession.title,
      description: "",
      scheduled_start: mergedSession.scheduledStartIso,
      scheduled_end: mergedSession.scheduledEndIso,
      meta: mergedMeta as unknown as Json,
    };

    const { data: mergedData, error: mergedError } = await supabase
      .schema("tm")
      .from("events")
      .insert(mergedInsert)
      .select("*")
      .single();

    if (mergedError) {
      if (__DEV__) {
        console.error("[Supabase] ❌ Error creating merged event:", mergedError);
      }
      throw handleSupabaseError(mergedError);
    }

    // Map the result to ScheduledEvent format
    const mergedEvent = rowToScheduledEvent(mergedData as TmEventRow);

    if (!mergedEvent) {
      throw new Error("Failed to map merged session event");
    }

    if (__DEV__) {
      console.log("[Supabase] ✅ Successfully merged sessions:", {
        originalEventIds,
        mergedEventId: mergedEvent.id,
      });
    }

    return {
      mergedEvent,
      originalsDeleted: allDeleted,
    };
  } catch (error) {
    if (__DEV__) {
      console.error("[Supabase] ❌ Error merging sessions:", error);
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Find adjacent session blocks that can be merged with the given event.
 *
 * Adjacent sessions are those that:
 * 1. Are session blocks (meta.kind === 'session_block')
 * 2. End where this session starts, or start where this session ends (within 5 min gap)
 * 3. Are not soft-deleted
 *
 * @param userId - User ID
 * @param event - The event to find neighbors for
 * @param allEvents - All events for the day (to search for neighbors)
 * @returns Array of adjacent session events
 */
export function findMergeableNeighbors(
  event: ScheduledEvent,
  allEvents: ScheduledEvent[],
): ScheduledEvent[] {
  const eventStart = event.startMinutes;
  const eventEnd = event.startMinutes + event.duration;
  const maxGapMinutes = 5; // Maximum gap between sessions to be considered adjacent

  // Filter for session blocks that are not soft-deleted and not the same event
  const sessionBlocks = allEvents.filter((e) => {
    if (e.id === event.id) return false;
    if (e.meta?.kind !== "session_block") return false;
    if (e.meta && isEventSoftDeleted(e.meta as unknown as Record<string, unknown>)) return false;
    return true;
  });

  // Find neighbors
  const neighbors: ScheduledEvent[] = [];

  for (const candidate of sessionBlocks) {
    const candidateStart = candidate.startMinutes;
    const candidateEnd = candidate.startMinutes + candidate.duration;

    // Check if candidate ends where this event starts (or within gap)
    const gapBefore = eventStart - candidateEnd;
    if (gapBefore >= 0 && gapBefore <= maxGapMinutes) {
      neighbors.push(candidate);
      continue;
    }

    // Check if candidate starts where this event ends (or within gap)
    const gapAfter = candidateStart - eventEnd;
    if (gapAfter >= 0 && gapAfter <= maxGapMinutes) {
      neighbors.push(candidate);
      continue;
    }
  }

  // Sort by start time
  return neighbors.sort((a, b) => a.startMinutes - b.startMinutes);
}
