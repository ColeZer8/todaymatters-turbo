# Manual Test Plan for Location Block Fix

## Test Case 1: Same-Location Block Merging

### Setup
Two consecutive activity segments at "Believe Candle Co.":
- Segment 1: 2:42 AM - 4:00 AM (1h 18m)
- Segment 2: 4:00 AM - 7:03 AM (3h 3m)

### Scenarios to Test

#### Scenario 1A: Same Place ID
```typescript
segment1.placeId = "abc123"
segment2.placeId = "abc123"
```
**Expected:** ✅ Merge (Place ID match)

#### Scenario 1B: Different Place IDs, Same Coordinates
```typescript
segment1.placeId = "abc123"
segment2.placeId = "def456"
segment1.lat = 41.1234, segment1.lng = -87.5678
segment2.lat = 41.1235, segment2.lng = -87.5679  // ~11m apart
```
**Expected:** ✅ Merge (Coordinate proximity < 200m)

#### Scenario 1C: No Place IDs, Same Label (NEW FIX!)
```typescript
segment1.placeId = null
segment2.placeId = null
segment1.placeLabel = "Believe Candle Co."
segment2.placeLabel = "Believe Candle Co."
segment1.lat = 41.1234, segment1.lng = -87.5678
segment2.lat = 41.1300, segment2.lng = -87.5750  // ~900m apart (>200m)
```
**Expected:** ✅ Merge (Place label match - NEW!)
**Before Fix:** ❌ Would NOT merge (no place ID, coords too far)

#### Scenario 1D: Case-Insensitive Label Match
```typescript
segment1.placeLabel = "Believe Candle Co."
segment2.placeLabel = "believe candle co."  // lowercase
```
**Expected:** ✅ Merge (Case-insensitive label match)

#### Scenario 1E: Don't Merge Unknown Locations
```typescript
segment1.placeLabel = "Unknown Location"
segment2.placeLabel = "Unknown Location"
```
**Expected:** ❌ Don't merge (meaningless labels)

---

## Test Case 2: Unknown Location Carry-Forward

### Setup
Three consecutive blocks:
- Block 1: "Believe Candle Co.", 2:42 AM - 7:03 AM
- Block 2: "Unknown Location", 7:03 AM - 7:56 AM
- Block 3: "Different Place", 8:00 AM - 9:00 AM

### Scenarios to Test

#### Scenario 2A: Replace Unknown Location (NEW FIX!)
```typescript
block1.locationLabel = "Believe Candle Co."
block1.type = "stationary"
block2.locationLabel = "Unknown Location"
block2.type = "stationary"
```
**Expected:** 
- Block 2 is REPLACED with a carried-forward version of "Believe Candle Co."
- Block 2 shows: "Believe Candle Co.", 7:03 AM - 7:56 AM, isCarriedForward=true
**Before Fix:** Block 2 showed "Unknown Location"

#### Scenario 2B: Don't Replace if Location Changed
```typescript
block1.locationLabel = "Believe Candle Co."
block2.locationLabel = "Unknown Location"
block3.locationLabel = "Starbucks"  // Different location
```
**Expected:** Don't carry forward (user moved to a different place)

#### Scenario 2C: Don't Replace Travel Blocks
```typescript
block1.locationLabel = "Believe Candle Co."
block1.type = "stationary"
block2.locationLabel = "Unknown Location"
block2.type = "travel"  // In transit
```
**Expected:** Don't replace travel blocks with stationary location

---

## Debug Log Checklist

When running the app on Feb 11 data, you should see these logs in Metro:

### 1. Segment Processing
```
📍 [groupSegmentsIntoLocationBlocks] Processing 5 segments:
  0: 2:42 AM - 4:00 AM: "Believe Candle Co." (ID: null, lat/lng: 41.1234,-87.5678)
  1: 4:00 AM - 7:03 AM: "Believe Candle Co." (ID: null, lat/lng: 41.1300,-87.5750)
  ...
```

