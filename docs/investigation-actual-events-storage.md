# Investigation: Where Are "Actual" Events Stored?

**Date**: 2026-01-22  
**Status**: Investigation Only - No Changes Made  
**Issue**: Client reports only seeing scheduled/meeting events, not location/screen time/unknown events

---

## Executive Summary

The client is querying `tm.events` and only seeing events with `type = 'meeting'` and `source_provider = 'google'`. However, **actual events** (location changes, screen time, phone usage, unknown blocks) are stored in the **same table** (`tm.events`) but with a **different type**: `type = 'calendar_actual'`.

**Key Finding**: The client's query is filtering by `type = 'meeting'` or `created_at::date = '2026-01-22'`, which will only show Google Calendar meeting events, not the actual evidence-based events.

---

## Data Storage Architecture

### 1. **Location Data** → `tm.location_samples`

- **Table**: `tm.location_samples`
- **Purpose**: Raw location samples from iOS background tasks
- **Fields**: `recorded_at`, `latitude`, `longitude`, `accuracy_m`, `speed_mps`, etc.
- **Status**: ✅ Data is being collected and stored

### 2. **Screen Time Data** → `tm.screen_time_app_sessions`

- **Table**: `tm.screen_time_app_sessions` (and related tables)
- **Purpose**: App usage sessions and screen time data
- **Status**: ✅ Tables exist, data should be synced from iOS Screen Time API

### 3. **Actual Events** → `tm.events` with `type = 'calendar_actual'`

- **Table**: `tm.events`
- **Type**: `'calendar_actual'` (NOT `'meeting'`)
- **Purpose**: Events derived from evidence (location, screen time, workouts)
- **Creation**: Via `syncActualEvidenceBlocks()` function
- **Status**: ⚠️ **This is where the issue likely is**

### 4. **Scheduled/Meeting Events** → `tm.events` with `type = 'meeting'` or `'calendar_planned'`

- **Table**: `tm.events`
- **Type**: `'meeting'` (from Google Calendar) or `'calendar_planned'` (user-created)
- **Source**: Google Calendar sync or user-created events
- **Status**: ✅ Client can see these

---

## How Actual Events Are Created

### Flow:

1. **Evidence Collection**: Location samples and screen time data are collected
2. **Block Generation**: `generateActualBlocks()` creates `ActualBlock[]` from evidence
3. **Sync to Database**: `syncActualEvidenceBlocks()` saves blocks as events with `type = 'calendar_actual'`

### Code Location:

- **Evidence Processing**: `apps/mobile/src/lib/calendar/verification-engine.ts` → `generateActualBlocks()`
- **Database Sync**: `apps/mobile/src/lib/supabase/services/actual-evidence-events.ts` → `syncActualEvidenceBlocks()`
- **Trigger**: `apps/mobile/src/app/comprehensive-calendar.tsx` (lines 471-496)

### What Gets Stored:

```typescript
{
  user_id: userId,
  type: 'calendar_actual',  // ← KEY: This is the type, NOT 'meeting'
  title: block.title || 'Actual',
  description: block.description || '',
  scheduled_start: scheduledStartIso,
  scheduled_end: scheduledEndIso,
  meta: {
    category: 'unknown',  // ← Often 'unknown' for gaps
    source: 'evidence',
    source_id: 'evidence:location:2026-01-22:540:720',
    actual: true,
    tags: ['actual'],
    // Location data
    location: 'Home',
    location_label: 'Home',
    // Screen time data
    screen_time_minutes: 45,
    top_app: 'Safari',
    // etc.
  }
}
```

---

## The Problem: Query Mismatch

### Client's Query (from image):

```sql
select * from tm.events
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and created_at::date = '2026-01-22'
order by received_at desc;
```

**OR** (commented out):

```sql
select title, description, status, scheduled_start, scheduled_end, location, attendees
from tm.events
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and type = 'meeting'
  and scheduled_start::date = '2026-01-22';
```

### Why This Doesn't Show Actual Events:

1. **Type Filter**: If filtering by `type = 'meeting'`, actual events won't show (they use `type = 'calendar_actual'`)
2. **Created_at vs Scheduled**: Actual events might have `created_at` on a different date than `scheduled_start`
3. **Missing Fields**: The query might be looking for `received_at` which doesn't exist in `tm.events` (that's in `public.events`)

---

