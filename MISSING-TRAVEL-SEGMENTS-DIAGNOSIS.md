# Missing Travel Segments Diagnosis

**Date:** 2026-02-11  
**User:** Gravy (b9ca3335-9929-4d54-a3fc-18883c5f3375)  
**Time Range:** 5:30 PM - 8:30 PM CST  
**Issue:** TodayMatters shows 1 block ("Believe Candle Co") instead of Google Timeline's detailed segments

---

## Executive Summary

**ROOT CAUSE:** The segment generation algorithm creates ONE large "unknown location" segment for the entire travel period because:

1. **Moving centroid bug** - Samples are grouped if within 200m of the group's centroid, but the centroid MOVES with the user, allowing continuous driving to be treated as one stationary cluster
2. **Commute detection only checks GAPS** - The commute detection algorithm only looks for travel in gaps BETWEEN segments, not WITHIN segments
3. **No movement analysis** - The clustering algorithm doesn't analyze whether samples represent MOVEMENT vs STATIONARY behavior

---

## Google Timeline vs TodayMatters Comparison

### Google Timeline Shows:
| Time | Activity | Details |
|------|----------|---------|
| 5:16 PM - 6:09 PM | **Driving** | 2.0 mi, 53 min |
| 6:09 PM - 6:18 PM | **Walking** | 0.6 mi, 9 min |
| 6:18 PM - Now | **Driving** | 1.4 mi, 5 min |

### TodayMatters Shows:
| Time | Activity | Details |
|------|----------|---------|
| ~5:30 PM - 8:30 PM | Believe Candle Co | Single stationary block |

---

## SQL Queries for Verification

**Note:** These queries require service role access to the `tm` schema.

### Query 1: Activity Segments for Gravy (5:30 PM - 8:30 PM)

```sql
SELECT 
  id,
  started_at AT TIME ZONE 'America/Chicago' as started_at_cst,
  ended_at AT TIME ZONE 'America/Chicago' as ended_at_cst,
  place_label,
  place_category,
  inferred_activity,
  location_lat,
  location_lng,
  evidence
FROM tm.activity_segments 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375' 
  AND started_at >= '2026-02-11 23:30:00+00'  -- 5:30 PM CST = 23:30 UTC
  AND started_at <= '2026-02-12 02:30:00+00'  -- 8:30 PM CST
ORDER BY started_at;
```

### Query 2: Location Samples with Movement Data

```sql
SELECT 
  recorded_at AT TIME ZONE 'America/Chicago' as recorded_at_cst,
  latitude,
  longitude,
  speed_mps,
  accuracy_m,
  heading_deg
FROM tm.location_samples 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375' 
  AND recorded_at >= '2026-02-11 23:30:00+00'
  AND recorded_at <= '2026-02-12 02:30:00+00'
ORDER BY recorded_at;
```

---

## Code Analysis: Root Causes

### Issue 1: Moving Centroid Bug in Segment Clustering

**File:** `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`  
**Lines:** 653-673

```typescript
// For samples without user place matches, check coordinate proximity
// If the sample is >200m from the group's centroid, start a new group
let sameCoordinateCluster = false;
let distanceFromCentroid = 0;
if (currentPlaceId === null && currentGroup.placeId === null) {
  const groupCentroid = calculateCentroid(currentGroup.samples);  // ← RECALCULATED EACH TIME
  distanceFromCentroid = haversineDistance(
    groupCentroid.latitude,
    groupCentroid.longitude,
    sample.latitude,
    sample.longitude,
  );
  // 200m threshold for considering it the same location cluster
  sameCoordinateCluster = distanceFromCentroid < 200;
}
```

**Problem:** When driving continuously:
1. Each new sample is compared to the centroid of ALL previous samples
2. As user drives, the centroid MOVES with them (average position shifts)
3. Consecutive samples are typically ~50-100m apart (30-sec intervals at driving speeds)
4. Each sample is within 200m of the constantly-moving centroid
5. Result: Entire journey becomes ONE segment

