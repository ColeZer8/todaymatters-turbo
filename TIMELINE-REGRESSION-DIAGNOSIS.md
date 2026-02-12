# Timeline Regression Diagnosis

## ✅ FIX APPLIED

**Status:** Fixed on 2026-02-11 at 8:25 PM CST

**Files Modified:**
- `apps/mobile/src/lib/utils/group-location-blocks.ts`

**Changes Made:**
1. Removed the buggy "place label matching" logic from `isSamePlace()`
2. Removed the same bug from `isSameBlockLocation()`
3. Removed verbose debug logging (🔥 emojis)

**Next Steps:**
1. Delete existing activity_segments for today (in app or via SQL)
2. Trigger reprocessing (pull to refresh in Activity Timeline)
3. Verify 7 blocks appear again

---

## Summary
**Timeline went from 7 detailed blocks to 2 giant merged blocks**

**Root Cause:** Commit `e9b581d` added a "place label matching" feature to `isSamePlace()` that merges segments with identical labels, even if they're at different physical locations. When the place lookup returns the same name for multiple locations (like "Monica Atherton - Wellness Navigator GTX"), ALL segments get merged into one giant block.

---

## Timeline of Events

| Time | Event |
|------|-------|
| 7:06 PM | 7 blocks showing correctly (Believe Candle Co., No Outlet, Steel City Chiropractic, etc.) |
| 7:30-8:00 PM | Agents deployed, made changes to grouping logic |
| 8:18 PM | Only 2 blocks showing ("Unknown Location" + "Monica Atherton" 14-hour block) |
| 8:18 PM+ | Reverts attempted but regression persists |

---

## Root Cause Analysis

### The Breaking Change (in `e9b581d`)

**File:** `apps/mobile/src/lib/utils/group-location-blocks.ts`

**Function:** `isSamePlace()`

**Lines Added (~lines 132-153):**
```javascript
// NEW: Place label match for geocoded locations (both have same meaningful label)
const label1 = seg1.placeLabel?.trim().toLowerCase();
const label2 = seg2.placeLabel?.trim().toLowerCase();
if (
  label1 &&
  label2 &&
  label1 === label2 &&
  label1 !== 'unknown location' &&
  label1 !== 'unknown' &&
  label1 !== 'location'
) {
  return true;  // ← MERGES SEGMENTS WITH SAME LABEL!
}
```

### Why This Breaks Everything

**Flow:**
1. `reprocessDayWithPlaceLookup()` creates segments for each hour
2. `enrichSegmentsWithPlaceNames()` calls `location-place-lookup` edge function
3. Edge function looks up places using Google Places API
4. **Key Issue:** The cache uses `latitude.toFixed(4),longitude.toFixed(4)` as keys (~11m precision)
5. If ANY coordinate lookup returns "Monica Atherton - Wellness Navigator GTX", it gets cached
6. Subsequent lookups for nearby coordinates (within ~11m) return the SAME cached name
7. **OR** Google's Nearby Places API returns the same business as "closest" for multiple queries
8. Now multiple segments have label "Monica Atherton - Wellness Navigator GTX"
9. `isSamePlace()` sees `label1 === label2` and **merges ALL of them**

### The Merge Chain Reaction

```
Segment 1: 6:10 AM, label="Monica Atherton"
Segment 2: 9:00 AM, label="Monica Atherton" (same label)
  → MERGE with Segment 1
Segment 3: 12:00 PM, label="Monica Atherton" (same label)
  → MERGE with Segment 1+2
...and so on...

Result: One giant 14-hour block labeled "Monica Atherton"
```

---

## Diff of Breaking Change

```diff
--- a/apps/mobile/src/lib/utils/group-location-blocks.ts (e9b581d~1)
+++ b/apps/mobile/src/lib/utils/group-location-blocks.ts (e9b581d)

function isSamePlace(seg1: ActivitySegment, seg2: ActivitySegment): boolean {
   // ... existing checks for commute, placeId, proximity ...

+  // NEW: Place label match for geocoded locations
+  const label1 = seg1.placeLabel?.trim().toLowerCase();
+  const label2 = seg2.placeLabel?.trim().toLowerCase();
+  if (
+    label1 &&
+    label2 &&
+    label1 === label2 &&
+    label1 !== 'unknown location' &&
+    label1 !== 'unknown' &&
+    label1 !== 'location'
+  ) {
+    return true;  // ← BUG: Merges segments even when physically distant!
+  }

   return false;
}
```

---

## Fix Instructions

### Step 1: Remove the Label Matching Logic

**File:** `apps/mobile/src/lib/utils/group-location-blocks.ts`

**Remove these lines (approx. lines 132-153):**

