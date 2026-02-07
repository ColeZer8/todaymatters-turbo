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
  cachedUserId = null;
  cachedLabels = null;
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
 */
export async function saveLocationLabel(
  userId: string,
  geohash7: string,
  customLabel: string,
  options?: {
    category?: string;
    latitude?: number;
    longitude?: number;
  },
): Promise<void> {
  const category = options?.category ?? null;

  try {
    // Check if a user_place already exists for this geohash7
    const { data: existing, error: findError } = await tmSchema()
      .from("user_places")
      .select("id")
      .eq("user_id", userId)
      .eq("geohash7", geohash7)
      .maybeSingle();

    if (findError) throw handleSupabaseError(findError);

    const payload: Record<string, unknown> = {
      user_id: userId,
      label: customLabel,
      category,
      geohash7,
    };

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
      const { error } = await tmSchema()
        .from("user_places")
        .update(payload)
        .eq("id", existing.id);

      if (error) throw handleSupabaseError(error);
    } else {
      // Insert new row — radius defaults to 100m in the table default
      const { error } = await tmSchema()
        .from("user_places")
        .insert(payload);

      if (error) throw handleSupabaseError(error);
    }

    invalidateCache();
  } catch (error) {
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
    return cachedLabels;
  }

  try {
    const { data, error } = await tmSchema()
      .from("user_places")
      .select("geohash7, label, category")
      .eq("user_id", userId)
      .not("geohash7", "is", null);

    if (error) throw handleSupabaseError(error);

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

    return map;
  } catch (error) {
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
