# Place Name Accuracy Fix

**Date:** 2026-02-11  
**Issue:** "Cameron Travis & Company, P.C." (law firm) showing instead of "Santos Coffee"  
**Status:** ✅ FIXED AND DEPLOYED

---

## Diagnosis

### The Problem
When Gravy visited Santos Coffee (6:00-6:07 PM), the timeline showed "Cameron Travis & Company, P.C." (a law firm) instead.

### Root Cause
The `location-place-lookup` edge function was selecting places **purely by distance**. When Google Places API returns multiple nearby businesses:

```
1. Cameron Travis & Company, P.C. - 15m away (lawyer)
2. Santos Coffee - 22m away (cafe)
3. Other Business - 45m away
```

The old logic picked the **closest** business regardless of type. This meant law offices, accounting firms, and other professional services were chosen over consumer destinations like cafes/restaurants.

### Why This Is Wrong
- Users rarely visit lawyer/accountant offices casually
- When someone is at a location with a coffee shop AND a law firm nearby, 99% of the time they're at the coffee shop
- GPS accuracy is ~15-20m, so "closest" within that margin is meaningless

---

## The Fix

### Code Changes: `supabase/functions/location-place-lookup/index.ts`

#### 1. Added Type Priority System

```typescript
// HIGH PRIORITY: Places users typically visit intentionally
const HIGH_PRIORITY_TYPES = new Set([
  // Food & Drink
  "cafe", "coffee_shop", "restaurant", "bar", "bakery", "food",
  // Entertainment & Leisure
  "movie_theater", "bowling_alley", "night_club", "amusement_park",
  "museum", "park", "zoo",
  // Fitness & Wellness  
  "gym", "fitness_center", "spa", "beauty_salon",
  // Retail
  "shopping_mall", "store", "supermarket", "clothing_store",
  // Health & Services
  "pharmacy", "hospital", "bank", "post_office", "library",
  // Transit
  "airport", "train_station", "bus_station",
]);

// LOW PRIORITY: Professional service offices
const LOW_PRIORITY_TYPES = new Set([
  "lawyer", "attorney", "law_firm",
  "accountant", "accounting",
  "insurance_agency", "insurance",
  "real_estate_agency", "real_estate",
  "finance", "financial_planner", "investment",
  "tax_preparer", "corporate_office",
]);
```

#### 2. Priority Scoring Function

```typescript
function getPlacePriorityScore(types: string[]): number {
  // Priority tiers:
  // - 3: High priority (cafes, restaurants, stores, entertainment)
  // - 2: Normal priority (other quality places)
  // - 1: Low priority (professional services like lawyers, accountants)
  // - 0: Generic/junk results
  
  if (types.some(t => LOW_PRIORITY_TYPES.has(t))) return 1;
  if (types.some(t => HIGH_PRIORITY_TYPES.has(t))) return 3;
  if (types.some(t => QUALITY_PLACE_TYPES.has(t))) return 2;
  return 0;
}
```

#### 3. Sort by Priority First, Then Distance

```typescript
placesWithDistance.sort((a, b) => {
  // First compare by priority (higher is better)
  if (a.priority !== b.priority) {
    return b.priority - a.priority; // Descending: 3 > 2 > 1
  }
  // Same priority: prefer closer distance
  return a.distance - b.distance;
});
```

### Result

With the new logic:
```
1. Santos Coffee - 22m away (cafe, priority=3) ✅ SELECTED
2. Cameron Travis & Company - 15m away (lawyer, priority=1) ❌ Deprioritized
```

Even though Cameron Travis is closer, Santos Coffee is selected because cafes (priority=3) beat lawyers (priority=1).

---

## Deployment

```bash
# Deployed at 2026-02-11 21:40 CST
npx supabase functions deploy location-place-lookup --project-ref bqbbuysyiyzdtftctvdk
```

**Edge Function URL:** `https://bqbbuysyiyzdtftctvdk.supabase.co/functions/v1/location-place-lookup`

---

## Clearing Cache (If Needed)

The fix applies to **new** place lookups. To force re-lookup for existing cached places:

```sql
-- Clear place cache for a specific user
DELETE FROM tm.location_place_cache 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';

-- Or clear all cache (use with caution)
-- DELETE FROM tm.location_place_cache;
```

Then re-ingest location data or wait for the app to refresh timeline.

---

## Debug Logging

The function now logs candidate analysis:

```
[location-place-lookup] Candidates: "Santos Coffee" (22m, priority=3, types=cafe,coffee_shop) | "Cameron Travis" (15m, priority=1, types=lawyer)
[location-place-lookup] Picked "Santos Coffee" at 22m, priority=3 (1 alternatives within 500m)
```

This helps diagnose future place selection issues.

---

## Testing

To verify the fix works:

1. **Clear cache for test coordinates:**
   ```sql
   DELETE FROM tm.location_place_cache 
   WHERE latitude BETWEEN 33.5 AND 33.6 
     AND longitude BETWEEN -86.8 AND -86.7;
   ```

2. **Call the edge function with test coordinates:**
   ```bash
   curl -X POST https://bqbbuysyiyzdtftctvdk.supabase.co/functions/v1/location-place-lookup \
     -H "Authorization: Bearer $USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{"points": [{"latitude": 33.5234, "longitude": -86.8024}], "forceRefresh": true}'
   ```

3. **Check logs** in Supabase Dashboard → Functions → location-place-lookup → Logs

---

## Summary

| Before | After |
|--------|-------|
| Closest business wins | Priority type wins, then closest |
| Law firm at 15m selected | Coffee shop at 22m selected |
| Professional services treated equally | Professional services deprioritized |

**This fix ensures the timeline shows where users actually went (cafes, restaurants, stores) instead of nearby offices they didn't visit.**
