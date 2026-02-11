# Location Label Save Bug - Debug Report

## Problem
User saves a location label (e.g., "Home") but it doesn't persist after refresh.

## Root Cause Hypothesis
**Geohash Key Mismatch** between save and load:

### Save Flow:
1. User clicks save on a location block
2. Block might have `geohash7 = null` (no data in location_hourly for that hour)
3. `saveLocationLabel()` generates a geohash7 from lat/lng coordinates
4. Label is saved to `user_places` with the **generated** geohash7

### Load Flow:
1. LocationBlockList enriches summaries from location_hourly
2. If location_hourly has no geohash7, the block's `geohash7` field is `null`
3. Label lookup: `userLabels[null]` → fails!
4. Label not found, fallback to pipeline/inference labels

## The Fix
When looking up user labels, if the block's geohash7 is null, **generate one from coordinates** and try that as a fallback lookup key.

##Changes Made

### 1. Added Comprehensive Logging
- `location-labels.ts`: Logs save/load operations, cache state
- `LocationBlockList.tsx`: Logs label resolution per hour
- `activity-timeline.tsx`: Logs block data before save

### 2. Fixed Label Lookup Logic (NEXT STEP)
Need to add fallback geohash7 generation in LocationBlockList enrichment phase.

## Testing Steps for Cole

1. **Reproduce the bug:**
   - Open app with dev console attached
   - Go to a location block
   - Set label to "Home"
   - Save
   - Pull to refresh

2. **Check logs for:**
   ```
   🔍 [ActivityTimeline] handleSaveRename - block data:
   - Check if `geohash7` is null or has a value
   
   🔍 [saveLocationLabel] CALLED with:
   - Check what geohash7 is being saved
   
   🔍 [getLocationLabels] Fetched X rows from database
   - Verify the label was saved
   
   🔍 [LocationBlockList] Hour X label resolution:
   - Check if geohash7 matches saved one
   ```

3. **Expected Issue:**
   - Save geohash7: `abc1234` (generated)
   - Load geohash7: `null` (from location_hourly)
   - Match: ❌ FAILED

## Next Steps
- [ ] Cole: Test and share logs
- [ ] Add fallback lookup logic
- [ ] Verify fix works
