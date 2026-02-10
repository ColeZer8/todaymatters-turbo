-- ============================================================================
-- FIX PAUL'S DUPLICATE MEETINGS - Run in Supabase SQL Editor
-- User: Paul Graeve (b9ca3335-9929-4d54-a3fc-18883c5f3375)
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSTIC - See the problem
-- Copy and run this first to see what's wrong
-- ============================================================================
SELECT 
    title,
    COUNT(*) as event_count
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND local_date >= '2026-02-01'
GROUP BY title
ORDER BY event_count DESC
LIMIT 20;

-- ============================================================================
-- STEP 2: PREVIEW - See what will be deleted
-- Run this to preview (doesn't delete anything)
-- ============================================================================
WITH ranked_events AS (
  SELECT 
    id,
    title,
    local_date,
    scheduled_start_iso,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY 
        user_id,
        local_date,
        scheduled_start_iso,
        scheduled_end_iso,
        title
      ORDER BY created_at ASC  -- Keep the OLDEST one
    ) as row_num
  FROM tm.events
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND (title ILIKE '%Meeting%' OR title ILIKE '%Private Event%')
    AND local_date >= '2026-02-01'
)
SELECT 
    'PREVIEW - Will be deleted' as action,
    title,
    local_date,
    scheduled_start_iso,
    COUNT(*) as duplicate_count
FROM ranked_events
WHERE row_num > 1
GROUP BY title, local_date, scheduled_start_iso
ORDER BY duplicate_count DESC
LIMIT 50;

-- Total count of duplicates
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
    ) as row_num
  FROM tm.events
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND (title ILIKE '%Meeting%' OR title ILIKE '%Private Event%')
    AND local_date >= '2026-02-01'
)
SELECT 
    COUNT(*) as total_duplicates_to_delete
FROM ranked_events
WHERE row_num > 1;

-- ============================================================================
-- STEP 3: DELETE - Actually remove duplicates
-- ⚠️ ONLY run this after reviewing Step 2 preview!
-- ============================================================================
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
    ) as row_num
  FROM tm.events
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND (title ILIKE '%Meeting%' OR title ILIKE '%Private Event%')
    AND local_date >= '2026-02-01'
)
DELETE FROM tm.events
WHERE id IN (
  SELECT id FROM ranked_events WHERE row_num > 1
);

-- ============================================================================
-- STEP 4: VERIFY - Check that it worked
-- Run this to confirm duplicates are gone
-- ============================================================================
SELECT 
    title,
    COUNT(*) as event_count
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND local_date >= '2026-02-01'
GROUP BY title
ORDER BY event_count DESC
LIMIT 20;

-- Check for remaining duplicates (should be 0)
SELECT 
    COUNT(*) as remaining_duplicates
FROM (
    SELECT 
        local_date,
        scheduled_start_iso,
        scheduled_end_iso,
        title,
        COUNT(*) as dup_count
    FROM tm.events
    WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
        AND local_date >= '2026-02-01'
    GROUP BY local_date, scheduled_start_iso, scheduled_end_iso, title
    HAVING COUNT(*) > 1
) duplicates;

-- ============================================================================
-- STEP 5: PREVENTION - Add unique constraint to prevent future duplicates
-- Run this to prevent this from happening again
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS tm_events_user_external_event_id_uniq
  ON tm.events (user_id, (meta->>'event_id'))
  WHERE meta->>'event_id' IS NOT NULL;

COMMENT ON INDEX tm_events_user_external_event_id_uniq IS 
  'Prevents duplicate calendar events by ensuring one event per user per external event_id';

-- Success message
SELECT 
    '✅ Fix complete! Paul should reload his app to see the updated data.' as message;
