# TodayMatters Location Pipeline Diagnosis
**Date:** Feb 11, 2026  
**User ID:** `b9ca3335-9929-4d54-a3fc-18883c5f3375`

---

## 🔍 Problem Summary

From the screenshot analysis:
1. **Blocks not merging** - Two "Believe Candle Co." blocks (2:42-4 AM and 4-7:03 AM) showing separately when they should be one block
2. **No location details** - Hourly location breakdown UI missing or not populating
3. **Segmenting feature not working** - Location blocks aren't being properly segmented

---

## 📊 Data Pipeline Architecture

```
GPS Location Samples (ALPHA)
          ↓
Activity Segments (BRAVO) ← segment creation logic
          ↓
Location Hourly (aggregation)
          ↓
Hourly Summaries (CHARLIE)
          ↓
UI: useLocationBlocksForDay hook
          ↓
groupSegmentsIntoLocationBlocks() ← merge logic
          ↓
fillLocationGaps() ← carry-forward logic
          ↓
LocationBlockList component
```

---

## 🔧 Code Analysis Findings

### 1. Merge Logic (`group-location-blocks.ts`)

**Status:** ✅ Code looks GOOD - extensive debug logging added

The `isSamePlace()` function has proper merge criteria:
- ✅ Place ID matching (strongest signal)
- ✅ Coordinate proximity (< 200m with haversine distance)
- ✅ Label matching (handles geocoded locations without place_id)
- ✅ Commute segment handling (merges commute segments together)

**Debug logging:** The file has a version check banner:
```typescript
console.log("🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED - VERSION 2026-02-11-ULTRA-VERBOSE");
```

**Key insight:** The ultra-verbose logging will show EXACTLY why two segments aren't merging!

### 2. Segment Creation (`activity-segments.ts`)

**Recent fix implemented:** Single-sample segment creation
- ✅ Creates segments even when only 1 location sample exists
- ✅ Uses actual screen time boundaries (not hour boundaries)
- ✅ Handles no-location-data case (screen time only)

### 3. Gap Filling (`fillLocationGaps()`)

**Status:** ✅ Implemented for overnight stays
- ✅ Carries forward last known location (30 min - 16 hour gaps)
- ✅ Replaces "Unknown Location" blocks after known locations
- ✅ Stops at travel blocks (movement = new location)

### 4. UI Data Flow (`useLocationBlocksForDay`)

**Status:** ✅ Uses segment-based grouping when available
```typescript
if (allSegments.length > 0) {
  locationBlocks = groupSegmentsIntoLocationBlocks(allSegments, enriched, alternativesBySegmentId);
} else {
  locationBlocks = groupIntoLocationBlocks(enriched); // fallback
}
```

---

## 🚨 Likely Root Causes

### Issue #1: Blocks Not Merging

**Three possible causes (in order of likelihood):**

#### A. **Segments have DIFFERENT place_ids despite being at same location**
   - If the two "Believe Candle Co." segments have different `place_id` values, they won't merge
   - This could happen if:
     - Place lookup returned different results at different times
     - One has a place_id, the other doesn't
     - User has multiple "Believe Candle Co." places saved with different IDs
   
   **How to verify:** Check the console logs - the ultra-verbose logging will show:
   ```
   🔥 [isSamePlace] Place ID check: seg1.placeId="X", seg2.placeId="Y" - NO MATCH
   ```

#### B. **Coordinates are > 200m apart**
   - If GPS drift caused segments to have different centroids > 200m apart
   - Less likely for an indoor location like a candle shop
   
   **How to verify:** Look for this log:
   ```
   🔥 [isSamePlace] ❌ TOO FAR APART: 250m > 200m - NOT MERGING
   ```

#### C. **Different labels AND no place_id**
   - If both segments lack a `place_id` and have different `placeLabel` values
   - Could happen if geocoding returned different results
   
   **How to verify:** Look for:
   ```
   🔥 [isSamePlace] Label check: labels don't match ("Believe Candle" !== "Believe Candle Co.")
   ```