**Example:**
```
Sample 1: (29.50, -98.50) → centroid = (29.50, -98.50)
Sample 2: (29.51, -98.50) → distance from centroid ≈ 111m < 200m → SAME CLUSTER
                          → new centroid = (29.505, -98.50)
Sample 3: (29.52, -98.50) → distance from centroid ≈ 167m < 200m → SAME CLUSTER
                          → new centroid = (29.51, -98.50)
Sample 4: (29.53, -98.50) → distance from centroid ≈ 222m > 200m → NEW CLUSTER!

BUT this only happens if samples are 200m+ apart. In reality:
- At 30 mph, 30-second intervals = ~400m between samples
- At 15 mph (city driving), 30-second intervals = ~200m between samples
- With traffic/stops, often < 150m between samples

So the centroid approach MIGHT work for highway driving but FAILS for city driving!
```

### Issue 2: Commute Detection Only Checks Gaps BETWEEN Segments

**File:** `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`  
**Function:** `processSegmentsWithCommutes()`  
**Lines:** 1219-1285

```typescript
export function processSegmentsWithCommutes(
  segments: LocationSegment[],
  locationSamples: EvidenceLocationSample[],
  userPlaces: UserPlaceRow[],
  windowStart: Date,
): LocationSegment[] {
  if (segments.length === 0) {
    // ← Only checks for commute when NO segments exist
    if (locationSamples.length >= 2) {
      const commute = detectCommute(locationSamples, startTime, endTime, userPlaces);
      if (commute.isCommute && commute.isLongCommute) {
        return [commuteSegment];
      }
    }
    return segments;
  }
  
  // ← If segments exist, only looks at GAPS between them
  for (let i = 0; i < sortedSegments.length; i++) {
    // Check gap before first segment
    // Check gap AFTER current segment to next segment
  }
```

**Problem:** 
1. When the clustering creates ONE segment for the entire journey, `segments.length === 1`
2. The `if (segments.length === 0)` block is SKIPPED
3. No gaps exist between segments to detect commutes in
4. The travel is never identified as a commute

### Issue 3: No Analysis of MOVEMENT vs STATIONARY Within Segments

The system has:
- `classifyMovementType()` - calculates speed and classifies walking/cycling/driving
- `isMovementGroup()` - checks if samples represent movement
- `detectCommute()` - identifies commute patterns

**BUT** these are only called for samples in "gaps" between segments. They're NEVER called for samples WITHIN a segment to split it into travel + stationary parts.

---

## Why "Believe Candle Co" Was Shown

The `enrichSegmentsWithPlaceNames()` function:

1. Takes the ONE segment created for 5:30 PM - 8:30 PM
2. Calculates its centroid (average of all GPS points during the drive)
3. Calls Google Places API with that centroid
4. Google returns "Believe Candle Co" as the nearest business
5. The segment gets labeled with that place name

The centroid of a journey from A to B is somewhere in the MIDDLE - which is why a random business along the route gets tagged.

---

## Fix Proposal

### Fix 1: Add Movement Detection WITHIN Segments (Recommended)

Modify `generateLocationSegments()` to SPLIT clusters when movement is detected:

```typescript
// In generateLocationSegments(), after grouping samples:

for (const group of groups) {
  // NEW: Check if this group represents MOVEMENT
  const distanceTraveled = calculatePathDistance(group.samples);
  const durationMs = getGroupDuration(group.samples);
  const movementType = classifyMovementType(distanceTraveled, durationMs);
  
  if (movementType !== 'stationary' && distanceTraveled > MIN_COMMUTE_DISTANCE_M) {
    // This is a TRAVEL segment, not a stationary one
    // Create it as kind: 'commute' instead of 'location_block'
    segment.meta.kind = 'commute';
    segment.meta.movement_type = movementType;
    segment.meta.distance_m = distanceTraveled;
  }
}
```

### Fix 2: Use FIRST Sample as Anchor for Clustering

Instead of comparing to the moving centroid, compare to the FIRST sample in the cluster:

