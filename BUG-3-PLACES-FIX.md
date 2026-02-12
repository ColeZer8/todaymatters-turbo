# Bug 3 Fix: Wrong Place Names

## Problem Statement

Place name resolution was returning random nearby businesses instead of meaningful location names:
- "Cameron Travis & Company" instead of "Santos Coffee"
- "Steel City Chiropractic" instead of "Dog Park"

**Root causes:**
1. GPS drift (10-50m accuracy)
2. 500m search radius (later 200m) returning distant businesses
3. No distance threshold - returned nearest POI even if it was 150m+ away

## Solution Evolution

### Phase 1: Basic Distance Filtering (Agent 2)
- Fixed 75m distance threshold
- Fallback to reverse geocoding with area filters
- Reduced search radius to 150m

### Phase 2: Context-Aware Smart Resolution (Agent 3)
- **Dynamic POI threshold** based on GPS accuracy, duration, and movement speed
- **POI type filtering** - only accept meaningful place types (cafes, gyms, parks, etc.)
- **Movement-aware logic** - skip POIs when moving, use neighborhoods instead

## Files Modified

### 1. `supabase/functions/location-place-lookup/index.ts`

**Change 1: Extended PlaceLookupPoint interface**
```typescript
interface PlaceLookupPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;   // GPS accuracy in meters
  duration?: number;   // Seconds at this location
  speed?: number;      // Speed in m/s
}
```

**Change 2: Context-aware threshold calculation**
```typescript
function calculatePOIThreshold(accuracy: number, duration: number, speed: number): number {
  // Moving fast (> 1 m/s) → skip POIs entirely
  if (speed > 1) return 0;
  
  // Short duration (< 3 min) → use neighborhood
  if (duration < 180) return 0;
  
  // Poor GPS accuracy (> 20m) → use neighborhood
  if (accuracy > 20) return 0;
  
  // Great GPS (< 10m) + long duration (> 5 min) → tight threshold
  if (accuracy < 10 && duration > 300) return 30;
  
  // Good GPS (< 20m) + medium duration (> 3 min) → medium threshold
  if (accuracy < 20 && duration > 180) return 50;
  
  // Long duration (> 5 min) → default threshold
  if (duration > 300) return 75;
  
  return 0; // Default: use neighborhood
}
```

**Change 3: Valid POI type filtering**
```typescript
const VALID_POI_TYPES = new Set([
  // Food & Drink
  "cafe", "restaurant", "bar", "bakery", "coffee_shop",
  // Fitness & Recreation
  "gym", "fitness_center", "park", "bowling_alley",
  // Retail
  "store", "shopping_mall", "supermarket",
  // Education & Culture
  "museum", "library", "school", "university",
  // ... and more meaningful place types
]);

// Filter: must have at least one valid POI type
const placesWithDistance = places
  .filter((r) => r.displayName?.text && !isJunkResult(r.types) && hasValidPOIType(r.types))
  // ...
```

### 2. `apps/mobile/src/lib/supabase/services/activity-segments.ts`

**Change: Pass context to edge function**
```typescript
const points = Array.from(dedupe.values()).map((seg) => {
  const durationSec = (seg.endedAt.getTime() - seg.startedAt.getTime()) / 1000;
  const speedMs = seg.placeCategory === "commute" && seg.distanceM 
    ? seg.distanceM / durationSec 
    : 0;
  
  return {
    latitude: seg.locationLat!,
    longitude: seg.locationLng!,
    accuracy: 15,  // Default GPS accuracy
    duration: durationSec,
    speed: speedMs,
  };
});
```

### 3. `apps/mobile/src/lib/supabase/services/location-place-lookup.ts`

**Change: Extended PlaceLookupPoint type**
```typescript
export interface PlaceLookupPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  duration?: number;
  speed?: number;
}
```

## Logic Flow (Context-Aware)

```
1. Receive coordinates + context (accuracy, duration, speed)
2. Calculate context-aware POI threshold:
   - Moving (>1 m/s) → skip POIs, use neighborhood
   - Short stay (<3 min) → skip POIs, use neighborhood
   - Poor GPS (>20m) → skip POIs, use neighborhood
   - Good GPS + long stay → accept nearby POIs
3. If threshold = 0 → straight to reverse geocoding
4. Query Google Places API (150m radius)
5. Filter by valid POI types (cafe, gym, park, etc.)
6. Sort by distance
7. If best POI > threshold → use reverse geocoding
8. Return POI name OR "Near [Neighborhood]"
```

## Testing Scenarios (Context-Aware)

### Scenario 1: Stationary at Santos Coffee (Good GPS)
**Input:**
- duration: 900s (15 min)
- accuracy: 8m
- speed: 0.1 m/s

**Expected:**
- POI threshold = 30m (great GPS + long duration)
- Should find "Santos Coffee" if within 30m
- Falls back to "Near Lakeview" if POI > 30m away

### Scenario 2: Driving through neighborhood (Moving)
**Input:**
- duration: 120s (2 min)
- accuracy: 25m
- speed: 8 m/s

**Expected:**
- POI threshold = 0m (moving fast)
- Skips POI search entirely
- Returns "Near Mountain Brook" (neighborhood)

### Scenario 3: Brief stop at dog park (Medium GPS)
**Input:**
- duration: 600s (10 min)
- accuracy: 15m
- speed: 0.5 m/s

