# Place Mis-Tagging Fix - Implementation Summary

**Problem:** When at Scooter's Coffee, the system was labeling it as "Chipotle" because the Edge Function returns the first "operational" business within 500m, not necessarily the closest one.

**Solution:** Client-side distance verification with confidence scoring.

## What Was Changed

### 1. New File: `apps/mobile/src/lib/supabase/services/place-confidence.ts`

A new utility module that provides:

- **`haversineDistance()`** - Calculate distance between two lat/lng points in meters
- **`scorePlaceConfidence()`** - Comprehensive confidence scoring based on:
  - Distance from segment centroid to the returned place (most important)
  - Dwell time at the location
  - Number of location samples
  - Whether it's a reverse geocode result
  - Place type (large venues vs small cafes)
- **`quickDistanceCheck()`** - Fast distance-based decision
- **`formatPlaceName()`** - Add "Near" prefix for fuzzy locations

**Key Constants:**
- `PLACE_MAX_CONFIDENT_DISTANCE_M = 75` - Places within 75m are "high confidence"
- `PLACE_MAX_FUZZY_DISTANCE_M = 150` - Places 75-150m get "Near X" format
- Places beyond 150m are rejected entirely

### 2. Modified: `apps/mobile/src/lib/supabase/services/activity-segments.ts`

**Added imports:**
```typescript
import {
  haversineDistance,
  scorePlaceConfidence,
  formatPlaceName,
  PLACE_MAX_FUZZY_DISTANCE_M,
} from "./place-confidence";
```

**Extended `ActivitySegment` interface:**
```typescript
// New optional fields:
placeDistanceM?: number;           // Distance to labeled place in meters
placeConfidenceScore?: number;     // 0-1 confidence score
placeConfidenceLevel?: "high" | "medium" | "low" | "very_low";
placeFuzzy?: boolean;              // Whether using "Near X" format
```

**Modified `enrichSegmentsWithPlaceNames()`:**

Before: Blindly accepted whatever place name the Edge Function returned.

After: 
1. Stores full `PlaceLookupResult` objects (with lat/lng of the returned place)
2. Calculates distance from segment centroid to returned place
3. Scores confidence based on multiple factors
4. Either accepts, fuzzy-ifies ("Near X"), or rejects the label

## How It Works

```
Segment centroid: (33.4567, -97.1234)
Edge Function returns: "Chipotle" at (33.4590, -97.1250)
Distance calculation: 280m

Result: REJECTED (> 150m threshold)
The segment remains unlabeled, or if another lookup was done,
it might get a closer match.
```

```
Segment centroid: (33.4567, -97.1234)
Edge Function returns: "Scooter's Coffee" at (33.4569, -97.1236)
Distance calculation: 35m

Result: ACCEPTED (< 75m threshold)
placeLabel = "Scooter's Coffee"
placeConfidenceLevel = "high"
```

```
Segment centroid: (33.4567, -97.1234)
Edge Function returns: "Target" at (33.4580, -97.1260)
Distance calculation: 90m

Result: FUZZY (75-150m threshold)
placeLabel = "Near Target"
placeFuzzy = true
```

## Constraints Met ✅

- ❌ Did NOT change search radius (kept at 500m)
- ❌ Did NOT require Supabase migrations
- ❌ Did NOT redeploy the Edge Function
- ✅ All changes are in mobile app / client-side code

## Debug Logging

In `__DEV__` mode, you'll see logs like:

```
[PlaceVerify] Chipotle: 280m from segment (score: 0.12, level: very_low, show: false, fuzzy: true) - 280m away (too far)
[PlaceVerify] ❌ Rejecting "Chipotle" - confidence too low

[PlaceVerify] Scooter's Coffee: 35m from segment (score: 0.88, level: high, show: true, fuzzy: false) - good match
```

## Risks and Tradeoffs

1. **More unlabeled segments** - Places far from the centroid will be rejected. This is intentional - better no label than wrong label.

2. **"Near X" might be less precise** - But it's honest about the uncertainty.

3. **Doesn't fix the root cause** - The Edge Function still only returns one place. A future improvement could return multiple candidates sorted by distance.

## Future Improvements (Optional)

1. **UI indicators** - Show confidence level in the UI (maybe a subtle indicator for "Near X" labels)

2. **Multi-candidate selection** - Modify Edge Function to return top 3-5 places, let client pick the closest (requires backend change)

3. **User correction learning** - If user corrects a place label, learn from it

## Testing

Reprocess a day that had mis-tagging issues:

```typescript
// In dev screen or via REPL
import { reprocessDayWithPlaceLookup } from '@/lib/supabase/services/activity-segments';

await reprocessDayWithPlaceLookup(userId, '2026-02-05', console.log);
```

Watch the debug logs to see which places get accepted/rejected/fuzzified.
