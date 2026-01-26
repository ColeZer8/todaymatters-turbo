import type { Database } from '../database.types';
import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

// ---------------------------------------------------------------------------
// Types derived from database schema
// ---------------------------------------------------------------------------

type DailyBig3Table = Database['tm']['Tables']['daily_big3'];

/** A row as returned from Supabase select */
export type DailyBig3 = DailyBig3Table['Row'];

/** Payload for inserting a new Big 3 set */
export type DailyBig3Insert = DailyBig3Table['Insert'];

/** Payload for updating an existing Big 3 set */
export type DailyBig3Update = DailyBig3Table['Update'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema('tm');
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Fetch the Big 3 for a specific date. Returns null if none set. */
export async function fetchBig3ForDate(
  userId: string,
  date: string
): Promise<DailyBig3 | null> {
  const { data, error } = await tmSchema()
    .from('daily_big3')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw handleSupabaseError(error);
  return (data as DailyBig3 | null) ?? null;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Upsert the Big 3 for a specific date.
 * Creates a new row or updates the existing one (unique on user_id + date).
 */
export async function upsertBig3ForDate(
  input: DailyBig3Insert
): Promise<DailyBig3> {
  const { data, error } = await tmSchema()
    .from('daily_big3')
    .upsert(input, { onConflict: 'user_id,date' })
    .select('*')
    .single();

  if (error) throw handleSupabaseError(error);
  return data as DailyBig3;
}

/** Delete the Big 3 for a specific date. */
export async function deleteBig3ForDate(
  userId: string,
  date: string
): Promise<void> {
  const { error } = await tmSchema()
    .from('daily_big3')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);

  if (error) throw handleSupabaseError(error);
}
