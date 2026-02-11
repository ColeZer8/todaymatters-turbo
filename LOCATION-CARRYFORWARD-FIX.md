# Location Carry-Forward Fix for Overnight Stays

## Problem
Since switching to movement-based tracking (Transistor), location data has gaps during stationary periods. When a user stays home overnight with no movement, the morning timeline blocks show NO location data.

**Example of the bug:**
```
8:00 PM - 11:00 PM: Home (captured on arrival) ✅
11:00 PM - 8:00 AM: [GAP - NO LOCATION] ❌
8:00 AM - 9:50 AM: [GAP - NO LOCATION] ❌
9:50 AM - 10:05 AM: Commute (movement detected) ✅
10:05 AM - 12:00 PM: Work (captured on arrival) ✅
```

## Solution
Implemented **location carry-forward** logic that fills gaps with the last known location when the user was stationary.

**Expected result:**
```
8:00 PM - 11:00 PM: Home (captured on arrival) ✅
11:00 PM - 8:00 AM: Home (carried forward) 🆕
8:00 AM - 9:50 AM: Home (carried forward) 🆕
9:50 AM - 10:05 AM: Commute (movement detected) ✅
10:05 AM - 12:00 PM: Work (captured on arrival) ✅
```

## Implementation

### Files Modified

1. **`apps/mobile/src/lib/utils/group-location-blocks.ts`**
   - Added `fillLocationGaps()` function to detect and fill gaps
   - Added `createCarriedForwardBlock()` helper to create synthetic blocks
   - Exports new functions for use in the UI pipeline

2. **`apps/mobile/src/lib/types/location-block.ts`**
   - Added `isCarriedForward?: boolean` field to `LocationBlock` type
   - Marks synthetic blocks for UI display/debugging

3. **`apps/mobile/src/lib/hooks/use-location-blocks-for-day.ts`**
   - Imported `fillLocationGaps` function
   - Calls gap-filling after grouping blocks into timeline
   - Logs gap-filling statistics for debugging

### Algorithm

The `fillLocationGaps()` function:

1. **Detects gaps** between consecutive location blocks
2. **Filters gaps** by duration:
   - Minimum: 30 minutes (ignore brief pauses)
   - Maximum: 12 hours (too long = uncertain)
3. **Carries forward** location from previous stationary block
4. **Stops** at travel blocks (movement = user left previous location)
5. **Creates synthetic blocks** with:
   - Location inherited from previous block
   - Screen time aggregated from hourly summaries
   - Lower confidence score (0.6x original)
   - `isCarriedForward: true` flag

### Edge Cases Handled

✅ **Overnight stays** - Carries forward home location across midnight
✅ **Travel blocks** - Stops carry-forward when user moves (travel block detected)
✅ **Short gaps** - Ignores gaps <30 minutes (likely data collection pauses)
✅ **Long gaps** - Doesn't carry forward >12 hours (too uncertain)
✅ **Screen time** - Includes actual screen time data from hourly summaries
✅ **Confidence scoring** - Lower confidence (0.6x) for inferred blocks

## Testing

### Test with Paul's Data

**User ID:** `b9ca3335-9929-4d54-a3fc-18883c5f3375`

**To verify:**
1. Open the TodayMatters mobile app
2. Navigate to Activity Timeline for Paul's account
3. Look for overnight periods (e.g., 11 PM - 8 AM)
4. Verify location blocks now show continuous location data

**Expected behavior:**
- No gaps in location timeline during stationary periods
- Carried-forward blocks show the last known location
- Travel blocks still separate different locations correctly
- Confidence scores are lower for carried-forward blocks

### Debug Logging

The implementation includes debug logging (only in development builds):

```
📍 [fillLocationGaps] Found 540min gap from 2026-02-10T23:00:00Z to 2026-02-11T08:00:00Z after "Home"
📍 [fillLocationGaps] ✅ Carried forward "Home" to fill 540min gap
[useLocationBlocksForDay] Filled gaps: 4 blocks → 5 blocks (1 gaps filled)
```

### Manual Verification

Check these scenarios:
1. ✅ **Overnight at home** - Location should show "Home" throughout
2. ✅ **Morning stationary** - Location carries forward until user leaves
3. ✅ **Travel blocks** - No carry-forward before travel (gap is OK)
4. ✅ **Short gaps** - Gaps <30 min are ignored (not filled)
5. ✅ **Multiple locations** - Each stationary period carries forward independently

## Architecture Notes

### Why UI Layer?

The carry-forward logic is implemented in the **UI grouping layer**, not the raw data pipeline, because:

1. **Preserves data integrity** - Raw location samples remain unchanged
2. **UI-specific concern** - Synthetic blocks are for visual continuity only
3. **No false evidence** - Carried-forward blocks have 0 location samples (accurate)
4. **Reprocessing-safe** - Re-running ingestion won't create duplicate synthetic data

### Data Flow

```
Raw GPS Samples (ALPHA)
    ↓
Location Segments (actual-ingestion.ts)
    ↓
Activity Segments (BRAVO) [saved to DB]
    ↓
Location Blocks (group-location-blocks.ts)
    ↓
[NEW] Fill Location Gaps (fillLocationGaps) 🆕
    ↓
Timeline Display (UI)
```

## Future Improvements

Potential enhancements:
1. **Smart gap detection** - Use screen time to infer if user was actually present
2. **Sleep detection** - Integrate with sleep data to confirm overnight stays
3. **Battery optimization** - Don't carry forward if device was off
4. **User feedback** - Let users confirm/reject carried-forward blocks

## Rollback

If issues arise, the fix can be easily disabled by commenting out the gap-filling call in `use-location-blocks-for-day.ts`:

```typescript
// Disable gap filling temporarily
// const blocksWithGapsFilled = fillLocationGaps(locationBlocks, enriched);
// setBlocks(blocksWithGapsFilled);
setBlocks(locationBlocks); // Use original blocks without gap filling
```

---

**Implementation Status:** ✅ Complete
**Testing Status:** ⏳ Awaiting verification with Paul's data
**Deployment:** Ready for testing in dev environment