```typescript
// Current (buggy):
const groupCentroid = calculateCentroid(currentGroup.samples);
const distance = haversineDistance(centroid, newSample);

// Fixed:
const anchorSample = currentGroup.samples[0];  // First sample stays fixed
const distance = haversineDistance(anchorSample, newSample);
```

This ensures the cluster can only grow 200m from its STARTING point, not its moving center.

### Fix 3: Run Commute Detection ON Segments, Not Just Gaps

Add a new function that checks each segment for internal movement:

```typescript
function detectCommuteWithinSegment(
  segment: LocationSegment,
  allSamples: EvidenceLocationSample[],
  userPlaces: UserPlaceRow[],
): LocationSegment[] {
  const segmentSamples = allSamples.filter(s => 
    s.recorded_at >= segment.start && s.recorded_at <= segment.end
  );
  
  const distance = calculatePathDistance(segmentSamples);
  const duration = segment.end.getTime() - segment.start.getTime();
  const movementType = classifyMovementType(distance, duration);
  
  if (movementType !== 'stationary' && distance > MIN_COMMUTE_DISTANCE_M) {
    // This segment IS a commute, convert it
    return [{
      ...segment,
      meta: {
        ...segment.meta,
        kind: 'commute',
        movement_type: movementType,
        distance_m: distance,
      }
    }];
  }
  
  return [segment];
}
```

---

## Implementation Priority

1. **HIGH** - Fix 1 (Movement detection within segments)
   - This directly addresses the root cause
   - Prevents travel from being classified as stationary
   
2. **MEDIUM** - Fix 2 (Anchor-based clustering)
   - Prevents the moving centroid issue
   - Makes clustering more predictable
   
3. **LOW** - Fix 3 (Commute detection on segments)
   - Additional safety net
   - Catches edge cases

---

## Test Plan

### Manual Test Steps

1. **Trigger reprocess for today:**
   ```
   In TodayMatters app: Settings → Debug → Reprocess Today
   ```

2. **Verify segments via SQL:**
   ```sql
   SELECT place_category, inferred_activity, count(*) 
   FROM tm.activity_segments 
   WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
     AND started_at >= '2026-02-11 23:00:00+00'
   GROUP BY place_category, inferred_activity;
   ```

3. **Expected results after fix:**
   - `place_category = 'commute'` segments for driving/walking periods
   - `inferred_activity = 'commute'` for travel segments
   - Multiple segments instead of one giant block
   - Proper movement_type values (driving/walking)

### Automated Test Ideas

```typescript
describe('Movement Detection', () => {
  it('should create commute segment for driving samples', () => {
    const samples = generateDrivingSamples(30, 5); // 30 samples over 5 minutes at 30mph
    const segments = generateLocationSegments(samples, [], start, end);
    
    expect(segments.length).toBe(1);
    expect(segments[0].meta.kind).toBe('commute');
    expect(segments[0].meta.movement_type).toBe('driving');
  });
  
  it('should create stationary segment for stationary samples', () => {
    const samples = generateStationarySamples(10, 30); // 10 samples over 30 minutes
    const segments = generateLocationSegments(samples, [], start, end);
    
    expect(segments.length).toBe(1);
    expect(segments[0].meta.kind).toBe('location_block');
  });
});
```

---

## Files to Modify

1. `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`
   - `generateLocationSegments()` - Add movement detection
   - Cluster anchor comparison instead of centroid
   
2. `apps/mobile/src/lib/supabase/services/activity-segments.ts`
   - `generateActivitySegments()` - Ensure commute segments get proper `inferredActivity`

---

## Concrete Code Fix

### File: `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`

**Location:** Inside `generateLocationSegments()`, after the `for (let groupIdx...)` loop that converts groups to segments, around line 700-730.

**Add this code AFTER calculating segment boundaries but BEFORE applying dwell filter:**