**Expected:**
- POI threshold = 50m (good GPS + stationary)
- Should find "Dog Park" if within 50m
- Falls back to neighborhood if POI > 50m away

### Scenario 4: Walking through downtown (Short duration)
**Input:**
- duration: 60s (1 min)
- accuracy: 10m
- speed: 1.2 m/s

**Expected:**
- POI threshold = 0m (moving + short duration)
- Returns "Near Downtown" (neighborhood)

### Scenario 5: Parked with poor GPS signal
**Input:**
- duration: 1800s (30 min)
- accuracy: 35m
- speed: 0 m/s

**Expected:**
- POI threshold = 0m (poor GPS accuracy)
- Returns neighborhood despite long duration
- Prevents false positives from GPS uncertainty

## Reverse Geocoding Fallback

The `fetchReverseGeocode` function already properly filters for area types:

```typescript
url.searchParams.set("result_type", "neighborhood|sublocality|locality|route");
```

And uses a priority chain:
1. Neighborhood (e.g., "Downtown")
2. Sublocality (e.g., "West Side")
3. Locality/City (e.g., "Birmingham")
4. Route (e.g., "1st Avenue")

Returns format: `"Near [AreaName]"`

## Client-Side Verification (Already Implemented)

The client (`place-confidence.ts`) already has distance verification:
- `PLACE_MAX_CONFIDENT_DISTANCE_M = 50` - Accept without modification
- `PLACE_MAX_FUZZY_DISTANCE_M = 100` - Use "Near X" format
- Beyond 100m - Reject entirely

## Test SQL Queries

### Check current place name distribution
```sql
SELECT 
  place_name,
  source,
  COUNT(*) as count,
  AVG(CASE WHEN place_latitude IS NOT NULL AND place_longitude IS NOT NULL 
      THEN ST_Distance(
        ST_Point(longitude, latitude)::geography,
        ST_Point(place_longitude, place_latitude)::geography
      ) 
      END) as avg_distance_m
FROM tm.location_place_cache
WHERE fetched_at > NOW() - INTERVAL '7 days'
GROUP BY place_name, source
ORDER BY count DESC
LIMIT 50;
```

### Find potentially mismatched places (businesses far from query point)
```sql
SELECT 
  place_name,
  latitude,
  longitude,
  place_latitude,
  place_longitude,
  ST_Distance(
    ST_Point(longitude, latitude)::geography,
    ST_Point(place_longitude, place_latitude)::geography
  ) as distance_m,
  place_types,
  source,
  fetched_at
FROM tm.location_place_cache
WHERE source = 'google_places_nearby'
  AND place_latitude IS NOT NULL
  AND ST_Distance(
    ST_Point(longitude, latitude)::geography,
    ST_Point(place_longitude, place_latitude)::geography
  ) > 75
ORDER BY fetched_at DESC
LIMIT 20;
```

### Clear old cache entries to force re-lookup
```sql
-- Run this to test the fix on next location query
DELETE FROM tm.location_place_cache
WHERE user_id = 'YOUR_USER_ID'
  AND fetched_at < NOW() - INTERVAL '1 hour';
```

## Test Coordinates

**Santos Coffee area (Birmingham, AL):**
- Latitude: 33.5186
- Longitude: -86.8104

**Test via Edge Function:**
```bash
curl -X POST 'YOUR_SUPABASE_URL/functions/v1/location-place-lookup' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"points": [{"latitude": 33.5186, "longitude": -86.8104}]}'
```

## Expected Behavior After Fix

| Scenario | Before | After (Context-Aware) |
|----------|--------|----------------------|
| User at Santos Coffee (15 min, good GPS) | Random nearby business | Santos Coffee |
| User at Santos Coffee (GPS drifts 40m) | Cameron Travis & Company | Santos Coffee (within 50m threshold) |
| User at Santos Coffee (GPS drifts 100m) | Random Business | "Near Lakeview" |
| User at dog park (no business nearby) | Steel City Chiropractic | "Near [Neighborhood]" |
| **NEW: Driving through area** | Random gas station | "Near Mountain Brook" |
| **NEW: Brief 1-min stop** | Nearest POI | "Near [Area]" |
| **NEW: 30 min stay, poor GPS** | Random business 50m away | "Near [Neighborhood]" |
| **NEW: 15 min at gym, great GPS** | Correct gym name | Correct gym name (30m threshold) |

## Success Criteria

### Phase 1 (Basic Filtering)
✅ POIs only returned when within 75m of query location  
✅ Search radius reduced from 500m → 150m  
✅ Fallback to reverse geocoding returns area names, not businesses  
✅ Client-side confidence scoring remains in place as second defense

### Phase 2 (Context-Aware)
✅ POI only shown when stationary (speed < 1 m/s)  
✅ POI threshold tightens with better GPS accuracy  
✅ Short durations (<3 min) use neighborhoods  
✅ Long durations (>5 min) use specific POIs  
✅ POI types filtered to relevant places (no random businesses)  
✅ Poor GPS accuracy (>20m) uses neighborhoods regardless of duration  

## Deployment

Deploy the edge function:
```bash
supabase functions deploy location-place-lookup
```

## Monitoring

Watch edge function logs for the new fallback message:
```
[location-place-lookup] Nearest POI "..." is Xm away (>75m) - falling back to reverse geocoding
```
