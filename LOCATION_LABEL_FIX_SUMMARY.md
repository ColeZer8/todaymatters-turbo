# Location Label Save Fix - Complete Solution

## Root Cause ✅ IDENTIFIED

**Geohash Key Mismatch** between save and load operations.

### The Problem:
1. **Save time:** Block has no `geohash7` from `location_hourly` (missing data)
2. **Save function:** Generates geohash7 from lat/lng coordinates → saves to DB
3. **Load time:** Block still has no `geohash7` from `location_hourly` (unchanged)
4. **Lookup:** Tries `userLabels[null]` → **FAILS** ❌
5. **Result:** Label not found, reverts to fallback

### Why This Happened:
- `location_hourly` table may have gaps or missing geohash7 values
- Activity segments have coordinates but enriched summaries rely on location_hourly
- Generated geohash7 (from save) ≠ null geohash7 (from load)

## The Fix ✅ IMPLEMENTED

### 1. Added Fallback Geohash Lookup
**File:** `apps/mobile/src/components/organisms/LocationBlockList.tsx`

```typescript
// PRIMARY: Try geohash7 from location_hourly
if (geohash7) {
  userSavedLabel = userLabels[geohash7]?.label ?? null;
}

// FALLBACK: Generate geohash7 from segment coordinates
if (!userSavedLabel && !geohash7 && hourSegments.length > 0) {
  const generatedGeohash = encodeGeohash(lat, lng, 7);
  userSavedLabel = userLabels[generatedGeohash]?.label ?? null;
}
```

### 2. Exported Geohash Encoder
**File:** `apps/mobile/src/lib/supabase/services/location-labels.ts`

Exported `encodeGeohash()` function for consistent hash generation across save/load.

### 3. Added Comprehensive Debug Logging

#### Save Flow (`activity-timeline.tsx`):
```
🔍 [ActivityTimeline] handleSaveRename - block data:
  - blockId, geohash7, lat/lng, locationLabel
📝 [ActivityTimeline] Saving location label:
  - geohash7, willGenerateFromCoords, label, category
```

#### Save Function (`location-labels.ts`):
```
🔍 [saveLocationLabel] CALLED with: {...}
🔍 [saveLocationLabel] Computed geohash7 from coords: abc1234
🔍 [saveLocationLabel] Checking for existing place with geohash7: abc1234
✅ [saveLocationLabel] INSERT/UPDATE successful
✅ [saveLocationLabel] Cache invalidated
```

#### Load Function (`location-labels.ts`):
```
🔍 [getLocationLabels] FETCHING labels for user: abc...
✅ [getLocationLabels] Fetched X rows from database
🔍 [getLocationLabels] Map keys (geohash7): [abc1234, def5678]
🔍 [getLocationLabels] Map values (labels): [Home, Work]
```

#### Merge Logic (`LocationBlockList.tsx`):
```
🔍 [LocationBlockList] Loaded user labels: 2 places
🔍 [LocationBlockList] Hour X label resolution:
  - geohash7, userSavedLabel, pipelineLabel, inferredLabel
✅ [LocationBlockList] Using USER LABEL for abc1234: Home
✅ [LocationBlockList] Found user label via GENERATED geohash: Home
```

## Testing Plan for Cole

### 1. Clean Test (Fresh Start)
```bash
# Build and install on device
cd /Users/colezerman/Projects/todaymatters-turbo
pnpm --filter mobile run ios
```

### 2. Reproduce the Bug
1. Open app with dev console attached (Xcode or React Native Debugger)
2. Navigate to a location block
3. Rename it to "Home"
4. Save
5. Pull to refresh

### 3. Check Logs

**Expected logs showing the fix working:**

```
🔍 [ActivityTimeline] handleSaveRename - block data:
  blockId: "12345..."
  hasGeohash: false
  geohash7: "(null)"
  hasCoords: true
  lat: 37.7749
  lng: -122.4194

🔍 [saveLocationLabel] CALLED with:
  geohash7: null
  
🔍 [saveLocationLabel] Computed geohash7 from coords: "9q8yyk8"

✅ [saveLocationLabel] INSERT successful

🔍 [getLocationLabels] Fetched 1 rows from database
🔍 [getLocationLabels] Map keys (geohash7): ["9q8yyk8"]

🔍 [LocationBlockList] Hour 14:00 label resolution:
  geohash7: null
  userSavedLabel: "(none)"
  
✅ [LocationBlockList] Found user label via GENERATED geohash (9q8yyk8): "Home"
```

### 4. Verify Fix
- [ ] Label persists after refresh
- [ ] No errors in console
- [ ] Logs show "Found user label via GENERATED geohash"

## Rollback Plan (If Needed)
```bash
git checkout HEAD -- apps/mobile/src/components/organisms/LocationBlockList.tsx
git checkout HEAD -- apps/mobile/src/lib/supabase/services/location-labels.ts
git checkout HEAD -- apps/mobile/src/app/activity-timeline.tsx
```

## Next Steps After Verification

1. **Remove debug logs** (or wrap in `__DEV__` checks)
2. **Test edge cases:**
   - Multiple labels at different locations
   - Labels with special characters
   - Very close locations (< 100m apart)
3. **Consider data migration:**
   - Backfill geohash7 in location_hourly?
   - Or keep fallback logic permanently?

## Files Changed

1. ✅ `apps/mobile/src/lib/supabase/services/location-labels.ts`
   - Exported `encodeGeohash()`
   - Added comprehensive logging

2. ✅ `apps/mobile/src/components/organisms/LocationBlockList.tsx`
   - Imported `encodeGeohash()`
   - Added fallback geohash7 lookup logic
   - Added label resolution logging

3. ✅ `apps/mobile/src/app/activity-timeline.tsx`
   - Added pre-save validation logging
   - Added geohash generation detection

## Commit Message
```
fix(mobile): resolve location label persistence bug via fallback geohash lookup

- Root cause: geohash key mismatch between save (generated) and load (null)
- Fix: Generate geohash7 from segment coords as fallback during label lookup
- Added comprehensive debug logging for save/load/merge flow
- Exported encodeGeohash() for consistent hashing across modules

Fixes issue where user-saved location labels (e.g., "Home") would not
persist after refresh when the location_hourly table had no geohash7 value.
```

---

**Status:** ✅ Fix implemented and ready for testing  
**Author:** OpenClaw TodayMatters Subagent  
**Date:** 2026-02-10
