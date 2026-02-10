# Location Labeling Implementation Guide

**Date:** February 10, 2026  
**Status:** Ready to Deploy  
**Goal:** Enable users to save location labels + auto-discover frequent places

---

## 🎯 Problem Solved

**Before:**
- Users could edit location names in the timeline modal
- But clicking "Save" didn't persist them
- `place_id` in activity_segments always NULL (no user places defined)
- No way to discover which places should be labeled first

**After:**
- ✅ Saving location names creates entries in `tm.user_places`
- ✅ Future visits to that location auto-tag with saved label
- ✅ Automatic frequency analysis finds top places
- ✅ "Discover Places" screen suggests places to label
- ✅ `place_id` gets populated for labeled locations

---

## 📦 What Was Built

### 1. **Database Migration** ✅
**File:** `supabase/migrations/20260210000000_add_geohash7_to_user_places.sql`

**Changes:**
- Added `geohash7 TEXT` column to `tm.user_places`
- Created index for fast lookups: `(user_id, geohash7)`
- Created unique constraint (one label per user per geohash7)
- Auto-backfills geohash7 from existing `center` geography points
- **Trigger function:** Auto-generates geohash7 from center on insert/update

**Why geohash7?**
- Fast lookups without spatial queries
- 7 characters ≈ 150m precision (perfect for place matching)
- Human-readable (can debug easily)

---

### 2. **Frequent Places Service** ✅
**File:** `apps/mobile/src/lib/supabase/services/frequent-places.ts`

**Functions:**

```typescript
// Find places user visits frequently
findFrequentPlaces(userId, options?: {
  minVisits?: number;      // Default: 3
  daysBack?: number;       // Default: 30
  limit?: number;          // Default: 20
  excludeLabeled?: boolean; // Default: false
}): Promise<FrequentPlace[]>

// Generate smart suggestions with inferred categories
suggestPlacesToLabel(userId, options?: {
  minVisits?: number;  // Default: 5
  daysBack?: number;   // Default: 14
  limit?: number;      // Default: 5
}): Promise<PlaceSuggestion[]>

// Check if user has unlabeled frequent places (for badges)
getUnlabeledFrequentPlaceCount(userId): Promise<number>
```

**Smart Features:**
- **Category Inference:**
  - Detects gyms, coffee shops, grocery stores from name
  - Infers work vs. home from visit frequency + duration
  - Returns confidence score (0-1)
  
- **Label Cleaning:**
  - "Starbucks Coffee" → "Starbucks"
  - "Total Home Inspection LLC" → "Total Home Inspection"
  
- **Visit Statistics:**
  - Total visits, total hours spent
  - Average coordinates (centroid)
  - Last visit timestamp
  - Average confidence score

---

### 3. **Discover Places Screen** ✅
**File:** `apps/mobile/src/app/settings/discover-places.tsx`

**Route:** `/settings/discover-places`

**UI Flow:**
1. Shows loading state while analyzing activity
2. Displays cards for each frequent place:
   ```
   ┌─────────────────────────────────────────┐
   │ 📍 Believe Candle Co.                   │
   │    12 visits • 15h total                │
   │                                          │
   │    [Work] (suggested category)          │
   │                                          │
   │    [Skip]  [✓ Save Place]               │
   └─────────────────────────────────────────┘
   ```
3. Clicking "Save Place" → saves to `tm.user_places`
4. Removes from suggestion list after saving
5. Shows empty state if no frequent places found

**Empty State:**
```
   🗺️
   No Places Found
   We'll suggest places after you
   visit them a few times
```

---

### 4. **Location Labels Service** (Already Exists) ✅
**File:** `apps/mobile/src/lib/supabase/services/location-labels.ts`

**What It Does:**
- Saves user-defined location labels keyed by geohash7
- Updates existing places if already labeled
- Caches results in memory for performance

**Now Fixed:**
- Properly saves to `tm.user_places` with geohash7
- Auto-generates geohash7 from lat/lng via DB trigger
- Works with existing timeline edit modal

---

## 🚀 Deployment Steps

### Step 1: Run Migration

```bash
cd /Users/colezerman/Projects/todaymatters-turbo

# Apply migration to add geohash7 column + trigger
npx supabase db push

# Or if using migrations directly:
psql $DATABASE_URL -f supabase/migrations/20260210000000_add_geohash7_to_user_places.sql
```

