# Timeline Accuracy Analysis

**Date:** 2026-02-11  
**User:** Gravy (b9ca3335-9929-4d54-a3fc-18883c5f3375)  
**Analyst:** Subagent (tm-timeline-accuracy)

---

## Executive Summary

TodayMatters' timeline doesn't match Google Timeline or Gravy's actual journey due to **three interconnected issues**:

1. **Commute detection thresholds too loose** - Using `OR` instead of `AND` logic
2. **GPS jitter causing false travel detection** - Stationary samples register as movement
3. **Brief stops not being captured** - Anchor clustering merges 7-minute Santos Coffee visit

---

## Discrepancy Summary

### Expected Timeline (from Gravy's texts + Google):

| Time | Location | Type |
|------|----------|------|
| 5:57 PM | Left driveway | **Travel** |
| 6:00 PM - 6:07 PM | Santos Coffee Shop | **Stationary (7 min)** |
| 6:07 PM - 6:09 PM | Driving to dog park | **Travel** |
| 6:09 PM - 7:50 PM+ | Dog Park | **Stationary** |

### TodayMatters Shows:

| Time | Location | Type | Issue |
|------|----------|------|-------|
| ~5:57 PM - 6:25 PM | (merged or missing) | ? | Santos stop MISSED |
| 6:25 PM - 7:50 PM | Unknown/Travel | **Travel** | WRONG - was stationary! |

---

## Current Threshold Configuration

### From `actual-ingestion.ts`:

```typescript
// Anchor clustering radius (for grouping samples into segments)
const ANCHOR_CLUSTER_RADIUS_M = 200;  // meters

// Commute detection thresholds
const COMMUTE_SPEED_THRESHOLD = 1.0;   // m/s (~2.2 mph)
const COMMUTE_DISTANCE_THRESHOLD = 100; // meters
const MIN_COMMUTE_DISTANCE_M = 100;     // meters
const MIN_COMMUTE_DURATION_MS = 60000;  // 1 minute
const MAX_REALISTIC_SPEED_MS = 67;      // m/s (~150 mph)

// CRITICAL: Uses OR logic!
const isMoving = avgSpeed > COMMUTE_SPEED_THRESHOLD || totalDistance > COMMUTE_DISTANCE_THRESHOLD;
```

### From `group-location-blocks.ts`:

```typescript
// Gap filling thresholds
const MIN_GAP_FOR_CARRY_FORWARD_MS = 30 * 60 * 1000;  // 30 minutes
const MAX_CARRY_FORWARD_DURATION_MS = 16 * 60 * 60 * 1000; // 16 hours (!)
```

---

## Root Cause #1: Santos Coffee Stop Missed

### Why It's Missed:

Santos Coffee was a **7-minute stop** (6:00 PM - 6:07 PM). The current algorithm likely merged it with surrounding travel because:

1. **Anchor clustering too permissive**: At 200m radius, brief stops that are close to travel points get absorbed
2. **Minimum dwell time not enforced**: There's no explicit minimum duration check for stationary segments
3. **Samples may be sparse**: If only 2-3 samples captured at Santos Coffee, they may have been grouped with travel samples

### What Should Happen:

Santos Coffee should create a **separate stationary segment** because:
- User was there for 7 minutes (above any reasonable minimum dwell time)
- Coordinates would cluster tightly (GPS accuracy typically <20m when stationary)
- Speed should be ~0 m/s for these samples

### Verification Needed (SQL):

```sql
-- Check raw samples around 6:00 PM CST (= 00:00 UTC Feb 12)
SELECT 
  recorded_at AT TIME ZONE 'America/Chicago' as local_time,
  latitude, longitude, speed_mps, accuracy_m
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-12T00:00:00Z'
  AND recorded_at <= '2026-02-12T00:10:00Z'  -- 6:00-6:10 PM CST
ORDER BY recorded_at;
```

---

## Root Cause #2: False Travel Detection (6:25 PM - 7:50 PM)

### The Problem:

Gravy was **stationary at the dog park** from ~6:09 PM onwards, but TodayMatters shows **travel** from 6:25 PM - 7:50 PM.

### Why It Happens:

**GPS Jitter + OR Logic = False Positives**

The commute detection uses:
```typescript
const isMoving = avgSpeed > 1.0 || totalDistance > 100;
```

This means:
- If GPS drifts 50m over an hour (common with urban multipath) → `totalDistance > 100` → TRAVEL!
- Even if speed is 0 m/s, distance accumulation triggers false travel detection

