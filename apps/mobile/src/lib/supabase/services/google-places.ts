/**
 * Google Places API Service
 *
 * Provides place suggestions for unknown locations using Google Places Nearby Search API.
 * Includes 15-minute TTL caching to reduce API calls.
 *
 * Usage:
 *   import { fetchNearbyPlaces, GooglePlaceSuggestion } from './google-places';
 *   const suggestions = await fetchNearbyPlaces(lat, lng);
 */

import appConfig from "@/lib/config";
import { supabase } from "../client";

// ============================================================================
// Types
// ============================================================================

/** A place suggestion from Google Places API */
export interface GooglePlaceSuggestion {
  /** Google Place ID */
  placeId: string;
  /** Display name of the place */
  name: string;
  /** Address or vicinity */
  vicinity: string;
  /** Place types (e.g., "cafe", "restaurant", "gym") */
  types: string[];
  /** Distance in meters from query location */
  distanceM: number;
  /** Latitude of the place */
  latitude: number;
  /** Longitude of the place */
  longitude: number;
  /** Rating (0-5) if available */
  rating?: number;
  /** Whether the place is currently open */
  isOpen?: boolean;
  /** Icon URL for the place type */
  iconUrl?: string;
}

/** Result from a nearby places search */
export interface NearbyPlacesResult {
  /** Whether the search was successful */
  success: boolean;
  /** Error message if search failed */
  error?: string;
  /** Whether the result came from cache */
  fromCache: boolean;
  /** Place suggestions */
  suggestions: GooglePlaceSuggestion[];
}

/** A place autocomplete prediction */
export interface PlaceAutocompletePrediction {
  /** Google Place ID */
  placeId: string;
  /** Primary text — usually the business/place name */
  mainText: string;
  /** Secondary text — usually the address */
  secondaryText: string;
  /** Full description (main + secondary combined) */
  description: string;
  /** Google place types */
  types: string[];
  /** Distance from search origin (if available from Place Details) */
  distanceM?: number;
}

// Google Places Autocomplete API response types
interface AutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types?: string[];
}

interface AutocompleteResponse {
  status: string;
  error_message?: string;
  predictions?: AutocompletePrediction[];
}

/** Cached entry for a location query */
interface CacheEntry {
  /** Cached suggestions */
  suggestions: GooglePlaceSuggestion[];
  /** Timestamp when cached */
  cachedAt: number;
  /** Cache key (lat,lng rounded) */
  key: string;
}

// Google Places API nearby search response types
interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  types?: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  opening_hours?: {
    open_now?: boolean;
  };
  icon?: string;
}

interface GooglePlacesResponse {
  status: string;
  error_message?: string;
  results?: GooglePlaceResult[];
}

// ============================================================================
// Configuration
// ============================================================================

/** Cache TTL in milliseconds (15 minutes) */
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Default search radius in meters (750m covers walking distance) */
const SEARCH_RADIUS_M = 750;

/** Maximum number of suggestions to return */
const MAX_SUGGESTIONS = 10;

/** Coordinate precision for cache keys (4 decimal places = ~11m precision) */
const CACHE_PRECISION = 4;

/** Place types to prioritize (order matters) */
const PRIORITY_TYPES = [
  "cafe",
  "restaurant",
  "gym",
  "bar",
  "library",
  "park",
  "shopping_mall",
  "store",
  "supermarket",
  "church",
  "museum",
  "hospital",
  "doctor",
  "pharmacy",
  "bank",
  "lodging",
  "university",
  "school",
  "airport",
  "train_station",
  "bus_station",
];

// ============================================================================
// Cache
// ============================================================================

/** In-memory cache for place suggestions */
const placesCache = new Map<string, CacheEntry>();

/**
 * Generate a cache key from coordinates.
 * Rounds to CACHE_PRECISION decimal places for grouping nearby queries.
 */
function getCacheKey(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(CACHE_PRECISION);
  const lng = longitude.toFixed(CACHE_PRECISION);
  return `${lat},${lng}`;
}