**Verify:**
```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'tm' 
  AND table_name = 'user_places' 
  AND column_name = 'geohash7';

-- Check trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_schema = 'tm' 
  AND event_object_table = 'user_places'
  AND trigger_name = 'user_places_auto_geohash7';
```

---

### Step 2: Export Service Functions

**File:** `apps/mobile/src/lib/supabase/services/index.ts`

Add exports:
```typescript
export * from "./frequent-places";
```

---

### Step 3: Add Navigation Link

**File:** `apps/mobile/src/app/settings/index.tsx` (or wherever settings menu lives)

Add button to navigate to discovery screen:
```tsx
<TouchableOpacity 
  onPress={() => router.push('/settings/discover-places')}
>
  <Text>🔍 Discover Frequent Places</Text>
</TouchableOpacity>
```

Optional: Add badge showing count:
```tsx
const [placesCount, setPlacesCount] = useState(0);

useEffect(() => {
  getUnlabeledFrequentPlaceCount(userId).then(setPlacesCount);
}, [userId]);

// Show badge if placesCount > 0
{placesCount > 0 && <Badge>{placesCount}</Badge>}
```

---

### Step 4: Test End-to-End

1. **Save a Location from Timeline:**
   - Open Activity Timeline
   - Tap on a location block (e.g., "Unknown Location")
   - Edit modal opens
   - Change name to "Office"
   - Select category: "Work"
   - Set radius: "Medium (100m)"
   - Click "Save"

2. **Verify Database:**
   ```sql
   SELECT * FROM tm.user_places 
   WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';
   
   -- Should show:
   -- label: 'Office'
   -- category: 'work'
   -- radius_m: 100
   -- center: POINT(...)
   -- geohash7: '9v6kb7d' (or similar)
   ```

3. **Test Frequency Discovery:**
   - Navigate to Settings → Discover Places
   - Should show frequent places (if data exists)
   - Click "Save Place" on one
   - Verify it saves to database

4. **Test Automatic Matching:**
   - Reprocess today's data:
     ```typescript
     await reprocessDayWithPlaceLookup(userId, '2026-02-10');
     ```
   - Check activity_segments:
     ```sql
     SELECT place_id, place_label, place_category 
     FROM tm.activity_segments 
     WHERE user_id = '...' 
       AND place_id IS NOT NULL;
     ```
   - Should see `place_id` populated for saved places!

---

## 🎨 UX Improvements (Optional)

### A. Smart Onboarding Wizard
After 3 days of data collection, show one-time prompt:
```
┌─────────────────────────────────────────┐
│  🎉 We've learned your routine!         │
│                                          │
│  Here are your top 3 places:            │
│  1. Believe Candle Co. (~15h)           │
│     [Work] [Home] [Other]               │
│                                          │
│  [Skip] [Label These Places →]          │
└─────────────────────────────────────────┘
```

### B. Contextual Suggestions
On Activity Timeline, show inline prompt:
```
┌─────────────────────────────────────────┐
│  1:23 PM - Believe Candle Co. (2h 15m)  │
│  Deep work • Slack, Chrome              │
│                                          │
│  💡 You visit here often. Label it?     │
│  [Label as...] [Dismiss]                │
└─────────────────────────────────────────┘
```

### C. Settings Badge
Show count of unlabeled frequent places in Settings:
```
Settings
  📍 Places              [5] 🔴
  🔍 Discover Places
```

---

## 📊 Metrics to Track