## Correct Query to See All Events

### To see ALL events for the day (including actual):

```sql
select
  id,
  type,
  title,
  description,
  scheduled_start,
  scheduled_end,
  created_at,
  meta
from tm.events
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and (
    scheduled_start::date = '2026-01-22'
    or scheduled_end::date = '2026-01-22'
    or (scheduled_start::date < '2026-01-22' and scheduled_end::date > '2026-01-22')
  )
order by scheduled_start;
```

### To see ONLY actual events (location/screen time/unknown):

```sql
select
  id,
  type,
  title,
  description,
  scheduled_start,
  scheduled_end,
  created_at,
  meta->>'category' as category,
  meta->>'source' as source,
  meta->>'location' as location,
  meta->>'screen_time_minutes' as screen_time_minutes
from tm.events
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and type = 'calendar_actual'
  and (
    scheduled_start::date = '2026-01-22'
    or scheduled_end::date = '2026-01-22'
  )
order by scheduled_start;
```

### To see the "all day unknown event":

```sql
select
  id,
  type,
  title,
  description,
  scheduled_start,
  scheduled_end,
  meta
from tm.events
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and type = 'calendar_actual'
  and meta->>'category' = 'unknown'
  and scheduled_start::date = '2026-01-22'
order by scheduled_start;
```

---

## Potential Issues to Investigate

### 1. **Are Actual Events Being Created?**

- Check if `actualBlocks` array is being generated (needs location/screen time data)
- Check if `syncActualEvidenceBlocks()` is being called
- Check for errors in the sync process (might be silently failing)

### 2. **Is Evidence Data Available?**

- Verify location samples exist: `select count(*) from tm.location_samples where user_id = '...' and recorded_at::date = '2026-01-22'`
- Verify screen time data exists: `select count(*) from tm.screen_time_app_sessions where user_id = '...' and date = '2026-01-22'`

### 3. **Is the Sync Function Running?**

- The sync happens in `comprehensive-calendar.tsx` when `actualBlocks` changes
- Check if the component is mounted and `actualBlocks` has data
- Check for console errors: `[Calendar] Failed to sync actual evidence blocks`

### 4. **Date/Time Issues**

- Actual events use `scheduled_start` and `scheduled_end` (not `created_at`)
- The client's query uses `created_at::date` which might miss events created on a different day

---

## Tables Summary

| Data Type            | Table                         | Key Fields                             | How to Query             |
| -------------------- | ----------------------------- | -------------------------------------- | ------------------------ |
| **Location Samples** | `tm.location_samples`         | `recorded_at`, `latitude`, `longitude` | Raw location data        |
| **Screen Time**      | `tm.screen_time_app_sessions` | `start_time`, `end_time`, `app`        | App usage sessions       |
| **Actual Events**    | `tm.events`                   | `type = 'calendar_actual'`             | Evidence-based events    |
| **Meeting Events**   | `tm.events`                   | `type = 'meeting'`                     | Google Calendar meetings |
| **Planned Events**   | `tm.events`                   | `type = 'calendar_planned'`            | User-created events      |

---

## Recommended Next Steps

1. **Run the correct query** to see if `calendar_actual` events exist for the date
2. **Check if evidence data exists** (location samples, screen time) for that date
3. **Verify the sync is running** - check app logs for sync errors
4. **Check the actualBlocks generation** - verify `generateActualBlocks()` is creating blocks from evidence
5. **Verify date filtering** - use `scheduled_start`/`scheduled_end` instead of `created_at`

---

## Key Files Reference

- **Evidence Processing**: `apps/mobile/src/lib/calendar/verification-engine.ts`
- **Database Sync**: `apps/mobile/src/lib/supabase/services/actual-evidence-events.ts`
- **Calendar Screen**: `apps/mobile/src/app/comprehensive-calendar.tsx` (lines 471-496)
- **Event Fetching**: `apps/mobile/src/lib/supabase/services/calendar-events.ts` → `fetchActualCalendarEventsForDay()`

---

## Notes

- The `tm.events` table does NOT have a `source_provider` column (that's in `public.events`)
- The `tm.events` table does NOT have a `received_at` column (that's in `public.events`)
- If the client is seeing `source_provider = 'google'`, they might be looking at `public.events` instead of `tm.events`
- The app uses `tm.events` for all calendar-related events (both planned and actual)
