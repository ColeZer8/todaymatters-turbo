# 🔥 Location Merge Fix - Quick Reference

## The Problem
Two "Believe Candle Co." blocks showing separately instead of merged:
- Block 1: 2:42 AM - 4:00 AM
- Block 2: 4:00 AM - 7:03 AM
- **Should be:** One block 2:42 AM - 7:03 AM

---

## Step 1: Check If Code Is Deployed

Open app → Activity Timeline → Check console for:

```
🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED - VERSION 2026-02-11-ULTRA-VERBOSE
```

✅ **See it?** → Code deployed, go to Step 2  
❌ **Don't see it?** → Rebuild app:
```bash
cd apps/mobile && expo start --clear
```

---

## Step 2: Find the Merge Decision Log

Scroll console for:

```javascript
🔥🔥🔥 [isSamePlace] DETAILED COMPARISON:
  SEG1: { 
    placeLabel: "Believe Candle Co.",
    placeId: "abc123",  // ← CHECK THIS
    ...
  }
  SEG2: { 
    placeLabel: "Believe Candle Co.",
    placeId: "xyz789",  // ← AND THIS
    ...
  }
```

Look for the verdict line:
```
🔥 [isSamePlace] ❌ NOT MERGING - <REASON>
```

---

## Step 3: Identify Root Cause

### Cause A: Different Place IDs (Most Likely)
```
🔥 Place ID check: seg1.placeId="abc", seg2.placeId="xyz" - NO MATCH
```

### Cause B: Distance > 200m
```
🔥 Distance: 250m (threshold: 200m)
🔥 ❌ TOO FAR APART: 250m > 200m - NOT MERGING
```

### Cause C: Different Labels
```
🔥 Label check: labels don't match ("Believe Candle" !== "Believe Candle Co.")
```

---

## Step 4: Apply Fix

### Fix for Cause A (Different Place IDs)

**File:** `apps/mobile/src/lib/utils/group-location-blocks.ts`

**Location:** In `isSamePlace()` function, **AFTER** the place ID check (around line 95)

**Add this code:**

```typescript
  // 🔧 FIX: Override place_id mismatch if labels match and coords are close
  if (seg1.placeId && seg2.placeId && seg1.placeId !== seg2.placeId) {
    const label1 = seg1.placeLabel?.trim().toLowerCase();
    const label2 = seg2.placeLabel?.trim().toLowerCase();
    
    if (
      label1 &&
      label2 &&
      label1 === label2 &&
      label1 !== 'unknown location' &&
      label1 !== 'unknown' &&
      seg1.locationLat != null &&
      seg1.locationLng != null &&
      seg2.locationLat != null &&
      seg2.locationLng != null
    ) {
      const distance = haversineDistance(
        seg1.locationLat,
        seg1.locationLng,
        seg2.locationLat,
        seg2.locationLng,
      );
      
      if (distance < SAME_PLACE_DISTANCE_THRESHOLD_M) {
        console.log(
          `🔥 [isSamePlace] ✅ LABEL+PROXIMITY OVERRIDE - ` +
          `Same label "${label1}" + ${Math.round(distance)}m apart - MERGING (ignoring place_id mismatch)`
        );
        return true;
      }
    }
  }
```

**Insert BEFORE the coordinate proximity fallback section** (before line ~110 where it says "Coordinate proximity fallback")

### Fix for Cause B (Distance Too Far)

**Option 1: Increase threshold**
```typescript
// Line ~50
const SAME_PLACE_DISTANCE_THRESHOLD_M = 500; // was 200
```

**Option 2: Add geohash7 check** (before distance check, around line 120)
```typescript
  // Use geohash7 if available (more reliable than GPS coords)
  if (
    seg1.locationGeohash7 &&
    seg2.locationGeohash7 &&
    seg1.locationGeohash7 === seg2.locationGeohash7
  ) {
    console.log(`🔥 [isSamePlace] ✅ GEOHASH7 MATCH: ${seg1.locationGeohash7} - MERGING`);
    return true;
  }
```

### Fix for Cause C (Label Mismatch)

Already handled by existing label normalization (line ~155). If still failing, check:
- Are labels being normalized correctly?
- Is one label null or empty?

---

## Step 5: Test

1. Save changes
2. Reload app (`r` in Metro console)
3. Navigate to Activity Timeline
4. Check console - should see:
   ```
   🔥 [isSamePlace] ✅ LABEL+PROXIMITY OVERRIDE - MERGING
   ```
5. UI should show **ONE** "Believe Candle Co." block

---

## Debug Function (Alternative)

If console logs are overwhelming, use the debug function:

```typescript
// In a dev screen or console:
import { debugLocationMerge } from '@/lib/diagnostics/location-merge-debug';

debugLocationMerge(
  'b9ca3335-9929-4d54-a3fc-18883c5f3375',
  '2026-02-11'
);
```

Output will show:
- All segments in a table
- Merge candidates
- Specific "Believe Candle" analysis
- Root cause diagnosis

---

## Files Modified

✅ `apps/mobile/src/lib/utils/group-location-blocks.ts` - Add place_id override logic

---

## Success Criteria

✅ Version banner appears in console  
✅ Merge decision log shows "MERGING" for Believe Candle segments  
✅ UI shows ONE combined "Believe Candle Co." block  
✅ Time range: 2:42 AM - 7:03 AM (combined)

---

## If Still Not Working

1. Screenshot the merge decision log
2. Run `debugLocationMerge()` and screenshot output
3. Check that fix was added in correct location
4. Verify app reloaded after changes
5. Check that segments actually exist (not a data collection issue)

---

**Estimated Time:** 10-15 minutes (once root cause identified from logs)

**Confidence:** Very high - logs will show exact issue, fix is straightforward

---

*Quick ref by TodayMatters subagent - Feb 11, 2026*
