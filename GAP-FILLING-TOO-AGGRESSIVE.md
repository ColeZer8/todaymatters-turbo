# Gap-Filling Too Aggressive - Analysis Report

**Date:** 2026-02-11  
**Issue:** Location "Monica Atherton" (Austin) carried forward 158 minutes to cover Birmingham blocks

## Executive Summary

The gap-filling algorithm has **NO DISTANCE CHECK** and uses an overly permissive **16-hour maximum gap duration**. This allows locations to be carried forward across massive distances (Austin → Birmingham = ~1,000 km).

---

## Current Gap-Filling Rules (BROKEN)

### Time Thresholds (from `group-location-blocks.ts`)

```typescript
// Line 643-650
const MIN_GAP_FOR_CARRY_FORWARD_MS = 30 * 60 * 1000;  // 30 minutes minimum
const MAX_CARRY_FORWARD_DURATION_MS = 16 * 60 * 60 * 1000; // 16 HOURS maximum (960 min!)
```

**Problem:** 158 minutes (2.6 hours) is well within the 16-hour maximum, so carry-forward proceeds.

### Distance Threshold

**THERE IS NONE FOR GAP-FILLING.**

The `fillLocationGaps()` function does NOT check distance between:
- The source block being carried forward
- The next block (or blocks being replaced)

---

## Why 158-Minute Gap is Allowed

The `fillLocationGaps()` function (line 698-786) checks:

```typescript
if (
  gapDurationMs >= MIN_GAP_FOR_CARRY_FORWARD_MS &&  // ✓ 158 min > 30 min
  gapDurationMs <= MAX_CARRY_FORWARD_DURATION_MS    // ✓ 158 min < 960 min
)
```

Both conditions pass. The function then checks:

```typescript
if (currentBlock.type === "stationary" && hasMeaningfulLocation(currentBlock)) {
  // Only checks if NEXT block has different meaningful location
  if (
    nextBlock.type === "stationary" &&
    hasMeaningfulLocation(nextBlock) &&
    nextLoc && nextLoc !== currentLoc
  ) {
    continue; // Skip - location changed
  }
  
  // ❌ NO DISTANCE CHECK HERE
  const carriedBlock = createCarriedForwardBlock(...);  // Blindly carries forward!
}
```

**Critical Bug:** If `nextBlock` has "Unknown Location" (no meaningful label), the distance check never happens, and Austin's location is carried forward to Birmingham.

---

## Why Austin → Birmingham Carry-Forward Isn't Prevented

### The Flow:

1. **Segment-based grouping:** 14 segments → 13 blocks
   - Morning blocks in Austin (geohash `9v6w9jz`)
   - Evening blocks in Birmingham (geohash `djfq4nk`) with "Unknown Location" labels

2. **Gap-filling runs:**
   ```
   LOG 📍 [fillLocationGaps] Found 158min gap from 2026-02-11T13:00:00.000Z 
   to 2026-02-11T15:38:17.963Z after "Monica Atherton - Wellness Navigator GTX"
   ```
   - Austin block ("Monica Atherton") ends
   - 158 min gap found (< 16 hours max ✓)
   - No distance check performed
   - Carries forward Austin location to fill gap

3. **"Unknown Location" replacement (line 713-727):**
   ```typescript
   if (
     !hasMeaningfulLocation(currentBlock) &&      // Birmingham has "Unknown Location" ✓
     currentBlock.type === "stationary" &&         // ✓
     lastKnownLocation &&                          // Austin exists ✓
     lastKnownLocation.type === "stationary"       // ✓
   ) {
     // ❌ NO DISTANCE CHECK - replaces Birmingham with Austin's location!
     const carriedBlock = createCarriedForwardBlock(lastKnownLocation, ...);
   }
   ```

4. **Block merging (line 896-938):**
   - Now ALL blocks have Austin's geohash (`9v6w9jz`) from carry-forward
   - `isSameBlockLocation()` sees matching geohashes
   - All blocks merge into one: 6:10 AM - 8:44 PM

### The `isSameBlockLocation()` Function HAS Distance Check - But It's Too Late!

```typescript
// Line 946-967 - This is ONLY used in mergeConsecutiveBlocks(), AFTER carry-forward!
function isSameBlockLocation(block1: LocationBlock, block2: LocationBlock): boolean {
  // Geohash7 match (strongest signal)
  if (block1.geohash7 && block2.geohash7 && block1.geohash7 === block2.geohash7) return true;
  
  // Coordinate proximity fallback (< 200m)
  if (block1.latitude != null && ...) {
    const distance = haversineDistance(...);
    if (distance < SAME_PLACE_DISTANCE_THRESHOLD_M) return true;  // 200m
  }
  
  return false;
}
```