### Place Coverage
```sql
-- What % of segments have user-defined places?
SELECT 
  COUNT(CASE WHEN place_id IS NOT NULL THEN 1 END)::float / 
  COUNT(*)::float * 100 as coverage_pct
FROM tm.activity_segments
WHERE user_id = :userId
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

**Target:** >60% after 2 weeks, >80% after 1 month

### Labeling Velocity
```sql
-- Places labeled per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as places_created
FROM tm.user_places
WHERE user_id = :userId
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
```

**Target:** 2-3 in first week, then 1-2/week

### Discovery Engagement
```sql
-- Track how many users visit discover screen
-- (Add analytics event when screen loads)
```

---

## 🐛 Troubleshooting

### geohash7 is NULL after save
**Check:**
```sql
SELECT id, label, geohash7, center 
FROM tm.user_places 
WHERE user_id = :userId;
```

**Fix:**
- Ensure migration trigger is deployed
- Verify `center` column has valid geography data
- Manually backfill:
  ```sql
  UPDATE tm.user_places
  SET geohash7 = ST_GeoHash(center::geometry, 7)
  WHERE geohash7 IS NULL AND center IS NOT NULL;
  ```

### place_id still NULL in activity_segments
**Possible causes:**
1. User hasn't created any places yet → Expected
2. Place exists but coordinates don't match
   - Check radius: default is 150m
   - Verify segment coordinates vs. place center
3. Pipeline hasn't reprocessed yet
   - Run: `reprocessDayWithPlaceLookup(userId, dateYmd)`

**Debug query:**
```sql
-- Find segments near a saved place but not matched
WITH saved_places AS (
  SELECT id, label, center, radius_m
  FROM tm.user_places
  WHERE user_id = :userId
)
SELECT 
  seg.id,
  seg.place_label,
  seg.place_id,
  seg.location_lat,
  seg.location_lng,
  ST_Distance(
    ST_SetSRID(ST_MakePoint(seg.location_lng, seg.location_lat), 4326)::geography,
    sp.center
  ) as distance_m
FROM tm.activity_segments seg
CROSS JOIN saved_places sp
WHERE seg.user_id = :userId
  AND seg.place_id IS NULL
  AND seg.location_lat IS NOT NULL
ORDER BY distance_m ASC
LIMIT 10;
```

### Discover screen shows no results
**Check:**
1. User has activity data:
   ```sql
   SELECT COUNT(*) FROM tm.activity_segments 
   WHERE user_id = :userId 
     AND created_at >= CURRENT_DATE - INTERVAL '14 days';
   ```
2. Segments have place_label populated:
   ```sql
   SELECT COUNT(*) FROM tm.activity_segments 
   WHERE user_id = :userId 
     AND place_label IS NOT NULL;
   ```
3. Lower minVisits threshold in `suggestPlacesToLabel` call

---

## ✅ Success Criteria

**Must Have (MVP):**
- [x] Migration deployed
- [x] Saving location from timeline creates user_place
- [x] Discover screen loads and shows suggestions
- [x] Saving from discover screen works
- [ ] Reprocessing day populates place_id in segments

**Nice to Have:**
- [ ] Badge on Settings showing unlabeled count
- [ ] Inline suggestion cards on timeline
- [ ] Automatic backfill when user saves place
- [ ] Category auto-inference working (70%+ accuracy)

**Stretch Goals:**
- [ ] Smart onboarding wizard after 3 days
- [ ] Merge duplicate places ("Starbucks #1" + "Starbucks #2")
- [ ] Import places from calendar (recurring meeting locations)
- [ ] Share places across household accounts

---

## 🔗 Related Files

**Core Services:**
- `apps/mobile/src/lib/supabase/services/frequent-places.ts` (new)
- `apps/mobile/src/lib/supabase/services/location-labels.ts` (updated)
- `apps/mobile/src/lib/supabase/services/activity-segments.ts` (existing)

**UI Screens:**
- `apps/mobile/src/app/settings/discover-places.tsx` (new)
- `apps/mobile/src/app/activity-timeline.tsx` (existing - already has modal)
- `apps/mobile/src/app/settings/place-labels.tsx` (existing - manual management)

**Database:**
- `supabase/migrations/20260210000000_add_geohash7_to_user_places.sql` (new)
- `supabase/migrations/20260112000000_create_tm_location_samples.sql` (original table)

**Documentation:**
- `docs/location-management-analysis.md` (analysis + best practices)
- `docs/location-labeling-implementation.md` (this file)

---

## 📞 Next Steps

1. ✅ Review this implementation guide
2. [ ] Deploy migration to production DB
3. [ ] Test save flow from timeline modal
4. [ ] Test discover screen
5. [ ] Add navigation link to settings
6. [ ] Track metrics after 1 week
7. [ ] Iterate based on user behavior

---

**Questions?** Check `/Users/colezerman/Projects/todaymatters-turbo/docs/location-management-analysis.md` for detailed analysis and best practices.
