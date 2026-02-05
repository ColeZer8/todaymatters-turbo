/**
 * Supabase Edge Function: location-place-lookup
 *
 * Resolve lat/lng -> a human-readable place name (prefer business name)
 * using Google Places Nearby Search, with write-through caching in:
 *   tm.location_place_cache (keyed by user_id + geohash7)
 *
 * Input:
 *  {
 *    points: Array<{ latitude: number; longitude: number }>,
 *    radiusMeters?: number,
 *    ttlDays?: number,
 *    forceRefresh?: boolean
 *  }
 *
 * Output:
 *  {
 *    results: Array<{
 *      geohash7: string
 *      latitude: number
 *      longitude: number
 *      placeName: string | null
 *      googlePlaceId: string | null
 *      vicinity: string | null
 *      types: string[] | null
 *      source: "cache" | "google_places_nearby" | "none"
 *      expiresAt: string | null
 *    }>
 *  }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Lazy-computed project root - only used for local dev .env reading
// In deployed Supabase edge runtime, we use Deno.env (secrets)
let _projectRoot: string | null = null;
function getProjectRoot(): string {
  if (_projectRoot !== null) return _projectRoot;
  try {
    if (!import.meta.url.startsWith("file://")) {
      _projectRoot = "";
      return _projectRoot;
    }
    const url = new URL(import.meta.url);
    const parts = url.pathname.split("/");
    parts.pop(); // index.ts
    parts.pop(); // location-place-lookup
    parts.pop(); // functions
    parts.pop(); // supabase
    _projectRoot = parts.join("/") || "/";
  } catch {
    _projectRoot = "";
  }
  return _projectRoot;
}

interface PlaceLookupPoint {
  latitude: number;
  longitude: number;
}

interface PlaceLookupRequest {
  points: PlaceLookupPoint[];
  radiusMeters?: number;
  ttlDays?: number;
  forceRefresh?: boolean;
}

type PlaceLookupSource = "cache" | "google_places_nearby" | "reverse_geocode" | "none";

interface PlaceLookupResult {
  geohash7: string;
  latitude: number;
  longitude: number;
  placeName: string | null;
  googlePlaceId: string | null;
  vicinity: string | null;
  types: string[] | null;
  source: PlaceLookupSource;
  expiresAt: string | null;
}

interface PlaceLookupResponse {
  results: PlaceLookupResult[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Partial<PlaceLookupRequest>;
    const rawPoints = Array.isArray(body?.points) ? body?.points : [];
    const radiusMeters = clampNumber(body?.radiusMeters, 1, 1000, 500);
    const ttlDays = clampNumber(body?.ttlDays, 1, 365, 180);
    const forceRefresh = Boolean(body?.forceRefresh);

    const points = rawPoints
      .map(normalizePoint)
      .filter((p): p is PlaceLookupPoint => p !== null);

    if (points.length === 0) {
      return new Response(JSON.stringify({ results: [] } satisfies PlaceLookupResponse), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const googleApiKeyResult = await getConfigValue("GOOGLE_MAPS_API_KEY");
    const fallbackGoogleApiKeyResult = await getConfigValue("DEV_GOOGLE_MAPS_API_KEY");
    const lowercaseFallbackResult = await getConfigValue("dev_google_maps_api_key");
    const googleApiKey = googleApiKeyResult.value ?? fallbackGoogleApiKeyResult.value ?? lowercaseFallbackResult.value;
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing GOOGLE_MAPS_API_KEY",
          hint:
            "Set Supabase secret GOOGLE_MAPS_API_KEY (Places API enabled). " +
            "DEV_GOOGLE_MAPS_API_KEY is also accepted for dev.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Deduplicate points by rounded coordinates (avoid duplicate lookups for nearby points)
    const uniquePoints = new Map<string, PlaceLookupPoint>();
    for (const p of points) {
      // Round to ~11m precision for deduplication
      const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
      if (!uniquePoints.has(key)) uniquePoints.set(key, p);
    }

    const nowIso = new Date().toISOString();

    // 1) Read fresh cache using RPC for proximity matching (avoids JS/PostgreSQL geohash mismatch)
    // We query cache entries within 150m of each point to match the view's join logic
    const cachedByKey = new Map<
      string,
      {
        place_name: string;
        google_place_id: string | null;
        place_vicinity: string | null;
        place_types: unknown;
        expires_at: string;
        geohash7: string;
      }
    >();

    if (!forceRefresh) {
      // Query all user's cached places and match client-side (simpler than N proximity queries)
      const { data: cachedRows, error: cacheError } = await supabase
        .schema("tm")
        .from("location_place_cache")
        .select("latitude, longitude, geohash7, place_name, google_place_id, place_vicinity, place_types, expires_at")
        .eq("user_id", user.id)
        .gt("expires_at", nowIso);

      if (cacheError) {
        console.error("location-place-lookup: cache read error", cacheError);
      } else {
        // Build a map of cached places by their coordinates
        for (const row of cachedRows ?? []) {
          if (!row?.place_name || !row.expires_at) continue;
          const key = `${Number(row.latitude).toFixed(4)},${Number(row.longitude).toFixed(4)}`;
          cachedByKey.set(key, {
            place_name: row.place_name,
            google_place_id: row.google_place_id ?? null,
            place_vicinity: row.place_vicinity ?? null,
            place_types: row.place_types,
            expires_at: row.expires_at,
            geohash7: row.geohash7 ?? "",
          });
        }
      }
    }

    // 2) For misses, call Google Places Nearby Search + write-through cache.
    const upserts: Array<{
      user_id: string;
      latitude: number;
      longitude: number;
      google_place_id: string | null;
      place_name: string;
      place_vicinity: string | null;
      place_types: unknown;
      fetched_at: string;
      expires_at: string;
      source: string;
    }> = [];

    const resolvedByKey = new Map<string, PlaceLookupResult>();

    for (const [key, p] of uniquePoints.entries()) {
      const cached = cachedByKey.get(key);
      if (cached) {
        resolvedByKey.set(key, {
          geohash7: cached.geohash7,
          latitude: p.latitude,
          longitude: p.longitude,
          placeName: cached.place_name,
          googlePlaceId: cached.google_place_id,
          vicinity: cached.place_vicinity,
          types: coerceStringArray(cached.place_types),
          source: "cache",
          expiresAt: cached.expires_at,
        });
        continue;
      }

      const google = await fetchNearbyPlace({
        apiKey: googleApiKey,
        latitude: p.latitude,
        longitude: p.longitude,
        radiusMeters,
      });

      if (!google) {
        resolvedByKey.set(key, {
          geohash7: "", // Will be computed by PostgreSQL on insert
          latitude: p.latitude,
          longitude: p.longitude,
          placeName: null,
          googlePlaceId: null,
          vicinity: null,
          types: null,
          source: "none",
          expiresAt: null,
        });
        continue;
      }

      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
      const fetchedAt = new Date().toISOString();

      upserts.push({
        user_id: user.id,
        latitude: p.latitude,
        longitude: p.longitude,
        google_place_id: google.placeId,
        place_name: google.name,
        place_vicinity: google.vicinity,
        place_types: google.types,
        fetched_at: fetchedAt,
        expires_at: expiresAt,
        source: google.source,
      });

      // Use JS geohash for the result (will be close enough for display purposes)
      const jsGeohash = encodeGeohash(p.latitude, p.longitude, 7);
      resolvedByKey.set(key, {
        geohash7: jsGeohash,
        latitude: p.latitude,
        longitude: p.longitude,
        placeName: google.name,
        googlePlaceId: google.placeId,
        vicinity: google.vicinity,
        types: Array.isArray(google.types) ? google.types : null,
        source: google.source,
        expiresAt,
      });
    }

    if (upserts.length > 0) {
      // Delete existing rows first, then insert fresh data
      // This avoids the JS/PostgreSQL geohash mismatch issue with upsert
      // We delete by rounded coordinates (same precision used for deduplication)
      for (const row of upserts) {
        const latRounded = Number(row.latitude.toFixed(4));
        const lngRounded = Number(row.longitude.toFixed(4));
        
        // Delete any existing cache entry for this approximate location
        const { error: deleteError } = await supabase
          .schema("tm")
          .from("location_place_cache")
          .delete()
          .eq("user_id", row.user_id)
          .gte("latitude", latRounded - 0.0001)
          .lte("latitude", latRounded + 0.0001)
          .gte("longitude", lngRounded - 0.0001)
          .lte("longitude", lngRounded + 0.0001);
        
        if (deleteError) {
          console.error("location-place-lookup: cache delete error", deleteError);
        }
      }
      
      // Now insert fresh data
      const { error: insertError } = await supabase
        .schema("tm")
        .from("location_place_cache")
        .insert(upserts);

      if (insertError) {
        console.error("location-place-lookup: cache insert error", insertError);
      } else {
        console.log(`location-place-lookup: cached ${upserts.length} new places`);
      }
    }

    const results: PlaceLookupResult[] = [...uniquePoints.keys()].map((key) => {
      const p = uniquePoints.get(key)!;
      return (
        resolvedByKey.get(key) ?? {
          geohash7: "",
          latitude: p.latitude,
          longitude: p.longitude,
          placeName: null,
          googlePlaceId: null,
          vicinity: null,
          types: null,
          source: "none",
          expiresAt: null,
        }
      );
    });

    return new Response(JSON.stringify({ results } satisfies PlaceLookupResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("location-place-lookup: unexpected error", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function coerceStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return out.length > 0 ? out : null;
}

interface PlaceLookupApiResult {
  placeId: string | null;
  name: string;
  vicinity: string | null;
  types: string[] | null;
  source: "google_places_nearby" | "reverse_geocode";
}

async function fetchNearbyPlace(params: {
  apiKey: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): Promise<PlaceLookupApiResult | null> {
  const { apiKey, latitude, longitude, radiusMeters } = params;

  // Using Places API (New) - POST endpoint with JSON body
  const url = "https://places.googleapis.com/v1/places:searchNearby";

  const requestBody = {
    locationRestriction: {
      circle: {
        center: {
          latitude,
          longitude,
        },
        radius: radiusMeters,
      },
    },
    rankPreference: "DISTANCE",
    maxResultCount: 10,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types,places.businessStatus",
    },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Google Places Nearby error:", resp.status, text);
    // Fall back to reverse geocoding
    return fetchReverseGeocode({ apiKey, latitude, longitude });
  }

  const data = (await resp.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      types?: string[];
      businessStatus?: string;
    }>;
    error?: { message?: string };
  };

  if (data.error) {
    console.error("Google Places Nearby error:", data.error.message ?? "Unknown error");
    return fetchReverseGeocode({ apiKey, latitude, longitude });
  }

  const places = Array.isArray(data.places) ? data.places : [];
  
  // If no POI results, fall back to reverse geocoding
  if (places.length === 0) {
    console.log(`No POIs found at ${latitude},${longitude} - falling back to reverse geocoding`);
    return fetchReverseGeocode({ apiKey, latitude, longitude });
  }

  const best =
    places.find((r) => r.businessStatus === "OPERATIONAL" && r.displayName?.text) ??
    places.find((r) => r.displayName?.text) ??
    null;
  
  if (!best?.displayName?.text) {
    return fetchReverseGeocode({ apiKey, latitude, longitude });
  }

  return {
    placeId: typeof best.id === "string" ? best.id : null,
    name: best.displayName.text,
    vicinity: typeof best.formattedAddress === "string" ? best.formattedAddress : null,
    types: Array.isArray(best.types) ? best.types : null,
    source: "google_places_nearby",
  };
}

/**
 * Reverse geocoding fallback - get neighborhood/area name when no POIs found.
 * Returns "Near [Neighborhood]" or "Near [City]" style labels.
 */
