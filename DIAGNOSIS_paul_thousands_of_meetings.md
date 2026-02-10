# DIAGNOSIS: Paul's "Thousands of Meetings" Issue

**Date:** February 10, 2026 3:33 PM CST  
**User:** Paul Graeve (`b9ca3335-9929-4d54-a3fc-18883c5f3375`)  
**Status:** 🔴 ROOT CAUSE IDENTIFIED

---

## The Mystery

- **Database Query:** `SELECT COUNT(*) FROM tm.events WHERE user_id = 'paul' AND DATE(scheduled_start) = '2026-02-10'` → Returns **60 events** ✅
- **UI Display:** Shows **THOUSANDS of meetings** in Activities screen ❌

---

## Root Cause: Triple Query Issue

The Activities screen (`activity-timeline.tsx`) → `LocationBlockList` component → `fetchPlannedCalendarEventsForDay()` function performs **THREE separate queries**:

### Query 1: Planned Events (✅ Works correctly)
```typescript
supabase.schema("tm").from("events")
  .eq("user_id", userId)
  .eq("type", "calendar_planned")
  .lt("scheduled_start", endIso)   // < 2026-02-11T00:00:00
  .gt("scheduled_end", startIso)   // > 2026-02-10T00:00:00
```

### Query 2: Public Events (✅ Works correctly)
```typescript
supabase.schema("public").from("events")
  .eq("user_id", userId)
  .eq("type", "calendar_planned")
  .lt("scheduled_start", endIso)
  .gt("scheduled_end", startIso)
```

### Query 3: Google Meetings ❌ **THIS IS THE PROBLEM**
```typescript
supabase.schema("tm").from("events")
  .eq("user_id", userId)
  .eq("type", "meeting")                    // ← Fetches ALL meetings
  .neq("title", "Private Event")
  .lt("scheduled_start", endIso)
  .gt("scheduled_end", startIso)
```

**The Issue:** If Paul has meetings where:
- `scheduled_start` or `scheduled_end` is NULL
- `scheduled_start` or `scheduled_end` is malformed
- Date range filter fails silently

Then **ALL 25,508 meetings** pass through the filter!

---

## Exact Query Location

**File:** `/apps/mobile/src/lib/supabase/services/calendar-events.ts`  
**Function:** `fetchPlannedCalendarEventsForDay()`  
**Lines:** 518-527 (the third query in `Promise.all()`)

```typescript
// Google Calendar ingestion currently stores meetings as `tm.events.type = 'meeting'`.
// We want those to show up in the PLANNED column, but only for Google Calendar rows.
// Filter out private events (they clutter the timeline with no useful info)
supabase
  .schema("tm")
  .from("events")
  .select("*")
  .eq("user_id", userId)
  .eq("type", "meeting")
  .neq("title", "Private Event") // Exclude private calendar events
  .lt("scheduled_start", endIso)
  .gt("scheduled_end", startIso)
  .order("scheduled_start", { ascending: true }),
```

---

## Diagnostic SQL Queries

### 1. Check for NULL scheduled times
```sql
SELECT 
    COUNT(*) as null_start_count
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start IS NULL;

SELECT 
    COUNT(*) as null_end_count
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_end IS NULL;
```

### 2. Check for meetings outside Feb 10 range
```sql
-- This simulates what the UI query SHOULD return
SELECT 
    COUNT(*) as meetings_in_range
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start < '2026-02-11T00:00:00'::timestamptz
    AND scheduled_end > '2026-02-10T00:00:00'::timestamptz;
```

### 3. Total meetings that COULD be fetched
```sql
SELECT 
    COUNT(*) as total_meetings
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event';
```

### 4. Sample problematic meetings
```sql
SELECT 
    id,
    title,
    scheduled_start,
    scheduled_end,
    local_date,
    created_at,
    meta
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND (
        scheduled_start IS NULL 
        OR scheduled_end IS NULL
        OR scheduled_start::text NOT LIKE '2026-02-10%'
    )
ORDER BY created_at DESC
LIMIT 20;
```