/**
 * Get cached suggestions if available and not expired.
 */
function getCachedSuggestions(
  latitude: number,
  longitude: number
): GooglePlaceSuggestion[] | null {
  const key = getCacheKey(latitude, longitude);
  const entry = placesCache.get(key);

  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    placesCache.delete(key);
    return null;
  }

  return entry.suggestions;
}

/**
 * Cache suggestions for a location.
 */
function cacheSuggestions(
  latitude: number,
  longitude: number,
  suggestions: GooglePlaceSuggestion[]
): void {
  const key = getCacheKey(latitude, longitude);
  placesCache.set(key, {
    suggestions,
    cachedAt: Date.now(),
    key,
  });
}

/**
 * Clear expired cache entries.
 * Called periodically to prevent memory growth.
 */
export function clearExpiredCache(): number {
  const now = Date.now();
  let cleared = 0;

  for (const [key, entry] of placesCache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      placesCache.delete(key);
      cleared++;
    }
  }

  return cleared;
}

/**
 * Clear all cached entries.
 */
export function clearAllCache(): void {
  placesCache.clear();
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): {
  size: number;
  oldestEntryAge: number | null;
} {
  let oldestAge: number | null = null;
  const now = Date.now();

  for (const entry of placesCache.values()) {
    const age = now - entry.cachedAt;
    if (oldestAge === null || age > oldestAge) {
      oldestAge = age;
    }
  }

  return {
    size: placesCache.size,
    oldestEntryAge: oldestAge,
  };
}

// ============================================================================
// Distance Calculation
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula.
 * Returns distance in meters.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// API Key Access
// ============================================================================

// Types that are too generic to identify a meaningful place (residential noise)
const GENERIC_ONLY_TYPES = new Set([
  "point_of_interest", "establishment", "premise", "subpremise",
  "street_address", "route", "geocode", "political",
  "plus_code", "natural_feature", "floor", "room",
]);

/**
 * Check if a Google Places result is "junk" — a generic listing with no
 * recognizable business type (e.g., a random home business in a neighborhood).
 * Returns true if ALL types are generic-only and none match PRIORITY_TYPES.
 */
function isJunkResult(types: string[]): boolean {
  if (types.length === 0) return true;
  // If any type is in our priority list, it's a real POI
  if (types.some((t) => PRIORITY_TYPES.includes(t))) return false;
  // If all types are generic-only, it's junk
  return types.every((t) => GENERIC_ONLY_TYPES.has(t));
}

/**
 * Get the Google Places API key from environment.
 * Returns null if not configured.
 */
function getGooglePlacesApiKey(): string | null {
  // Try Expo config extra first
  const config = appConfig as unknown as {
    googlePlacesApiKey?: string;
  };
  if (config.googlePlacesApiKey) {
    return config.googlePlacesApiKey;
  }

  // Try process.env fallback
  try {
    // eslint-disable-next-line no-undef
    const envKey =
      typeof process !== "undefined"
        ? (process.env as Record<string, string | undefined>)[
            "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY"
          ]
        : undefined;
    if (envKey) {
      return envKey;
    }
  } catch {
    // Ignore env access errors
  }

  return null;
}

// ============================================================================
// Main API Functions
// ============================================================================

/**
 * Fetch nearby places from Google Places API.
 *
 * @param latitude - Latitude of the location
 * @param longitude - Longitude of the location
 * @param radiusM - Search radius in meters (default: 100m)
 * @returns NearbyPlacesResult with suggestions or error
 */
