/**
 * Supabase Edge Function: google-places-proxy
 *
 * Secure proxy for Google Places API calls from the mobile app.
 * The client never needs the API key — it stays server-side as a Supabase Secret.
 *
 * Supports two actions:
 *   - "nearby"       → Google Places Nearby Search (New API)
 *   - "autocomplete" → Google Places Autocomplete (Legacy API)
 *
 * Usage from client:
 *   supabase.functions.invoke('google-places-proxy', {
 *     body: { action: 'nearby', latitude: 33.5, longitude: -86.8, radius: 750 }
 *   })
 *
 *   supabase.functions.invoke('google-places-proxy', {
 *     body: { action: 'autocomplete', query: 'Starbucks', latitude: 33.5, longitude: -86.8, sessionToken: 'uuid' }
 *   })
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CORS
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Types
// ============================================================================

interface NearbyRequest {
  action: "nearby";
  latitude: number;
  longitude: number;
  radius?: number; // meters, default 750
}

interface AutocompleteRequest {
  action: "autocomplete";
  query: string;
  latitude?: number | null;
  longitude?: number | null;
  sessionToken?: string;
  radius?: number; // bias radius, default 5000
}

type ProxyRequest = NearbyRequest | AutocompleteRequest;

// Google Places Nearby Search (New API) response
interface GoogleNewNearbyPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  types?: string[];
  businessStatus?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  currentOpeningHours?: { openNow?: boolean };
  primaryType?: string;
}

interface GoogleNewNearbyResponse {
  places?: GoogleNewNearbyPlace[];
  error?: { message?: string; code?: number };
}

// Google Places Autocomplete (Legacy) response
interface GoogleAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types?: string[];
}

interface GoogleAutocompleteResponse {
  status: string;
  error_message?: string;
  predictions?: GoogleAutocompletePrediction[];
}

// Standardised output types returned to client
interface NearbyPlaceResult {
  placeId: string;
  name: string;
  vicinity: string;
  types: string[];
  latitude: number;
  longitude: number;
  distanceM: number;
  rating?: number;
  isOpen?: boolean;
}

interface AutocompletePredictionResult {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
  types: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Types that are too generic — filter these out of nearby results. */
const GENERIC_ONLY_TYPES = new Set([
  "point_of_interest",
  "establishment",
  "premise",
  "subpremise",
  "street_address",
  "route",
  "geocode",
  "political",
  "plus_code",
  "natural_feature",
  "floor",
  "room",
]);

function isJunkResult(types: string[] | null | undefined): boolean {
  if (!types || types.length === 0) return true;
  return types.every((t) => GENERIC_ONLY_TYPES.has(t));
}

/** Priority scoring — prefer consumer-facing destinations. */
const HIGH_PRIORITY_TYPES = new Set([
  "cafe",
  "coffee_shop",
  "restaurant",
  "bar",
  "bakery",
  "food",
  "gym",
  "fitness_center",
  "spa",
  "beauty_salon",
  "hair_care",
  "movie_theater",
  "bowling_alley",
  "night_club",
  "amusement_park",
  "aquarium",
  "art_gallery",
  "casino",
  "zoo",
  "museum",
  "park",
  "shopping_mall",
  "shopping_center",
  "store",
  "supermarket",
  "clothing_store",
  "convenience_store",
  "department_store",
  "electronics_store",
  "book_store",
  "pet_store",
  "pharmacy",
  "hospital",
  "doctor",
  "dentist",
  "veterinary_care",
  "bank",
  "post_office",
  "library",
  "church",
  "school",
  "university",
  "car_wash",
  "gas_station",
  "lodging",
  "airport",
  "train_station",
  "bus_station",
  "transit_station",
]);

const LOW_PRIORITY_TYPES = new Set([
  "lawyer",
  "attorney",
  "law_firm",
  "accountant",
  "accounting",
  "insurance_agency",
  "insurance",
  "real_estate_agency",
  "real_estate",
  "finance",
  "financial_planner",
  "investment",
  "tax_preparer",
  "marketing_agency",
  "employment_agency",
  "corporate_office",
  "consultant",
]);

