# Bug 4 & 5 Fix + Location Debug UI - COMPLETE

**Date:** 2026-02-11
**Status:** ✅ COMPLETE

---

## Bug 4: Place Confidence Too Loose

### Status: ✅ ALREADY FIXED

The confidence thresholds were already updated in the codebase:

**File:** `apps/mobile/src/lib/supabase/services/place-confidence.ts`

| Threshold | Before | After |
|-----------|--------|-------|
| Confident distance | 75m | **50m** |
| Fuzzy distance | 150m | **100m** |

```typescript
// Line 25-32
export const PLACE_MAX_CONFIDENT_DISTANCE_M = 50;
export const PLACE_MAX_FUZZY_DISTANCE_M = 100;
```

### Confidence Scoring Tiers (Updated)
- **0-15m:** 100% confidence (at the place)
- **15-30m:** 90% confidence (close)
- **30-50m:** 75% confidence (acceptable)
- **50-75m:** 55% confidence (borderline - uses "Near X")
- **75-100m:** 35% confidence (far - uses "Near X")
- **100m+:** 10% confidence (rejected)

### Additional Factors Applied:
- Dwell time bonus/penalty (up to 20% weight)
- Sample count bonus/penalty (up to 10% weight)
- Reverse geocode penalty (10%)
- Large venue bonus (airports, malls get +15%)
- Small venue penalty (cafes/restaurants far away get -15%)

---

## Bug 5: Geohash Matching Too Strict

### Status: ✅ ALREADY FIXED

Geohash6 prefix matching fallback was already implemented:

**File:** `apps/mobile/src/lib/supabase/services/location-labels.ts`

```typescript
// Lines 364-396
// Bug 5 fix: Fallback to geohash6 prefix matching
// geohash6 covers ~600m x 1km, so handles GPS drift at cell boundaries
const geohash6Prefix = geohash7.slice(0, 6);

const { data: prefixMatches, error: prefixError } = await tmSchema()
  .from("user_places")
  .select("label, category, geohash7")
  .eq("user_id", userId)
  .like("geohash7", `${geohash6Prefix}%`)
  .limit(5);
```

### How It Works:
1. First tries exact geohash7 match
2. If no match, extracts geohash6 prefix (first 6 characters)
3. Queries for all places with that prefix (LIKE 'abc123%')
4. Returns first match (handles ~10m GPS drift at cell boundaries)

### Geohash Precision Reference:
| Geohash Length | Cell Size |
|----------------|-----------|
| 6 | ~1.2km × 600m |
| 7 | ~150m × 150m |
| 8 | ~38m × 19m |

---

## Debug UI: Location Timeline

### New Files Created:

```
apps/mobile/src/components/organisms/location-debug/
├── ActivityIcon.tsx       # Icons for walking/driving/stationary
├── ConfidenceBadge.tsx    # Confidence score display with color
├── LocationDebugBlock.tsx # Individual segment card (Google Timeline style)
├── LocationDebugList.tsx  # Scrollable list with stats
└── index.ts               # Barrel exports

apps/mobile/src/app/settings/location-debug.tsx  # Main screen
```

### Features:

#### Header & Navigation
- Back button to settings
- Date navigation (< Today >)
- Shows "Today" / "Yesterday" / "Mon, Feb 10" format
- Can't navigate to future dates

#### Filter Tabs
- **All** - Shows all segments
- **Travel** - Only commute/driving segments
- **Stationary** - Only stationary segments

#### Segment Display (Google Timeline Style)
- Activity icon with color-coded background:
  - 🚗 Orange for driving/commute
  - 🚶 Green for walking
  - 🏃 Light green for running
  - 📍 Gray for stationary
- Place name with confidence badge (e.g., "Santos Coffee (95%)")
- Activity type label ("Deep Work", "Commute", etc.)
- Duration + distance ("2.1 mi · 53 min")
- Time range ("5:16 PM - 6:09 PM")
- Timeline connector line between segments

#### Debug Info (Collapsible per segment)
- Segment ID (truncated)
- Location samples count
- Screen sessions count
- Raw activity type
- Place category

#### Summary Stats
- Total segments count
- Commute count
- Segments with place labels
- Unknown location count

### Access:
Navigate to: **Settings → Location Debug**

Or via deep link: `todaymatters://settings/location-debug`

---

## Files Modified:

| File | Change |
|------|--------|
| `components/organisms/index.ts` | Added location-debug exports |

## Pre-existing (No changes needed):

| File | Status |
|------|--------|
| `services/place-confidence.ts` | ✅ Thresholds already at 50m/100m |
| `services/location-labels.ts` | ✅ Geohash6 prefix matching already implemented |
| `services/actual-ingestion.ts` | ✅ Uses DEFAULT_PLACE_RADIUS_M = 100m |
| `services/user-places.ts` | ✅ Uses DEFAULT_PLACE_RADIUS_M = 100m |

---

## Screenshot Reference

The UI is designed to match Google Timeline format as shown in the reference screenshot:

```
┌─────────────────────────────────────┐
│  ←    Location Debug                │
├─────────────────────────────────────┤
│  <       Today ▼        >           │
│        2026-02-11                   │
├─────────────────────────────────────┤
│  [All]  [Travel]  [Stationary]      │
├─────────────────────────────────────┤
│  24 segments (24 total)             │
├─────────────────────────────────────┤
│  ◯ ─ 2646 Denyse Dr      [95%]     │
│  │   Stationary                     │
│  │   5 hr 41 min                    │
│  │   11:35 AM - 5:16 PM            │
│  │   ────────────────────          │
│  │   id: abc123... | samples: 12   │
│  │                                  │
│  🚗 ─ Driving             [88%]     │
│  │   → Santos Coffee                │
│  │   2.0 mi · 53 min               │
│  │   5:16 PM - 6:09 PM             │
│  │                                  │
│  🚶 ─ Walking             [72%]     │
│  │   0.6 mi · 9 min                │
│  │   6:09 PM - 6:18 PM             │
│  │                                  │
└─────────────────────────────────────┘
```

---

## Testing Instructions

1. Build and run the app
2. Navigate to Settings
3. Tap "Location Debug" 
4. View today's activity segments
5. Use date arrows to browse history
6. Use filter tabs to isolate travel vs stationary
7. Check confidence scores match expected values
8. Pull to refresh for latest data

---

## Success Criteria: ✅ MET

- [x] Confidence thresholds tightened (50m/100m) - **Already done**
- [x] Geohash6 prefix matching working - **Already done**
- [x] Debug UI displays activity_segments - **Created**
- [x] Shows activity types (Walking/Driving/Stationary) - **Created**
- [x] Shows confidence scores - **Created**
- [x] Matches Google Timeline visual format - **Created**
- [x] TypeScript compiles without errors - **Verified**
