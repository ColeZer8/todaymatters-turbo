# Location Tracking Accuracy Fixes

**Date:** 2026-02-11
**User Test Case:** Gravy (b9ca3335-9929-4d54-a3fc-18883c5f3375)

## Summary of Issues Found

### Issue 1: Activity Type Not Being Saved to Database 🔴 CRITICAL

**Symptom:** Walking activity at dog park not detected; no activity_type data in segments

**Root Cause:** The iOS location provider captures activity data from Transistorsoft in `location.activity`, but it's only stored in the `raw` JSON field. The dedicated database columns (`activity_type`, `activity_confidence`, `is_moving`) added in migration `20260211000000_add_activity_to_location_samples.sql` are never populated.

**Code Location:**
- `apps/mobile/src/lib/location-provider/ios.ts` - `toSample()` captures `location.activity` in `raw` but doesn't extract it
- `apps/mobile/src/lib/ios-location/types.ts` - `IosLocationSample` type missing activity fields
- `apps/mobile/src/lib/supabase/services/location-samples.ts` - `upsertLocationSamples()` doesn't include activity columns

**Fix Required:** See [Fix #1](#fix-1-activity-type-extraction) below.

---

### Issue 2: "No Outlet" Instead of Dog Park Name 🟠 HIGH

**Symptom:** Stationary segment at dog park labeled "No Outlet" (a street name)

**Root Cause:** The `location-place-lookup` edge function falls back to reverse geocoding when no POI is found. Reverse geocoding extracts street names, and "No Outlet" is literally the name of a dead-end street sign.

The priority chain in the edge function is:
```
neighborhood > sublocality > city > route > county > state
```

**BUT** the `route` (street name) can be "No Outlet" which is unhelpful.

**Fix Required:** 
1. Filter out unhelpful street names ("No Outlet", "Private Road", etc.)
2. For stationary segments > 5 min with no POI match, skip street names entirely

---

### Issue 3: Phantom "Steel City Chiropractic" Destination 🟠 HIGH

**Symptom:** Travel segment shows "Travel → Steel City Chiropractic" when user was just passing by

**Root Cause:** The ingestion code sets `destination_place_label` for commute segments based on where the GPS samples are heading. If the last few samples before entering a commute happen to be near "Steel City Chiropractic", it gets incorrectly labeled as the destination.

The real destination should be determined by looking at **where the user actually stopped**, not where they were traveling toward.

**Fix Required:**
1. For commute segments, determine destination from the **next stationary segment** (not from commute samples)
2. Don't assign destination labels to commute segments where the user didn't actually stop

---

### Issue 4: Santos Coffee Stop Missing 🟡 MEDIUM

**Symptom:** Quick stop at Santos Coffee (6:00 PM) not appearing in timeline

**Root Cause:** `MIN_DWELL_TIME_MS = 3 * 60 * 1000` (3 minutes). If the coffee stop was under 3 minutes, it would be filtered out.

**Fix Options:**
1. Add a "quick stop" category for brief visits (1-3 min) at recognized POIs
2. Lower dwell time for places that match Google Places POIs
3. Show as travel annotation: "Drove · quick stop at Santos Coffee"

---

## Fixes

### Fix #1: Activity Type Extraction

**File: `apps/mobile/src/lib/ios-location/types.ts`**

Add activity fields to the interface:

```typescript
export interface IosLocationSample {
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  is_mocked: boolean | null;
  source: IosLocationSampleSource;
  dedupe_key: string;
  raw: Json | null;
  // NEW FIELDS:
  activity_type: string | null;  // 'still', 'walking', 'on_foot', 'running', 'on_bicycle', 'in_vehicle', 'unknown'
  activity_confidence: number | null;  // 0-100
  is_moving: boolean | null;
}
```

**File: `apps/mobile/src/lib/location-provider/ios.ts`**

Update `toSample()` to extract activity data:

```typescript
function toSample(
  location: Location,
  sourceMeta: { collected_via: "transistor_event" | "transistor_foreground_poll" },
): Omit<IosLocationSample, "dedupe_key"> | null {
  // ... existing validation ...

  // Extract activity data from Transistorsoft location object
  const activity = location.activity;
  let activityType: string | null = null;
  let activityConfidence: number | null = null;
  
  if (activity && typeof activity === 'object') {
    // Transistorsoft activity format: { type: 'walking', confidence: 75 }
    if (typeof activity.type === 'string') {
      activityType = activity.type;
    }
    if (typeof activity.confidence === 'number') {
      activityConfidence = Math.round(activity.confidence);
    }
  }

  return {
    recorded_at: location.timestamp,
    latitude,
    longitude,
    accuracy_m: normalizeNonNegative(location.coords.accuracy),
    altitude_m: isFiniteNumber(location.coords.altitude) ? location.coords.altitude : null,
    speed_mps: normalizeNonNegative(location.coords.speed),
    heading_deg: normalizeHeadingDeg(location.coords.heading),
    is_mocked: typeof location.mock === "boolean" ? location.mock : null,
    source: "background",
    // NEW:
    activity_type: activityType,
    activity_confidence: activityConfidence,
    is_moving: typeof location.is_moving === "boolean" ? location.is_moving : null,
    raw: normalizeRaw({
      ...sourceMeta,
      uuid: location.uuid,
      age: location.age,
      is_moving: location.is_moving,
      event: location.event,
      coords: location.coords,
      activity: location.activity,
      provider: location.provider,
    }),
  };
}
```

**File: `apps/mobile/src/lib/supabase/services/location-samples.ts`**

Update the interfaces and upsert function:

```typescript
interface LocationSampleLike {
  // ... existing fields ...
  activity_type?: string | null;
  activity_confidence?: number | null;
  is_moving?: boolean | null;
}

export async function upsertLocationSamples(
  userId: string,
  samples: LocationSampleLike[],
): Promise<void> {
  if (samples.length === 0) return;

  const rows: LocationSamplesInsert[] = samples.map((s) => ({
    user_id: userId,
    recorded_at: s.recorded_at,
    latitude: s.latitude,
    longitude: s.longitude,
    accuracy_m: s.accuracy_m,
    altitude_m: s.altitude_m,
    speed_mps: s.speed_mps,
    heading_deg: s.heading_deg,
    is_mocked: s.is_mocked,
    source: s.source,
    dedupe_key: s.dedupe_key,
    raw: s.raw,
    // NEW:
    activity_type: s.activity_type ?? null,
    activity_confidence: s.activity_confidence ?? null,
    is_moving: s.is_moving ?? null,
  }));

  // ... rest of function ...
}
```

---

### Fix #2: Filter Unhelpful Street Names

**File: `supabase/functions/location-place-lookup/index.ts`**

Add a blacklist of unhelpful street names:

```typescript
// Street names that are unhelpful for place identification
const UNHELPFUL_STREET_NAMES = new Set([
  "no outlet",
  "private road",
  "private drive",
  "dead end",
  "unnamed road",
  "service road",
  "access road",
  "frontage road",
]);

function isUnhelpfulStreetName(name: string): boolean {
  return UNHELPFUL_STREET_NAMES.has(name.toLowerCase().trim());
}
```

Then update `fetchReverseGeocode()`:

```typescript
// Skip route if it's an unhelpful name
if (!route && types.includes("route")) {
  const routeName = component.long_name;
  if (!isUnhelpfulStreetName(routeName)) {
    route = routeName;
  }
}
```

---

### Fix #3: Commute Destination from Next Stationary Segment

**File: `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`**

Modify `processSegmentsWithCommutes()` to determine commute destinations from the following stationary segment:

```typescript
// After detecting all segments, update commute destinations
for (let i = 0; i < result.length; i++) {
  const segment = result[i];
  if (segment.meta.kind === "commute") {
    // Find the next non-commute segment
    const nextStationary = result.slice(i + 1).find(s => s.meta.kind !== "commute");
    if (nextStationary) {
      segment.meta.destination_place_id = nextStationary.placeId;
      segment.meta.destination_place_label = nextStationary.placeLabel;
    } else {
      // No destination found - clear any incorrect label
      segment.meta.destination_place_id = null;
      segment.meta.destination_place_label = null;
    }
  }
}
```

---

## Testing Plan

1. **Activity Type Test:**
   - Walk around the block with location tracking on
   - Check `tm.location_samples` for `activity_type = 'walking'`
   - Verify activity shows in timeline segment

2. **Place Name Test:**
   - Visit a dog park or park
   - Verify it doesn't show "No Outlet" but shows park name or "Near [Neighborhood]"

3. **Commute Destination Test:**
   - Drive from home → coffee shop → back home
   - Verify travel shows "Driving → [Coffee Shop]" not a random business along the route

4. **Quick Stop Test:**
   - Make a 2-minute stop at a recognizable POI
   - Check if it appears in timeline (even as annotation)

---

## Files Changed

| File | Change |
|------|--------|
| `apps/mobile/src/lib/ios-location/types.ts` | Add activity fields to IosLocationSample |
| `apps/mobile/src/lib/location-provider/ios.ts` | Extract activity from Transistorsoft |
| `apps/mobile/src/lib/supabase/services/location-samples.ts` | Save activity to database |
| `supabase/functions/location-place-lookup/index.ts` | Filter unhelpful street names |
| `apps/mobile/src/lib/supabase/services/actual-ingestion.ts` | Fix commute destination logic |
