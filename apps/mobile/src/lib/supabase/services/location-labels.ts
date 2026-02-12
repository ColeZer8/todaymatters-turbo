/**
 * Location Labels Service
 *
 * Persists user-defined location labels keyed by geohash7.
 * When a user renames a location on the timeline (e.g. "Lifetime Fitness" → "Workout"),
 * we save that preference so it always applies to that geohash location.
 *
 * Under the hood this uses the `tm.user_places` table — the same table the
 * place-labels settings page manages. We bridge via geohash7 so the timeline
 * can quickly look up labels without spatial queries.
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

// ============================================================================
// Geohash Encoding (for client-side fallback)
// ============================================================================

const BASE32_CHARS = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encode lat/lng to a geohash string of the specified precision.
 * This is a simple implementation used when geohash7 isn't available from the
 * data pipeline but we have coordinates.
 * 
 * Exported for use in other modules that need to match geohashes.
 */
export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision: number = 7,
): string {
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLon = true;

  while (hash.length < precision) {
    if (isLon) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) {
        ch |= 1 << (4 - bit);
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    isLon = !isLon;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32_CHARS[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

// ============================================================================
// Types
// ============================================================================

export interface LocationLabelEntry {
  label: string;
  category?: string;
}

// ============================================================================
// In-memory cache
// ============================================================================

/** Cached geohash→label map per user. Cleared on save/delete. */
let cachedUserId: string | null = null;
let cachedLabels: Record<string, LocationLabelEntry> | null = null;

function invalidateCache() {
  if (__DEV__) {
    console.log('🔍 [invalidateCache] Clearing cache. Previous state:', {
      hadUserId: !!cachedUserId,
      hadLabels: !!cachedLabels,
      labelCount: cachedLabels ? Object.keys(cachedLabels).length : 0,
    });
  }
  cachedUserId = null;
  cachedLabels = null;
  if (__DEV__) {
    console.log('✅ [invalidateCache] Cache cleared');
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Save a custom label for a geohash7 location.
 *
 * If a `user_place` row already exists for the same user + geohash7 (stored in
 * the `meta` JSONB column), we update it. Otherwise we insert a new row.
 *
 * The caller should provide `latitude` / `longitude` when available so the
 * spatial `center` column stays accurate (used by the place-matching pipeline).
 *
 * If geohash7 is null or empty but lat/lng are provided, a geohash7 will be
 * computed client-side. This allows saving location labels even when the
 * data pipeline didn't provide a geohash (e.g., segment-based blocks).
 */
export async function saveLocationLabel(
  userId: string,
  geohash7: string | null | undefined,
  customLabel: string,
  options?: {
    category?: string;
    latitude?: number;
    longitude?: number;
    radius_m?: number;
  },
): Promise<void> {
  const category = options?.category ?? null;

  if (__DEV__) {
    console.log('🔍 [saveLocationLabel] CALLED with:', {
      userId: userId?.substring(0, 8) + '...',
      geohash7,
      customLabel,
      category,
      lat: options?.latitude,
      lng: options?.longitude,
      radius_m: options?.radius_m,
    });
  }

  // Compute geohash7 from coordinates if not provided
  let effectiveGeohash7 = geohash7;
  if (
    (!effectiveGeohash7 || effectiveGeohash7.trim() === "") &&
    options?.latitude != null &&
    options?.longitude != null &&
    Number.isFinite(options.latitude) &&
    Number.isFinite(options.longitude)
  ) {
    effectiveGeohash7 = encodeGeohash(options.latitude, options.longitude, 7);
    if (__DEV__) {
      console.log('🔍 [saveLocationLabel] Computed geohash7 from coords:', effectiveGeohash7);
    }
  }

  // If we still don't have a geohash7, we can't save
  if (!effectiveGeohash7) {
    const errorMsg = "Cannot save location label: no geohash7 and no valid coordinates provided";
    if (__DEV__) console.error('❌ [saveLocationLabel]', errorMsg);
    throw new Error(errorMsg);
  }

  try {
    // Check if a user_place already exists for this geohash7
    if (__DEV__) {
      console.log('🔍 [saveLocationLabel] Checking for existing place with geohash7:', effectiveGeohash7);
    }
    
    const { data: existing, error: findError } = await tmSchema()
      .from("user_places")
      .select("id")
      .eq("user_id", userId)
      .eq("geohash7", effectiveGeohash7)
      .maybeSingle();

    if (findError) {
      if (__DEV__) console.error('❌ [saveLocationLabel] Find error:', findError);
      throw handleSupabaseError(findError);
    }

    if (__DEV__) {
      console.log('🔍 [saveLocationLabel] Existing place:', existing ? `Found (id: ${existing.id})` : 'Not found');
    }

    const payload: Record<string, unknown> = {
      user_id: userId,
      label: customLabel,
      category,
      geohash7: effectiveGeohash7,
    };

    if (options?.radius_m != null && Number.isFinite(options.radius_m)) {
      payload.radius_m = options.radius_m;
    }

    // Include spatial center if coordinates were provided
    if (
      options?.latitude != null &&
      options?.longitude != null &&
      Number.isFinite(options.latitude) &&
      Number.isFinite(options.longitude)
    ) {
      payload.center = `POINT(${options.longitude} ${options.latitude})`;
    }

    if (existing?.id) {
      // Update existing row
      if (__DEV__) {
        console.log('🔍 [saveLocationLabel] UPDATING existing place:', payload);
      }
      
      const { error } = await tmSchema()
        .from("user_places")
        .update(payload)
        .eq("id", existing.id);

      if (error) {
        if (__DEV__) console.error('❌ [saveLocationLabel] Update error:', error);
        throw handleSupabaseError(error);
      }
      
      if (__DEV__) {
        console.log('✅ [saveLocationLabel] UPDATE successful');
      }
    } else {
      // Insert new row — radius defaults to 100m in the table default
      if (__DEV__) {
        console.log('🔍 [saveLocationLabel] INSERTING new place:', payload);
      }
      
      const { error } = await tmSchema()
        .from("user_places")
        .insert(payload);

      if (error) {
        if (__DEV__) console.error('❌ [saveLocationLabel] Insert error:', error);
        throw handleSupabaseError(error);
      }
      
      if (__DEV__) {
        console.log('✅ [saveLocationLabel] INSERT successful');
      }
    }

    invalidateCache();
    if (__DEV__) {
      console.log('✅ [saveLocationLabel] Cache invalidated, operation complete');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('❌ [saveLocationLabel] Caught error:', error);
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Get all custom labels for a user, keyed by geohash7.
 *
 * Results are cached in memory — call `invalidateLocationLabelCache()` or
 * any mutating function to bust the cache.
 */
export async function getLocationLabels(
  userId: string,
): Promise<Record<string, LocationLabelEntry>> {
  // Return cached if still valid
  if (cachedUserId === userId && cachedLabels !== null) {
    if (__DEV__) {
      console.log('🔍 [getLocationLabels] Returning CACHED labels:', Object.keys(cachedLabels).length, 'places');
      console.log('🔍 [getLocationLabels] Cached geohash7 keys:', Object.keys(cachedLabels));
    }
    // CRITICAL FIX: Return deep clone to prevent shared reference mutation
    // Without this, all components share the same object and mutations propagate
    return JSON.parse(JSON.stringify(cachedLabels));
  }

  if (__DEV__) {
    console.log('🔍 [getLocationLabels] FETCHING labels for user:', userId?.substring(0, 8) + '...');
  }

  try {
    const { data, error } = await tmSchema()
      .from("user_places")
      .select("geohash7, label, category")
      .eq("user_id", userId)
      .not("geohash7", "is", null);

    if (error) {
      if (__DEV__) console.error('❌ [getLocationLabels] Fetch error:', error);
      throw handleSupabaseError(error);
    }

    if (__DEV__) {
      console.log('🔍 [getLocationLabels] Fetched', data?.length || 0, 'rows from database');
    }

    const map: Record<string, LocationLabelEntry> = {};
    for (const row of data ?? []) {
      const gh = row.geohash7 as string | null;
      if (!gh) continue;
      map[gh] = {
        label: row.label as string,
        ...(row.category ? { category: row.category as string } : {}),
      };
    }

    // Cache
    cachedUserId = userId;
    cachedLabels = map;

    if (__DEV__) {
      console.log('✅ [getLocationLabels] Built label map with', Object.keys(map).length, 'entries');
      console.log('🔍 [getLocationLabels] Map keys (geohash7):', Object.keys(map));
      console.log('🔍 [getLocationLabels] Map values (labels):', Object.values(map).map(v => v.label));
    }

    // CRITICAL FIX: Return deep clone to prevent shared reference mutation
    return JSON.parse(JSON.stringify(map));
  } catch (error) {
    if (__DEV__) {
      console.error('❌ [getLocationLabels] Caught error:', error);
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Get the custom label for a single geohash7.
 * Returns `null` if no label has been set.
 */
export async function getLocationLabel(
  userId: string,
  geohash7: string,
): Promise<LocationLabelEntry | null> {
  try {
    const { data, error } = await tmSchema()
      .from("user_places")
      .select("label, category")
      .eq("user_id", userId)
      .eq("geohash7", geohash7)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    if (!data) return null;

    return {
      label: data.label as string,
      ...(data.category ? { category: data.category as string } : {}),
    };
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Delete the custom label for a geohash7 location.
 * This removes the corresponding `user_places` row.
 */
export async function deleteLocationLabel(
  userId: string,
  geohash7: string,
): Promise<void> {
  try {
    const { error } = await tmSchema()
      .from("user_places")
      .delete()
      .eq("user_id", userId)
      .eq("geohash7", geohash7);

    if (error) throw handleSupabaseError(error);
    invalidateCache();
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Manually bust the in-memory label cache.
 * Useful after bulk operations or when the place-labels settings page saves.
 */
export function invalidateLocationLabelCache(): void {
  invalidateCache();
}
