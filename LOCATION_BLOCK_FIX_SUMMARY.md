# Location Block Merging & Carry-Forward Fix

## Date: Feb 11, 2026

## Issues Fixed

### Issue 1: Same-Location Blocks Not Merging ✅

**Problem:** Two consecutive blocks at "Believe Candle Co." (2:42 AM - 4 AM and 4 AM - 7:03 AM) were showing as separate blocks instead of merging into one.

**Root Cause:** The `isSamePlace()` function was only checking:
- Place ID match
- Coordinate proximity (<200m)

But it was missing a check for **place label match**. When reverse geocoding returns the same place name for two segments but they don't have place IDs (or have different IDs), they wouldn't merge.

**Fix:**
- Added place label matching: if two consecutive segments have the same meaningful place label (case-insensitive), they now merge
- Added comprehensive debug logging to show why blocks are/aren't merging
- Logs include: place IDs, coordinates, distances, and merge decisions

**Code Changes:** `group-location-blocks.ts` - `isSamePlace()` function

---

### Issue 2: "Unknown Location" Instead of Carry-Forward ✅

**Problem:** A block from 7:03 AM - 7:56 AM was showing "Unknown Location" instead of carrying forward "Believe Candle Co." from the previous block.

**Root Cause:** The `fillLocationGaps()` function was only filling **gaps between blocks** (time periods with no blocks). It wasn't handling blocks that already existed but had "Unknown Location" labels.

**Fix:**
- Modified `fillLocationGaps()` to track the last known meaningful location
- When it encounters an "Unknown Location" block immediately after a known location, it **replaces** that block with a carried-forward version
- The carried-forward block inherits the location label, geohash, coordinates, and other location data from the previous block
- Still handles true gaps between blocks as before

**Code Changes:** `group-location-blocks.ts` - `fillLocationGaps()` function

---

## Debug Logging Added

The following debug logs are now active when running in development mode (`__DEV__`):

### During Segment Processing:
```
📍 [groupSegmentsIntoLocationBlocks] Processing X segments:
  0: 2:42 AM - 4:00 AM: "Believe Candle Co." (ID: abc123, lat/lng: 41.1234,-87.5678)
  1: 4:00 AM - 7:03 AM: "Believe Candle Co." (ID: def456, lat/lng: 41.1235,-87.5679)
```

### During Merge Comparisons:
```
📍 [groupSegmentsIntoLocationBlocks] Comparing segments 0 and 1:
  Prev: "Believe Candle Co." (2:42 AM - 4:00 AM)
  Curr: "Believe Candle Co." (4:00 AM - 7:03 AM)
  
📍 [isSamePlace] ✅ Merging by place label: "Believe Candle Co."
  ✅ Merged into current group (now 2 segments)
```

### During Gap Filling:
```
📍 [fillLocationGaps] 🔄 Replaced "Unknown Location" block (7:03 AM - 7:56 AM) 
with carried-forward location "Believe Candle Co."
```

---

## Testing Instructions

### 1. Run the App in Development Mode
```bash
cd apps/mobile
npm run ios
# or
npm run android
```

### 2. Navigate to Feb 11, 2026 Data
- Open the app
- Go to the Location Blocks view
- Navigate to Feb 11, 2026

### 3. Check Metro Logs
In the Metro bundler console, you should see:
- Debug logs showing all segments
- Comparison logs showing merge decisions
- Gap-filling logs showing carry-forward operations

### 4. Expected Results

**Before Fix:**
- Block 1: Believe Candle Co., 2:42 AM - 4 AM (1h 18m)
- Block 2: Believe Candle Co., 4 AM - 7:03 AM (3h 3m)
- Block 3: Unknown Location, 7:03 AM - 7:56 AM (53m)

**After Fix:**
- Block 1: Believe Candle Co., 2:42 AM - 7:56 AM (5h 14m)

Or possibly:
- Block 1: Believe Candle Co., 2:42 AM - 7:03 AM (4h 21m) ← merged from two segments
- Block 2: Believe Candle Co., 7:03 AM - 7:56 AM (53m) ← carried forward

---

## Verification Steps

1. **Check Block Count:** Should see fewer blocks (merged)
2. **Check Labels:** No "Unknown Location" blocks immediately after known locations
3. **Check Times:** Consecutive same-place blocks should merge into one continuous block
4. **Check Debug Logs:** Should see merge confirmations and carry-forward operations

---

## Files Modified

1. `apps/mobile/src/lib/utils/group-location-blocks.ts`
   - `isSamePlace()` - Added place label matching + debug logging
   - `fillLocationGaps()` - Added "Unknown Location" replacement logic
   - `groupSegmentsIntoLocationBlocks()` - Added comprehensive debug logging

2. `apps/mobile/src/lib/types/location-block.ts`
   - Already had `isCarriedForward?: boolean` flag (no changes needed)

---

## Technical Details

### Why Place Label Matching Works

When reverse geocoding is performed:
1. Multiple GPS coordinates near the same business may get the same place name
2. But they might not have Google Place IDs (if using reverse geocoding instead of Places API)
3. Or they might have different Place IDs (different entrances, parking lots, etc.)
4. Place label matching catches these cases and merges them appropriately

### Why "Unknown Location" Replacement Works

The previous logic only looked for **gaps** (time with no blocks). But "Unknown Location" blocks were **real blocks** created by the grouping algorithm when segments had no location data. By replacing them during gap-filling, we effectively "extend" the previous known location to cover these periods.

---

## Next Steps

1. **Test with Feb 11 data** - Verify both fixes work
2. **Test with other dates** - Make sure fixes don't break existing behavior
3. **Monitor debug logs** - Look for any unexpected merge/carry-forward behavior
4. **Remove debug logs** - Once verified, can reduce verbosity or gate behind a feature flag

---

## Notes

- All debug logging is gated behind `__DEV__` checks, so it won't appear in production
- The `isCarriedForward` flag is set on synthetic blocks for UI/debugging purposes
- Carried-forward blocks have lower confidence scores (0.6x original) since they're inferred
- Place label matching is case-insensitive and filters out meaningless labels like "Unknown Location"
