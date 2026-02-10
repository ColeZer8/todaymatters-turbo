# URGENT: Paul's Duplicate Meeting Events Issue

**Date:** February 10, 2026 1:29 PM CST  
**Reporter:** Paul Graeve (client)  
**Issue:** "THOUSANDS of meetings like this in my activities"

---

## Problem Description

Paul is seeing massive duplicate "Meeting - Private Event" entries in his timeline with:
- Absurd durations (39733h = 1655 days, 2079h = 86 days)
- All labeled "Meeting - Private Event"
- Appearing in thousands

**Screenshot shows:**
- 10+ "Meeting" events visible on single day
- Times like "6:58 PM - 9:20 AM" (spanning overnight incorrectly)
- Duration gaps suggesting data corruption or infinite loop

---

## Likely Root Causes

### 1. **Calendar Sync Loop (Most Likely)**
- Google Calendar sync running repeatedly
- No deduplication on calendar event_id
- Same events being inserted over and over
- Could be from recurring events being expanded infinitely

### 2. **Private Event Handling Bug**
- Calendar API returning "Private Event" for declined/private meetings
- These shouldn't be ingested at all
- Filter missing or broken

### 3. **Duplicate Event IDs**
- `tm.events` table has no unique constraint on external_id
- Same Google Calendar event inserted multiple times
- Each sync appends instead of upserting

### 4. **Recurring Event Expansion Gone Wrong**
- Recurring meetings being expanded without end date
- Could generate thousands of instances
- Should be limited to a window (e.g., next 90 days)

---

## Diagnostic Steps

### Step 1: Count Paul's Events
```sql
-- Find Paul's user_id
SELECT id, email FROM auth.users WHERE email ILIKE '%paul%graeve%' OR email ILIKE '%graeve%';

-- Count events for Paul on Feb 10
SELECT 
    type,
    title,
    COUNT(*) as count
FROM tm.events
WHERE user_id = '<paul_user_id>'
    AND local_date = '2026-02-10'
GROUP BY type, title
ORDER BY count DESC;
```

### Step 2: Find Duplicate Events
```sql
-- Check for duplicate event_ids (external calendar IDs)
SELECT 
    meta->>'event_id' as external_id,
    meta->>'source' as source,
    title,
    COUNT(*) as duplicate_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM tm.events
WHERE user_id = '<paul_user_id>'
    AND local_date >= '2026-02-01'
    AND title LIKE '%Meeting%'
GROUP BY meta->>'event_id', meta->>'source', title
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;
```

### Step 3: Check Source
```sql
-- What's creating these events?
SELECT 
    meta->>'source' as source,
    meta->>'kind' as kind,
    COUNT(*) as count
FROM tm.events
WHERE user_id = '<paul_user_id>'
    AND local_date = '2026-02-10'
    AND title LIKE '%Meeting%'
GROUP BY meta->>'source', meta->>'kind';
```

---

## Immediate Fix (Emergency Stop)

### Option A: Delete Duplicates (Safest)
```sql
-- Delete all but the earliest instance of each duplicate
WITH ranked_events AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        user_id,
        local_date,
        scheduled_start_iso,
        scheduled_end_iso,
        title
      ORDER BY created_at ASC
    ) as rn
  FROM tm.events
  WHERE user_id = '<paul_user_id>'
    AND title LIKE '%Meeting - Private Event%'
)
DELETE FROM tm.events
WHERE id IN (
  SELECT id FROM ranked_events WHERE rn > 1
);
```

### Option B: Delete All Private Events
```sql
-- Nuclear option: remove all private events
DELETE FROM tm.events
WHERE user_id = '<paul_user_id>'
  AND title LIKE '%Private Event%';
```

---

## Permanent Fix (Code Changes)

### 1. Add Unique Constraint on External ID
```sql
-- Migration: Add unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS tm_events_user_external_id_uniq
  ON tm.events (user_id, (meta->>'event_id'))
  WHERE meta->>'event_id' IS NOT NULL;
```

### 2. Filter Out Private/Declined Events
In calendar sync code, add filter:
```typescript
// Skip private/declined events
if (event.summary === 'Private Event' || 
    event.summary?.includes('Private') ||
    event.status === 'declined' ||
    event.transparency === 'transparent') {
  continue; // Don't import
}
```

### 3. Limit Recurring Event Expansion
```typescript
// Limit recurring events to 90 days forward
const MAX_RECURRING_DAYS = 90;
const expandUntil = addDays(new Date(), MAX_RECURRING_DAYS);

if (event.recurrence && instances.length > 100) {
  console.warn(`Limiting recurring event ${event.id} to 100 instances`);
  instances = instances.slice(0, 100);
}
```

### 4. Use Upsert Instead of Insert
```typescript
// Change from .insert() to .upsert()
await supabase
  .schema('tm')
  .from('events')
  .upsert(eventData, {
    onConflict: 'user_id,external_id',  // Dedupe by external calendar ID
    ignoreDuplicates: false  // Update existing instead
  });
```

---

## Action Plan (Priority Order)

**URGENT (Do Now):**
1. Run diagnostic queries to count duplicates
2. Run delete duplicate query to clean Paul's data
3. Disable calendar sync temporarily (if possible)

**HIGH (Today):**
4. Add unique constraint migration
5. Add private event filter to sync code
6. Test with Paul's account

**MEDIUM (This Week):**
7. Add recurring event limits
8. Switch to upsert pattern
9. Add deduplication logging
10. Create monitoring alert for duplicate counts

---

## Files to Check/Modify

1. **Calendar Sync Logic:**
   - `/apps/mobile/src/lib/supabase/services/calendar-events.ts`
   - Search for where events are inserted into `tm.events`
   
2. **Migration:**
   - Create: `/supabase/migrations/20260210000001_fix_duplicate_calendar_events.sql`
   
3. **Background Tasks:**
   - Check for cron jobs or background tasks syncing calendar
   - Look in: `/supabase/functions/` or app background tasks

---

## Prevention

**Add Monitoring:**
```sql
-- Query to detect duplicates (run daily)
SELECT 
    user_id,
    COUNT(*) as total_events,
    COUNT(DISTINCT (meta->>'event_id')) as unique_events,
    COUNT(*) - COUNT(DISTINCT (meta->>'event_id')) as duplicate_count
FROM tm.events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(*) - COUNT(DISTINCT (meta->>'event_id')) > 10
ORDER BY duplicate_count DESC;
```

**Add Rate Limiting:**
```typescript
// Limit calendar sync to once per hour per user
const lastSync = await getLastCalendarSync(userId);
if (lastSync && Date.now() - lastSync < 60 * 60 * 1000) {
  console.log('Calendar sync rate limited');
  return;
}
```

---

## Next Steps

Cole, run the diagnostic queries first to confirm the root cause, then I'll provide the exact fix based on what we find.

**Quick Check:**
```bash
cd /Users/colezerman/Projects/todaymatters-turbo
echo "SELECT COUNT(*) FROM tm.events WHERE user_id = (SELECT id FROM auth.users WHERE email ILIKE '%paul%' LIMIT 1) AND title LIKE '%Meeting%';" | npx supabase db execute -
```
