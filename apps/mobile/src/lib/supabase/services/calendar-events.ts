import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { Database, Json } from '../database.types';
import type { CalendarEventMeta, EventCategory, ScheduledEvent } from '@/stores';

const PLANNED_EVENT_TYPE = 'calendar_planned';
const ACTUAL_EVENT_TYPE = 'calendar_actual';

type TmEventRow = Database['tm']['Tables']['events']['Row'];
type TmEventInsert = Database['tm']['Tables']['events']['Insert'];
type TmEventUpdate = Database['tm']['Tables']['events']['Update'];
type PublicEventRow = Database['public']['Tables']['events']['Row'];

export type PlannedCalendarMeta = CalendarEventMeta & Record<string, Json>;

function isPlannedCalendarMeta(value: Json): value is PlannedCalendarMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, Json>;
  const category = rec.category;
  return typeof category === 'string' && category.length > 0;
}

function ymdToLocalDayStart(ymd: string): Date {
  // ymd: YYYY-MM-DD
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day, 0, 0, 0, 0);
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
 * Ensures the timestamp is interpreted as UTC if no timezone info is present.
 * This prevents issues where timestamps without 'Z' suffix would be interpreted as local time.
 */
function parseDbTimestamp(timestamp: string): Date {
  // If the timestamp already has timezone info (Z or offset), parse normally
  if (/Z$|[+-]\d{2}:\d{2}$/.test(timestamp)) {
    return new Date(timestamp);
  }
  // Otherwise, treat it as UTC by appending 'Z'
  return new Date(timestamp + 'Z');
}