### Issue #2: No Location Details

**Possible causes:**

#### A. **Hourly location data not being written**
   - `location_hourly` table/view may not be populated
   - Aggregation pipeline not running
   
   **Where to check:** `useLocationBlocksForDay` has debug logging:
   ```typescript
   console.log(`🔍 DEBUG: location_hourly data for ${date}:`);
   ```

#### B. **UI component for hourly breakdown missing/hidden**
   - The hourly detail view might not be rendered
   - Could be a conditional rendering issue
   
   **Where to check:** Look for hourly summary component in LocationBlockCard

### Issue #3: Recent Changes Not Deployed

**Critical question:** Are the Feb 11 fixes actually running in the app?

**How to verify:**
1. Check console logs for version banner:
   ```
   🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED - VERSION 2026-02-11-ULTRA-VERBOSE
   ```
2. If missing → code is not deployed/loaded
3. If present → proceed to check merge logs

---

## 🔬 Diagnostic Steps (Priority Order)

### Step 1: Check Console Logs (CRITICAL)
**Action:** Look at React Native console output while viewing the activity timeline

**What to look for:**
```
🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED - VERSION 2026-02-11-ULTRA-VERBOSE
🔥🔥🔥 [groupSegmentsIntoLocationBlocks] FUNCTION CALLED!
🔥 Received X segments, Y summaries
🔥🔥🔥 [isSamePlace] DETAILED COMPARISON:
```

**If you don't see these logs:**
- ✅ Recent changes are NOT deployed
- ❌ Need to rebuild/reload the app

**If you DO see these logs:**
- ✅ Recent changes ARE deployed
- ➡️ Proceed to Step 2 to analyze WHY segments aren't merging

### Step 2: Analyze Merge Decision Logs

**Look for the two "Believe Candle Co." segments in the logs:**

The logs will show EXACTLY why they're not merging:

```
🔥🔥🔥 [isSamePlace] DETAILED COMPARISON:
  SEG1: {
    placeLabel: "Believe Candle Co.",
    placeId: "abc123",  ← CHECK THIS
    ...
  }
  SEG2: {
    placeLabel: "Believe Candle Co.",
    placeId: "xyz789",  ← IF DIFFERENT = ROOT CAUSE
    ...
  }
```

### Step 3: Check Segment Data Quality

**Look for these logs in `useLocationBlocksForDay`:**
```typescript
console.log(`Used segment-based grouping: X segments → Y blocks`);
console.log(`Before gap-filling, X blocks:`);
console.log(`After gap-filling, Y blocks:`);
```

**Red flags:**
- ❌ "Used hourly-based grouping" - means NO segments were created
- ❌ Very few segments compared to hours of data
- ❌ Segments with `samples=0` or `geohash=null`

### Step 4: Check Database Queries (If Possible)

**If you can access Supabase SQL editor:**

```sql
-- Check if segments exist for the problem hours
SELECT 
  started_at, 
  ended_at, 
  place_label,
  place_id,  -- KEY: Are these different?
  location_lat,
  location_lng,
  location_geohash7
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11T02:00:00'
  AND started_at < '2026-02-11T08:00:00'
ORDER BY started_at;
```

**What to look for:**
- Two "Believe Candle Co." segments with DIFFERENT `place_id` values
- Coordinates that are far apart (> 200m)
- Missing `location_geohash7` values

---

## 🛠️ Recommended Fixes (Based on Root Cause)

### If Cause = Different Place IDs

**Fix:** Modify merge logic to be more lenient with place_id matching

