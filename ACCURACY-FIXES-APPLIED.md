# Accuracy Fixes Applied

**Date:** 2026-02-11
**File:** `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`

## Summary

Applied 3 surgical fixes to match Google Timeline accuracy:

1. **Changed OR → AND logic** for commute detection (fixes false travel)
2. **Reduced anchor radius** from 200m → 100m (catches brief stops)
3. **Updated minimum dwell time** from 5 → 3 minutes (keeps 7-min coffee stops)

---

## Fix #1: OR → AND Logic (Critical)

### Problem
GPS jitter accumulates distance even when stationary. With OR logic:
- Stationary at dog park: avgSpeed ~0.5 m/s, distance ~150m (jitter) → FALSE TRAVEL ❌

### Before
```typescript
// Classification thresholds (match Google Timeline behavior)
// - Average speed > 1.0 m/s (~2.2 mph) = definitely moving
// - Total distance > 100m = traveled a meaningful distance
const COMMUTE_SPEED_THRESHOLD = 1.0; // m/s
const COMMUTE_DISTANCE_THRESHOLD = 100; // meters

const isMoving = avgSpeed > COMMUTE_SPEED_THRESHOLD || totalDistance > COMMUTE_DISTANCE_THRESHOLD;
```

### After
```typescript
// Classification thresholds (match Google Timeline behavior)
// CRITICAL FIX: Use AND logic, not OR!
// - GPS jitter can accumulate >100m distance while stationary (avgSpeed ~0.5 m/s)
// - Using OR incorrectly classifies stationary as travel
// - Using AND: must have BOTH meaningful speed AND meaningful distance
// Speed data shows: stationary = 0-0.78 m/s, driving = 6.66-8.33 m/s
const COMMUTE_SPEED_THRESHOLD = 1.5; // m/s (~3.4 mph, faster than slow walk)
const COMMUTE_DISTANCE_THRESHOLD = 200; // meters (requires actual travel, not jitter)

// BOTH conditions must be true to classify as commute
// This prevents GPS jitter (high distance, low speed) from triggering false travel
const isMoving = avgSpeed > COMMUTE_SPEED_THRESHOLD && totalDistance > COMMUTE_DISTANCE_THRESHOLD;
```

### Why This Works

| Scenario | avgSpeed | distance | OR Logic | AND Logic |
|----------|----------|----------|----------|-----------|
| Stationary + GPS jitter | ~0.5 m/s | ~150m | COMMUTE ❌ | STATIONARY ✅ |
| Actual driving | ~7 m/s | ~500m | COMMUTE ✅ | COMMUTE ✅ |
| Walking | ~1.5 m/s | ~100m | COMMUTE | STATIONARY (correct for brief) |

---

## Fix #2: Anchor Radius Reduced

### Before
```typescript
// 200m threshold from cluster ANCHOR (start point), not moving center
sameCoordinateCluster = distanceFromAnchor < 200;
```

### After
```typescript
// 100m threshold from cluster ANCHOR (start point), not moving center
// Reduced from 200m to catch brief stops like coffee shops
sameCoordinateCluster = distanceFromAnchor < 100;
```

### Why This Works
- 200m radius was too large, merging Santos Coffee into adjacent travel
- 100m radius creates separate cluster for 7-minute coffee stop
- User would need to drift 100m from anchor to start new segment

---

## Fix #3: Minimum Dwell Time Reduced

### Before
```typescript
const MIN_DWELL_TIME_MS = 5 * 60 * 1000; // 5 minutes
```

### After
```typescript
const MIN_DWELL_TIME_MS = 3 * 60 * 1000; // 3 minutes (reduced from 5 to catch brief stops)
```

### Why This Works
- Santos Coffee stop was 7 minutes → passes 3-minute threshold ✅
- Red light stops (~30 seconds) still filtered out ✅
- Place label override: if place has a label, keep even if < 3 min

---

## Post-Filter Added

Also added a post-creation filter for stationary segments:

```typescript
const filteredSegments = segments.filter(seg => {
  // Keep all commute segments
  if (seg.meta?.kind === 'commute') {
    return true;
  }
  
  // For stationary segments, check duration
  const duration = seg.end.getTime() - seg.start.getTime();
  const hasMeaningfulPlace = seg.placeLabel !== null && seg.placeLabel !== undefined;
  
  // Keep if >= 3 minutes OR has a meaningful place label
  if (duration >= MIN_DWELL_TIME_MS || hasMeaningfulPlace) {
    return true;
  }
  
  return false;
});
```

---

## Expected Results After Reprocessing

For Gravy's evening (previously had false travel 6:25-7:50 PM):

| Time | Expected | Reason |
|------|----------|--------|
| ~5:30-5:57 PM | Stationary (home) | Low speed + short distance |
| ~5:57-6:00 PM | Commute (driving) | High speed (~7 m/s) + long distance (~500m) |
| 6:00-6:07 PM | **Stationary (Santos Coffee)** | 7 min > 3 min threshold, 100m radius catches it |
| 6:07-6:09 PM | Commute | Driving to dog park |
| 6:18-6:25 PM | Commute | Driving |
| **6:25+ PM** | **Stationary (dog park)** | Low avgSpeed (~0.5) despite GPS jitter distance |

---

## Testing Instructions

1. **Rebuild app:**
   ```bash
   cd apps/mobile
   npx expo prebuild --clean
   npx expo run:ios
   ```

2. **Reprocess location data:**
   - Clear existing segments for test date
   - Re-run ingestion for Feb 11 evening

3. **Verify:**
   - Dog park should show as STATIONARY (not travel)
   - Santos Coffee should appear as separate 7-min segment
   - Commute segments should only appear for actual driving

---

## Compilation Status

✅ `actual-ingestion.ts` compiles without errors
