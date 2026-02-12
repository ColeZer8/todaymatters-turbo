# Anchor-Based Clustering Fix

**Date:** 2026-02-11  
**Fixed by:** Subagent (tm-anchor-clustering-fix)  
**File:** `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`

---

## Summary

Fixed the "moving centroid" bug in `generateLocationSegments()` that caused continuous travel to be grouped as a single segment.

## The Problem

When clustering GPS samples for segment generation, the algorithm compared each new sample to the **moving centroid** of the cluster. As the user drove, the centroid moved with them, so consecutive samples were always within 200m of the shifting center point. Result: an entire journey became ONE segment.

## The Fix

Changed comparison from **moving centroid** to **first sample (anchor)**. The cluster can now only grow 200m from its **starting point**, not its constantly-shifting center.

---

## Exact Lines Changed

**Location:** Lines 655-675 in `generateLocationSegments()` function

### Before (BROKEN):

```typescript
let sameCoordinateCluster = false;
let distanceFromCentroid = 0;
if (currentPlaceId === null && currentGroup.placeId === null) {
  const groupCentroid = calculateCentroid(currentGroup.samples);
  distanceFromCentroid = haversineDistance(
    groupCentroid.latitude,
    groupCentroid.longitude,
    sample.latitude,
    sample.longitude,
  );
  // 200m threshold for considering it the same location cluster
  sameCoordinateCluster = distanceFromCentroid < 200;
  
  // DEBUG: Log when distance is significant
  if (distanceFromCentroid > 100) {
    console.log(`📍 [CLUSTER DEBUG] Distance from centroid: ${Math.round(distanceFromCentroid)}m, sameCluster: ${sameCoordinateCluster}, sample: (${sample.latitude}, ${sample.longitude}), centroid: (${groupCentroid.latitude}, ${groupCentroid.longitude})`);
  }
}
```

### After (FIXED):

```typescript
let sameCoordinateCluster = false;
let distanceFromAnchor = 0;
if (currentPlaceId === null && currentGroup.placeId === null) {
  // ANCHOR-BASED CLUSTERING FIX:
  // Compare to FIRST sample (anchor) instead of moving centroid.
  // This prevents continuous travel from being grouped as one segment
  // because the centroid would move with the user, allowing indefinite cluster growth.
  const anchorSample = currentGroup.samples[0];
  distanceFromAnchor = haversineDistance(
    anchorSample.latitude!,
    anchorSample.longitude!,
    sample.latitude,
    sample.longitude,
  );
  // 200m threshold from cluster ANCHOR (start point), not moving center
  sameCoordinateCluster = distanceFromAnchor < 200;
  
  // DEBUG: Log when distance is significant
  if (distanceFromAnchor > 100) {
    console.log(`📍 [CLUSTER DEBUG] Distance from anchor: ${Math.round(distanceFromAnchor)}m, sameCluster: ${sameCoordinateCluster}, sample: (${sample.latitude}, ${sample.longitude}), anchor: (${anchorSample.latitude}, ${anchorSample.longitude})`);
  }
}
```

Also updated the debug log at line ~683:
```typescript
// Before:
console.log(`... distance: ${Math.round(distanceFromCentroid)}m`);

// After:
console.log(`... distance: ${Math.round(distanceFromAnchor)}m`);
```

---

## Testing Instructions

### 1. Delete existing segments for today

```sql
DELETE FROM tm.activity_segments 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375' 
  AND started_at >= '2026-02-11 00:00:00+00';
```

### 2. Trigger reprocessing

In TodayMatters app: **Settings → Debug → Reprocess Today**

Or via code:
```typescript
await processAllWindows(new Date('2026-02-11'));
```

### 3. Verify results

**Expected:** Multiple segments (5+ blocks) instead of one giant block

```sql
SELECT 
  started_at AT TIME ZONE 'America/Chicago' as started_cst,
  ended_at AT TIME ZONE 'America/Chicago' as ended_cst,
  place_label,
  place_category,
  inferred_activity
FROM tm.activity_segments 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375' 
  AND started_at >= '2026-02-11 23:30:00+00'
ORDER BY started_at;
```

### 4. Check debug logs

Watch for `[CLUSTER DEBUG]` logs showing clusters being split when distance from anchor exceeds 200m.

---

## Why This Works

| Scenario | Old (Centroid) | New (Anchor) |
|----------|----------------|--------------|
| Drive 1km | Centroid shifts, all samples stay within 200m of it → ONE segment | Samples >200m from start → NEW segment every ~200m |
| Stay at location | Samples cluster around center → ONE segment | Samples cluster around start → ONE segment |
| Walk 100m | Stays within 200m → same segment | Stays within 200m → same segment |

The anchor approach limits cluster growth to a **fixed 200m radius** from the starting point, rather than a moving window that follows the user.

---

## Build Status

✅ Code compiles (no TypeScript errors in `actual-ingestion.ts`)  
⚠️ Pre-existing TS errors in test files and other screens (unrelated to this fix)

---

## Files Modified

1. `apps/mobile/src/lib/supabase/services/actual-ingestion.ts` - Anchor clustering fix
2. `ANCHOR-CLUSTERING-FIX.md` - This documentation