```typescript
// Convert groups to segments, applying the 70% threshold
for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
  const group = groups[groupIdx];
  if (group.samples.length === 0) continue;

  // ... existing code for segment boundaries ...
  
  // ========== NEW: MOVEMENT DETECTION WITHIN SEGMENT ==========
  // Check if this segment represents TRAVEL (moving) vs STATIONARY
  // This catches cases where clustering grouped a journey into one segment
  const pathDistance = calculatePathDistance(group.samples);
  const segmentDurationMs = clampedEnd.getTime() - clampedStart.getTime();
  const movementType = classifyMovementType(pathDistance, segmentDurationMs);
  
  // If this segment shows significant movement, it's actually a commute
  const isMovingSegment = 
    movementType !== 'stationary' && 
    movementType !== 'unknown' && 
    pathDistance >= MIN_COMMUTE_DISTANCE_M;  // 100m minimum
  
  if (isMovingSegment) {
    if (__DEV__) {
      console.log(`📍 [MOVEMENT DETECTED] Segment shows ${movementType} movement: ${Math.round(pathDistance)}m in ${Math.round(segmentDurationMs/1000)}s`);
    }
    
    // Create as COMMUTE segment, not location_block
    const centroid = calculateCentroid(group.samples);
    const sourceId = generateCommuteSourceId(windowStart, clampedStart);
    const confidence = calculateSegmentConfidence(group.samples.length, matchRatio);
    const telemetry = summarizeTelemetry(group.samples);

    segments.push({
      sourceId,
      start: clampedStart,
      end: clampedEnd,
      placeId: null,  // Commutes don't have a place
      placeLabel: null,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      sampleCount: group.samples.length,
      confidence,
      meta: {
        kind: "commute",  // ← KEY CHANGE: Mark as commute
        place_id: null,
        place_label: null,
        sample_count: group.samples.length,
        confidence,
        intent: "commute",
        distance_m: pathDistance,
        movement_type: movementType,
        provider: telemetry.provider,
        activity: telemetry.activity,
        battery_level: telemetry.battery_level,
        battery_state: telemetry.battery_state,
        is_simulator: telemetry.is_simulator,
        is_mocked: telemetry.is_mocked,
      },
    });
    
    continue;  // Skip normal segment creation
  }
  // ========== END NEW CODE ==========
  
  // ... existing code for dwell filter and creating location_block segment ...
}
```

### Alternative Fix: Anchor-Based Clustering

**Location:** Lines 653-673, replace centroid comparison with anchor comparison:

```typescript
// CURRENT (buggy - centroid moves):
if (currentPlaceId === null && currentGroup.placeId === null) {
  const groupCentroid = calculateCentroid(currentGroup.samples);
  distanceFromCentroid = haversineDistance(
    groupCentroid.latitude,
    groupCentroid.longitude,
    sample.latitude,
    sample.longitude,
  );
  sameCoordinateCluster = distanceFromCentroid < 200;
}

// FIXED (anchor stays fixed):
if (currentPlaceId === null && currentGroup.placeId === null) {
  // Use FIRST sample as anchor, not moving centroid
  const anchorSample = currentGroup.samples[0];
  const distanceFromAnchor = haversineDistance(
    anchorSample.latitude!,
    anchorSample.longitude!,
    sample.latitude,
    sample.longitude,
  );
  // 200m from START of cluster, not from moving center
  sameCoordinateCluster = distanceFromAnchor < 200;
  
  if (__DEV__ && distanceFromAnchor > 100) {
    console.log(`📍 [ANCHOR DEBUG] Distance from anchor: ${Math.round(distanceFromAnchor)}m, sameCluster: ${sameCoordinateCluster}`);
  }
}
```

This ensures the cluster can ONLY grow 200m from its starting point, not its moving center.

---

## Summary

The TodayMatters segment generation algorithm has a fundamental flaw: it treats continuous travel as a single "unknown location" because the centroid-based clustering allows the cluster to grow indefinitely as the user moves. The commute detection logic only runs on gaps BETWEEN segments, so when there's only ONE segment covering the entire period, no commutes are ever detected.

**The fix requires adding movement analysis WITHIN segments** - if a segment's samples show significant movement (speed > 0.3 m/s, distance > 100m), it should be classified as a commute, not a stationary location block.