async function fetchReverseGeocode(params: {
  apiKey: string;
  latitude: number;
  longitude: number;
}): Promise<PlaceLookupApiResult | null> {
  const { apiKey, latitude, longitude } = params;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${latitude},${longitude}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("result_type", "neighborhood|sublocality|locality");

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      console.error("Reverse geocode HTTP error:", resp.status);
      return null;
    }

    const data = (await resp.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        address_components: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
        formatted_address: string;
      }>;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Reverse geocode error:", data.error_message ?? data.status);
      return null;
    }

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Extract the most useful area name
    let neighborhood: string | null = null;
    let city: string | null = null;

    for (const result of data.results) {
      for (const component of result.address_components) {
        if (
          component.types.includes("neighborhood") ||
          component.types.includes("sublocality_level_1") ||
          component.types.includes("sublocality")
        ) {
          if (!neighborhood) neighborhood = component.long_name;
        }
        if (
          component.types.includes("locality") ||
          component.types.includes("administrative_area_level_3")
        ) {
          if (!city) city = component.long_name;
        }
      }
    }

    const areaName = neighborhood || city;
    if (!areaName) return null;

    return {
      placeId: null,
      name: `Near ${areaName}`,
      vicinity: data.results[0]?.formatted_address ?? null,
      types: ["reverse_geocode_area"],
      source: "reverse_geocode",
    };
  } catch (error) {
    console.error("Reverse geocode exception:", error);
    return null;
  }
}

