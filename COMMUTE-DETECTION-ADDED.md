# Commute Detection Added - Phase 2 Complete

## Summary

Added classification logic to `generateLocationSegments()` to detect commute/travel segments based on speed and distance metrics from GPS samples.

## Problem

Looking at Gravy's location samples with clear driving indicators:
- 6:24 PM: `speed_mps: 8.33` (30 km/h - DRIVING)
- 6:23 PM: `speed_mps: 6.66` (24 km/h - DRIVING)

All segments were being classified as "stationary" (`kind: "location_block"`) because there was no logic to analyze the speed/distance data within segments.

## Solution

### 1. Added `speed_mps` to EvidenceLocationSample Type

**File:** `apps/mobile/src/lib/supabase/services/evidence-data.ts`

```typescript
// BEFORE
export interface EvidenceLocationSample {
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  is_mocked?: boolean | null;
  telemetry?: IosLocationTelemetryMeta | null;
}

// AFTER
export interface EvidenceLocationSample {
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  speed_mps?: number | null;  // ← ADDED
  is_mocked?: boolean | null;
  telemetry?: IosLocationTelemetryMeta | null;
}
```

### 2. Updated Database Query to Fetch speed_mps

**File:** `apps/mobile/src/lib/supabase/services/evidence-data.ts`

```typescript
// BEFORE
.select("recorded_at, latitude, longitude, accuracy_m, is_mocked, raw")

// AFTER
.select("recorded_at, latitude, longitude, accuracy_m, speed_mps, is_mocked, raw")
```

### 3. Added `calculateAverageSpeed()` Helper Function

**File:** `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`

```typescript
/**
 * Calculate the average speed from location samples.
 * Only considers positive, non-null speed values.
 */
function calculateAverageSpeed(samples: EvidenceLocationSample[]): number {
  const speeds = samples
    .map(s => s.speed_mps)
    .filter((s): s is number => s != null && s > 0 && s < MAX_REALISTIC_SPEED_MS);
  
  if (speeds.length === 0) return 0;
  return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}
```

### 4. Added Segment Classification Logic

**File:** `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`
**Location:** Inside `generateLocationSegments()`, right before `segments.push()`

```typescript
// =========================================================================
// SEGMENT CLASSIFICATION: Stationary vs Commute
// =========================================================================
// Calculate movement metrics from the samples
const avgSpeed = calculateAverageSpeed(group.samples);
const totalDistance = calculatePathDistance(group.samples);
const segmentDurationMs = clampedEnd.getTime() - clampedStart.getTime();

// Classification thresholds (match Google Timeline behavior)
// - Average speed > 1.0 m/s (~2.2 mph) = definitely moving
// - Total distance > 100m = traveled a meaningful distance
const COMMUTE_SPEED_THRESHOLD = 1.0; // m/s
const COMMUTE_DISTANCE_THRESHOLD = 100; // meters

const isMoving = avgSpeed > COMMUTE_SPEED_THRESHOLD || totalDistance > COMMUTE_DISTANCE_THRESHOLD;

// Determine segment kind and movement type
let segmentKind: "location_block" | "commute" = "location_block";
let movementType: MovementType | undefined;

if (isMoving) {
  segmentKind = "commute";
  movementType = classifyMovementType(totalDistance, segmentDurationMs);
}
```

## Classification Rules

| Condition | Classification |
|-----------|----------------|
| `avgSpeed > 1.0 m/s` | **COMMUTE** |
| `totalDistance > 100m` | **COMMUTE** |
| Low speed AND short distance | **STATIONARY** |

Movement types are further classified:
- `< 0.3 m/s`: stationary (GPS noise)
- `0.3 - 2.2 m/s`: walking
- `2.2 - 7.0 m/s`: cycling
- `> 7.0 m/s`: driving

## Expected Behavior

For Gravy's evening (5:57 PM - 6:30 PM):

| Time | Expected Classification | Reason |
|------|------------------------|--------|
| 5:57 PM - 6:00 PM | Travel | speed 6-8 m/s |
| 6:00 PM - 6:06 PM | Stationary | low speed near Santos Coffee |
| 6:06 PM - 6:09 PM | Travel | driving |
| 6:09 PM - 6:18 PM | Stationary/Travel | walking ~1-2 m/s |
| 6:18 PM - 6:25 PM | Travel | driving |
| 6:25 PM+ | Stationary | dog park/home |

## UI Behavior

When `meta.kind === "commute"`:
- UI should show orange "Travel →" blocks instead of location blocks
- Title will be formatted as "Driving · 1.3 mi · 4 min" (Google Timeline style)

## Testing Instructions

1. **Rebuild the app:**
   ```bash
   cd apps/mobile
   npx expo start --clear
   ```

2. **View calendar for a day with driving data:**
   - Open the app
   - Navigate to a day where Gravy was driving
   - Verify that travel segments show as orange "Travel →" blocks

3. **Check console logs:**
   Look for classification debug logs:
   ```
   📍 [CLASSIFY] Segment 2024-01-15T18:24:00Z → COMMUTE (avgSpeed: 8.33 m/s, distance: 1250m, type: driving)
   📍 [CLASSIFY] Segment 2024-01-15T18:30:00Z → STATIONARY (avgSpeed: 0.15 m/s, distance: 20m)
   ```

## Files Modified

1. `apps/mobile/src/lib/supabase/services/evidence-data.ts`
   - Added `speed_mps` to `EvidenceLocationSample` interface
   - Added `speed_mps` to SELECT query in `fetchLocationSamplesForDay()`
   - Added `speed_mps` to `coerceEvidenceLocationSample()` function

2. `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`
   - Added `calculateAverageSpeed()` helper function
   - Added segment classification logic in `generateLocationSegments()`

## Success Criteria

✅ Segments with speed > 1 m/s are classified as "commute"
✅ Segments with distance > 100m are classified as "commute"
✅ Stationary segments (low speed, short distance) remain "stationary"
✅ Commute segments include metadata: `intent`, `distance_m`, `movement_type`
✅ Existing functionality unchanged - segment creation logic untouched