### GPS Jitter Analysis:

Typical GPS accuracy is 5-20m horizontally. When stationary for 1+ hours, samples can "walk" due to:
- Atmospheric conditions
- Multipath from buildings/trees
- Satellite geometry changes

**Example:**
```
Sample 1: 29.50000, -98.50000
Sample 2: 29.50015, -98.49990  (17m drift)
Sample 3: 29.49985, -98.50020  (40m drift)
Sample 4: 29.50020, -98.49970  (55m drift)
...
Total cumulative distance: 150m+ → FALSE TRAVEL!
```

### Verification Needed (SQL):

```sql
-- Check samples for 6:25-7:50 PM CST
SELECT 
  recorded_at AT TIME ZONE 'America/Chicago' as local_time,
  latitude, longitude, speed_mps,
  accuracy_m
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-12T00:25:00Z'
  AND recorded_at <= '2026-02-12T01:50:00Z'
ORDER BY recorded_at;
```

Look for:
- Low speeds (< 0.5 m/s) indicating stationary
- High accuracy values (>15m) indicating GPS uncertainty
- Coordinates that cluster but don't drift far from centroid

---

## Root Cause #3: Label-Based Merging Bug (Previously Fixed)

**Status:** Fixed on 2026-02-11 8:25 PM CST

The `isSamePlace()` function was merging segments with matching place labels, even if they were miles apart. This caused:
- Multiple locations with "Monica Atherton" label → merged into one 14-hour block
- Different geohashes ignored because label matched

**Fix applied:** Removed label matching from `isSamePlace()` and `isSameBlockLocation()`.

---

## Threshold Recommendations

### 1. Change Commute Detection from OR to AND Logic

**Current (too loose):**
```typescript
const isMoving = avgSpeed > 1.0 || totalDistance > 100;
```

**Recommended:**
```typescript
// Require BOTH speed AND distance for travel detection
const isMoving = avgSpeed > SPEED_THRESHOLD && totalDistance > DISTANCE_THRESHOLD;

// OR use weighted scoring:
const isMoving = (avgSpeed * 30) + (totalDistance / 10) > TRAVEL_SCORE_THRESHOLD;
```

### 2. Lower Speed Threshold + Add Minimum Speed for Stationary

| Parameter | Current | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| `COMMUTE_SPEED_THRESHOLD` | 1.0 m/s | 2.0 m/s | 1 m/s is walking pace, too sensitive |
| `STATIONARY_MAX_SPEED` | (none) | 0.5 m/s | Explicitly define "stationary" |
| `COMMUTE_DISTANCE_THRESHOLD` | 100m | 250m | 100m is too close to GPS error margin |

### 3. Add GPS Smoothing / Jitter Filtering

Before calculating distance:
```typescript
function filterJitter(samples: LocationSample[]): LocationSample[] {
  // Skip samples with accuracy > 30m
  // Use median filtering (3-sample window)
  // Remove samples where speed > 150 mph
}
```

### 4. Reduce Gap-Filling Maximum Duration

**Current:** 16 hours  
**Recommended:** 4 hours (daytime), 10 hours (overnight)

```typescript
const MAX_CARRY_FORWARD_DURATION_MS = isOvernightGap(gapStart, gapEnd) 
  ? 10 * 60 * 60 * 1000   // 10 hours for sleep
  : 4 * 60 * 60 * 1000;   // 4 hours daytime max
```

### 5. Add Distance Check to Gap Filling

**Current:** No distance check → Austin can "carry forward" to Birmingham  
**Recommended:** Max 2km carry-forward distance

```typescript
const MAX_CARRY_FORWARD_DISTANCE_M = 2000; // 2 km

if (distance > MAX_CARRY_FORWARD_DISTANCE_M) {
  console.log(`📍 Skipping gap - distance too far (${distance}m)`);
  continue;
}
```

### 6. Add Minimum Dwell Time for Stationary Segments

**Recommended:** 3 minutes minimum  
This ensures brief GPS clusters during driving don't create false "stops".

```typescript
const MIN_STATIONARY_DURATION_MS = 3 * 60 * 1000; // 3 minutes

if (segmentType === 'stationary' && durationMs < MIN_STATIONARY_DURATION_MS) {
  // Too short to be a real stop - merge with surrounding travel
}
```

---

## Code Changes Needed

### File: `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`

#### Change 1: Use AND Logic for Commute Detection (Line ~802)

