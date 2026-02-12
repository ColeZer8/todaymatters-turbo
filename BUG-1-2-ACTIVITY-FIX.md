# Bug Fix Report: Activity Detection + Movement Sensitivity

**Date:** 2026-02-11  
**Bugs Fixed:** Bug 1 (Activity Detection) + Bug 2 (Walking Movement)  
**Status:** ✅ Complete

---

## Summary

Fixed two critical bugs preventing proper activity tracking:

1. **Bug 1:** Activity data from Transistorsoft wasn't being captured or stored
2. **Bug 2:** Walking movement wasn't detected due to large `distanceFilter` values

---

## Changes Made

### 1. Android Configuration (`apps/mobile/src/lib/location-provider/android.ts`)

**Before:**
```typescript
distanceFilter: 50,
// Missing: stationaryRadius, activity recognition configs, triggerActivities
```

**After:**
```typescript
distanceFilter: 15,              // Reduced for walking detection
stationaryRadius: 25,            // Better stationary detection
activityRecognitionInterval: 10000,  // Check activity every 10s
minimumActivityRecognitionConfidence: 70,  // 70% threshold
disableMotionActivityUpdates: false,  // CRITICAL: Enable activity detection
disableStopDetection: false,
triggerActivities: "in_vehicle, on_bicycle, on_foot, walking, running",  // NEW
```

Also added:
- `onActivityChange` event listener (already present, verified logging)
- Activity data extraction in `toSample()` function

### 2. iOS Configuration (`apps/mobile/src/lib/location-provider/ios.ts`)

**Before:**
```typescript
distanceFilter: 75,
activityType: BackgroundGeolocation.ActivityType.Other,
// Missing: stationaryRadius, activity recognition configs
```

**After:**
```typescript
distanceFilter: 15,              // Reduced from 75 for walking
stationaryRadius: 25,            // Better stationary detection
activityType: BackgroundGeolocation.ActivityType.Fitness,  // Better for walking/running
disableMotionActivityUpdates: false,  // Enable activity detection
disableStopDetection: false,
activityRecognitionInterval: 10000,   // NEW: Check activity every 10s
minimumActivityRecognitionConfidence: 70,  // NEW: 70% threshold  
triggerActivities: "in_vehicle, on_bicycle, on_foot, walking, running",  // NEW
```

Also added:
- `onActivityChange` event listener (already present, verified logging)
- Activity data extraction in `toSample()` function

### 3. Type Definitions Updated

**Files modified:**
- `apps/mobile/src/lib/android-location/types.ts`
- `apps/mobile/src/lib/ios-location/types.ts`

**Added fields:**
```typescript
// Activity recognition from Transistorsoft (Bug 1 fix)
activity_type: string | null;        // still, walking, running, on_foot, on_bicycle, in_vehicle, unknown
activity_confidence: number | null;  // 0.0-1.0
```

### 4. Supabase Service Updated

**File:** `apps/mobile/src/lib/supabase/services/location-samples.ts`

- Added `activity_type` and `activity_confidence` to `LocationSampleLike` interface
- Added fields to `LocationSampleRow` interface  
- Updated `upsertLocationSamples()` to include activity columns in INSERT

### 5. Database Migration Created

**File:** `supabase/migrations/20260211190000_add_activity_columns_to_location_samples.sql`

```sql
ALTER TABLE tm.location_samples 
  ADD COLUMN IF NOT EXISTS activity_type text NULL,
  ADD COLUMN IF NOT EXISTS activity_confidence real NULL 
    CHECK (activity_confidence >= 0 AND activity_confidence <= 1);

-- Index for activity queries
CREATE INDEX IF NOT EXISTS idx_location_samples_activity_type 
  ON tm.location_samples(user_id, activity_type, recorded_at DESC)
  WHERE activity_type IS NOT NULL;

-- Backfill from existing raw JSON where available
```

---

## Configuration Comparison

| Setting | Android Before | Android After | iOS Before | iOS After |
|---------|---------------|---------------|------------|-----------|
| `distanceFilter` | 50m | **15m** | 75m | **15m** |
| `stationaryRadius` | — | **25m** | — | **25m** |
| `activityType` | — | — | Other | **Fitness** |
| `activityRecognitionInterval` | — | **10000** | — | **10000** |
| `minimumActivityRecognitionConfidence` | — | **70** | — | **70** |
| `triggerActivities` | — | **✓** | — | **✓** |
| `disableMotionActivityUpdates` | — | **false** | — | **false** |
| `onActivityChange` listener | ✓ | ✓ | ✓ | ✓ |

---

## Testing Instructions

### 1. Apply Database Migration

```bash
cd supabase
supabase db push
# or
supabase migration up
```

### 2. Verify Activity Events (Console)

Start the app with debug logs enabled. Look for:

```
📍 [transistor-ios] 🏃 Activity changed: walking (85% confidence)
📍 [transistor-ios] 🔥 onLocation fired! {..., activity: "walking", activityConfidence: 85}
```

or for Android:
```
📍 [transistor] Activity changed: {"activity":"walking","confidence":85}
```

### 3. Verify Walking Detection

1. Start tracking
2. Walk 15+ meters
3. Check console for new location events
4. Previous behavior: No events until 50m (Android) or 75m (iOS)
5. Expected behavior: Events every ~15m of movement

### 4. Check Database for Activity Data

```sql
-- Check if activity data is being stored
SELECT 
  recorded_at,
  activity_type,
  activity_confidence,
  raw->'activity'->>'type' as raw_activity
FROM tm.location_samples
WHERE user_id = 'YOUR_USER_ID'
  AND recorded_at > NOW() - INTERVAL '1 hour'
ORDER BY recorded_at DESC
LIMIT 20;

-- Count samples by activity type
SELECT 
  activity_type,
  COUNT(*) as count,
  AVG(activity_confidence) as avg_confidence
FROM tm.location_samples
WHERE user_id = 'YOUR_USER_ID'
  AND recorded_at > NOW() - INTERVAL '24 hours'
GROUP BY activity_type
ORDER BY count DESC;
```

---

## Files Modified

1. `apps/mobile/src/lib/location-provider/android.ts` - Config + toSample
2. `apps/mobile/src/lib/location-provider/ios.ts` - Config + toSample
3. `apps/mobile/src/lib/android-location/types.ts` - Added activity fields
4. `apps/mobile/src/lib/ios-location/types.ts` - Added activity fields
5. `apps/mobile/src/lib/supabase/services/location-samples.ts` - Insert logic
6. `supabase/migrations/20260211190000_add_activity_columns_to_location_samples.sql` - New

---

## Expected Results

After these changes:

1. ✅ `onActivityChange` listener fires when activity changes (walking, driving, still)
2. ✅ Walking 15+ meters triggers new location samples (was 50-75m)
3. ✅ Activity type stored in `location_samples.activity_type` column
4. ✅ Activity confidence (0.0-1.0) stored in `location_samples.activity_confidence` column
5. ✅ Activity data also preserved in `raw` JSON for debugging

---

## Rollback

If issues occur:

1. Revert the migration (columns are nullable, safe to leave)
2. Revert distanceFilter to previous values if battery drain is excessive
3. Activity listeners can be removed but are low-cost

---

---

## Verification

TypeScript compilation verified - no new errors introduced by these changes. The activity_type and activity_confidence fields are now:
- ✅ Optional in types (backwards compatible with legacy samples)
- ✅ Included in Supabase insert
- ✅ Set from `location.activity.type` and `location.activity.confidence` in toSample()

*Fix completed by TodayMatters subagent on 2026-02-11*
