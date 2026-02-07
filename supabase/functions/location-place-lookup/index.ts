/**
 * Supabase Edge Function: location-place-lookup
 *
 * Resolve lat/lng -> a human-readable place name (prefer business name)
 * using Google Places Nearby Search, with write-through caching.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface PlaceCandidate {
  placeName: string;
  googlePlaceId: string | null;
  vicinity: string | null;
  types: string[] | null;
  placeLatitude: number | null;
  placeLongitude: number | null;
  distanceMeters: number | null;
}

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
  placeLatitude: number | null;
  placeLongitude: number | null;
  distanceMeters: number | null;
  alternatives: PlaceCandidate[] | null;
}

interface PlaceLookupResponse {
  results: PlaceLookupResult[];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function coerceStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => v.length > 0);
  return out.length > 0 ? out : null;
}

function encodeGeohash(latitude: number, longitude: number, precision: number): string {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latMin = -90.0, latMax = 90.0, lonMin = -180.0, lonMax = 180.0;
  let hash = "", bits = 0, ch = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) { ch = (ch << 1) + 1; lonMin = mid; } else { ch = (ch << 1) + 0; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) { ch = (ch << 1) + 1; latMin = mid; } else { ch = (ch << 1) + 0; latMax = mid; }
    }
    even = !even;
    bits++;
    if (bits === 5) { hash += base32[ch]; bits = 0; ch = 0; }
  }
  return hash;
}

interface PlaceLookupApiResult {
  placeId: string | null;
  name: string;
  vicinity: string | null;
  types: string[] | null;
  source: "google_places_nearby" | "reverse_geocode";
  placeLatitude: number | null;
  placeLongitude: number | null;
  distanceMeters: number | null;
  alternatives: PlaceCandidate[];
}

async function fetchReverseGeocode(params: { apiKey: string; latitude: number; longitude: number }): Promise<PlaceLookupApiResult | null> {
  const { apiKey, latitude, longitude } = params;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${latitude},${longitude}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("result_type", "neighborhood|sublocality|locality");
    const resp = await fetch(url.toString());
    if (!resp.ok) { console.error("Reverse geocode HTTP error:", resp.status); return null; }
    const data = (await resp.json()) as { status: string; error_message?: string; results?: Array<{ address_components: Array<{ long_name: string; short_name: string; types: string[] }>; formatted_address: string }> };
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") { console.error("Reverse geocode error:", data.error_message ?? data.status); return null; }
    if (!data.results || data.results.length === 0) return null;
    let neighborhood: string | null = null, city: string | null = null;
    for (const result of data.results) {
      for (const component of result.address_components) {
        if (component.types.includes("neighborhood") || component.types.includes("sublocality_level_1") || component.types.includes("sublocality")) { if (!neighborhood) neighborhood = component.long_name; }
        if (component.types.includes("locality") || component.types.includes("administrative_area_level_3")) { if (!city) city = component.long_name; }
      }
    }
    const areaName = neighborhood || city;
    if (!areaName) return null;
    return { placeId: null, name: `Near ${areaName}`, vicinity: data.results[0]?.formatted_address ?? null, types: ["reverse_geocode_area"], source: "reverse_geocode", placeLatitude: latitude, placeLongitude: longitude, distanceMeters: 0, alternatives: [] };
  } catch (error) { console.error("Reverse geocode exception:", error); return null; }
}

// Types that indicate a real, recognizable business/POI
const QUALITY_PLACE_TYPES = new Set([
  "cafe", "restaurant", "gym", "bar", "library", "park",
  "shopping_mall", "store", "supermarket", "church", "museum",
  "hospital", "doctor", "pharmacy", "bank", "lodging",
  "university", "school", "airport", "train_station", "bus_station",
  "bakery", "hair_care", "spa", "beauty_salon", "movie_theater",
  "bowling_alley", "night_club", "gas_station", "post_office",
  "fire_station", "police", "courthouse", "veterinary_care",
  "transit_station", "subway_station", "light_rail_station",
  "parking", "car_dealer", "car_rental", "car_repair", "car_wash",
  "clothing_store", "convenience_store", "department_store",
  "electronics_store", "furniture_store", "hardware_store",
  "home_goods_store", "jewelry_store", "pet_store", "shoe_store",
  "amusement_park", "aquarium", "art_gallery", "casino", "zoo",
  "fitness_center", "coffee_shop", "shopping_center",
]);

// Types that are too generic to identify a meaningful place (residential noise)
const GENERIC_ONLY_TYPES = new Set([
  "point_of_interest", "establishment", "premise", "subpremise",
  "street_address", "route", "geocode", "political",
  "plus_code", "natural_feature", "floor", "room",
]);

function isJunkResult(types: string[] | null | undefined): boolean {
  if (!types || types.length === 0) return true;
  if (types.some((t) => QUALITY_PLACE_TYPES.has(t))) return false;
  return types.every((t) => GENERIC_ONLY_TYPES.has(t));
}

async function fetchNearbyPlace(params: { apiKey: string; latitude: number; longitude: number; radiusMeters: number }): Promise<PlaceLookupApiResult | null> {
  const { apiKey, latitude, longitude, radiusMeters } = params;
  const url = "https://places.googleapis.com/v1/places:searchNearby";
  const requestBody = { locationRestriction: { circle: { center: { latitude, longitude }, radius: radiusMeters } }, rankPreference: "DISTANCE", maxResultCount: 10 };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types,places.businessStatus,places.location" },
    body: JSON.stringify(requestBody),
  });
  if (!resp.ok) { const text = await resp.text(); console.error("Google Places Nearby error:", resp.status, text); return fetchReverseGeocode({ apiKey, latitude, longitude }); }
  const data = (await resp.json()) as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; types?: string[]; businessStatus?: string; location?: { latitude?: number; longitude?: number } }>; error?: { message?: string } };
  if (data.error) { console.error("Google Places Nearby error:", data.error.message ?? "Unknown error"); return fetchReverseGeocode({ apiKey, latitude, longitude }); }
  const places = Array.isArray(data.places) ? data.places : [];
  if (places.length === 0) { console.log(`No POIs found at ${latitude},${longitude} - falling back to reverse geocoding`); return fetchReverseGeocode({ apiKey, latitude, longitude }); }
  
  const placesWithDistance = places.filter((r) => r.displayName?.text && !isJunkResult(r.types)).map((r) => {
    const placeLat = r.location?.latitude ?? null;
    const placeLng = r.location?.longitude ?? null;
    const distance = (placeLat != null && placeLng != null) ? haversineDistance(latitude, longitude, placeLat, placeLng) : Infinity;
    return { place: r, distance, placeLat, placeLng };
  }).sort((a, b) => a.distance - b.distance);

  const bestEntry = placesWithDistance.find((p) => p.place.businessStatus === "OPERATIONAL") ?? placesWithDistance[0] ?? null;
  if (!bestEntry?.place?.displayName?.text) return fetchReverseGeocode({ apiKey, latitude, longitude });
  const best = bestEntry.place;
  
  const alternatives: PlaceCandidate[] = placesWithDistance.filter((p) => p.place.id !== best.id).slice(0, 4).map((p) => ({
    placeName: p.place.displayName?.text ?? "",
    googlePlaceId: typeof p.place.id === "string" ? p.place.id : null,
    vicinity: typeof p.place.formattedAddress === "string" ? p.place.formattedAddress : null,
    types: Array.isArray(p.place.types) ? p.place.types : null,
    placeLatitude: p.placeLat,
    placeLongitude: p.placeLng,
    distanceMeters: p.distance === Infinity ? null : Math.round(p.distance),
  }));

  console.log(`[location-place-lookup] Picked "${best.displayName?.text}" at ${Math.round(bestEntry.distance)}m (${alternatives.length} alternatives within ${radiusMeters}m)`);
  return {
    placeId: typeof best.id === "string" ? best.id : null,
    name: best.displayName.text,
    vicinity: typeof best.formattedAddress === "string" ? best.formattedAddress : null,
    types: Array.isArray(best.types) ? best.types : null,
    source: "google_places_nearby",
    placeLatitude: bestEntry.placeLat,
    placeLongitude: bestEntry.placeLng,
    distanceMeters: bestEntry.distance === Infinity ? null : Math.round(bestEntry.distance),
    alternatives,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = (await req.json()) as Partial<PlaceLookupRequest>;
    const rawPoints = Array.isArray(body?.points) ? body?.points : [];
    const radiusMeters = clampNumber(body?.radiusMeters, 1, 1000, 500);
    const ttlDays = clampNumber(body?.ttlDays, 1, 365, 180);
    const forceRefresh = Boolean(body?.forceRefresh);
    const points = rawPoints.map(normalizePoint).filter((p): p is PlaceLookupPoint => p !== null);
    if (points.length === 0) return new Response(JSON.stringify({ results: [] } satisfies PlaceLookupResponse), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? Deno.env.get("DEV_GOOGLE_MAPS_API_KEY") ?? null;
    if (!googleApiKey) return new Response(JSON.stringify({ error: "Missing GOOGLE_MAPS_API_KEY", hint: "Set Supabase secret GOOGLE_MAPS_API_KEY (Places API enabled)." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const uniquePoints = new Map<string, PlaceLookupPoint>();
    for (const p of points) { const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`; if (!uniquePoints.has(key)) uniquePoints.set(key, p); }

    const nowIso = new Date().toISOString();
    const cachedByKey = new Map<string, { place_name: string; google_place_id: string | null; place_vicinity: string | null; place_types: unknown; expires_at: string; geohash7: string }>();

    if (!forceRefresh) {
      const { data: cachedRows, error: cacheError } = await supabase.schema("tm").from("location_place_cache").select("latitude, longitude, geohash7, place_name, google_place_id, place_vicinity, place_types, expires_at").eq("user_id", user.id).gt("expires_at", nowIso);
      if (cacheError) console.error("location-place-lookup: cache read error", cacheError);
      else for (const row of cachedRows ?? []) { if (!row?.place_name || !row.expires_at) continue; const key = `${Number(row.latitude).toFixed(4)},${Number(row.longitude).toFixed(4)}`; cachedByKey.set(key, { place_name: row.place_name, google_place_id: row.google_place_id ?? null, place_vicinity: row.place_vicinity ?? null, place_types: row.place_types, expires_at: row.expires_at, geohash7: row.geohash7 ?? "" }); }
    }

    const upserts: Array<{ user_id: string; latitude: number; longitude: number; google_place_id: string | null; place_name: string; place_vicinity: string | null; place_types: unknown; fetched_at: string; expires_at: string; source: string }> = [];
    const resolvedByKey = new Map<string, PlaceLookupResult>();

    for (const [key, p] of uniquePoints.entries()) {
      const cached = cachedByKey.get(key);
      if (cached) {
        resolvedByKey.set(key, { geohash7: cached.geohash7, latitude: p.latitude, longitude: p.longitude, placeName: cached.place_name, googlePlaceId: cached.google_place_id, vicinity: cached.place_vicinity, types: coerceStringArray(cached.place_types), source: "cache", expiresAt: cached.expires_at, placeLatitude: null, placeLongitude: null, distanceMeters: null, alternatives: null });
        continue;
      }
      const google = await fetchNearbyPlace({ apiKey: googleApiKey, latitude: p.latitude, longitude: p.longitude, radiusMeters });
      if (!google) { resolvedByKey.set(key, { geohash7: "", latitude: p.latitude, longitude: p.longitude, placeName: null, googlePlaceId: null, vicinity: null, types: null, source: "none", expiresAt: null, placeLatitude: null, placeLongitude: null, distanceMeters: null, alternatives: null }); continue; }
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
      const fetchedAt = new Date().toISOString();
      upserts.push({ user_id: user.id, latitude: p.latitude, longitude: p.longitude, google_place_id: google.placeId, place_name: google.name, place_vicinity: google.vicinity, place_types: google.types, fetched_at: fetchedAt, expires_at: expiresAt, source: google.source });
      const jsGeohash = encodeGeohash(p.latitude, p.longitude, 7);
      resolvedByKey.set(key, { geohash7: jsGeohash, latitude: p.latitude, longitude: p.longitude, placeName: google.name, googlePlaceId: google.placeId, vicinity: google.vicinity, types: Array.isArray(google.types) ? google.types : null, source: google.source, expiresAt, placeLatitude: google.placeLatitude, placeLongitude: google.placeLongitude, distanceMeters: google.distanceMeters, alternatives: google.alternatives.length > 0 ? google.alternatives : null });
    }

    if (upserts.length > 0) {
      for (const row of upserts) {
        const latRounded = Number(row.latitude.toFixed(4)), lngRounded = Number(row.longitude.toFixed(4));
        const { error: deleteError } = await supabase.schema("tm").from("location_place_cache").delete().eq("user_id", row.user_id).gte("latitude", latRounded - 0.0001).lte("latitude", latRounded + 0.0001).gte("longitude", lngRounded - 0.0001).lte("longitude", lngRounded + 0.0001);
        if (deleteError) console.error("location-place-lookup: cache delete error", deleteError);
      }
      const { error: insertError } = await supabase.schema("tm").from("location_place_cache").insert(upserts);
      if (insertError) console.error("location-place-lookup: cache insert error", insertError);
      else console.log(`location-place-lookup: cached ${upserts.length} new places`);
    }

    const results: PlaceLookupResult[] = [...uniquePoints.keys()].map((key) => {
      const p = uniquePoints.get(key)!;
      return resolvedByKey.get(key) ?? { geohash7: "", latitude: p.latitude, longitude: p.longitude, placeName: null, googlePlaceId: null, vicinity: null, types: null, source: "none", expiresAt: null, placeLatitude: null, placeLongitude: null, distanceMeters: null, alternatives: null };
    });

    return new Response(JSON.stringify({ results } satisfies PlaceLookupResponse), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("location-place-lookup: unexpected error", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
