# 🚀 Quick Location Pipeline Debug Guide

**Problem:** Location blocks not merging (Believe Candle Co. showing as 2 blocks instead of 1)

---

## Option 1: Check Console Logs (Easiest)

1. **Open the app** on your device with React Native debugger connected
2. **Navigate to Activity Timeline** for Feb 11
3. **Look for these logs:**

```
🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED - VERSION 2026-02-11-ULTRA-VERBOSE
```

**If you see this** ✅ → Code is deployed, proceed to check merge logs  
**If you DON'T see this** ❌ → Code is not deployed, rebuild the app

4. **Scroll through logs to find the merge comparisons:**

```
🔥🔥🔥 [isSamePlace] DETAILED COMPARISON:
  SEG1: { placeLabel: "Believe Candle Co.", placeId: "...", ... }
  SEG2: { placeLabel: "Believe Candle Co.", placeId: "...", ... }
  
🔥 [isSamePlace] ❌ NOT MERGING - <REASON HERE>
```

The logs will tell you EXACTLY why the segments aren't merging!

---

## Option 2: Run Debug Function (Most Detailed)

1. **Import the debug function** in your app (e.g., in a dev screen or console):

```typescript
import { debugLocationMerge } from '@/lib/diagnostics/location-merge-debug';

// Run it
debugLocationMerge('b9ca3335-9929-4d54-a3fc-18883c5f3375', '2026-02-11');
```

2. **Check console output** - it will show:
   - All segments for the day (in a table)
   - Merge candidates (segments that should merge)
   - Specific analysis of "Believe Candle" segments
   - Root cause diagnosis

3. **Screenshot the output** and share for analysis

---

## Option 3: Database Query (If You Have Access)

Open Supabase SQL Editor and run:

```sql
SELECT 
  to_char(started_at, 'HH:MI AM') as start_time,
  to_char(ended_at, 'HH:MI AM') as end_time,
  place_label,
  LEFT(place_id, 12) as place_id_short,
  location_geohash7,
  ROUND(location_lat::numeric, 5) as lat,
  ROUND(location_lng::numeric, 5) as lng,
  ROUND(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) as duration_min
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11T00:00:00'
  AND started_at < '2026-02-11T23:59:59'
ORDER BY started_at;
```

**Look for:**
- Two "Believe Candle Co." rows
- Check if `place_id_short` is different between them
- Check if `location_geohash7` is different
- Check if lat/lng are > 200m apart

---

## Expected Root Causes & Fixes

### Cause 1: Different Place IDs ⚠️ (Most Likely)

**Symptom:** Both segments have the same label but different `place_id` values

**Why it happens:** 
- Place lookup returned different results at different times
- User has multiple saved places with similar names

**Fix:** Add label+proximity override in `group-location-blocks.ts`:

```typescript
// In isSamePlace(), after the place_id check:
if (seg1.placeId && seg2.placeId && seg1.placeId !== seg2.placeId) {
  // Check if labels match and coords are close
  const label1 = seg1.placeLabel?.trim().toLowerCase();
  const label2 = seg2.placeLabel?.trim().toLowerCase();
  
  if (label1 && label2 && label1 === label2 &&
      seg1.locationLat && seg1.locationLng && 
      seg2.locationLat && seg2.locationLng) {
    const distance = haversineDistance(
      seg1.locationLat, seg1.locationLng,
      seg2.locationLat, seg2.locationLng
    );
    if (distance < SAME_PLACE_DISTANCE_THRESHOLD_M) {
      console.log(`🔥 [isSamePlace] ✅ OVERRIDING place_id mismatch - same label+coords`);
      return true;
    }
  }
}
```

### Cause 2: Coordinates Too Far Apart

**Symptom:** Distance > 200m between segments

**Fix:** Increase threshold OR use geohash7 matching:

```typescript
// Option 1: Increase threshold
const SAME_PLACE_DISTANCE_THRESHOLD_M = 500; // was 200

// Option 2: Add geohash7 check (already in data)
if (seg1.locationGeohash7 && seg2.locationGeohash7 &&
    seg1.locationGeohash7 === seg2.locationGeohash7) {
  console.log(`🔥 [isSamePlace] ✅ GEOHASH7 MATCH - MERGING`);
  return true;
}
```

### Cause 3: Code Not Deployed

**Symptom:** No version banner in console

**Fix:**
```bash
cd apps/mobile
rm -rf node_modules/.cache
expo start --clear
```

Then reload the app and check logs again.

---

## Quick Checklist

- [ ] Check console for version banner (deployed?)
- [ ] Check console for merge decision logs (why not merging?)
- [ ] Run `debugLocationMerge()` function (detailed analysis)
- [ ] Check database query (raw segment data)
- [ ] Identify root cause from logs
- [ ] Apply appropriate fix
- [ ] Test with fresh data

---

## Need Help?

If you can't determine the root cause:
1. ✅ Screenshot the console output (especially isSamePlace logs)
2. ✅ Run `debugLocationMerge()` and screenshot output
3. ✅ Share database query results (if accessible)
4. ✅ Confirm app version / build timestamp

The logs will reveal the exact reason segments aren't merging!

---

**Pro Tip:** The ultra-verbose logging already in the code is your best friend. It was added specifically for this kind of debugging. Just look at the console! 🔥