// Minimal geohash encoder (no deps) for precision 1..12.
// Based on standard base32 alphabet: 0123456789bcdefghjkmnpqrstuvwxyz
function encodeGeohash(latitude: number, longitude: number, precision: number): string {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  let hash = "";
  let bits = 0;
  let ch = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) {
        ch = (ch << 1) + 1;
        lonMin = mid;
      } else {
        ch = (ch << 1) + 0;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch = (ch << 1) + 1;
        latMin = mid;
      } else {
        ch = (ch << 1) + 0;
        latMax = mid;
      }
    }

    even = !even;
    bits++;

    if (bits === 5) {
      hash += base32[ch];
      bits = 0;
      ch = 0;
    }
  }

  return hash;
}

type ConfigSource = "denoEnv" | "dotenvFile" | "missing";

async function getConfigValue(
  key: string,
): Promise<{ value: string | null; source: ConfigSource; path?: string }> {
  const fromEnv = Deno.env.get(key);
  if (fromEnv != null && fromEnv.trim() !== "") {
    return { value: fromEnv, source: "denoEnv" };
  }

  // Local-testing fallback: read from .env files in repo (ignored in git).
  // In deployed edge runtime, PROJECT_ROOT is empty so this is skipped.
  const projectRoot = getProjectRoot();
  if (!projectRoot) {
    return { value: null, source: "missing" };
  }

  const candidates = [
    `${projectRoot}/.env`,
    `${projectRoot}/supabase/.env`,
    `${projectRoot}/apps/mobile/.env`,
  ];

  for (const path of candidates) {
    try {
      const env = await readDotenv(path);
      const val = env[key];
      if (val != null && val.trim() !== "") {
        return { value: val, source: "dotenvFile", path };
      }
    } catch {
      // ignore
    }
  }

  return { value: null, source: "missing" };
}

async function readDotenv(path: string): Promise<Record<string, string>> {
  const text = await Deno.readTextFile(path);
  return parseDotenv(text);
}

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

