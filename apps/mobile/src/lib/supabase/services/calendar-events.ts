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
  source?: 'user';
  plannedEventId?: string;
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

function dateToMinutesFromMidnightLocal(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
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

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
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
      .gte('scheduled_start', startIso)
      .lt('scheduled_start', endIso)
      .order('scheduled_start', { ascending: true });

    if (error) throw handleSupabaseError(error);

    return (data ?? [])
      .map((row) => rowToScheduledEvent(row as TmEventRow))
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
      .gte('scheduled_start', startIso)
      .lt('scheduled_start', endIso)
      .order('scheduled_start', { ascending: true });

    if (error) throw handleSupabaseError(error);

    return (data ?? [])
      .map((row) => rowToScheduledEvent(row as TmEventRow))
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
  scheduledStartIso: string;
  scheduledEndIso: string;
  meta: PlannedCalendarMeta;
}

export async function createPlannedCalendarEvent(input: CreatePlannedCalendarEventInput): Promise<ScheduledEvent> {
  try {
    const insert: TmEventInsert = {
      user_id: input.userId,
      type: PLANNED_EVENT_TYPE,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      scheduled_start: input.scheduledStartIso,
      scheduled_end: input.scheduledEndIso,
      meta: input.meta as unknown as Json,
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
    const insert: TmEventInsert = {
      user_id: input.userId,
      type: ACTUAL_EVENT_TYPE,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      scheduled_start: input.scheduledStartIso,
      scheduled_end: input.scheduledEndIso,
      meta: input.meta as unknown as Json,
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

export interface UpdatePlannedCalendarEventInput {
  eventId: string;
  title?: string;
  description?: string;
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
    if (input.meta) updates.meta = input.meta as unknown as Json;

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