export async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
  radiusM: number = SEARCH_RADIUS_M
): Promise<NearbyPlacesResult> {
  // Check cache first
  const cached = getCachedSuggestions(latitude, longitude);
  if (cached !== null) {
    return {
      success: true,
      fromCache: true,
      suggestions: cached,
    };
  }

  // Get API key
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "Google Places API key not configured",
      fromCache: false,
      suggestions: [],
    };
  }

  try {
    // Build API URL
    const params = new URLSearchParams({
      location: `${latitude},${longitude}`,
      radius: radiusM.toString(),
      key: apiKey,
    });
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;

    // Fetch from API
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: GooglePlacesResponse = await response.json();

    // Handle API errors
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(data.error_message || `API status: ${data.status}`);
    }

    // Transform results to suggestions
    const results = data.results || [];
    const suggestions = results
      .map((place): GooglePlaceSuggestion => {
        const distance = haversineDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng
        );

        return {
          placeId: place.place_id,
          name: place.name,
          vicinity: place.vicinity || "",
          types: place.types || [],
          distanceM: Math.round(distance),
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating,
          isOpen: place.opening_hours?.open_now,
          iconUrl: place.icon,
        };
      })
      // Filter out junk results (generic residential listings)
      .filter((s) => !isJunkResult(s.types))
      // Sort by priority type first, then by distance
      .sort((a, b) => {
        const aPriority = getPriorityScore(a.types);
        const bPriority = getPriorityScore(b.types);
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        return a.distanceM - b.distanceM;
      })
      // Take top suggestions
      .slice(0, MAX_SUGGESTIONS);

    // Cache results
    cacheSuggestions(latitude, longitude, suggestions);

    return {
      success: true,
      fromCache: false,
      suggestions,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error fetching places";

    if (__DEV__) {
      console.warn("[GooglePlaces] Fetch error:", message);
    }

    return {
      success: false,
      error: message,
      fromCache: false,
      suggestions: [],
    };
  }
}

/**
 * Get a priority score for a place based on its types.
 * Higher score = more likely to be useful for user.
 */
function getPriorityScore(types: string[]): number {
  for (let i = 0; i < PRIORITY_TYPES.length; i++) {
    if (types.includes(PRIORITY_TYPES[i])) {
      return PRIORITY_TYPES.length - i; // Higher priority types get higher scores
    }
  }
  return 0;
}

/**
 * Get a user-friendly place type label from Google Places types.
 */
export function getPlaceTypeLabel(types: string[]): string {
  // Map Google types to friendly labels
  const typeLabels: Record<string, string> = {
    cafe: "Cafe",
    restaurant: "Restaurant",
    gym: "Gym",
    bar: "Bar",
    library: "Library",
    park: "Park",
    shopping_mall: "Mall",
    store: "Store",
    supermarket: "Supermarket",
    church: "Church",
    museum: "Museum",
    hospital: "Hospital",
    doctor: "Doctor",
    pharmacy: "Pharmacy",
    bank: "Bank",
    lodging: "Hotel",
    university: "University",
    school: "School",
    airport: "Airport",
    train_station: "Train Station",
    bus_station: "Bus Station",
    bakery: "Bakery",
    hair_care: "Salon",
    spa: "Spa",
    beauty_salon: "Salon",
    movie_theater: "Movie Theater",
    bowling_alley: "Bowling",
    night_club: "Night Club",
    laundry: "Laundry",
    car_wash: "Car Wash",
    gas_station: "Gas Station",
    parking: "Parking",
    post_office: "Post Office",
    courthouse: "Courthouse",
    police: "Police Station",
    fire_station: "Fire Station",
    veterinary_care: "Vet",
    pet_store: "Pet Store",
    florist: "Florist",
  };

  for (const type of types) {
    if (typeLabels[type]) {
      return typeLabels[type];
    }
  }

  // If no match, try to format the first type
  if (types.length > 0 && types[0] !== "point_of_interest" && types[0] !== "establishment") {
    return types[0]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return "Place";
}

/**
 * Map Google Place types to user place categories.
 */
export function mapPlaceTypeToCategory(
  types: string[]
): "home" | "work" | "gym" | "cafe" | "restaurant" | "other" {
  // Check for specific types
  if (types.includes("gym") || types.includes("fitness_center")) {
    return "gym";
  }
  if (types.includes("cafe") || types.includes("coffee_shop")) {
    return "cafe";
  }
  if (
    types.includes("restaurant") ||
    types.includes("bakery") ||
    types.includes("food")
  ) {
    return "restaurant";
  }
  // Work-related types
  if (
    types.includes("office") ||
    types.includes("accounting") ||
    types.includes("lawyer") ||
    types.includes("real_estate_agency")
  ) {
    return "work";
  }

  return "other";
}

/**
 * Get the best suggestion from a list based on type preferences.
 * Used for auto-suggest "Are you at X?" prompts.
 */
export function getBestSuggestion(
  suggestions: GooglePlaceSuggestion[]
): GooglePlaceSuggestion | null {
  if (suggestions.length === 0) return null;

  // The suggestions are already sorted by priority and distance
  // Return the first one as the best suggestion
  return suggestions[0];
}

/**
 * Check if Google Places API is available (API key configured).
 */
export function isGooglePlacesAvailable(): boolean {
  return getGooglePlacesApiKey() !== null;
}

/**
 * Get the Google API key for use in Static Maps URLs, etc.
 * Returns null if not configured.
 */
export function getGoogleApiKey(): string | null {
  return getGooglePlacesApiKey();
}

// ============================================================================
// Reverse Geocoding
// ============================================================================

/** Result from reverse geocoding lookup */
export interface ReverseGeocodeResult {
  /** Whether the lookup was successful */
  success: boolean;
  /** Error message if lookup failed */
  error?: string;
  /** Whether the result came from cache */
  fromCache: boolean;
  /** Formatted area name (e.g., "Downtown", "Mission District", "Santa Monica") */
  areaName: string | null;
  /** City name */
  city: string | null;
  /** Neighborhood name if available */
  neighborhood: string | null;
  /** Street name if available (e.g., "Oak Street", "Elm Avenue") */
  streetName: string | null;
}

/** Google Geocoding API response types */
interface GoogleGeocodingAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodingResult {
  address_components: GoogleGeocodingAddressComponent[];
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
    location_type: string;
  };
  types: string[];
}