```typescript
// BEFORE:
const isMoving = avgSpeed > COMMUTE_SPEED_THRESHOLD || totalDistance > COMMUTE_DISTANCE_THRESHOLD;

// AFTER:
// Require BOTH speed AND distance to detect travel
// This prevents GPS jitter (low speed but accumulated distance) from triggering false travel
const COMMUTE_SPEED_THRESHOLD = 1.5;   // m/s (~3.4 mph, faster than walking)
const COMMUTE_DISTANCE_THRESHOLD = 200; // meters (twice GPS error margin)

const isMoving = avgSpeed > COMMUTE_SPEED_THRESHOLD && totalDistance > COMMUTE_DISTANCE_THRESHOLD;
```

#### Change 2: Add Stationary Speed Check (New)

```typescript
const STATIONARY_MAX_SPEED = 0.5; // m/s

// If average speed is below stationary threshold, force stationary even if distance is high
if (avgSpeed < STATIONARY_MAX_SPEED) {
  isMoving = false; // GPS jitter, not actual movement
}
```

### File: `apps/mobile/src/lib/utils/group-location-blocks.ts`

#### Change 3: Reduce Max Gap Duration (Line ~749)

```typescript
// BEFORE:
const MAX_CARRY_FORWARD_DURATION_MS = 16 * 60 * 60 * 1000; // 16 hours

// AFTER:
const MAX_CARRY_FORWARD_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours (daytime)
```

#### Change 4: Add Distance Check to Gap Filling (Line ~842, before `createCarriedForwardBlock`)

```typescript
// ADD before carry-forward:
const MAX_CARRY_FORWARD_DISTANCE_M = 2000; // 2 km

if (currentBlock.latitude && nextBlock.latitude) {
  const distance = haversineDistance(
    currentBlock.latitude, currentBlock.longitude!,
    nextBlock.latitude, nextBlock.longitude!
  );
  
  if (distance > MAX_CARRY_FORWARD_DISTANCE_M) {
    if (__DEV__) {
      console.log(`📍 [fillLocationGaps] ⏭️  Skipping gap - distance too far (${Math.round(distance)}m)`);
    }
    continue;
  }
}
```

---

## Comparison: TodayMatters vs Google Timeline Thresholds

| Parameter | TodayMatters (Current) | Google (Estimated) | Recommendation |
|-----------|----------------------|-------------------|----------------|
| Anchor radius | 200m | ~50-100m | 100m |
| Speed threshold for travel | 1.0 m/s | ~1.5-2.0 m/s | 1.5 m/s |
| Distance threshold for travel | 100m | ~200-300m | 200m |
| Speed/Distance logic | OR | AND | AND |
| Min dwell time for stops | None | ~2-3 min | 3 min |
| Max gap fill duration | 16 hours | ~2-4 hours | 4 hours |
| Max gap fill distance | Unlimited | ~1-2 km | 2 km |

---

## Testing Verification

After applying fixes, verify with:

```sql
-- Should show multiple segments, not one giant block
SELECT 
  id,
  started_at AT TIME ZONE 'America/Chicago' as start_cst,
  ended_at AT TIME ZONE 'America/Chicago' as end_cst,
  place_label,
  inferred_activity,
  ROUND(distance_m::numeric, 0) as distance_m
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11T23:00:00Z'
ORDER BY started_at;
```

Expected results:
- 5:57 PM - 6:00 PM: Travel (to Santos Coffee)
- 6:00 PM - 6:07 PM: Stationary (Santos Coffee)
- 6:07 PM - 6:09 PM: Travel (to dog park)
- 6:09 PM - 7:50 PM+: Stationary (dog park)

---

## Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Missing Santos Coffee stop | 200m anchor radius + no min dwell time | Reduce radius to 100m, add 3min min dwell |
| False travel 6:25-7:50 PM | OR logic + GPS jitter | Use AND logic, add stationary speed check |
| Over-merged blocks (Austin→Birmingham) | Gap fill has no distance check | Add 2km max distance |
| 16-hour gap fills | Max duration too permissive | Reduce to 4 hours |

**Priority:** 
1. HIGH - Fix OR → AND logic (immediate impact on false travel)
2. HIGH - Add distance check to gap filling  
3. MEDIUM - Reduce anchor radius and add min dwell time
4. LOW - Reduce gap fill duration

---

*Analysis complete. Implement fixes in order of priority and retest with fresh data.*
