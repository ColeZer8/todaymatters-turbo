import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

/**
 * App Mapping - maps an app name to an activity type and distraction flag
 * Used for actual timeline derivation to infer what user was doing based on app usage
 */
export interface AppMapping {
  id: string;
  user_id: string;
  app_name: string;
  activity_type: string;
  is_distraction: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppMappingInsert {
  app_name: string;
  activity_type: string;
  is_distraction?: boolean;
}

export interface AppMappingUpdate {
  app_name?: string;
  activity_type?: string;
  is_distraction?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema('tm');
}

/**
 * Fetch all app mappings for a user
 */
export async function fetchAppMappings(userId: string): Promise<AppMapping[]> {
  try {
    const { data, error } = await tmSchema()
      .from('app_mappings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw handleSupabaseError(error);
    return (data ?? []) as AppMapping[];
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch a single app mapping by ID
 */
export async function fetchAppMappingById(
  userId: string,
  mappingId: string
): Promise<AppMapping | null> {
  try {
    const { data, error } = await tmSchema()
      .from('app_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('id', mappingId)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    return data as AppMapping | null;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch an app mapping by app name (for lookups during derivation)
 */
export async function fetchAppMappingByAppName(
  userId: string,
  appName: string
): Promise<AppMapping | null> {
  try {
    const { data, error } = await tmSchema()
      .from('app_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('app_name', appName)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    return data as AppMapping | null;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch all apps marked as distractions for a user
 */
export async function fetchDistractionApps(
  userId: string
): Promise<AppMapping[]> {
  try {
    const { data, error } = await tmSchema()
      .from('app_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('is_distraction', true)
      .order('app_name', { ascending: true });

    if (error) throw handleSupabaseError(error);
    return (data ?? []) as AppMapping[];
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Create a new app mapping
 */
export async function createAppMapping(
  userId: string,
  input: AppMappingInsert
): Promise<AppMapping> {
  try {
    const { data, error } = await tmSchema()
      .from('app_mappings')
      .insert({
        user_id: userId,
        app_name: input.app_name,
        activity_type: input.activity_type,
        is_distraction: input.is_distraction ?? false,
      })
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);
    return data as AppMapping;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Update an existing app mapping
 */
export async function updateAppMapping(
  userId: string,
  mappingId: string,
  input: AppMappingUpdate
): Promise<AppMapping> {
  try {
    const updatePayload: Record<string, unknown> = {};
    if (input.app_name !== undefined) {
      updatePayload.app_name = input.app_name;
    }
    if (input.activity_type !== undefined) {
      updatePayload.activity_type = input.activity_type;
    }
    if (input.is_distraction !== undefined) {
      updatePayload.is_distraction = input.is_distraction;
    }

    const { data, error } = await tmSchema()
      .from('app_mappings')
      .update(updatePayload)
      .eq('user_id', userId)
      .eq('id', mappingId)
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);
    return data as AppMapping;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Delete an app mapping
 */
export async function deleteAppMapping(
  userId: string,
  mappingId: string
): Promise<void> {
  try {
    const { error } = await tmSchema()
      .from('app_mappings')
      .delete()
      .eq('user_id', userId)
      .eq('id', mappingId);

    if (error) throw handleSupabaseError(error);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Upsert an app mapping (create or update by app name)
 * Useful when user wants to update the activity type for an existing app
 */
export async function upsertAppMapping(
  userId: string,
  input: AppMappingInsert
): Promise<AppMapping> {
  try {
    const { data, error } = await tmSchema()
      .from('app_mappings')
      .upsert(
        {
          user_id: userId,
          app_name: input.app_name,
          activity_type: input.activity_type,
          is_distraction: input.is_distraction ?? false,
        },
        {
          onConflict: 'user_id,app_name',
        }
      )
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);
    return data as AppMapping;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
