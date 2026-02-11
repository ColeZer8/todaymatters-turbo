# Location Tagging Bug Fix

## 🐛 Problem Summary

When a user clicks an event and tags it as "Home" (or other label):
1. ❌ UI refreshes but location doesn't update to show the tag
2. ❌ Tag is saved to Supabase but not reflected immediately
3. ❌ Future sessions don't automatically use that tag until app restart

## 🔍 Root Cause Analysis

### Bug #1: Missing `onAddPlace` callback propagation
**File:** `apps/mobile/src/components/templates/ComprehensiveCalendarTemplate.tsx`

The `SessionDetailModal` component was missing the `onAddPlace` prop, so when a user saved a place, nothing triggered a UI refresh.

**Before:**
```tsx
<SessionDetailModal
  event={sessionDetailEvent}
  visible={isSessionDetailVisible}
  onClose={...}
  onSplit={...}
  onMerge={...}
  // ❌ Missing: onAddPlace prop
/>
```

**After:**
```tsx
<SessionDetailModal
  event={sessionDetailEvent}
  visible={isSessionDetailVisible}
  onClose={...}
  onSplit={...}
  onMerge={...}
  onAddPlace={(placeLabel) => {
    if (onAddPlace) {
      onAddPlace(placeLabel);
    }
    setIsSessionDetailVisible(false);
    setSessionDetailEvent(null);
  }}
/>
```

### Bug #2: No realtime subscription for `user_places` table
**File:** `apps/mobile/src/app/comprehensive-calendar.tsx`

The calendar page subscribed to several tables (`location_hourly`, `events`, `screen_time_app_sessions`, `health_workouts`, `hourly_summaries`) but NOT `user_places`. When a place was added, the app didn't know to refresh.

**Fix Added:**
```typescript
// Listen for user_places changes (location tagging)
channel.on(
  "postgres_changes",
  {
    event: "*",
    schema: "tm",
    table: "user_places",
    filter: `user_id=eq.${userId}`,
  },
  () => {
    // Refresh location blocks to pick up new place labels
    if (USE_NEW_LOCATION_PIPELINE) void refreshBlocks();
    void refreshVerification();
  },
);
```

### Bug #3: Location blocks not refreshing after place creation
**File:** `apps/mobile/src/app/comprehensive-calendar.tsx`

The `ComprehensiveCalendarTemplate` component needed an `onAddPlace` handler to refresh location blocks when a place is added.

**Fix Added:**
```typescript
<ComprehensiveCalendarTemplate
  ...
  onAddPlace={async (placeLabel) => {
    // Refresh location blocks to pick up the new place label
    if (USE_NEW_LOCATION_PIPELINE) {
      await refreshBlocks();
    }
    // Refresh actual events to show updated labels
    await refreshActualEventsForSelectedDay();
  }}
/>
```

## ✅ How The Fix Works

### Database Architecture (Already Working!)
The `location_hourly` **view** automatically joins with `user_places` to match locations:

```sql
left join lateral (
  select p.id, p.label, p.category
  from tm.user_places p
  where p.user_id = h.user_id
    and st_dwithin(p.center, h.centroid_geom::geography, p.radius_m)
  order by p.radius_m asc
  limit 1
) place_match on true
```

This means whenever `location_hourly` is queried, it automatically picks up the latest user places within the specified radius (default 150m).

### The Complete Flow (After Fix)

1. **User adds a place:**
   - Taps location block → opens `SessionDetailModal`
   - Selects "Home" tag → calls `createUserPlace()`
   - Place is saved to `tm.user_places` with coordinates and radius

2. **Modal triggers refresh:**
   - `SessionDetailModal` calls `onAddPlace("Home")`
   - `ComprehensiveCalendarTemplate` receives callback
   - Calls `refreshBlocks()` to re-fetch location data

3. **Location blocks refresh:**
   - `useLocationBlocksForDay` hook's `refresh()` function:
     - Clears place inference cache
     - Re-queries `location_hourly` view
     - View automatically joins with `user_places`
     - Returns location blocks with new place label

4. **UI updates:**
   - Location blocks now show "Home" instead of "Unknown Location"
   - User sees the change immediately
   - Future sessions at those coordinates automatically use "Home"

5. **Realtime updates (bonus):**
   - If another device adds a place, Supabase realtime triggers refresh
   - All devices stay in sync automatically

## 🧪 Testing Checklist

- [ ] **Create new place:**
  1. Open calendar, find "Unknown Location" session
  2. Tap it, select "Add Place"
  3. Choose "Home" from quick select
  4. Verify modal closes and location updates to "Home" immediately

- [ ] **Place persists:**
  1. Kill and restart app
  2. Return to calendar
  3. Verify session still shows "Home"

- [ ] **Future sessions auto-tagged:**
  1. Create a place "Home"
  2. Wait for next location data sync (or simulate with test data)
  3. New sessions at those coordinates should automatically show "Home"

- [ ] **Realtime sync (multi-device):**
  1. Open app on Device A and Device B
  2. Add place "Office" on Device A
  3. Device B should auto-refresh and show "Office" within seconds

## 📝 Files Changed

1. `apps/mobile/src/components/templates/ComprehensiveCalendarTemplate.tsx`
   - Added `onAddPlace` prop to interface
   - Added `onAddPlace` prop to component destructuring
   - Passed `onAddPlace` to `SessionDetailModal`

2. `apps/mobile/src/app/comprehensive-calendar.tsx`
   - Added `onAddPlace` handler to `ComprehensiveCalendarTemplate`
   - Added realtime subscription for `user_places` table

## 🎯 Expected Behavior

### Before Fix
- User adds place → modal closes → **nothing changes**
- User force-quits app → reopens → location now shows label
- Confusing UX, feels broken

### After Fix
- User adds place → modal closes → **location updates immediately**
- Place label shows on all past and future sessions at that location
- Smooth, instant feedback

## 🔧 Additional Notes

- The `user_places` table stores places with a `radius_m` column (default 150m)
- The `location_hourly` view uses `ST_DWithin()` to match locations within this radius
- Place inference cache is properly invalidated on refresh
- No backend changes needed - the SQL view already does the heavy lifting!

## 🚀 Deployment

These are client-side changes only. No database migrations or backend deployments required.

Deploy by:
1. Commit changes to `main` branch
2. Build new iOS app version
3. Test on physical device (simulator may not have location data)
4. Submit to TestFlight/App Store when ready