function isoToLocalYmd(iso: string): string {
  const date = parseDbTimestamp(iso);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeIsoToHoursMinutes(timeIso: string): { hours: number; minutes: number } {
  const parsed = parseDbTimestamp(timeIso);
  if (Number.isNaN(parsed.getTime())) return { hours: 22, minutes: 30 };
  return { hours: parsed.getHours(), minutes: parsed.getMinutes() };
}

function dateToMinutesFromMidnightLocal(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function rowToScheduledEventForDay(row: TmEventRow, dayStart: Date, dayEnd: Date): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = parseDbTimestamp(row.scheduled_start);
  const end = parseDbTimestamp(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

  // Clip to the visible day window so cross-midnight events render correctly on both days.
  const clippedStart = new Date(Math.max(startMs, dayStart.getTime()));
  const clippedEnd = new Date(Math.min(endMs, dayEnd.getTime()));
  const clippedStartMs = clippedStart.getTime();
  const clippedEndMs = clippedEnd.getTime();
  if (clippedEndMs <= clippedStartMs) return null;

  const startMinutes = Math.max(0, Math.round((clippedStartMs - dayStart.getTime()) / 60_000));
  const duration = Math.max(Math.round((clippedEndMs - clippedStartMs) / 60_000), 1);

  const meta = row.meta as Json;
  const metaParsed: PlannedCalendarMeta | null = meta && isPlannedCalendarMeta(meta) ? meta : null;
  const suggestedCategory =
    typeof metaParsed?.suggested_category === 'string' ? metaParsed.suggested_category : null;
  const fallbackCategory = metaParsed?.category ?? 'work';
  const category = (
    fallbackCategory === 'unknown' && suggestedCategory ? suggestedCategory : fallbackCategory
  ) as EventCategory;
  const locationFromMeta = typeof metaParsed?.location === 'string' && metaParsed.location.trim().length > 0 ? metaParsed.location : undefined;

  const actualFlag = row.type === ACTUAL_EVENT_TYPE;
  const metaWithActual: PlannedCalendarMeta = {
    ...(metaParsed ?? {}),
    ...(actualFlag ? { actual: true, source: metaParsed?.source ?? 'user' } : {}),
  };

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
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
    typeof value === 'string' &&
    [
      'routine',
      'work',
      'meal',
      'meeting',
      'health',
      'family',
      'social',
      'travel',
      'finance',
      'comm',
      'digital',
      'sleep',
      'unknown',
      'free',
    ].includes(value)
  );
}

function mapPublicEventTypeToCategory(
  type: Database['public']['Enums']['event_type'] | string | null,
  fallback?: EventCategory | null
): EventCategory {
  if (fallback && isEventCategory(fallback)) return fallback;
  switch (type) {
    case 'calendar_planned':
    case 'calendar_actual':
    case 'meeting':
    case 'call':
    case 'video_call':
    case 'phone_call':
      return 'meeting';
    case 'drive':
      return 'travel';
    case 'sleep':
      return 'sleep';
    case 'message':
    case 'email':
    case 'chat':
    case 'slack_message':
    case 'sms':
    case 'communication':
      return 'social';
    case 'task':
    case 'project':
    case 'goal':
    case 'category':
    case 'tag':
      return 'work';
    case 'note':
    case 'other':
    default:
      return 'work';
  }
}

function rowToScheduledEventForDayFromPublic(
  row: PublicEventRow,
  dayStart: Date,
  dayEnd: Date
): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = parseDbTimestamp(row.scheduled_start);
  const end = parseDbTimestamp(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

  const clippedStart = new Date(Math.max(startMs, dayStart.getTime()));
  const clippedEnd = new Date(Math.min(endMs, dayEnd.getTime()));
  const clippedStartMs = clippedStart.getTime();
  const clippedEndMs = clippedEnd.getTime();
  if (clippedEndMs <= clippedStartMs) return null;

  const startMinutes = Math.max(0, Math.round((clippedStartMs - dayStart.getTime()) / 60_000));
  const duration = Math.max(Math.round((clippedEndMs - clippedStartMs) / 60_000), 1);

  const meta = row.meta as Json;
  const metaParsed = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, Json>) : null;
  const metaCategory = metaParsed?.category;
  const category = mapPublicEventTypeToCategory(row.type, isEventCategory(metaCategory) ? metaCategory : null);

  const title =
    row.title?.trim() ||
    row.subject?.trim() ||
    (typeof metaParsed?.title === 'string' ? metaParsed.title : '') ||
    'Calendar event';
  const description =
    row.description?.trim() ||
    row.preview?.trim() ||
    (typeof metaParsed?.description === 'string' ? metaParsed.description : '') ||
    '';

  const location =
    row.location?.trim() ||
    (typeof metaParsed?.location === 'string' ? metaParsed.location : '') ||
    undefined;

  const isActual = row.type === ACTUAL_EVENT_TYPE;
  const metaForDisplay: PlannedCalendarMeta = {
    ...(metaParsed ?? {}),
    category,
    source: isActual ? 'user' : 'system',
    actual: isActual ? true : undefined,
    tags: ['external_calendar'],
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
  if (typeof sourceId === 'string' && sourceId.trim()) return `source:${sourceId.trim()}`;
  if (typeof externalId === 'string' && externalId.trim()) return `external:${externalId.trim()}`;
  return `time:${event.startMinutes}-${event.duration}-${event.title.trim().toLowerCase()}`;
}

function rowToScheduledEvent(row: TmEventRow): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = parseDbTimestamp(row.scheduled_start);
  const end = parseDbTimestamp(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

  const startMinutes = dateToMinutesFromMidnightLocal(start);
  const duration = Math.max(Math.round((endMs - startMs) / 60_000), 1);
  const meta = row.meta as Json;

  const metaParsed: PlannedCalendarMeta | null = meta && isPlannedCalendarMeta(meta) ? meta : null;
  const suggestedCategory =
    typeof metaParsed?.suggested_category === 'string' ? metaParsed.suggested_category : null;
  const fallbackCategory = metaParsed?.category ?? 'work';
  const category = (
    fallbackCategory === 'unknown' && suggestedCategory ? suggestedCategory : fallbackCategory
  ) as EventCategory;
  const locationFromMeta = typeof metaParsed?.location === 'string' && metaParsed.location.trim().length > 0 ? metaParsed.location : undefined;

  const actualFlag = row.type === ACTUAL_EVENT_TYPE;
  const metaWithActual: PlannedCalendarMeta = {
    ...(metaParsed ?? {}),
    ...(actualFlag ? { actual: true, source: metaParsed?.source ?? 'user' } : {}),
  };

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    location: locationFromMeta,
    startMinutes,
    duration,
    category,
    isBig3: metaParsed?.isBig3 ?? false,
    meta: Object.keys(metaWithActual).length > 0 ? metaWithActual : undefined,
  };
}