```typescript
// In isSamePlace(), BEFORE the place_id check:
// If labels match and both have place_ids, check if they're "close enough" locations
if (seg1.placeId && seg2.placeId && seg1.placeId !== seg2.placeId) {
  const label1 = seg1.placeLabel?.trim().toLowerCase();
  const label2 = seg2.placeLabel?.trim().toLowerCase();
  
  // If labels match and coords are close, merge anyway (place_id mismatch is likely a data issue)
  if (label1 && label2 && label1 === label2 &&
      seg1.locationLat && seg1.locationLng && seg2.locationLat && seg2.locationLng) {
    const distance = haversineDistance(
      seg1.locationLat, seg1.locationLng,
      seg2.locationLat, seg2.locationLng
    );
    if (distance < SAME_PLACE_DISTANCE_THRESHOLD_M) {
      console.log(`🔥 [isSamePlace] ✅ LABEL+PROXIMITY MATCH (overriding place_id mismatch)`);
      return true;
    }
  }
}
```

### If Cause = Coordinates Too Far Apart

**Fix:** Increase proximity threshold OR implement fuzzy matching

```typescript
// Option 1: Increase threshold for stationary segments
const threshold = isCommuteSegment(seg1) ? 200 : 500; // 500m for stationary

// Option 2: Use geohash7 matching (already in the data)
if (seg1.locationGeohash7 && seg2.locationGeohash7 &&
    seg1.locationGeohash7 === seg2.locationGeohash7) {
  return true;
}
```

### If Cause = No Segments Created

**Fix:** Check BRAVO pipeline deployment
- Verify segment creation function is being called
- Check error logs for segment creation failures
- Ensure location samples exist in the database

### If Cause = Code Not Deployed

**Fix:** Rebuild and reload the app
```bash
cd apps/mobile
rm -rf node_modules/.cache
expo start --clear
```

---

## 📋 Action Items for Cole

### Immediate (Today)
1. ✅ **Check console logs** - Look for version banner and merge decision logs
2. ✅ **Screenshot merge logs** - Capture the isSamePlace comparisons for the two Believe Candle segments
3. ✅ **Check if deployed** - Confirm code changes from earlier today are loaded

### If Changes Not Deployed
1. ❌ Clear cache and rebuild
2. ❌ Reload dev client
3. ❌ Re-run app and check logs again

### If Changes ARE Deployed But Still Not Merging
1. ✅ Share merge decision logs (will show exact reason)
2. ✅ Implement fix based on root cause (see recommendations above)
3. ✅ Consider adding place_id normalization in segment creation

---

## 🎯 Expected Outcomes

### When Working Correctly

**Console output should show:**
```
🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED - VERSION 2026-02-11-ULTRA-VERBOSE
🔥🔥🔥 [groupSegmentsIntoLocationBlocks] FUNCTION CALLED!
🔥 Received 15 segments, 24 summaries
🔥 [groupSegmentsIntoLocationBlocks] Processing 15 segments:
  🔥 0: 2:42 AM - 4:00 AM: "Believe Candle Co." (ID: abc123, lat/lng: 30.1234,-97.5678)
  🔥 1: 4:00 AM - 7:03 AM: "Believe Candle Co." (ID: abc123, lat/lng: 30.1234,-97.5678)
  
🔥🔥🔥 [isSamePlace] DETAILED COMPARISON:
🔥 [isSamePlace] ✅ PLACE ID MATCH: "Believe Candle Co." (abc123) - MERGING

📍 [groupSegmentsIntoLocationBlocks] Created 1 groups:  ← SHOULD BE 1, NOT 2
  Group 0: "Believe Candle Co." (2 segments, 2:42 AM - 7:03 AM)
```

**UI should show:**
- ✅ One "Believe Candle Co." block (2:42 AM - 7:03 AM)
- ✅ Hourly location breakdown visible
- ✅ Proper segmentation across the day

---

## 📞 Next Steps

**If you need help interpreting logs or implementing fixes:**
1. Share console output (especially the isSamePlace logs)
2. Share Supabase query results (if accessible)
3. Confirm app version / deployment status

**Quick Win Test:**
Run this in the app to force a re-fetch:
```typescript
// In activity timeline, trigger refresh
// Should see all the debug logs
```

---

*This diagnosis is based on code analysis of the TodayMatters codebase as of Feb 11, 2026. The actual root cause will be revealed by the console logs when running the app.*
