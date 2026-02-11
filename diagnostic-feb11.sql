-- ============================================================================
-- TodayMatters Data Pipeline Diagnostic - Feb 11, 2026
-- ============================================================================
-- Run this in Supabase SQL Editor to diagnose missing activity segments
-- User ID: b9ca3335-9929-4d54-a3fc-18883c5f3375
-- Date: 2026-02-11
-- ============================================================================

\echo '================================================'
\echo '1. LOCATION SAMPLES (Raw GPS Data)'
\echo '================================================'

SELECT 
  COUNT(*) as total_samples,
  MIN(recorded_at AT TIME ZONE 'America/Chicago') as first_sample_cst,
  MAX(recorded_at AT TIME ZONE 'America/Chicago') as last_sample_cst,
  COUNT(DISTINCT DATE_TRUNC('hour', recorded_at)) as hours_with_data,
  ROUND(AVG(accuracy_m)::numeric, 1) as avg_accuracy_m,
  COUNT(CASE WHEN is_mocked = true THEN 1 END) as mocked_samples
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-11 00:00:00'
  AND recorded_at < '2026-02-12 00:00:00';

\echo ''
\echo 'Samples by Hour:'
SELECT 
  EXTRACT(HOUR FROM recorded_at AT TIME ZONE 'America/Chicago') as hour,
  COUNT(*) as sample_count,
  MIN(recorded_at AT TIME ZONE 'America/Chicago') as first_sample,
  MAX(recorded_at AT TIME ZONE 'America/Chicago') as last_sample,
  ROUND(AVG(accuracy_m)::numeric, 1) as avg_accuracy_m
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-11 00:00:00'
  AND recorded_at < '2026-02-12 00:00:00'
GROUP BY EXTRACT(HOUR FROM recorded_at AT TIME ZONE 'America/Chicago')
ORDER BY hour;

\echo ''
\echo '================================================'
\echo '2. ACTIVITY SEGMENTS (Processed Location Data)'
\echo '================================================'

SELECT 
  started_at AT TIME ZONE 'America/Chicago' as started_cst,
  ended_at AT TIME ZONE 'America/Chicago' as ended_cst,
  ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60, 1) as duration_min,
  location_geohash7 as geohash,
  place_label,
  inferred_activity,
  ROUND(activity_confidence::numeric, 2) as confidence,
  (evidence->>'locationSamples')::int as location_samples,
  (evidence->>'screenSessions')::int as screen_sessions,
  total_screen_seconds / 60 as screen_min,
  ARRAY_LENGTH(source_ids, 1) as source_count
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11 00:00:00'
  AND started_at < '2026-02-12 00:00:00'
ORDER BY started_at;

\echo ''
\echo 'Segment Count by Hour:'
SELECT 
  EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Chicago') as hour,
  COUNT(*) as segment_count,
  SUM((evidence->>'locationSamples')::int) as total_location_samples,
  SUM(total_screen_seconds) / 60 as total_screen_min
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11 00:00:00'
  AND started_at < '2026-02-12 00:00:00'
GROUP BY EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Chicago')
ORDER BY hour;

\echo ''
\echo '================================================'
\echo '3. LOCATION HOURLY (Aggregated Geohashes)'
\echo '================================================'

SELECT 
  hour_start AT TIME ZONE 'America/Chicago' as hour_cst,
  geohash7,
  sample_count,
  place_label,
  google_place_name,
  radius_m,
  google_place_types
FROM tm.location_hourly
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND hour_start >= '2026-02-11 00:00:00'
  AND hour_start < '2026-02-12 00:00:00'
ORDER BY hour_start;

\echo ''
\echo '================================================'
\echo '4. SCREEN TIME SESSIONS (Activity Data)'
\echo '================================================'

SELECT 
  COUNT(*) as total_sessions,
  MIN(started_at AT TIME ZONE 'America/Chicago') as first_session_cst,
  MAX(ended_at AT TIME ZONE 'America/Chicago') as last_session_cst,
  COUNT(DISTINCT app_id) as unique_apps,
  SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 60 as total_screen_min
FROM tm.screen_time_app_sessions
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11 00:00:00'
  AND started_at < '2026-02-12 00:00:00';

\echo ''
\echo 'Screen Time by Hour:'
SELECT 
  EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Chicago') as hour,
  COUNT(*) as session_count,
  COUNT(DISTINCT app_id) as unique_apps,
  SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 60 as total_min,
  STRING_AGG(DISTINCT display_name, ', ' ORDER BY display_name) as apps_used