function getPlacePriorityScore(types: string[] | null | undefined): number {
  if (!types || types.length === 0) return 0;
  if (types.some((t) => LOW_PRIORITY_TYPES.has(t))) return 1;
  if (types.some((t) => HIGH_PRIORITY_TYPES.has(t))) return 3;
  if (types.every((t) => GENERIC_ONLY_TYPES.has(t))) return 0;
  return 2;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ============================================================================
// Nearby Search (Google Places New API — same as location-place-lookup)
// ============================================================================

async function handleNearby(
  apiKey: string,
  req: NearbyRequest
): Promise<Response> {
  const { latitude, longitude } = req;
  const radius = Math.max(50, Math.min(5000, req.radius ?? 750));

  // Validate coordinates
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return errorResponse("Invalid latitude/longitude");
  }

  const url = "https://places.googleapis.com/v1/places:searchNearby";
  const requestBody = {
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius,
      },
    },
    rankPreference: "DISTANCE",
    maxResultCount: 15,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.types,places.businessStatus,places.location,places.rating,places.currentOpeningHours",
    },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(
      `[google-places-proxy] Nearby Search error ${resp.status}:`,
      text
    );
    return errorResponse("Google Places API error", 502);
  }

  const data: GoogleNewNearbyResponse = await resp.json();

  if (data.error) {
    console.error(
      "[google-places-proxy] Nearby Search API error:",
      data.error.message
    );
    return errorResponse(data.error.message ?? "Google API error", 502);
  }

  const places = Array.isArray(data.places) ? data.places : [];

  // Transform, filter junk, sort by priority + distance
  const results: NearbyPlaceResult[] = places
    .filter(
      (p) => p.displayName?.text && !isJunkResult(p.types)
    )
    .map((p) => {
      const placeLat = p.location?.latitude ?? latitude;
      const placeLng = p.location?.longitude ?? longitude;
      const dist = haversineDistance(latitude, longitude, placeLat, placeLng);
      return {
        placeId: p.id ?? "",
        name: p.displayName!.text!,
        vicinity: p.formattedAddress ?? "",
        types: p.types ?? [],
        latitude: placeLat,
        longitude: placeLng,
        distanceM: Math.round(dist),
        rating: p.rating,
        isOpen: p.currentOpeningHours?.openNow,
        _priority: getPlacePriorityScore(p.types),
      };
    })
    .sort((a, b) => {
      if (a._priority !== b._priority) return b._priority - a._priority;
      return a.distanceM - b.distanceM;
    })
    .slice(0, 10)
    .map(({ _priority, ...rest }) => rest); // strip internal field

  console.log(
    `[google-places-proxy] Nearby: ${results.length} results for ${latitude.toFixed(4)},${longitude.toFixed(4)} r=${radius}m`
  );

  return jsonResponse({ results });
}

// ============================================================================
// Autocomplete (Google Places Legacy API — free with session tokens)
// ============================================================================

async function handleAutocomplete(
  apiKey: string,
  req: AutocompleteRequest
): Promise<Response> {
  const { query, sessionToken } = req;

  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return jsonResponse({ predictions: [] });
  }

  const radius = Math.max(1000, Math.min(50000, req.radius ?? 5000));

  const params = new URLSearchParams({
    input: query.trim(),
    key: apiKey,
  });

  if (sessionToken) {
    params.set("sessiontoken", sessionToken);
  }

  // Add location bias if provided
  if (
    req.latitude != null &&
    req.longitude != null &&
    Number.isFinite(req.latitude) &&
    Number.isFinite(req.longitude)
  ) {
    params.set("location", `${req.latitude},${req.longitude}`);
    params.set("radius", radius.toString());
  }

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    const text = await resp.text();
    console.error(
      `[google-places-proxy] Autocomplete error ${resp.status}:`,
      text
    );
    return errorResponse("Google Autocomplete API error", 502);
  }

  const data: GoogleAutocompleteResponse = await resp.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error(
      "[google-places-proxy] Autocomplete status:",
      data.status,
      data.error_message
    );
    return errorResponse(
      data.error_message ?? `Autocomplete status: ${data.status}`,
      502
    );
  }

  const predictions: AutocompletePredictionResult[] = (
    data.predictions ?? []
  ).map((p) => ({
    placeId: p.place_id,
    mainText: p.structured_formatting.main_text,
    secondaryText: p.structured_formatting.secondary_text,
    description: p.description,
    types: p.types ?? [],
  }));

  console.log(
    `[google-places-proxy] Autocomplete: "${query}" → ${predictions.length} predictions`
  );

  return jsonResponse({ predictions });
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse("Invalid or expired token", 401);
    }

    // ---- API Key ----
    const googleApiKey =
      Deno.env.get("GOOGLE_MAPS_API_KEY") ??
      Deno.env.get("DEV_GOOGLE_MAPS_API_KEY") ??
      null;

    if (!googleApiKey) {
      return errorResponse(
        "Missing GOOGLE_MAPS_API_KEY. Set Supabase secret.",
        500
      );
    }

    // ---- Parse body & route ----
    const body = (await req.json()) as Partial<ProxyRequest>;

    if (!body || !body.action) {
      return errorResponse('Missing "action" field. Use "nearby" or "autocomplete".');
    }

    switch (body.action) {
      case "nearby":
        return await handleNearby(googleApiKey, body as NearbyRequest);

      case "autocomplete":
        return await handleAutocomplete(
          googleApiKey,
          body as AutocompleteRequest
        );

      default:
        return errorResponse(
          `Unknown action "${body.action}". Use "nearby" or "autocomplete".`
        );
    }
  } catch (error) {
    console.error("[google-places-proxy] Unexpected error:", error);
    return errorResponse("Internal server error", 500);
  }
});
