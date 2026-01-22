import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { Database, Json } from '../database.types';
import type { CalendarEventMeta, EventCategory, ScheduledEvent } from '@/stores';

const PLANNED_EVENT_TYPE = 'calendar_planned';
const ACTUAL_EVENT_TYPE = 'calendar_actual';

type TmEventRow = Database['tm']['Tables']['events']['Row'];
type TmEventInsert = Database['tm']['Tables']['events']['Insert'];
type TmEventUpdate = Database['tm']['Tables']['events']['Update'];

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

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    location: locationFromMeta,
    startMinutes,
    duration,
    category,
    isBig3: metaParsed?.isBig3 ?? false,
    meta: metaParsed ?? undefined,
  };
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

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    location: locationFromMeta,
    startMinutes,
    duration,
    category,
    isBig3: metaParsed?.isBig3 ?? false,
    meta: metaParsed ?? undefined,
  };
}

export async function fetchPlannedCalendarEventsForDay(userId: string, ymd: string): Promise<ScheduledEvent[]> {
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('type', PLANNED_EVENT_TYPE)
      // Include events that overlap the day (handles cross-midnight sleep blocks).
      .lt('scheduled_start', endIso)
      .gt('scheduled_end', startIso)
      .order('scheduled_start', { ascending: true });

    if (error) throw handleSupabaseError(error);

    return (data ?? [])
      .map((row) => rowToScheduledEventForDay(row as TmEventRow, dayStart, dayEnd))
      .filter((e): e is ScheduledEvent => !!e)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function fetchActualCalendarEventsForDay(userId: string, ymd: string): Promise<ScheduledEvent[]> {
  try {
    const dayStart = ymdToLocalDayStart(ymd);
    const dayEnd = addDays(dayStart, 1);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('type', ACTUAL_EVENT_TYPE)
      // Include events that overlap the day (supports cross-midnight actual blocks too).
      .lt('scheduled_start', endIso)
      .gt('scheduled_end', startIso)
      .order('scheduled_start', { ascending: true });

    if (error) throw handleSupabaseError(error);

    return (data ?? [])
      .map((row) => rowToScheduledEventForDay(row as TmEventRow, dayStart, dayEnd))
      .filter((e): e is ScheduledEvent => !!e)
      .sort((a, b) => a.startMinutes - b.startMinutes);
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
 * Automatically saves derived actual events to Supabase.
 * Only saves events that don't already exist (checked by source_id in meta).
 */
export async function syncDerivedActualEvents(input: SyncDerivedActualEventsInput): Promise<ScheduledEvent[]> {
  const { userId, ymd, derivedEvents } = input;
  
  if (derivedEvents.length === 0) return [];

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

    const existingSourceIds = new Set<string>();
    if (existing) {
      for (const row of existing) {
        const meta = row.meta as Record<string, Json> | null;
        if (meta?.source_id && typeof meta.source_id === 'string') {
          existingSourceIds.add(meta.source_id);
        }
        // Also check for derived events by checking if meta.source is 'derived' and matching time ranges
        if (meta?.source === 'derived' && meta?.kind) {
          const start = new Date(row.scheduled_start).getTime();
          const end = new Date(row.scheduled_end).getTime();
          existingSourceIds.add(`derived_${start}_${end}_${meta.kind}`);
        }
      }
    }

    const inserts: Array<Record<string, unknown>> = [];
    const savedEvents: ScheduledEvent[] = [];

    for (const event of derivedEvents) {
      // Skip if this is not a derived event (already saved)
      if (!event.id.startsWith('derived_actual:') && !event.id.startsWith('derived_evidence:')) {
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
      startDate.setHours(Math.floor(event.startMinutes / 60), event.startMinutes % 60, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + event.duration);
      
      const timeRangeKey = `derived_${startDate.getTime()}_${endDate.getTime()}_${event.meta?.kind ?? 'unknown'}`;
      if (existingSourceIds.has(timeRangeKey)) {
        continue;
      }

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

    if (inserts.length === 0) return [];

    if (__DEV__) {
      console.log(`[Supabase] Syncing ${inserts.length} derived actual events for ${ymd}`);
    }

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

    if (__DEV__) {
      console.log(`[Supabase] ✅ Successfully synced ${savedEvents.length} derived actual events`);
    }

    return savedEvents;
  } catch (error) {
    if (__DEV__) {
      console.error('[Supabase] ❌ Error syncing derived actual events:', error);
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}