```javascript
// DELETE THIS ENTIRE BLOCK:
// NEW: Place label match for geocoded locations (both have same meaningful label)
// This handles cases where reverse geocoding returns the same place name but no place_id
const label1 = seg1.placeLabel?.trim().toLowerCase();
const label2 = seg2.placeLabel?.trim().toLowerCase();
console.log(`🔥 [isSamePlace] Label check: label1="${label1}", label2="${label2}"`);
if (
  label1 &&
  label2 &&
  label1 === label2 &&
  label1 !== 'unknown location' &&
  label1 !== 'unknown' &&
  label1 !== 'location'
) {
  console.log(`🔥 [isSamePlace] ✅ LABEL MATCH: "${seg1.placeLabel}" === "${seg2.placeLabel}" - MERGING`);
  return true;
} else {
  if (!label1 || !label2) {
    console.log(`🔥 [isSamePlace] Label check: one or both labels empty`);
  } else if (label1 !== label2) {
    console.log(`🔥 [isSamePlace] Label check: labels don't match ("${label1}" !== "${label2}")`);
  } else if (label1 === 'unknown location' || label1 === 'unknown' || label1 === 'location') {
    console.log(`🔥 [isSamePlace] Label check: labels match but are meaningless ("${label1}")`);
  }
}
```

### Step 2: Also Remove Debug Logging (Optional but Recommended)

The commit also added extensive `console.log` statements with 🔥 emojis. These should be removed for production:

```javascript
// Remove all lines like:
console.log(`🔥🔥🔥 [isSamePlace] DETAILED COMPARISON:`);
console.log(`  SEG1:`, JSON.stringify({...}));
// etc.
```

### Step 3: Clear Database and Reprocess

```sql
-- Clear existing activity_segments for today
DELETE FROM tm.activity_segments 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(started_at AT TIME ZONE 'America/Chicago') = '2026-02-11';

-- Clear location_place_cache (optional - forces fresh Google lookups)
DELETE FROM tm.location_place_cache
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';
```

### Step 4: Trigger Reprocess

In the app, go to Activity Timeline and pull down to refresh, or use the Location Debug screen to trigger reprocessing.

---

## SQL Queries to Verify Data Integrity

### Check Location Samples Count
```sql
SELECT COUNT(*) as sample_count,
       DATE(recorded_at AT TIME ZONE 'America/Chicago') as date
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(recorded_at AT TIME ZONE 'America/Chicago') = '2026-02-11'
GROUP BY DATE(recorded_at AT TIME ZONE 'America/Chicago');
```

### Check Activity Segments
```sql
SELECT id, 
       started_at AT TIME ZONE 'America/Chicago' as start_local,
       ended_at AT TIME ZONE 'America/Chicago' as end_local,
       place_label,
       place_id,
       location_lat,
       location_lng,
       inferred_activity
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(started_at AT TIME ZONE 'America/Chicago') = '2026-02-11'
ORDER BY started_at;
```

### Check Place Cache
```sql
SELECT latitude, longitude, place_name, google_place_id, source, fetched_at
FROM tm.location_place_cache
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
ORDER BY fetched_at DESC
LIMIT 20;
```

---

## Why the Revert Didn't Work

The commit `e9b581d` was supposedly the "fix" commit, but it actually **CONTAINS** the breaking change. The git log shows:

```
e9b581d fix: enhance location block merging and carry-forward logic
```

This commit added 7,496 lines of code including:
- The label matching bug in `isSamePlace()`
- Extensive debug logging (🔥 emojis everywhere)
- Changes to `fillLocationGaps()`
- Changes to `mergeConsecutiveBlocks()`

When you "reverted to e9b581d", you were reverting TO the buggy commit, not BEFORE it.

**To truly revert:** You need to go back to `e9b581d~1` (the commit BEFORE the bug):
```bash
git checkout e9b581d~1 -- apps/mobile/src/lib/utils/group-location-blocks.ts
```

---

## Alternative Fix: Use `e9b581d~1` Version

Instead of manual edits, restore the pre-bug version:

```bash
cd /Users/colezerman/Projects/todaymatters-turbo
git checkout e9b581d~1 -- apps/mobile/src/lib/utils/group-location-blocks.ts
```

This will restore `group-location-blocks.ts` to its state BEFORE the breaking changes.

---

## Summary

| Aspect | Before `e9b581d` | After `e9b581d` |
|--------|------------------|-----------------|
| `isSamePlace()` merging criteria | placeId match OR <200m proximity | placeId match OR <200m proximity **OR same label** |
| Result | 7 distinct blocks | 2 merged blocks |
| Root cause | - | Label matching merges distant locations with same name |

**Fix:** Remove the label matching logic from `isSamePlace()`.
