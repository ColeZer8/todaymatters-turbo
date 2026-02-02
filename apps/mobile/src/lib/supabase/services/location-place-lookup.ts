import { supabase, SUPABASE_URL } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

export interface PlaceLookupPoint {
  latitude: number;
  longitude: number;
}

export interface PlaceLookupResult {
  geohash7: string;
  latitude: number;
  longitude: number;
  placeName: string | null;
  googlePlaceId: string | null;
  vicinity: string | null;
  types: string[] | null;
  source: "cache" | "google_places_nearby" | "none";
  expiresAt: string | null;
}

interface PlaceLookupResponse {
  results: PlaceLookupResult[];
}

const ensuredDayKey = new Set<string>();

interface LocationHourlyLikeRow {
  place_label: string | null;
  google_place_name?: string | null;
  centroid?: unknown;
  centroid_latitude?: number | null;
  centroid_longitude?: number | null;
}

function normalizePoint(value: unknown): PlaceLookupPoint | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const latitude = typeof obj.latitude === "number" ? obj.latitude : null;
  const longitude = typeof obj.longitude === "number" ? obj.longitude : null;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function extractLatLngFromGeoPoint(center: unknown): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!center) return { latitude: null, longitude: null };
  if (typeof center === "string") {
    const match = center.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (match) {
      return { longitude: Number(match[1]), latitude: Number(match[2]) };
    }
    return { latitude: null, longitude: null };
  }
  if (typeof center !== "object") {
    return { latitude: null, longitude: null };
  }
  const geo = center as { type?: string; coordinates?: number[] };
  if (
    geo.type === "Point" &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length >= 2
  ) {
    return { latitude: geo.coordinates[1], longitude: geo.coordinates[0] };
  }
  return { latitude: null, longitude: null };
}

/**
 * Ensure we have Google place names cached for any hourly rows that lack:
 * - user_place match (place_label), AND
 * - google_place_name
 *
 * This is intentionally opportunistic: it runs during evidence fetch, fills cache,
 * and subsequent fetches of `tm.location_hourly` will include `google_place_name`.
 */
export async function ensureGooglePlaceNamesForDay(params: {
  userId: string;
  ymd: string;
  locationHourly: LocationHourlyLikeRow[];
}): Promise<boolean> {
  const { userId, ymd, locationHourly } = params;
  
  // Early return if no userId (user not authenticated)
  if (!userId) {
    if (__DEV__) {
      console.log("[LocationPlaceLookup] Skipping - no userId (user not authenticated)");
    }
    return false;
  }
  
  const dayKey = `${userId}|${ymd}`;
  if (ensuredDayKey.has(dayKey)) return false;

  const points: PlaceLookupPoint[] = [];
  const dedupe = new Set<string>();

  for (const row of locationHourly) {
    if (row.place_label) continue;
    if (row.google_place_name) continue;

    const lat =
      row.centroid_latitude ??
      extractLatLngFromGeoPoint(row.centroid).latitude ??
      null;
    const lng =
      row.centroid_longitude ??
      extractLatLngFromGeoPoint(row.centroid).longitude ??
      null;
    if (lat == null || lng == null) continue;

    // Deduplicate by rounded coordinate to avoid large batches.
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    points.push({ latitude: lat, longitude: lng });

    if (points.length >= 20) break;
  }

  if (points.length === 0) {
    ensuredDayKey.add(dayKey);
    return false;
  }

  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/swift-task`;
    if (__DEV__) {
      console.log("[LocationPlaceLookup] Calling:", functionUrl);
    }

    const { data, error } = await supabase.functions.invoke(
      "swift-task",
      {
        body: { points },
      },
    );

    if (error) throw handleSupabaseError(error);
    const resp = data as Partial<PlaceLookupResponse> | null;
    const results = Array.isArray(resp?.results) ? resp?.results : [];

    // Mark as ensured even if Google returns no results; avoids repeated attempts
    // during the same app session for the same day.
    ensuredDayKey.add(dayKey);
    return results.length > 0;
  } catch (error) {
    if (__DEV__) {
      const functionUrl = `${SUPABASE_URL}/functions/v1/swift-task`;
      console.error("[LocationPlaceLookup] Failed:", {
        error,
        url: functionUrl,
        supabaseUrl: SUPABASE_URL,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    // Don't mark as ensured on error - allow retry on next call
    return false;
  }
}

export function coercePlaceLookupResults(value: unknown): PlaceLookupResult[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  const raw = obj.results;
  if (!Array.isArray(raw)) return [];
  const out: PlaceLookupResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const geohash7 = typeof r.geohash7 === "string" ? r.geohash7 : "";
    const point = normalizePoint(r);
    if (!geohash7 || !point) continue;
    out.push({
      geohash7,
      latitude: point.latitude,
      longitude: point.longitude,
      placeName: typeof r.placeName === "string" ? r.placeName : null,
      googlePlaceId:
        typeof r.googlePlaceId === "string" ? r.googlePlaceId : null,
      vicinity: typeof r.vicinity === "string" ? r.vicinity : null,
      types: Array.isArray(r.types)
        ? r.types.filter((t) => typeof t === "string")
        : null,
      source:
        r.source === "cache" ||
        r.source === "google_places_nearby" ||
        r.source === "none"
          ? r.source
          : "none",
      expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
    });
  }
  return out;
}

