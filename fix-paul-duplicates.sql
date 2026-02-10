-- URGENT FIX: Paul's Duplicate Meeting Events
-- Run this to diagnose and fix the issue

-- =============================================================================
-- STEP 1: DIAGNOSTIC (RUN THIS FIRST TO SEE THE PROBLEM)
-- =============================================================================

-- Find Paul's user_id
SELECT id as paul_user_id, email 
FROM auth.users 
WHERE email ILIKE '%paul%' 
LIMIT 1;

-- Count Paul's events (should show THOUSANDS of meetings)
SELECT 
    type,
    title,
    COUNT(*) as event_count
FROM tm.events
WHERE user_id = (SELECT id FROM auth.users WHERE email ILIKE '%paul%' LIMIT 1)
    AND local_date >= '2026-02-01'
GROUP BY type, title
ORDER BY event_count DESC
LIMIT 20;

-- Find duplicate patterns
SELECT 
    COALESCE(meta->>'event_id', 'NO_EXTERNAL_ID') as external_id,
    COALESCE(meta->>'source', 'NO_SOURCE') as source,
    title,
    local_date,
    COUNT(*) as duplicate_count
FROM tm.events
WHERE user_id = (SELECT id FROM auth.users WHERE email ILIKE '%paul%' LIMIT 1)
    AND title LIKE '%Meeting%'
    AND local_date >= '2026-02-01'
GROUP BY meta->>'event_id', meta->>'source', title, local_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;

-- =============================================================================
-- STEP 2: EMERGENCY FIX (DELETE DUPLICATES)
-- =============================================================================

-- Preview what will be deleted (BEFORE running delete)
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
  WHERE user_id = (SELECT id FROM auth.users WHERE email ILIKE '%paul%' LIMIT 1)
    AND (title LIKE '%Meeting%' OR title LIKE '%Private Event%')
)
SELECT 
    'WILL DELETE' as action,
    COUNT(*) as total_to_delete
FROM ranked_events
WHERE row_num > 1;

-- ACTUAL DELETE (Run this after confirming preview looks good)
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
  WHERE user_id = (SELECT id FROM auth.users WHERE email ILIKE '%paul%' LIMIT 1)
    AND (title LIKE '%Meeting%' OR title LIKE '%Private Event%')
)
DELETE FROM tm.events
WHERE id IN (
  SELECT id FROM ranked_events WHERE row_num > 1
);

-- =============================================================================
-- STEP 3: VERIFY FIX
-- =============================================================================

-- Count events again (should be much lower now)
SELECT 
    type,
    title,
    COUNT(*) as event_count
FROM tm.events
WHERE user_id = (SELECT id FROM auth.users WHERE email ILIKE '%paul%' LIMIT 1)
    AND local_date >= '2026-02-01'
GROUP BY type, title
ORDER BY event_count DESC
LIMIT 20;

-- Check for remaining duplicates (should be 0)
SELECT 
    COUNT(*) as remaining_duplicates
FROM (
    SELECT 
        user_id,
        local_date,
        scheduled_start_iso,
        scheduled_end_iso,
        title,
        COUNT(*) as dup_count
    FROM tm.events
    WHERE user_id = (SELECT id FROM auth.users WHERE email ILIKE '%paul%' LIMIT 1)
        AND local_date >= '2026-02-01'
    GROUP BY user_id, local_date, scheduled_start_iso, scheduled_end_iso, title
    HAVING COUNT(*) > 1
) duplicates;

-- =============================================================================
-- STEP 4: PREVENT FUTURE DUPLICATES (MIGRATION)
-- =============================================================================

-- Add unique constraint to prevent duplicates by external calendar ID
CREATE UNIQUE INDEX IF NOT EXISTS tm_events_user_external_event_id_uniq
  ON tm.events (user_id, (meta->>'event_id'))
  WHERE meta->>'event_id' IS NOT NULL;

-- Add comment
COMMENT ON INDEX tm_events_user_external_event_id_uniq IS 
  'Prevents duplicate calendar events by ensuring one event per user per external event_id';
