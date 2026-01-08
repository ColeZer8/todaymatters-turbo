import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { Database, Json } from '../database.types';
import type { EventCategory, ScheduledEvent } from '@/stores';

const PLANNED_EVENT_TYPE = 'calendar_planned';
const ACTUAL_EVENT_TYPE = 'calendar_actual';

type TmEventRow = Database['tm']['Tables']['events']['Row'];
type TmEventInsert = Database['tm']['Tables']['events']['Insert'];
type TmEventUpdate = Database['tm']['Tables']['events']['Update'];

export interface PlannedCalendarMeta extends Record<string, Json> {
  category: EventCategory;
  isBig3?: boolean;
  location?: string | null;
  source?: 'user' | 'system';
  plannedEventId?: string;
  kind?: 'sleep_schedule';
  startYmd?: string;
}

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

function parseTimeIsoToHoursMinutes(timeIso: string): { hours: number; minutes: number } {
  const parsed = new Date(timeIso);
  if (Number.isNaN(parsed.getTime())) return { hours: 22, minutes: 30 };
  return { hours: parsed.getHours(), minutes: parsed.getMinutes() };
}

function dateToMinutesFromMidnightLocal(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function rowToScheduledEventForDay(row: TmEventRow, dayStart: Date, dayEnd: Date): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = new Date(row.scheduled_start);
  const end = new Date(row.scheduled_end);
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
  const category = (metaParsed?.category ?? 'work') as EventCategory;
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
  };
}

function rowToScheduledEvent(row: TmEventRow): ScheduledEvent | null {
  if (!row.id) return null;
  if (!row.scheduled_start || !row.scheduled_end) return null;
  const start = new Date(row.scheduled_start);
  const end = new Date(row.scheduled_end);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

  const startMinutes = dateToMinutesFromMidnightLocal(start);
  const duration = Math.max(Math.round((endMs - startMs) / 60_000), 1);
  const meta = row.meta as Json;

  const metaParsed: PlannedCalendarMeta | null = meta && isPlannedCalendarMeta(meta) ? meta : null;
  const category = (metaParsed?.category ?? 'work') as EventCategory;
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

    const { data, error } = await supabase.schema('tm').from('events').insert(insert).select('*').single();
    if (error) throw handleSupabaseError(error);

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

    const { data, error } = await supabase.schema('tm').from('events').insert(insert).select('*').single();
    if (error) throw handleSupabaseError(error);

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


