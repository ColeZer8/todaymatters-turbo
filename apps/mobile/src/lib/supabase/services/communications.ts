import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { Database } from '../database.types';

export type TmEventRow = Database['tm']['Tables']['events']['Row'];

export interface FetchGmailEmailsOptions {
  limit?: number;
  includeRead?: boolean;
}

/**
 * Fetch Gmail email events for the given user.
 *
 * Source of truth:
 * - `tm.events.type = 'email'`
 * - Unread state is derived from `meta.raw.labelIds` (Gmail label IDs)
 */
export async function fetchGmailEmailEvents(
  userId: string,
  options: FetchGmailEmailsOptions = {}
): Promise<TmEventRow[]> {
  const { limit = 50, includeRead = true } = options;

  try {
    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .select('id,user_id,type,title,meta,created_at,updated_at')
      .eq('user_id', userId)
      .eq('type', 'email')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw handleSupabaseError(error);
    const rows = (data ?? []) as TmEventRow[];

    // Unread filter is client-side (labelIds are nested in JSON, and JSON-path filtering can be brittle across PostgREST versions).
    if (!includeRead) return rows.filter((r) => isGmailUnreadFromMeta(r.meta));

    return rows;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

function isGmailUnreadFromMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const raw = (meta as Record<string, unknown>).raw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const labelIds = (raw as Record<string, unknown>).labelIds;
  if (!Array.isArray(labelIds)) return false;
  return labelIds.some((v) => typeof v === 'string' && v.toUpperCase() === 'UNREAD');
}