export async function fetchPlannedCalendarEventsForDay(userId: string, ymd: string): Promise<ScheduledEvent[]> {
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const [tmResult, publicResult] = await Promise.all([
      supabase
        .schema('tm')
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .eq('type', PLANNED_EVENT_TYPE)
        .lt('scheduled_start', endIso)
        .gt('scheduled_end', startIso)
        .order('scheduled_start', { ascending: true }),
      supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .eq('type', PLANNED_EVENT_TYPE)
        .lt('scheduled_start', endIso)
        .gt('scheduled_end', startIso)
        .order('scheduled_start', { ascending: true }),
    ]);

    if (tmResult.error) throw handleSupabaseError(tmResult.error);
    if (publicResult.error) throw handleSupabaseError(publicResult.error);

    const tmEvents = (tmResult.data ?? [])
      .map((row) => rowToScheduledEventForDay(row as TmEventRow, dayStart, dayEnd))
      .filter((e): e is ScheduledEvent => !!e);

    const externalEvents = (publicResult.data ?? [])
      .map((row) => rowToScheduledEventForDayFromPublic(row as PublicEventRow, dayStart, dayEnd))
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

export async function fetchActualCalendarEventsForDay(userId: string, ymd: string): Promise<ScheduledEvent[]> {
  console.log(`[Supabase] fetchActualCalendarEventsForDay: Fetching actual events for ${ymd}`);
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const [tmResult, publicResult] = await Promise.all([
      supabase
        .schema('tm')
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .eq('type', ACTUAL_EVENT_TYPE)
        .lt('scheduled_start', endIso)
        .gt('scheduled_end', startIso)
        .order('scheduled_start', { ascending: true }),
      supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .eq('type', ACTUAL_EVENT_TYPE)
        .lt('scheduled_start', endIso)
        .gt('scheduled_end', startIso)
        .order('scheduled_start', { ascending: true }),
    ]);

    if (tmResult.error) throw handleSupabaseError(tmResult.error);
    if (publicResult.error) throw handleSupabaseError(publicResult.error);

    const tmEvents = (tmResult.data ?? [])
      .map((row) => rowToScheduledEventForDay(row as TmEventRow, dayStart, dayEnd))
      .filter((e): e is ScheduledEvent => !!e);

    const externalEvents = (publicResult.data ?? [])
      .map((row) => rowToScheduledEventForDayFromPublic(row as PublicEventRow, dayStart, dayEnd))
      .filter((e): e is ScheduledEvent => !!e);

    // Count derived events for logging
    const derivedCount = tmEvents.filter((e) => {
      const sourceId = e.meta?.source_id;
      return typeof sourceId === 'string' &&
        (sourceId.startsWith('derived_actual:') || sourceId.startsWith('derived_evidence:'));
    }).length;

    console.log(`[Supabase] fetchActualCalendarEventsForDay: Found ${tmEvents.length} tm events (${derivedCount} derived), ${externalEvents.length} external events for ${ymd}`);

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
    console.log(`[Supabase] fetchActualCalendarEventsForDay: Error fetching events for ${ymd}:`, error);
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
  endYmd: string
): Promise<ActualPatternSourceEvent[]> {
  try {
    const rangeStart = ymdToLocalDayStart(startYmd);
    const rangeEnd = addDays(ymdToLocalDayStart(endYmd), 1);
    const startIso = rangeStart.toISOString();
    const endIso = rangeEnd.toISOString();

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('type', ACTUAL_EVENT_TYPE)
      .lt('scheduled_start', endIso)
      .gt('scheduled_end', startIso)
      .order('scheduled_start', { ascending: true });

    if (error) throw handleSupabaseError(error);

    return (data ?? [])
      .map((row) => {
        const mapped = rowToScheduledEvent(row as TmEventRow);
        if (!mapped || !row.scheduled_start) return null;
        const ymd = isoToLocalYmd(row.scheduled_start);
        if (!ymd) return null;
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

export async function createPlannedCalendarEvent(input: CreatePlannedCalendarEventInput): Promise<ScheduledEvent> {
  try {
    const trimmedLocation = typeof input.location === 'string' ? input.location.trim() : '';
    const metaWithLocation: PlannedCalendarMeta = {
      ...input.meta,
      ...(trimmedLocation ? { location: trimmedLocation } : {}),
    };
    const insert: TmEventInsert = {
      user_id: input.userId,
      type: PLANNED_EVENT_TYPE,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      scheduled_start: input.scheduledStartIso,
      scheduled_end: input.scheduledEndIso,
      meta: metaWithLocation as unknown as Json,
    };

    if (__DEV__) {
      console.log('[Supabase] Inserting planned calendar event:', {
        userId: input.userId,
        title: insert.title,
        scheduled_start: insert.scheduled_start,
        scheduled_end: insert.scheduled_end,
        type: insert.type,
      });
    }

    const { data, error } = await supabase.schema('tm').from('events').insert(insert).select('*').single();
    if (error) {
      if (__DEV__) {
        console.error('[Supabase] ❌ Error inserting planned event:', error);
      }
      throw handleSupabaseError(error);
    }

    if (__DEV__) {
      console.log('[Supabase] ✅ Successfully inserted planned event:', data.id);
    }

    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) {
      throw new Error('Failed to map created planned event');
    }
    return mapped;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface CreateActualCalendarEventInput extends CreatePlannedCalendarEventInput {}

export async function createActualCalendarEvent(input: CreateActualCalendarEventInput): Promise<ScheduledEvent> {
  try {
    const trimmedLocation = typeof input.location === 'string' ? input.location.trim() : '';
    const metaWithLocation: PlannedCalendarMeta = {
      ...input.meta,
      ...(trimmedLocation ? { location: trimmedLocation } : {}),
    };
    const insert: TmEventInsert = {
      user_id: input.userId,
      type: ACTUAL_EVENT_TYPE,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      scheduled_start: input.scheduledStartIso,
      scheduled_end: input.scheduledEndIso,
      meta: metaWithLocation as unknown as Json,
    };

    if (__DEV__) {
      console.log('[Supabase] Inserting actual calendar event:', {
        userId: input.userId,
        title: insert.title,
        scheduled_start: insert.scheduled_start,
        scheduled_end: insert.scheduled_end,
        type: insert.type,
      });
    }

    const { data, error } = await supabase.schema('tm').from('events').insert(insert).select('*').single();
    if (error) {
      if (__DEV__) {
        console.error('[Supabase] ❌ Error inserting actual event:', error);
      }
      throw handleSupabaseError(error);
    }

    if (__DEV__) {
      console.log('[Supabase] ✅ Successfully inserted actual event:', data.id);
    }

    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) {
      throw new Error('Failed to map created actual event');
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
export async function ensurePlannedSleepScheduleForDay(input: EnsureSleepScheduleInput): Promise<ScheduledEvent> {
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

    const desiredStartIso = start.toISOString();
    const desiredEndIso = end.toISOString();

    const targetMeta: PlannedCalendarMeta = {
      category: 'sleep',
      isBig3: false,
      source: 'system',
      kind: 'sleep_schedule',
      startYmd,
    };

    const { data: existing, error: existingError } = await supabase
      .schema('tm')
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('type', PLANNED_EVENT_TYPE)
      .eq('meta->>kind', 'sleep_schedule')
      .eq('meta->>startYmd', startYmd)
      .maybeSingle();

    if (existingError) throw handleSupabaseError(existingError);

    if (existing?.id) {
      const needsUpdate =
        existing.scheduled_start !== desiredStartIso ||
        existing.scheduled_end !== desiredEndIso ||
        existing.title !== 'Sleep' ||
        existing.description !== 'Sleep schedule';

      if (!needsUpdate) {
        const mapped = rowToScheduledEvent(existing as TmEventRow);
        if (!mapped) throw new Error('Failed to map existing sleep schedule event');
        return mapped;
      }

      const updates: TmEventUpdate = {
        title: 'Sleep',
        description: 'Sleep schedule',
        scheduled_start: desiredStartIso,
        scheduled_end: desiredEndIso,
        meta: targetMeta as unknown as Json,
      };

      const { data, error } = await supabase
        .schema('tm')
        .from('events')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw handleSupabaseError(error);
      const mapped = rowToScheduledEvent(data as TmEventRow);
      if (!mapped) throw new Error('Failed to map updated sleep schedule event');
      return mapped;
    }

    const insert: TmEventInsert = {
      user_id: userId,
      type: PLANNED_EVENT_TYPE,
      title: 'Sleep',
      description: 'Sleep schedule',
      scheduled_start: desiredStartIso,
      scheduled_end: desiredEndIso,
      meta: targetMeta as unknown as Json,
    };

    const { data, error } = await supabase.schema('tm').from('events').insert(insert).select('*').single();
    if (error) throw handleSupabaseError(error);
    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) throw new Error('Failed to map created sleep schedule event');
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

export async function updatePlannedCalendarEvent(input: UpdatePlannedCalendarEventInput): Promise<ScheduledEvent> {
  try {
    const updates: TmEventUpdate = {};
    if (typeof input.title === 'string') updates.title = input.title.trim();
    if (typeof input.description === 'string') updates.description = input.description.trim();
    if (typeof input.scheduledStartIso === 'string') updates.scheduled_start = input.scheduledStartIso;
    if (typeof input.scheduledEndIso === 'string') updates.scheduled_end = input.scheduledEndIso;

    const locationWasProvided = typeof input.location === 'string';
    const trimmedLocation = locationWasProvided ? input.location.trim() : null;

    if (input.meta && locationWasProvided) {
      // If meta is provided, apply the location override into meta in the same update.
      updates.meta = { ...input.meta, location: trimmedLocation || null } as unknown as Json;
    } else if (input.meta) {
      updates.meta = input.meta as unknown as Json;
    } else if (locationWasProvided) {
      // If only location was provided, merge it into existing meta so we don't wipe category/isBig3.
      const { data: existing, error: existingError } = await supabase
        .schema('tm')
        .from('events')
        .select('meta')
        .eq('id', input.eventId)
        .single();
      if (existingError) throw handleSupabaseError(existingError);

      const existingMeta = (existing?.meta ?? {}) as Json;
      const nextMeta: Record<string, Json> =
        existingMeta && typeof existingMeta === 'object' && !Array.isArray(existingMeta)
          ? (existingMeta as Record<string, Json>)
          : {};
      nextMeta.location = trimmedLocation && trimmedLocation.length > 0 ? trimmedLocation : null;
      updates.meta = nextMeta as unknown as Json;
    }

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .update(updates)
      .eq('id', input.eventId)
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);

    const mapped = rowToScheduledEvent(data as TmEventRow);
    if (!mapped) {
      throw new Error('Failed to map updated planned event');
    }
    return mapped;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export interface UpdateActualCalendarEventInput extends UpdatePlannedCalendarEventInput {}

export async function updateActualCalendarEvent(input: UpdateActualCalendarEventInput): Promise<ScheduledEvent> {
  return await updatePlannedCalendarEvent(input);
}

export async function deletePlannedCalendarEvent(eventId: string): Promise<void> {
  try {
    const { error } = await supabase.schema('tm').from('events').delete().eq('id', eventId);
    if (error) throw handleSupabaseError(error);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function deleteActualCalendarEvent(eventId: string): Promise<void> {
  return await deletePlannedCalendarEvent(eventId);
}

export async function deleteActualCalendarEventsByIds(userId: string, eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  try {
    const { error } = await supabase
      .schema('tm')
      .from('events')
      .delete()
      .eq('user_id', userId)
      .eq('type', ACTUAL_EVENT_TYPE)
      .in('id', eventIds);
    if (error) throw handleSupabaseError(error);
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
 * Check if a day already has synced derived actual events.
 * This helps prevent re-derivation for prior days that have already been processed.
 */
export async function hasSyncedDerivedEventsForDay(userId: string, ymd: string): Promise<boolean> {
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .select('id, meta')
      .eq('user_id', userId)
      .eq('type', ACTUAL_EVENT_TYPE)
      .lt('scheduled_start', endIso)
      .gt('scheduled_end', startIso)
      .limit(10);

    if (error) {
      console.log(`[Supabase] Error checking synced events for ${ymd}:`, error.message);
      return false;
    }

    // Check if any events have source_id starting with derived prefixes
    const hasDerived = (data ?? []).some((row) => {
      const meta = row.meta as Record<string, Json> | null;
      const sourceId = meta?.source_id;
      if (typeof sourceId !== 'string') return false;
      return sourceId.startsWith('derived_actual:') || sourceId.startsWith('derived_evidence:');
    });

    console.log(`[Supabase] hasSyncedDerivedEventsForDay(${ymd}): ${hasDerived} (checked ${data?.length ?? 0} events)`);
    return hasDerived;
  } catch (error) {
    console.log(`[Supabase] Error checking synced events for ${ymd}:`, error);
    return false;
  }
}

/**
 * Clean up duplicate derived events for a day by keeping the oldest event of each kind at each time range.
 * Returns the IDs of events that were deleted.
 */
export async function cleanupDuplicateDerivedEvents(userId: string, ymd: string): Promise<string[]> {
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const { data: existing, error: fetchError } = await supabase
      .schema('tm')
      .from('events')
      .select('id, scheduled_start, scheduled_end, meta, created_at')
      .eq('user_id', userId)
      .eq('type', ACTUAL_EVENT_TYPE)
      .lt('scheduled_start', endIso)
      .gt('scheduled_end', startIso)
      .order('created_at', { ascending: true }); // Oldest first

    if (fetchError) throw handleSupabaseError(fetchError);
    if (!existing || existing.length === 0) return [];

    // Group events by time range and kind, keeping the oldest one
    const groupedByTimeAndKind = new Map<string, typeof existing>();
    for (const row of existing) {
      const meta = row.meta as Record<string, Json> | null;
      const sourceId = meta?.source_id;
      if (typeof sourceId !== 'string') continue;
      if (!sourceId.startsWith('derived_actual:') && !sourceId.startsWith('derived_evidence:')) continue;

      const startMs = new Date(row.scheduled_start!).getTime();
      const endMs = new Date(row.scheduled_end!).getTime();
      const kind = meta?.kind ?? 'unknown';
      const key = `${startMs}:${endMs}:${kind}`;

      if (!groupedByTimeAndKind.has(key)) {
        groupedByTimeAndKind.set(key, []);
      }
      groupedByTimeAndKind.get(key)!.push(row);
    }

    // Find duplicates to remove (all except the oldest in each group)
    const toRemove: string[] = [];
    for (const [key, rows] of groupedByTimeAndKind) {
      if (rows.length > 1) {
        // Keep the first (oldest), remove the rest
        for (let i = 1; i < rows.length; i++) {
          toRemove.push(rows[i].id);
        }
        console.log(`[Supabase] Found ${rows.length} duplicate events for ${key}, keeping oldest, removing ${rows.length - 1}`);
      }
    }

    if (toRemove.length === 0) return [];

    console.log(`[Supabase] Cleaning up ${toRemove.length} duplicate derived events for ${ymd}`);

    const { error: deleteError } = await supabase
      .schema('tm')
      .from('events')
      .delete()
      .in('id', toRemove);

    if (deleteError) throw handleSupabaseError(deleteError);

    console.log(`[Supabase] ✅ Successfully removed ${toRemove.length} duplicate derived events`);
    return toRemove;
  } catch (error) {
    console.log(`[Supabase] ❌ Error cleaning up duplicate derived events:`, error);
    return [];
  }
}

/**
 * Automatically saves derived actual events to Supabase.
 * Only saves events that don't already exist (checked by source_id in meta).
 *
 * IMPORTANT: This function is designed to be idempotent - calling it multiple times
 * with the same events will not create duplicates.
 */
export async function syncDerivedActualEvents(input: SyncDerivedActualEventsInput): Promise<ScheduledEvent[]> {
  const { userId, ymd, derivedEvents } = input;

  if (derivedEvents.length === 0) return [];

  console.log(`[Supabase] syncDerivedActualEvents: Starting sync for ${ymd} with ${derivedEvents.length} derived events`);

  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    // Fetch existing actual events for this day to check for duplicates
    const { data: existing, error: fetchError } = await supabase
      .schema('tm')
      .from('events')
      .select('id, scheduled_start, scheduled_end, meta')
      .eq('user_id', userId)
      .eq('type', ACTUAL_EVENT_TYPE)
      .lt('scheduled_start', endIso)
      .gt('scheduled_end', startIso);

    if (fetchError) throw handleSupabaseError(fetchError);

    console.log(`[Supabase] syncDerivedActualEvents: Found ${existing?.length ?? 0} existing events for ${ymd}`);

    const existingSourceIds = new Set<string>();
    const existingTimeRangeKeys = new Set<string>();
    if (existing) {
      for (const row of existing) {
        const meta = row.meta as Record<string, Json> | null;
        if (meta?.source_id && typeof meta.source_id === 'string') {
          existingSourceIds.add(meta.source_id);
        }
        // Also check for derived events by matching time ranges and kind
        const sourceId = meta?.source_id;
        if (typeof sourceId === 'string' &&
            (sourceId.startsWith('derived_actual:') || sourceId.startsWith('derived_evidence:'))) {
          const start = new Date(row.scheduled_start!).getTime();
          const end = new Date(row.scheduled_end!).getTime();
          const kind = meta?.kind ?? 'unknown';
          existingTimeRangeKeys.add(`${start}:${end}:${kind}`);
        }
      }
    }

    const inserts: Array<Record<string, unknown>> = [];
    const savedEvents: ScheduledEvent[] = [];
    let skippedCount = 0;

    for (const event of derivedEvents) {
      // Skip if this is not a derived event (already saved)
      if (!event.id.startsWith('derived_actual:') && !event.id.startsWith('derived_evidence:')) {
        continue;
      }

      // Create a source_id based on the event's derived ID
      const sourceId = event.id;

      // Check if we already have this event saved by source_id
      if (existingSourceIds.has(sourceId)) {
        skippedCount++;
        continue;
      }

      // Also check by time range and kind for derived events
      const startDate = new Date(dayStart);
      startDate.setHours(Math.floor(event.startMinutes / 60), event.startMinutes % 60, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + event.duration);

      const timeRangeKey = `${startDate.getTime()}:${endDate.getTime()}:${event.meta?.kind ?? 'unknown'}`;
      if (existingTimeRangeKeys.has(timeRangeKey)) {
        skippedCount++;
        continue;
      }

      // Mark as occupied to prevent duplicate inserts within this batch
      existingSourceIds.add(sourceId);
      existingTimeRangeKeys.add(timeRangeKey);

      const meta: Record<string, Json> = {
        category: event.category,
        source: event.meta?.source ?? 'derived',
        kind: event.meta?.kind ?? 'unknown_gap',
        source_id: sourceId,
        actual: true,
        tags: ['actual'],
        confidence: event.meta?.confidence ?? 0.2,
        ...(event.meta?.evidence ? { evidence: event.meta.evidence } : {}),
        ...(event.meta?.dataQuality ? { dataQuality: event.meta.dataQuality } : {}),
        ...(event.meta?.verificationReport ? { verificationReport: event.meta.verificationReport } : {}),
        ...(event.meta?.patternSummary ? { patternSummary: event.meta.patternSummary } : {}),
        ...(event.meta?.evidenceFusion ? { evidenceFusion: event.meta.evidenceFusion } : {}),
        ...(event.meta?.plannedEventId ? { plannedEventId: event.meta.plannedEventId } : {}),
      };

      if (event.location) {
        meta.location = event.location;
      }

      inserts.push({
        user_id: userId,
        type: ACTUAL_EVENT_TYPE,
        title: event.title,
        description: event.description ?? '',
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
        meta: meta as unknown as Json,
      });
    }

    console.log(`[Supabase] syncDerivedActualEvents: Skipped ${skippedCount} events (already exist), inserting ${inserts.length} new events`);

    if (inserts.length === 0) return [];

    const { data: inserted, error: insertError } = await supabase
      .schema('tm')
      .from('events')
      .insert(inserts)
      .select('*');

    if (insertError) throw handleSupabaseError(insertError);

    if (!inserted) return [];

    // Map inserted rows to ScheduledEvent format
    for (const row of inserted) {
      const mapped = rowToScheduledEventForDay(row as TmEventRow, dayStart, dayEnd);
      if (mapped) {
        savedEvents.push(mapped);
      }
    }

    console.log(`[Supabase] syncDerivedActualEvents: ✅ Successfully synced ${savedEvents.length} derived actual events for ${ymd}`);

    return savedEvents;
  } catch (error) {
    console.log(`[Supabase] syncDerivedActualEvents: ❌ Error syncing derived actual events for ${ymd}:`, error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}