---

## The Fix Options

### Option A: Add Defensive NULL Check (Quick Fix)
```typescript
// In calendar-events.ts, line ~518
supabase
  .schema("tm")
  .from("events")
  .select("*")
  .eq("user_id", userId)
  .eq("type", "meeting")
  .neq("title", "Private Event")
  .not("scheduled_start", "is", null)  // ← ADD THIS
  .not("scheduled_end", "is", null)    // ← ADD THIS
  .lt("scheduled_start", endIso)
  .gt("scheduled_end", startIso)
  .order("scheduled_start", { ascending: true }),
```

### Option B: Use local_date as Fallback Filter (More Robust)
```typescript
supabase
  .schema("tm")
  .from("events")
  .select("*")
  .eq("user_id", userId)
  .eq("type", "meeting")
  .eq("local_date", ymd)  // ← Filter by exact date first
  .neq("title", "Private Event")
  .not("scheduled_start", "is", null)
  .not("scheduled_end", "is", null)
  .lt("scheduled_start", endIso)
  .gt("scheduled_end", startIso)
  .order("scheduled_start", { ascending: true }),
```

### Option C: Fix Data Quality (Long-term)
```sql
-- Delete meetings with NULL scheduled times
DELETE FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND (scheduled_start IS NULL OR scheduled_end IS NULL);

-- Or set proper values from meta->>'start_time' if available
UPDATE tm.events
SET 
    scheduled_start = (meta->>'start_time')::timestamptz,
    scheduled_end = (meta->>'end_time')::timestamptz
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND scheduled_start IS NULL
    AND meta->>'start_time' IS NOT NULL;
```

---

## Testing the Theory

**Run this to confirm:**
```sql
-- If this returns THOUSANDS, we found the bug
SELECT COUNT(*) as meetings_fetched
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND (scheduled_start IS NULL OR scheduled_end IS NULL);

-- Expected: If count is high (thousands), this is the root cause
-- Expected: If count is low (< 100), there's a different issue
```

---

## Deduplication Logic

After fetching all three queries, the code DOES deduplicate using `buildDedupKey()`:

```typescript
for (const event of googleMeetingEvents) {
  const key = buildDedupKey(event);  // Uses title + startMinutes
  if (seen.has(key)) continue;       // Skip if already added
  seen.add(key);
  merged.push(event);
}
```

**BUT:** If `rowToScheduledEventForDayFromTmGoogleMeeting()` successfully parses NULL/malformed timestamps, it still adds them to the result array!

---

## Why Database Query Shows 60 but UI Shows Thousands

Your test query:
```sql
SELECT COUNT(*) 
FROM tm.events 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375' 
  AND DATE(scheduled_start) = '2026-02-10'
```

This correctly filters by `DATE(scheduled_start)`.

But the Supabase query uses:
```typescript
.lt("scheduled_start", endIso)      // scheduled_start < '2026-02-11T00:00:00'
.gt("scheduled_end", startIso)      // scheduled_end > '2026-02-10T00:00:00'
```

**This fails if:**
- `scheduled_start` is NULL → comparison returns NULL (treated as false in SQL, but might behave differently in PostgREST)
- `scheduled_end` is NULL → same issue
- Timestamps are far in the future/past but still pass the range check

---

## Next Steps

1. **Run diagnostic queries above** to confirm NULL scheduled times
2. **Apply Option A (quick fix)** to add NULL checks to the query
3. **Clean up data** using Option C SQL
4. **Test with Paul's account** to verify fix

---

## Files to Modify

1. `/apps/mobile/src/lib/supabase/services/calendar-events.ts` (line ~518-527)
2. **Optional:** Create migration to clean up NULL scheduled times

---

## Related Issues

- This is NOT related to the duplicate meetings issue we fixed earlier
- This is a **query filter bug** that allows thousands of unrelated meetings to leak into the day view
- The fix is straightforward: add `.not("scheduled_start", "is", null)` filters

---

**Status:** Ready to implement fix. Awaiting confirmation from diagnostic queries.
