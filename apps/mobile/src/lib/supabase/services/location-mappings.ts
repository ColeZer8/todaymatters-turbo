import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

/**
 * Location Mapping - maps a location address to an activity name
 * Used for actual timeline derivation to infer what user was doing at a location
 */
export interface LocationMapping {
  id: string;
  user_id: string;
  location_address: string;
  activity_name: string;
  created_at: string;
  updated_at: string;
}

export interface LocationMappingInsert {
  location_address: string;
  activity_name: string;
}

export interface LocationMappingUpdate {
  location_address?: string;
  activity_name?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema('tm');
}

/**
 * Fetch all location mappings for a user
 */
export async function fetchLocationMappings(
  userId: string
): Promise<LocationMapping[]> {
  try {
    const { data, error } = await tmSchema()
      .from('location_mappings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw handleSupabaseError(error);
    return (data ?? []) as LocationMapping[];
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch a single location mapping by ID
 */
export async function fetchLocationMappingById(
  userId: string,
  mappingId: string
): Promise<LocationMapping | null> {
  try {
    const { data, error } = await tmSchema()
      .from('location_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('id', mappingId)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    return data as LocationMapping | null;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch a location mapping by address (for lookups during derivation)
 */
export async function fetchLocationMappingByAddress(
  userId: string,
  locationAddress: string
): Promise<LocationMapping | null> {
  try {
    const { data, error } = await tmSchema()
      .from('location_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('location_address', locationAddress)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    return data as LocationMapping | null;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Create a new location mapping
 */
export async function createLocationMapping(
  userId: string,
  input: LocationMappingInsert
): Promise<LocationMapping> {
  try {
    const { data, error } = await tmSchema()
      .from('location_mappings')
      .insert({
        user_id: userId,
        location_address: input.location_address,
        activity_name: input.activity_name,
      })
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);
    return data as LocationMapping;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Update an existing location mapping
 */
export async function updateLocationMapping(
  userId: string,
  mappingId: string,
  input: LocationMappingUpdate
): Promise<LocationMapping> {
  try {
    const updatePayload: Record<string, unknown> = {};
    if (input.location_address !== undefined) {
      updatePayload.location_address = input.location_address;
    }
    if (input.activity_name !== undefined) {
      updatePayload.activity_name = input.activity_name;
    }

    const { data, error } = await tmSchema()
      .from('location_mappings')
      .update(updatePayload)
      .eq('user_id', userId)
      .eq('id', mappingId)
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);
    return data as LocationMapping;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Delete a location mapping
 */
export async function deleteLocationMapping(
  userId: string,
  mappingId: string
): Promise<void> {
  try {
    const { error } = await tmSchema()
      .from('location_mappings')
      .delete()
      .eq('user_id', userId)
      .eq('id', mappingId);

    if (error) throw handleSupabaseError(error);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Upsert a location mapping (create or update by address)
 * Useful when user wants to update the activity for an existing location
 */
export async function upsertLocationMapping(
  userId: string,
  input: LocationMappingInsert
): Promise<LocationMapping> {
  try {
    const { data, error } = await tmSchema()
      .from('location_mappings')
      .upsert(
        {
          user_id: userId,
          location_address: input.location_address,
          activity_name: input.activity_name,
        },
        {
          onConflict: 'user_id,location_address',
        }
      )
      .select('*')
      .single();

    if (error) throw handleSupabaseError(error);
    return data as LocationMapping;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
