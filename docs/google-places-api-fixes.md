# Google Places API Integration - Investigation & Fixes

## Problem Summary
The "Lookup Places" button on the Location Activity page wasn't working reliably for all locations. Some locations got resolved with place names, others returned nothing.

## Root Causes Identified

### 1. Search Radius Too Small (150m)
**Issue:** The default search radius was 150m, which is too small for residential areas, parks, and rural locations where the nearest POI might be 500m+ away.

**Fix:** Increased default radius from 150m to 500m.

### 2. Wrong Ranking Algorithm
**Issue:** Using `rankPreference: "POPULARITY"` meant the API returned the most popular places, not the nearest ones. For GPS coordinate lookup, we want proximity-based results.

**Fix:** Changed to `rankPreference: "DISTANCE"` to get the nearest place to the user's actual location.

### 3. No Fallback Strategy
**Issue:** When Google Places Nearby Search found no POIs (common in residential areas), the function returned nothing. Users saw blank location data.

**Fix:** Added reverse geocoding fallback that returns "Near [Neighborhood]" or "Near [City]" when no POIs are found. This ensures every location gets some meaningful label.

### 4. No Negative Caching
**Issue:** When no results were found, nothing was cached. This meant:
- Every subsequent request for the same location hit the Google API again
- API quota was wasted on repeated failed lookups
- Same "no results" every time

**Fix:** Implemented negative caching - when we confirm a location has no POI, we cache that fact with a shorter TTL (30 days vs 180 days). On retry after TTL expires, we'll check again in case new places have opened.

### 5. Poor User Feedback
**Issue:** The UI showed "X locations processed" but didn't distinguish between:
- Found a POI
- Found area name via reverse geocoding
- Found nothing at all

**Fix:** Updated UI to show detailed breakdown:
- 📍 X POIs found
- 🗺️ X areas (reverse geocode)
- 💾 X from cache
- ⚠️ X no results

## Files Changed

### Edge Function (Backend)
- `supabase/functions/location-place-lookup/index.ts`
  - Increased default radius: 150m → 500m
  - Changed ranking: POPULARITY → DISTANCE
  - Added reverse geocoding fallback function
  - Implemented negative caching with configurable TTL
  - Added new `source` values: `reverse_geocode`, `none`

### Database Migration
- `supabase/migrations/20260204_expand_location_cache_source_types.sql`
  - Updated `source` column check constraint to allow new values
  - Updated `location_hourly` view to filter out `__NO_RESULT__` placeholder

### Client Services
- `apps/mobile/src/lib/supabase/services/location-place-lookup.ts`
  - Updated `PlaceLookupResult.source` type to include `reverse_geocode`

### UI
- `apps/mobile/src/app/dev/location.tsx`
  - Enhanced feedback message to show detailed breakdown by source type
  - Auto-refresh triggers for both POI and reverse geocode results

## Best Practices Implemented

### Google Places API Best Practices
1. **Use DISTANCE ranking** for GPS coordinate lookups (not POPULARITY)
2. **Larger search radius** (500m) for better coverage in sparse areas
3. **Reverse geocoding fallback** when no POIs found
4. **Cache everything** including negative results
5. **Respect rate limits** by caching aggressively

### Caching Strategy
- **Positive results (POI found):** 180 days TTL
- **Reverse geocode results:** 180 days TTL
- **Negative results (nothing found):** 30 days TTL (shorter to allow retry)
- **Cache key:** Rounded coordinates (4 decimal places, ~11m precision)
- **Cache scope:** Per-user for privacy

### Error Handling
- Google API failures → fall back to reverse geocoding
- Reverse geocoding failures → cache as negative result
- All failures → visible in UI with clear messaging

## How Google Timeline Handles This

For reference, Google Timeline (Google Maps location history) uses a similar approach:
1. Primary: Match to Google Places POI database
2. Fallback: Reverse geocoding to get area/neighborhood
3. Deep fallback: Show coordinates if nothing else works
4. User can manually correct/label locations

Our implementation now follows this same pattern.

## Testing

To test the fixes:
1. Open Location Activity page
2. Click "Lookup Places"
3. Verify the message shows detailed breakdown
4. Check that residential locations now show "Near [Area]"
5. Run lookup again - should show cache hits
6. Check database: `SELECT * FROM tm.location_place_cache WHERE user_id = 'your-id' ORDER BY fetched_at DESC;`

## Migration Notes

The migration `20260204_expand_location_cache_source_types.sql` must be applied before the edge function changes will work. The migration:
1. Updates the check constraint on `source` column
2. Updates the `location_hourly` view to handle the `__NO_RESULT__` placeholder
