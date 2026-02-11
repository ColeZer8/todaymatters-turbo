# Travel Detection Recalibration - Feb 10, 2026

## Problem
TodayMatters was missing travel segments that Google Maps Timeline detects. The app's thresholds for detecting movement were too conservative.

## Root Cause
The travel detection logic in `actual-ingestion.ts` had these issues:

1. **MIN_COMMUTE_DISTANCE_M = 200m** - Too high. Google detects walks as short as 100m
2. **MIN_MOVEMENT_SPEED_MS = 0.3 m/s** - Filtered out very slow walks (~0.7 mph)
3. **MIN_COMMUTE_DURATION_MS = 2 minutes** - Slightly conservative
4. **MIN_COMMUTE_GAP_CHECK_MS = 30 seconds** - Missed brief movements
5. **Movement classification thresholds** - Walking/cycling/driving boundaries too strict

## Changes Made

### File: `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`

| Threshold | Old Value | New Value | Reason |
|-----------|-----------|-----------|--------|
| `MIN_COMMUTE_DISTANCE_M` | 200m | **100m** | Match Google's sensitivity for short walks |
| `MIN_MOVEMENT_SPEED_MS` | 0.3 m/s (0.7 mph) | **0.15 m/s (0.3 mph)** | Detect very slow walks |
| `MIN_COMMUTE_DURATION_MS` | 2 minutes | **1 minute** | Capture brief movements |
| `MIN_COMMUTE_GAP_CHECK_MS` | 30 seconds | **15 seconds** | Check shorter gaps for movement |
| Walking threshold | < 2.5 m/s | **< 2.2 m/s** | Better walking detection |
| Cycling threshold | < 8.0 m/s | **< 7.0 m/s** | Better cycling detection |

### Movement Classification (Before vs After)

**Before:**
- Stationary: < 0.3 m/s (< 0.7 mph)
- Walking: 0.3-2.5 m/s (0.7-5.5 mph)
- Cycling: 2.5-8.0 m/s (5.5-18 mph)
- Driving: > 8.0 m/s (> 18 mph)

**After:**
- Stationary: < 0.15 m/s (< 0.3 mph)
- Walking: 0.15-2.2 m/s (0.3-5 mph)
- Cycling: 2.2-7.0 m/s (5-15.5 mph)
- Driving: > 7.0 m/s (> 15.5 mph)

## Expected Improvements

Users should now see:
- ✅ Short walks (100m+) detected as travel segments
- ✅ Slow walks (as slow as 0.3 mph) captured
- ✅ Brief movements (1+ minute) shown as separate segments
- ✅ More accurate walking vs. driving classification
- ✅ Better alignment with Google Maps Timeline

## Testing Instructions

### For Paul (User ID: `b9ca3335-9929-4d54-a3fc-18883c5f3375`)

1. **Trigger Reprocessing:**
   - Go to the Activity Timeline screen
   - Swipe down to refresh
   - Or wait for background sync to run

2. **Compare with Google Maps:**
   - Open Google Maps → Timeline
   - Pick today's date
   - Compare travel segments with TodayMatters
   - Check that short walks/drives now appear

3. **Verify Movement Types:**
   - Walk to a nearby location (~100-200m)
   - Check that it appears as "Walking" (not ignored)
   - Drive somewhere (~1-2 minutes)
   - Check that it appears as "Driving"

### For Cole (Testing)

```bash
# Test with recent data for Paul
cd /Users/colezerman/Projects/todaymatters-turbo
npm run dev

# In Supabase Studio, run:
SELECT 
  started_at,
  ended_at,
  place_label,
  inferred_activity,
  ROUND(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) as duration_min
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(started_at) = CURRENT_DATE
  AND inferred_activity = 'commute'
ORDER BY started_at;
```

Expected: More "commute" segments than before, including shorter ones.

## Rollback Plan

If this creates too much noise (e.g., GPS drift detected as movement):

```bash
# Revert the changes
cd /Users/colezerman/Projects/todaymatters-turbo
git checkout apps/mobile/src/lib/supabase/services/actual-ingestion.ts

# Or adjust individual thresholds up slightly
```

Recommended rollback values if needed:
- `MIN_COMMUTE_DISTANCE_M = 150` (compromise between 100 and 200)
- `MIN_MOVEMENT_SPEED_MS = 0.2` (compromise between 0.15 and 0.3)

## Next Steps

1. Deploy to production
2. Monitor for 24-48 hours
3. Compare Paul's timeline with Google Maps
4. Collect feedback on accuracy
5. Fine-tune thresholds if needed

## Notes

- The pipeline is solid - this is purely threshold recalibration
- No changes to location sampling or segment generation logic
- All changes are in `actual-ingestion.ts` (movement classification layer)
- The fix is backward compatible (won't break existing data)

---

**Commit:** Travel detection recalibration to match Google Maps accuracy  
**Author:** TodayMatters Agent  
**Date:** February 10, 2026
