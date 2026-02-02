-- ============================================================================
-- TodayMatters Pipeline Test Script
-- Pull all data that would feed into the BRAVO/CHARLIE pipeline
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Pick a test hour (change this to an hour you have data for)
-- Format: YYYY-MM-DD HH:00:00
\set test_hour '2026-02-01 14:00:00'
\set test_user_id 'YOUR_USER_ID_HERE'  -- Replace with actual user ID

-- Or use these variables in the queries directly:
-- Replace 'YOUR_USER_ID_HERE' with your actual user_id
-- Replace the timestamps with an hour you have data for

-- ============================================================================
-- 1. ALPHA LAYER: Raw Location Samples for the hour
-- ============================================================================
SELECT 
    '1. LOCATION SAMPLES' as section,
    count(*) as sample_count,
    min(recorded_at) as first_sample,
    max(recorded_at) as last_sample,
    avg(accuracy_m) as avg_accuracy
FROM tm.location_samples
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND recorded_at >= '2026-02-01 14:00:00'::timestamptz
  AND recorded_at < '2026-02-01 15:00:00'::timestamptz;

-- Detailed location samples
SELECT 
    recorded_at,
    latitude,
    longitude,
    accuracy_m,
    source
FROM tm.location_samples
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND recorded_at >= '2026-02-01 14:00:00'::timestamptz
  AND recorded_at < '2026-02-01 15:00:00'::timestamptz
ORDER BY recorded_at;

-- ============================================================================
-- 2. ALPHA LAYER: User Places (for matching locations)
-- ============================================================================
SELECT 
    '2. USER PLACES' as section,
    id,
    label,
    category,
    latitude,
    longitude,
    radius_m
FROM tm.user_places
WHERE user_id = 'YOUR_USER_ID_HERE'
ORDER BY label;

-- ============================================================================
-- 3. ALPHA LAYER: Screen Time Sessions overlapping the hour
-- ============================================================================
SELECT 
    '3. SCREEN TIME SESSIONS' as section,
    count(*) as session_count,
    sum(duration_seconds) as total_seconds,
    count(distinct app_id) as unique_apps
FROM tm.screen_time_app_sessions
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND started_at < '2026-02-01 15:00:00'::timestamptz
  AND ended_at > '2026-02-01 14:00:00'::timestamptz;

-- Top apps in the hour
SELECT 
    app_id,
    app_name,
    sum(duration_seconds) as total_seconds,
    count(*) as session_count
FROM tm.screen_time_app_sessions
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND started_at < '2026-02-01 15:00:00'::timestamptz
  AND ended_at > '2026-02-01 14:00:00'::timestamptz
GROUP BY app_id, app_name
ORDER BY total_seconds DESC
LIMIT 10;

-- ============================================================================
-- 4. ALPHA LAYER: Health Data (workouts in the hour)
-- ============================================================================
SELECT 
    '4. HEALTH WORKOUTS' as section,
    count(*) as workout_count
FROM tm.health_workouts
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND started_at < '2026-02-01 15:00:00'::timestamptz
  AND (ended_at > '2026-02-01 14:00:00'::timestamptz OR ended_at IS NULL);

SELECT 
    activity_type,
    started_at,
    ended_at,
    duration_seconds
FROM tm.health_workouts
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND started_at < '2026-02-01 15:00:00'::timestamptz
  AND (ended_at > '2026-02-01 14:00:00'::timestamptz OR ended_at IS NULL);

-- ============================================================================
-- 5. CURRENT OUTPUT: Events in tm.events for comparison
-- ============================================================================
SELECT 
    '5. CURRENT EVENTS (tm.events)' as section,
    count(*) as event_count
FROM tm.events
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND started_at < '2026-02-01 15:00:00'::timestamptz
  AND ended_at > '2026-02-01 14:00:00'::timestamptz;

SELECT 
    id,
    title,
    started_at,
    ended_at,
    category,
    locked,
    source_kind
FROM tm.events
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND started_at < '2026-02-01 15:00:00'::timestamptz
  AND ended_at > '2026-02-01 14:00:00'::timestamptz
ORDER BY started_at;

-- ============================================================================
-- 6. SUMMARY: Data availability check
-- ============================================================================
SELECT 
    'DATA SUMMARY' as section,
    (SELECT count(*) FROM tm.location_samples 
     WHERE user_id = 'YOUR_USER_ID_HERE' 
       AND recorded_at >= '2026-02-01 14:00:00'::timestamptz 
       AND recorded_at < '2026-02-01 15:00:00'::timestamptz) as location_samples,
    (SELECT count(*) FROM tm.screen_time_app_sessions 
     WHERE user_id = 'YOUR_USER_ID_HERE'
       AND started_at < '2026-02-01 15:00:00'::timestamptz
       AND ended_at > '2026-02-01 14:00:00'::timestamptz) as screen_sessions,
    (SELECT count(*) FROM tm.user_places 
     WHERE user_id = 'YOUR_USER_ID_HERE') as user_places,
    (SELECT count(*) FROM tm.events 
     WHERE user_id = 'YOUR_USER_ID_HERE'
       AND started_at < '2026-02-01 15:00:00'::timestamptz
       AND ended_at > '2026-02-01 14:00:00'::timestamptz) as current_events;

-- ============================================================================
-- 7. FIND HOURS WITH GOOD DATA (run this first to pick a test hour)
-- ============================================================================
SELECT 
    date_trunc('hour', recorded_at) as hour,
    count(*) as location_samples
FROM tm.location_samples
WHERE user_id = 'YOUR_USER_ID_HERE'
  AND recorded_at >= now() - interval '7 days'
GROUP BY date_trunc('hour', recorded_at)
HAVING count(*) >= 2
ORDER BY hour DESC
LIMIT 20;