FROM tm.screen_time_app_sessions
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11 00:00:00'
  AND started_at < '2026-02-12 00:00:00'
GROUP BY EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Chicago')
ORDER BY hour;

\echo ''
\echo '================================================'
\echo '5. HOURLY SUMMARIES (CHARLIE Layer)'
\echo '================================================'

SELECT 
  hour_start AT TIME ZONE 'America/Chicago' as hour_cst,
  title,
  primary_activity,
  confidence_score,
  total_screen_minutes,
  primary_place_label,
  (metadata->>'locationSamples')::int as location_samples
FROM tm.hourly_summaries
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND local_date = '2026-02-11'
ORDER BY hour_start;

\echo ''
\echo '================================================'
\echo '6. DATA PIPELINE HEALTH CHECK'
\echo '================================================'

WITH pipeline_health AS (
  SELECT 
    '1. Location Samples' as layer,
    COUNT(*) as record_count,
    MIN(recorded_at AT TIME ZONE 'America/Chicago') as first_record,
    MAX(recorded_at AT TIME ZONE 'America/Chicago') as last_record
  FROM tm.location_samples
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND recorded_at >= '2026-02-11 00:00:00'
    AND recorded_at < '2026-02-12 00:00:00'
  
  UNION ALL
  
  SELECT 
    '2. Activity Segments' as layer,
    COUNT(*) as record_count,
    MIN(started_at AT TIME ZONE 'America/Chicago') as first_record,
    MAX(ended_at AT TIME ZONE 'America/Chicago') as last_record
  FROM tm.activity_segments
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND started_at >= '2026-02-11 00:00:00'
    AND started_at < '2026-02-12 00:00:00'
  
  UNION ALL
  
  SELECT 
    '3. Location Hourly' as layer,
    COUNT(*) as record_count,
    MIN(hour_start AT TIME ZONE 'America/Chicago') as first_record,
    MAX(hour_start AT TIME ZONE 'America/Chicago') as last_record
  FROM tm.location_hourly
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND hour_start >= '2026-02-11 00:00:00'
    AND hour_start < '2026-02-12 00:00:00'
  
  UNION ALL
  
  SELECT 
    '4. Screen Time' as layer,
    COUNT(*) as record_count,
    MIN(started_at AT TIME ZONE 'America/Chicago') as first_record,
    MAX(ended_at AT TIME ZONE 'America/Chicago') as last_record
  FROM tm.screen_time_app_sessions
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND started_at >= '2026-02-11 00:00:00'
    AND started_at < '2026-02-12 00:00:00'
  
  UNION ALL
  
  SELECT 
    '5. Hourly Summaries' as layer,
    COUNT(*) as record_count,
    MIN(hour_start AT TIME ZONE 'America/Chicago') as first_record,
    MAX(hour_start AT TIME ZONE 'America/Chicago') as last_record
  FROM tm.hourly_summaries
  WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
    AND local_date = '2026-02-11'
)
SELECT 
  layer,
  record_count,
  first_record,
  last_record,
  CASE 
    WHEN record_count = 0 THEN '❌ NO DATA'
    WHEN record_count < 5 THEN '⚠️  LOW DATA'
    ELSE '✅ OK'
  END as status
FROM pipeline_health
ORDER BY layer;

\echo ''
\echo '================================================'
\echo '7. RECENT LOCATION SAMPLES (Last 10)'
\echo '================================================'

SELECT 
  recorded_at AT TIME ZONE 'America/Chicago' as recorded_cst,
  ROUND(latitude::numeric, 5) as lat,
  ROUND(longitude::numeric, 5) as lng,
  ROUND(accuracy_m::numeric, 1) as accuracy_m,
  source,
  is_mocked
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-11 00:00:00'
  AND recorded_at < '2026-02-12 00:00:00'
ORDER BY recorded_at DESC
LIMIT 10;

\echo ''
\echo '================================================'
\echo 'DIAGNOSTIC COMPLETE'
\echo '================================================'
\echo ''
\echo 'Expected Results:'
\echo '  - Location Samples: Hundreds of records across 24 hours'
\echo '  - Activity Segments: 10-30 segments throughout the day'
\echo '  - Location Hourly: 24 records (one per hour)'
\echo '  - Screen Time: Dozens of sessions'
\echo '  - Hourly Summaries: 24 records'
\echo ''
\echo 'If any layer shows "NO DATA" or "LOW DATA", that is the broken step!'
\echo ''
