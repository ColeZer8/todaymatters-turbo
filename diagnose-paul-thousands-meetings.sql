-- ============================================================================
-- DIAGNOSE: Paul's "Thousands of Meetings" UI Bug
-- Run these queries to confirm the root cause
-- ============================================================================

-- Paul's user_id
\set paul_id 'b9ca3335-9929-4d54-a3fc-18883c5f3375'

-- ============================================================================
-- STEP 1: Count meetings with NULL scheduled times (ROOT CAUSE CHECK)
-- ============================================================================

-- Check for NULL scheduled_start
SELECT 
    COUNT(*) as null_start_count,
    'If this is HIGH (thousands), THIS IS THE BUG' as diagnosis
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start IS NULL;

-- Check for NULL scheduled_end
SELECT 
    COUNT(*) as null_end_count,
    'If this is HIGH (thousands), THIS IS THE BUG' as diagnosis
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_end IS NULL;

-- Check for EITHER NULL
SELECT 
    COUNT(*) as meetings_with_null_times,
    'CRITICAL: If > 1000, this explains UI bug' as diagnosis
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND (scheduled_start IS NULL OR scheduled_end IS NULL);

-- ============================================================================
-- STEP 2: Simulate the UI query (what SHOULD be fetched)
-- ============================================================================

-- This replicates the exact query from fetchPlannedCalendarEventsForDay
SELECT 
    COUNT(*) as meetings_that_should_show,
    'Expected: ~60 (or less) for Feb 10' as diagnosis
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start < '2026-02-11T00:00:00'::timestamptz
    AND scheduled_end > '2026-02-10T00:00:00'::timestamptz;

-- ============================================================================
-- STEP 3: Check total meetings (to understand scale)
-- ============================================================================

SELECT 
    COUNT(*) as total_meetings,
    'Total meetings in database for Paul' as description
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting';

SELECT 
    COUNT(*) as total_non_private_meetings,
    'Total non-private meetings' as description
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event';

-- ============================================================================
-- STEP 4: Inspect sample problematic meetings
-- ============================================================================

-- Show meetings with NULL scheduled times
SELECT 
    id,
    title,
    type,
    scheduled_start,
    scheduled_end,
    local_date,
    created_at,
    meta->>'event_id' as external_id,
    meta->>'source' as source
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- Show meetings with valid times but wrong dates
SELECT 
    id,
    title,
    scheduled_start,
    scheduled_end,
    local_date,
    DATE(scheduled_start) as start_date,
    created_at
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start IS NOT NULL
    AND scheduled_end IS NOT NULL
    AND DATE(scheduled_start) != '2026-02-10'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 5: Check if local_date is reliable
-- ============================================================================

-- Count meetings with mismatched local_date vs scheduled_start
SELECT 
    COUNT(*) as mismatched_dates,
    'If high, local_date is unreliable' as diagnosis
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start IS NOT NULL
    AND local_date IS NOT NULL
    AND local_date != DATE(scheduled_start AT TIME ZONE 'America/Chicago');

-- ============================================================================
-- STEP 6: Count events by type (to understand data composition)
-- ============================================================================

SELECT 
    type,
    COUNT(*) as count,
    COUNT(CASE WHEN scheduled_start IS NULL THEN 1 END) as null_start,
    COUNT(CASE WHEN scheduled_end IS NULL THEN 1 END) as null_end,
    COUNT(CASE WHEN title = 'Private Event' THEN 1 END) as private_count
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
GROUP BY type
ORDER BY count DESC;

-- ============================================================================
-- STEP 7: Sample valid meetings for Feb 10 (what SHOULD display)
-- ============================================================================

SELECT 
    id,
    title,
    scheduled_start,
    scheduled_end,
    EXTRACT(HOUR FROM scheduled_start) as start_hour,
    EXTRACT(EPOCH FROM (scheduled_end - scheduled_start))/60 as duration_minutes,
    created_at
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND type = 'meeting'
    AND title != 'Private Event'
    AND scheduled_start >= '2026-02-10T00:00:00'::timestamptz
    AND scheduled_start < '2026-02-11T00:00:00'::timestamptz
ORDER BY scheduled_start
LIMIT 30;

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
/*
ROOT CAUSE CONFIRMED IF:
- null_start_count or null_end_count > 1000
- meetings_with_null_times is HIGH (thousands)
- total_meetings ≈ meetings_with_null_times

FIX NEEDED:
1. Add NULL checks to query in calendar-events.ts
2. Clean up NULL scheduled times in database

NOT THE ROOT CAUSE IF:
- All meetings have valid scheduled_start/scheduled_end
- meetings_that_should_show is LOW (<100)
- Then investigate UI rendering logic or deduplication bug
*/
