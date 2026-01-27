import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Json } from "../database.types";

interface LocationSampleRow {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
}

interface UserPlaceRow {
  id: string;
  user_id: string;
  label: string;
  category: string | null;
  category_id: string | null;
  radius_m: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

export async function fetchLocationSamplesForRange(
  userId: string,
  startIso: string,
  endIso: string,
  limit: number = 200,
): Promise<LocationSampleRow[]> {
  try {
    const { data, error } = await tmSchema()
      .from("location_samples")
      .select("latitude, longitude, accuracy_m")
      .eq("user_id", userId)
      .gte("recorded_at", startIso)
      .lt("recorded_at", endIso)
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (error) throw handleSupabaseError(error);
    return (data ?? []) as LocationSampleRow[];
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

function computeCentroid(
  samples: LocationSampleRow[],
): { latitude: number; longitude: number } | null {
  if (samples.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  let sumWeight = 0;
  for (const sample of samples) {
    const accuracy = sample.accuracy_m ?? 50;
    const weight = accuracy > 0 ? 1 / accuracy : 1;
    sumLat += sample.latitude * weight;
    sumLng += sample.longitude * weight;
    sumWeight += weight;
  }
  if (sumWeight === 0) return null;
  return { latitude: sumLat / sumWeight, longitude: sumLng / sumWeight };
}

const USER_PLACE_SELECT = "id, user_id, label, category, category_id, radius_m";

/**
 * Fetch a user place by label (case-insensitive match via exact label).
 * Returns null if no place with that label exists.
 */
export async function fetchUserPlaceByLabel(
  userId: string,
  label: string,
): Promise<UserPlaceRow | null> {
  try {
    const { data, error } = await tmSchema()
      .from("user_places")
      .select(USER_PLACE_SELECT)
      .eq("user_id", userId)
      .eq("label", label)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    return (data as UserPlaceRow) ?? null;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch all user places for a user, ordered by label.
 */
export async function fetchAllUserPlaces(
  userId: string,
): Promise<UserPlaceRow[]> {
  try {
    const { data, error } = await tmSchema()
      .from("user_places")
      .select(USER_PLACE_SELECT)
      .eq("user_id", userId)
      .order("label", { ascending: true });

    if (error) throw handleSupabaseError(error);
    return (data ?? []) as UserPlaceRow[];
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Update a user place's label and/or category.
 */
export async function updateUserPlace(
  placeId: string,
  updates: {
    label?: string;
    category?: string | null;
    category_id?: string | null;
  },
): Promise<UserPlaceRow> {
  try {
    const { data, error } = await tmSchema()
      .from("user_places")
      .update(updates)
      .eq("id", placeId)
      .select(USER_PLACE_SELECT)
      .single();

    if (error) throw handleSupabaseError(error);
    return data as UserPlaceRow;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Delete a user place by ID.
 */
export async function deleteUserPlace(placeId: string): Promise<void> {
  try {
    const { error } = await tmSchema()
      .from("user_places")
      .delete()
      .eq("id", placeId);

    if (error) throw handleSupabaseError(error);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Count events auto-tagged from each user place.
 * Queries actual_events meta->>'autoTaggedFrom' matching place labels.
 */
export async function fetchAutoTagCountsByPlaceLabel(
  userId: string,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await tmSchema()
      .from("actual_events")
      .select("meta")
      .eq("user_id", userId)
      .not("meta", "is", null);

    if (error) throw handleSupabaseError(error);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const meta = row.meta as Record<string, unknown> | null;
      const evidence = meta?.evidence as Record<string, unknown> | null;
      const autoTaggedFrom = evidence?.autoTaggedFrom as string | undefined;
      if (autoTaggedFrom) {
        counts[autoTaggedFrom] = (counts[autoTaggedFrom] ?? 0) + 1;
      }
    }
    return counts;
  } catch (error) {
    // If table doesn't exist yet or query fails, return empty counts
    return {};
  }
}

export async function upsertUserPlaceFromSamples(input: {
  userId: string;
  label: string;
  category?: string | null;
  categoryId?: string | null;
  radiusMeters?: number;
  samples: LocationSampleRow[];
}): Promise<UserPlaceRow> {
  const centroid = computeCentroid(input.samples);
  if (!centroid) {
    throw new Error("Unable to determine location center from samples.");
  }

  const centerGeoJson = {
    type: "Point",
    coordinates: [centroid.longitude, centroid.latitude],
  } as unknown as Json;

  try {
    const existing = await tmSchema()
      .from("user_places")
      .select(USER_PLACE_SELECT)
      .eq("user_id", input.userId)
      .eq("label", input.label)
      .maybeSingle();

    if (existing.error) throw handleSupabaseError(existing.error);

    const payload: Record<string, unknown> = {
      user_id: input.userId,
      label: input.label,
      category: input.category ?? null,
      category_id: input.categoryId ?? null,
      radius_m: input.radiusMeters ?? 150,
      center: centerGeoJson,
    };

    if (existing.data?.id) {
      const { data, error } = await tmSchema()
        .from("user_places")
        .update(payload)
        .eq("id", existing.data.id)
        .select(USER_PLACE_SELECT)
        .single();
      if (error) throw handleSupabaseError(error);
      return data as UserPlaceRow;
    }

    const { data, error } = await tmSchema()
      .from("user_places")
      .insert(payload)
      .select(USER_PLACE_SELECT)
      .single();

    if (error) throw handleSupabaseError(error);
    return data as UserPlaceRow;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