interface GoogleGeocodingResponse {
  status: string;
  error_message?: string;
  results?: GoogleGeocodingResult[];
}

/** In-memory cache for reverse geocoding results */
const reverseGeocodeCache = new Map<string, { result: ReverseGeocodeResult; cachedAt: number }>();

/**
 * Reverse geocode coordinates to get an area/neighborhood name.
 * Returns a fuzzy "Near [Area]" label for use when location confidence is low.
 *
 * @param latitude - Latitude of the location
 * @param longitude - Longitude of the location
 * @returns ReverseGeocodeResult with area information
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  // Check cache first (use same precision as places cache)
  const cacheKey = getCacheKey(latitude, longitude);
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.result, fromCache: true };
  }

  // Get API key
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "Google API key not configured",
      fromCache: false,
      areaName: null,
      city: null,
      neighborhood: null,
      streetName: null,
    };
  }

  try {
    // Build API URL for reverse geocoding
    // No result_type filter — let Google return all detail levels so we can
    // extract street names (route), neighborhoods, and cities from a single call.
    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      key: apiKey,
    });
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;

    // Fetch from API
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: GoogleGeocodingResponse = await response.json();

    // Handle API errors
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(data.error_message || `API status: ${data.status}`);
    }

    // Parse results to find area name, street name, and neighborhood
    let areaName: string | null = null;
    let city: string | null = null;
    let neighborhood: string | null = null;
    let streetName: string | null = null;

    if (data.results && data.results.length > 0) {
      for (const result of data.results) {
        for (const component of result.address_components) {
          // Look for street name (route component)
          if (component.types.includes("route")) {
            if (!streetName) {
              streetName = component.long_name; // e.g., "Oak Street"
            }
          }
          // Look for neighborhood (most specific)
          if (
            component.types.includes("neighborhood") ||
            component.types.includes("sublocality_level_1") ||
            component.types.includes("sublocality")
          ) {
            if (!neighborhood) {
              neighborhood = component.long_name;
            }
          }
          // Look for city
          if (
            component.types.includes("locality") ||
            component.types.includes("administrative_area_level_3")
          ) {
            if (!city) {
              city = component.long_name;
            }
          }
        }
      }
    }

    // Determine best area name: prefer neighborhood, fall back to city
    areaName = neighborhood || city;

    const successResult: ReverseGeocodeResult = {
      success: true,
      fromCache: false,
      areaName,
      city,
      neighborhood,
      streetName,
    };

    // Cache the result
    reverseGeocodeCache.set(cacheKey, {
      result: successResult,
      cachedAt: Date.now(),
    });

    return successResult;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error in reverse geocoding";

    if (__DEV__) {
      console.warn("[GooglePlaces] Reverse geocode error:", message);
    }

    return {
      success: false,
      error: message,
      fromCache: false,
      areaName: null,
      city: null,
      neighborhood: null,
      streetName: null,
    };
  }
}

/**
 * Reverse geocode coordinates via the secure Edge Function proxy.
 *
 * Drop-in replacement for `reverseGeocode()` but the Google API key stays
 * server-side. Returns the same `ReverseGeocodeResult` shape so the UI
 * can switch with a one-line import change.
 *
 * @param latitude  - Latitude of the location
 * @param longitude - Longitude of the location
 * @returns ReverseGeocodeResult with area/street/neighborhood information
 */
