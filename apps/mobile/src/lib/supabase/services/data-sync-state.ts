import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { Json } from '../database.types';

export type DataSyncDataset = 'health' | 'screen_time';
export type DataSyncPlatform = 'ios' | 'android';

export interface DataSyncState {
  userId: string;
  dataset: DataSyncDataset;
  platform: DataSyncPlatform;
  provider: string;
  oldestSyncedLocalDate: string | null;
  newestSyncedLocalDate: string | null;
  cursor: Json;
  lastSyncStartedAt: string | null;
  lastSyncFinishedAt: string | null;
  lastSyncStatus: 'ok' | 'partial' | 'error' | null;
  lastSyncError: string | null;
}

export interface DataSyncStateUpdate {
  userId: string;
  dataset: DataSyncDataset;
  platform: DataSyncPlatform;
  provider: string;
  oldestSyncedLocalDate?: string | null;
  newestSyncedLocalDate?: string | null;
  cursor?: Json;
  lastSyncStartedAt?: string | null;
  lastSyncFinishedAt?: string | null;
  lastSyncStatus?: 'ok' | 'partial' | 'error' | null;
  lastSyncError?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema('tm');
}

function rowToDataSyncState(row: Record<string, unknown>): DataSyncState {
  return {
    userId: String(row.user_id),
    dataset: row.dataset as DataSyncDataset,
    platform: row.platform as DataSyncPlatform,
    provider: String(row.provider),
    oldestSyncedLocalDate: typeof row.oldest_synced_local_date === 'string' ? row.oldest_synced_local_date : null,
    newestSyncedLocalDate: typeof row.newest_synced_local_date === 'string' ? row.newest_synced_local_date : null,
    cursor: (row.cursor ?? {}) as Json,
    lastSyncStartedAt: typeof row.last_sync_started_at === 'string' ? row.last_sync_started_at : null,
    lastSyncFinishedAt: typeof row.last_sync_finished_at === 'string' ? row.last_sync_finished_at : null,
    lastSyncStatus:
      row.last_sync_status === 'ok' || row.last_sync_status === 'partial' || row.last_sync_status === 'error'
        ? row.last_sync_status
        : null,
    lastSyncError: typeof row.last_sync_error === 'string' ? row.last_sync_error : null,
  };
}

export async function fetchDataSyncState(
  userId: string,
  dataset: DataSyncDataset,
  platform: DataSyncPlatform,
  provider: string
): Promise<DataSyncState | null> {
  try {
    const { data, error } = await tmSchema()
      .from('data_sync_state')
      .select('*')
      .eq('user_id', userId)
      .eq('dataset', dataset)
      .eq('platform', platform)
      .eq('provider', provider)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    if (!data) return null;
    return rowToDataSyncState(data as Record<string, unknown>);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function upsertDataSyncState(update: DataSyncStateUpdate): Promise<DataSyncState> {
  try {
    const payload: Record<string, unknown> = {
      user_id: update.userId,
      dataset: update.dataset,
      platform: update.platform,
      provider: update.provider,
    };

    if (update.oldestSyncedLocalDate !== undefined) payload.oldest_synced_local_date = update.oldestSyncedLocalDate;
    if (update.newestSyncedLocalDate !== undefined) payload.newest_synced_local_date = update.newestSyncedLocalDate;
    if (update.cursor !== undefined) payload.cursor = update.cursor;
    if (update.lastSyncStartedAt !== undefined) payload.last_sync_started_at = update.lastSyncStartedAt;
    if (update.lastSyncFinishedAt !== undefined) payload.last_sync_finished_at = update.lastSyncFinishedAt;
    if (update.lastSyncStatus !== undefined) payload.last_sync_status = update.lastSyncStatus;
    if (update.lastSyncError !== undefined) payload.last_sync_error = update.lastSyncError;

    const { data, error } = await tmSchema()
      .from('data_sync_state')
      .upsert(payload, { onConflict: 'user_id,dataset,platform,provider' })
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);
    return rowToDataSyncState(data as Record<string, unknown>);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