### 2. Merge Decisions
```
📍 [groupSegmentsIntoLocationBlocks] Comparing segments 0 and 1:
  Prev: "Believe Candle Co." (2:42 AM - 4:00 AM)
  Curr: "Believe Candle Co." (4:00 AM - 7:03 AM)

📍 [isSamePlace] ✅ Merging by place label: "Believe Candle Co."
  ✅ Merged into current group (now 2 segments)
```

### 3. Group Summary
```
📍 [groupSegmentsIntoLocationBlocks] Created 3 groups:
  Group 0: "Believe Candle Co." (2 segments, 2:42 AM - 7:03 AM)
  Group 1: "Unknown Location" (1 segment, 7:03 AM - 7:56 AM)
  Group 2: "Different Place" (1 segment, 8:00 AM - 9:00 AM)
```

### 4. Gap Filling
```
📍 [fillLocationGaps] 🔄 Replaced "Unknown Location" block (7:03 AM - 7:56 AM) 
with carried-forward location "Believe Candle Co."
```

### 5. Final Block Count
```
[useLocationBlocksForDay] Filled gaps: 3 blocks → 3 blocks (0 gaps filled)
```
(Block count stays the same because we REPLACED, not added)

---

## Visual Verification

### Before Fix
```
┌─────────────────────────────────────────┐
│ 📍 Believe Candle Co.                   │
│ 2:42 AM - 4:00 AM · 1h 18m              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📍 Believe Candle Co.                   │
│ 4:00 AM - 7:03 AM · 3h 3m               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ❓ Unknown Location                     │
│ 7:03 AM - 7:56 AM · 53 min              │
└─────────────────────────────────────────┘
```

### After Fix
```
┌─────────────────────────────────────────┐
│ 📍 Believe Candle Co.                   │
│ 2:42 AM - 7:56 AM · 5h 14m              │
│ (or split as 2:42 AM - 7:03 AM and      │
│  7:03 AM - 7:56 AM if still 2 blocks)   │
└─────────────────────────────────────────┘
```

---

## Acceptance Criteria

✅ **Fix 1 (Merging):**
- Two consecutive segments with same place label should merge into one block
- Case-insensitive label matching works
- Debug logs show merge decision reasoning

✅ **Fix 2 (Carry-Forward):**
- "Unknown Location" blocks after known locations are replaced with carried-forward location
- Carried-forward blocks have `isCarriedForward: true` flag
- Debug logs show replacement operation

✅ **No Regressions:**
- Existing merge behavior (place ID, coordinates) still works
- Gap filling for true gaps still works
- Travel blocks are handled correctly

---

## Testing Commands

```bash
# Run iOS app in development mode
cd apps/mobile
npm run ios

# Watch Metro logs for debug output
# (Logs will appear in the terminal running the Metro bundler)

# Navigate to Feb 11, 2026 in the app
# Location Blocks view

# Check logs for:
# 1. Segment processing
# 2. Merge decisions
# 3. Group creation
# 4. Gap filling / replacement
```

---

## Edge Cases to Watch For

1. **Empty segments array** - Should not crash
2. **Single segment** - Should create one block (no merging needed)
3. **All unknown locations** - Should not merge (no meaningful labels)
4. **Mixed case labels** - Should merge (case-insensitive)
5. **Labels with extra whitespace** - Should merge (trimmed comparison)
6. **Travel blocks** - Should not be replaced with carried-forward locations
7. **Location changes during gaps** - Should not carry forward if user moved

---

## Known Limitations

1. **Place label matching is greedy** - If two different businesses have the same name, they'll merge. This is acceptable because:
   - Most unique place names are unique within a person's daily range
   - Users can still provide feedback to split blocks
   - Better to over-merge than under-merge (easier to split than manually merge in UI)

2. **Carried-forward blocks have lower confidence** - Intentionally set to 0.6x original confidence since they're inferred, not measured

3. **Debug logs are verbose** - Gated behind `__DEV__` so they won't appear in production