export async function reverseGeocodeSecure(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  // Check cache first (same cache as the direct function)
  const cacheKey = getCacheKey(latitude, longitude);
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.result, fromCache: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "google-places-proxy",
      {
        body: {
          action: "geocode" as const,
          latitude,
          longitude,
        },
      }
    );

    if (error) {
      throw new Error(
        typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : String(error)
      );
    }

    // The edge function returns the raw Google Geocoding API response:
    // { status: "OK", results: GoogleGeocodingResult[] }
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(data.error_message || `API status: ${data.status}`);
    }

    // Parse results — same extraction logic as reverseGeocode()
    let areaName: string | null = null;
    let city: string | null = null;
    let neighborhood: string | null = null;
    let streetName: string | null = null;

    if (data.results && data.results.length > 0) {
      for (const result of data.results) {
        for (const component of result.address_components) {
          // Look for street name (route component)
          if (component.types.includes("route")) {
            if (!streetName) {
              streetName = component.long_name;
            }
          }
          // Look for neighborhood (most specific)
          if (
            component.types.includes("neighborhood") ||
            component.types.includes("sublocality_level_1") ||
            component.types.includes("sublocality")
          ) {
            if (!neighborhood) {
              neighborhood = component.long_name;
            }
          }
          // Look for city
          if (
            component.types.includes("locality") ||
            component.types.includes("administrative_area_level_3")
          ) {
            if (!city) {
              city = component.long_name;
            }
          }
        }
      }
    }

    // Determine best area name: prefer neighborhood, fall back to city
    areaName = neighborhood || city;

    const successResult: ReverseGeocodeResult = {
      success: true,
      fromCache: false,
      areaName,
      city,
      neighborhood,
      streetName,
    };

    // Cache the result (same 15-min TTL)
    reverseGeocodeCache.set(cacheKey, {
      result: successResult,
      cachedAt: Date.now(),
    });

    return successResult;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error in secure reverse geocoding";

    if (__DEV__) {
      console.warn("[GooglePlaces] Secure reverse geocode error:", message);
    }

    return {
      success: false,
      error: message,
      fromCache: false,
      areaName: null,
      city: null,
      neighborhood: null,
      streetName: null,
    };
  }
}

/**
 * Get a fuzzy location label from coordinates.
 * Returns a descriptive label like "Oak Street, Crestwood" or "Near Downtown".
 *
 * Priority:
 * 1. "Street, Neighborhood" (e.g., "Oak Street, Crestwood") — if both available
 * 2. "Near Neighborhood" (e.g., "Near Crestwood") — if only neighborhood
 * 3. "Near City" (e.g., "Near Santa Monica") — if only city
 *
 * @param latitude - Latitude of the location
 * @param longitude - Longitude of the location
 * @returns A fuzzy label, or null if unable to geocode
 */