By the time this runs, `createCarriedForwardBlock()` has already copied Austin's geohash to Birmingham blocks (line 1175):
```typescript
geohash7: sourceBlock.geohash7,  // Austin's geohash copied to Birmingham!
```

---

## Exact Fix Needed

### Fix 1: Add Distance Check to `fillLocationGaps()`

Before carrying forward, check if the NEXT block (or blocks being filled) are near the source:

```typescript
// BEFORE calling createCarriedForwardBlock:

// Distance check: If next block has coordinates, verify it's close enough
if (nextBlock.latitude != null && nextBlock.longitude != null &&
    currentBlock.latitude != null && currentBlock.longitude != null) {
  const distance = haversineDistance(
    currentBlock.latitude, currentBlock.longitude,
    nextBlock.latitude, nextBlock.longitude
  );
  
  const MAX_CARRY_FORWARD_DISTANCE_M = 2000; // 2 km max
  
  if (distance > MAX_CARRY_FORWARD_DISTANCE_M) {
    if (__DEV__) {
      console.log(
        `📍 [fillLocationGaps] ⏭️  Skipping gap - distance too far ` +
        `(${Math.round(distance)}m > ${MAX_CARRY_FORWARD_DISTANCE_M}m)`
      );
    }
    continue; // User moved too far - don't carry forward
  }
}
```

### Fix 2: Add Distance Check to "Unknown Location" Replacement

Same check needed at line 713-727:

```typescript
// Check if this is an "Unknown Location" block that should be replaced
if (!hasMeaningfulLocation(currentBlock) && currentBlock.type === "stationary" &&
    lastKnownLocation && lastKnownLocation.type === "stationary") {
  
  // ⚠️ NEW: Distance check before replacement
  if (currentBlock.latitude != null && currentBlock.longitude != null &&
      lastKnownLocation.latitude != null && lastKnownLocation.longitude != null) {
    const distance = haversineDistance(
      lastKnownLocation.latitude, lastKnownLocation.longitude,
      currentBlock.latitude, currentBlock.longitude
    );
    
    if (distance > MAX_CARRY_FORWARD_DISTANCE_M) {
      // Too far apart - don't replace, just add original block
      result.push(currentBlock);
      continue;
    }
  }
  
  // ... existing carry-forward logic
}
```

### Fix 3: Reduce Maximum Carry-Forward Duration

```typescript
// Current (broken):
const MAX_CARRY_FORWARD_DURATION_MS = 16 * 60 * 60 * 1000; // 16 hours

// Fixed (more reasonable):
const MAX_CARRY_FORWARD_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours daytime max
```

Or use time-of-day aware logic:
- Overnight (10 PM - 6 AM): Allow 10 hours (sleep)
- Daytime (6 AM - 10 PM): Allow 2 hours max

### Fix 4: Don't Copy Geohash in `createCarriedForwardBlock()`

The carried-forward block should NOT inherit the source geohash, as this causes false merges:

```typescript
// Current (broken) - line 1175:
geohash7: sourceBlock.geohash7,  // Copies Austin's geohash

// Fixed:
geohash7: null,  // Don't inherit - let merging use coordinates instead
```

---

## Summary of Thresholds to Fix

| Threshold | Current | Should Be |
|-----------|---------|-----------|
| Max gap duration | **16 hours** | 2-4 hours (daytime) |
| Max carry-forward distance | **NONE (∞)** | 1-2 km |
| Distance check for "Unknown" replacement | **NONE** | Required |
| Geohash inheritance | **Copies source** | Don't copy |

---

## Code Location Summary

| Line | Function | Issue |
|------|----------|-------|
| 649 | `MAX_CARRY_FORWARD_DURATION_MS` | 16 hours too long |
| 713-727 | Unknown replacement | No distance check |
| 762-786 | Gap-filling | No distance check before carry-forward |
| 1175 | `createCarriedForwardBlock()` | Copies source geohash |

---

## Test Case for Validation

After fix, this scenario should produce **separate blocks**:

```
6:10 AM - 12:00 PM: "Monica Atherton" (Austin, geohash 9v6w9jz)
1:00 PM - 3:38 PM: "Unknown Location" or gap (no carry-forward - distance too far)  
5:41 PM - 8:44 PM: "Birmingham Location" (Birmingham, geohash djfq4nk)
```

NOT one merged block from 6:10 AM - 8:44 PM.
