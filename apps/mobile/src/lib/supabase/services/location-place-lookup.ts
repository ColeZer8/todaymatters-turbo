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
  source: "cache" | "google_places_nearby" | "reverse_geocode" | "none";
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
    const functionUrl = `${SUPABASE_URL}/functions/v1/location-place-lookup`;
    
    // Get the current session to debug auth state
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (__DEV__) {
      // Parse the token to see expiration
      let tokenExpiry = "unknown";
      let tokenUserId = "unknown";
      let isExpired = false;
      const token = sessionData?.session?.access_token;
      if (token) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            tokenExpiry = payload.exp ? new Date(payload.exp * 1000).toISOString() : "unknown";
            tokenUserId = payload.sub ?? "unknown";
            isExpired = payload.exp ? payload.exp * 1000 < Date.now() : false;
          }
        } catch {
          tokenExpiry = "parse-error";
        }
      }
      
      console.log("[LocationPlaceLookup] Session state before call:", {
        url: functionUrl,
        hasSession: !!sessionData?.session,
        hasAccessToken: !!token,
        tokenLength: token?.length ?? 0,
        sessionExpiresAt: sessionData?.session?.expires_at 
          ? new Date((sessionData.session.expires_at as number) * 1000).toISOString() 
          : null,
        userId: sessionData?.session?.user?.id ?? null,
        tokenUserId,
        tokenExpiry,
        isExpired,
        sessionError: sessionError?.message ?? null,
      });
      
      // CRITICAL: If token is expired or missing, log a clear warning
      if (!token) {
        console.error("[LocationPlaceLookup] ⚠️ NO ACCESS TOKEN! Function call will likely fail.");
      } else if (isExpired) {
        console.error("[LocationPlaceLookup] ⚠️ TOKEN IS EXPIRED! Function call will likely fail.");
      }
    }

    // Get the access token to pass explicitly (workaround for potential auth header issues)
    const accessToken = sessionData?.session?.access_token;
    
    // Call the function with explicit Authorization header as backup
    const invokeOptions: Parameters<typeof supabase.functions.invoke>[1] = {
      body: { points },
    };
    
    // Explicitly include the Authorization header to ensure it's passed
    if (accessToken) {
      invokeOptions.headers = {
        Authorization: `Bearer ${accessToken}`,
      };
    }
    
    const { data, error } = await supabase.functions.invoke(
      "location-place-lookup",
      invokeOptions,
    );

    if (error) {
      // Enhanced error logging to capture the actual response
      if (__DEV__) {
        console.error("[LocationPlaceLookup] Function error:", {
          name: error.name,
          message: error.message,
          // @ts-expect-error - FunctionsHttpError has context property
          context: error.context,
          // @ts-expect-error - accessing potential response body
          responseBody: typeof error.context?.body === "string" 
            ? error.context.body 
            : JSON.stringify(error.context),
        });
      }
      throw handleSupabaseError(error);
    }
    const resp = data as Partial<PlaceLookupResponse> | null;
    const results = Array.isArray(resp?.results) ? resp?.results : [];

    // Mark as ensured even if Google returns no results; avoids repeated attempts
    // during the same app session for the same day.
    ensuredDayKey.add(dayKey);
    return results.length > 0;
  } catch (error) {
    if (__DEV__) {
      const functionUrl = `${SUPABASE_URL}/functions/v1/location-place-lookup`;
      // Try to get more details about the error
      const errorDetails: Record<string, unknown> = {
        error,
        url: functionUrl,
        supabaseUrl: SUPABASE_URL,
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : "unknown",
      };
      // Check for FunctionsHttpError properties
      if (error && typeof error === "object") {
        const errObj = error as Record<string, unknown>;
        if (errObj.context) errorDetails.context = errObj.context;
        if (errObj.code) errorDetails.code = errObj.code;
        if (errObj.status) errorDetails.status = errObj.status;
      }
      console.error("[LocationPlaceLookup] Failed:", errorDetails);
    }
    // Don't mark as ensured on error - allow retry on next call
    return false;
  }
}

/**
 * Debug function to test the location-place-lookup edge function.
 * Call this from the dev screen to diagnose auth issues.
 * 
 * @returns Debug information about the function call
 */
export async function debugTestLocationPlaceLookup(): Promise<{
  success: boolean;
  sessionInfo: Record<string, unknown>;
  functionResult?: unknown;
  error?: string;
}> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  const token = sessionData?.session?.access_token;
  let tokenInfo: Record<string, unknown> = {};
  
  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        tokenInfo = {
          sub: payload.sub,
          exp: payload.exp,
          iat: payload.iat,
          role: payload.role,
          expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : "unknown",
          isExpired: payload.exp ? payload.exp * 1000 < Date.now() : false,
        };
      }
    } catch {
      tokenInfo = { parseError: true };
    }
  }
  
  const sessionInfo = {
    hasSession: !!sessionData?.session,
    hasAccessToken: !!token,
    tokenLength: token?.length ?? 0,
    sessionExpiresAt: sessionData?.session?.expires_at,
    userId: sessionData?.session?.user?.id ?? null,
    sessionError: sessionError?.message ?? null,
    tokenInfo,
  };
  
  console.log("[LocationPlaceLookup] Debug test - session info:", sessionInfo);
  
  if (!token) {
    return {
      success: false,
      sessionInfo,
      error: "No access token available",
    };
  }
  
  // Test with a simple point (Times Square, NYC)
  const testPoints = [{ latitude: 40.758, longitude: -73.9855 }];
  
  try {
    const { data, error } = await supabase.functions.invoke(
      "location-place-lookup",
      {
        body: { points: testPoints },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    
    if (error) {
      console.error("[LocationPlaceLookup] Debug test - function error:", error);
      return {
        success: false,
        sessionInfo,
        error: `Function error: ${error.message}`,
        functionResult: { errorName: error.name, errorMessage: error.message },
      };
    }
    
    console.log("[LocationPlaceLookup] Debug test - success:", data);
    return {
      success: true,
      sessionInfo,
      functionResult: data,
    };
  } catch (e) {
    console.error("[LocationPlaceLookup] Debug test - exception:", e);
    return {
      success: false,
      sessionInfo,
      error: e instanceof Error ? e.message : String(e),
    };
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
        r.source === "reverse_geocode" ||
        r.source === "none"
          ? r.source
          : "none",
      expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
    });
  }
  return out;
}