export async function getFuzzyLocationLabel(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const result = await reverseGeocode(latitude, longitude);

  if (!result.success) {
    return null;
  }

  // Prefer "Street, Neighborhood" when both are available
  if (result.streetName && result.neighborhood) {
    return `${result.streetName}, ${result.neighborhood}`;
  }

  // Fall back to "Near Area"
  if (result.areaName) {
    return `Near ${result.areaName}`;
  }

  return null;
}

/**
 * Clear expired reverse geocode cache entries.
 */
export function clearExpiredReverseGeocodeCache(): number {
  const now = Date.now();
  let cleared = 0;

  for (const [key, entry] of reverseGeocodeCache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      reverseGeocodeCache.delete(key);
      cleared++;
    }
  }

  return cleared;
}

// ============================================================================
// Autocomplete
// ============================================================================

/**
 * Generate a UUID v4-style session token for Google Places Autocomplete.
 *
 * Session tokens group autocomplete keystrokes + final selection into
 * a single billing session. Autocomplete requests within a session are
 * free; only the Place Details call on selection is charged.
 *
 * Create one token per user "search session" (e.g., when the picker sheet opens).
 */
export function createSessionToken(): string {
  // Simple UUID v4 generator (no crypto dependency needed)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * In-flight autocomplete request tracker for cancellation.
 */
let autocompleteAbortController: AbortController | null = null;

/**
 * Search for places using Google Places Autocomplete API.
 *
 * Uses session tokens so autocomplete requests are free — only the final
 * Place Details selection is charged ($5/1,000 at Essentials tier).
 *
 * @param query - User's search text (e.g., "Starbu")
 * @param latitude - Latitude for location bias (nearby results ranked higher)
 * @param longitude - Longitude for location bias
 * @param sessionToken - Session token from createSessionToken()
 * @param radiusM - Bias radius in meters (default 5000m / 5km)
 * @returns Array of autocomplete predictions
 */
export async function searchPlacesAutocomplete(
  query: string,
  latitude: number | null,
  longitude: number | null,
  sessionToken: string,
  radiusM: number = 5000
): Promise<PlaceAutocompletePrediction[]> {
  // Cancel any in-flight request
  if (autocompleteAbortController) {
    autocompleteAbortController.abort();
  }
  autocompleteAbortController = new AbortController();

  if (!query || query.length < 2) {
    return [];
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    if (__DEV__) {
      console.warn("[GooglePlaces] No API key for autocomplete");
    }
    return [];
  }

  try {
    const params = new URLSearchParams({
      input: query,
      key: apiKey,
      sessiontoken: sessionToken,
    });

    // Add location bias if coordinates are available
    if (latitude != null && longitude != null) {
      params.set("location", `${latitude},${longitude}`);
      params.set("radius", radiusM.toString());
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;

    const response = await fetch(url, {
      signal: autocompleteAbortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: AutocompleteResponse = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(data.error_message || `API status: ${data.status}`);
    }

    const predictions = data.predictions || [];

    return predictions.map(
      (prediction): PlaceAutocompletePrediction => ({
        placeId: prediction.place_id,
        mainText: prediction.structured_formatting.main_text,
        secondaryText: prediction.structured_formatting.secondary_text,
        description: prediction.description,
        types: prediction.types || [],
      })
    );
  } catch (error) {
    // Ignore abort errors (expected when user types fast)
    if (error instanceof Error && error.name === "AbortError") {
      return [];
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error in autocomplete";

    if (__DEV__) {
      console.warn("[GooglePlaces] Autocomplete error:", message);
    }

    return [];
  }
}

/**
 * Cancel any in-flight autocomplete request.
 * Call this when the picker sheet closes to clean up.
 */
export function cancelAutocomplete(): void {
  if (autocompleteAbortController) {
    autocompleteAbortController.abort();
    autocompleteAbortController = null;
  }
}

// ============================================================================
// Secure Edge Function Proxy
// ============================================================================
//
// These functions route Google Places API calls through the Supabase Edge
// Function `google-places-proxy`, so the API key never leaves the server.
//
// They are drop-in replacements for the direct-API functions above.
// The UI will migrate to these gradually — do NOT remove the old functions.
// ============================================================================

/**
 * Fetch nearby places via the secure Edge Function proxy.
 *
 * Equivalent to `fetchNearbyPlaces()` but the API key stays server-side.
 * Results are returned in the same `NearbyPlacesResult` shape so the UI
 * can switch with a one-line import change.
 *
 * @param latitude  - Latitude of the location
 * @param longitude - Longitude of the location
 * @param radiusM   - Search radius in meters (default 750)
 * @returns NearbyPlacesResult with suggestions or error
 */
export async function fetchNearbyPlacesSecure(
  latitude: number,
  longitude: number,
  radiusM: number = SEARCH_RADIUS_M
): Promise<NearbyPlacesResult> {
  // Check client-side cache first (same cache as the direct function)
  const cached = getCachedSuggestions(latitude, longitude);
  if (cached !== null) {
    return { success: true, fromCache: true, suggestions: cached };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "google-places-proxy",
      {
        body: {
          action: "nearby" as const,
          latitude,
          longitude,
          radius: radiusM,
        },
      }
    );

    if (error) {
      throw new Error(
        typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : String(error)
      );
    }

    // The edge function returns { results: NearbyPlaceResult[] }
    const rawResults: Array<{
      placeId: string;
      name: string;
      vicinity: string;
      types: string[];
      latitude: number;
      longitude: number;
      distanceM: number;
      rating?: number;
      isOpen?: boolean;
    }> = data?.results ?? [];

    // Map to the existing GooglePlaceSuggestion shape used by the UI
    const suggestions: GooglePlaceSuggestion[] = rawResults.map((r) => ({
      placeId: r.placeId,
      name: r.name,
      vicinity: r.vicinity,
      types: r.types,
      distanceM: r.distanceM,
      latitude: r.latitude,
      longitude: r.longitude,
      rating: r.rating,
      isOpen: r.isOpen,
    }));

    // Cache results client-side (same 15-min TTL)
    cacheSuggestions(latitude, longitude, suggestions);

    return { success: true, fromCache: false, suggestions };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error fetching places via proxy";

    if (__DEV__) {
      console.warn("[GooglePlaces] Secure nearby error:", message);
    }

    return { success: false, error: message, fromCache: false, suggestions: [] };
  }
}

/**
 * Search places via autocomplete through the secure Edge Function proxy.
 *
 * Equivalent to `searchPlacesAutocomplete()` but the API key stays server-side.
 * Returns the same `PlaceAutocompletePrediction[]` shape.
 *
 * @param query        - User's search text
 * @param latitude     - Latitude for location bias
 * @param longitude    - Longitude for location bias
 * @param sessionToken - Session token from `createSessionToken()`
 * @param radiusM      - Bias radius in meters (default 5000)
 * @returns Array of autocomplete predictions
 */
export async function searchPlacesAutocompleteSecure(
  query: string,
  latitude: number | null,
  longitude: number | null,
  sessionToken: string,
  radiusM: number = 5000
): Promise<PlaceAutocompletePrediction[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "google-places-proxy",
      {
        body: {
          action: "autocomplete" as const,
          query,
          latitude,
          longitude,
          sessionToken,
          radius: radiusM,
        },
      }
    );

    if (error) {
      throw new Error(
        typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : String(error)
      );
    }

    // The edge function returns { predictions: AutocompletePredictionResult[] }
    const rawPredictions: Array<{
      placeId: string;
      mainText: string;
      secondaryText: string;
      description: string;
      types: string[];
    }> = data?.predictions ?? [];

    return rawPredictions.map(
      (p): PlaceAutocompletePrediction => ({
        placeId: p.placeId,
        mainText: p.mainText,
        secondaryText: p.secondaryText,
        description: p.description,
        types: p.types,
      })
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error in autocomplete proxy";

    if (__DEV__) {
      console.warn("[GooglePlaces] Secure autocomplete error:", message);
    }

    return [];
  }
}
