-- Test Travel Detection Recalibration
-- User: Paul Graeve (b9ca3335-9929-4d54-a3fc-18883c5f3375)
-- Date: 2026-02-10

-- === BEFORE vs AFTER COMPARISON ===

-- 1. Count commute segments today (after fix)
SELECT 
  'Commute Segments Today' as metric,
  COUNT(*) as count
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(started_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE
  AND inferred_activity = 'commute';

-- 2. Show all travel segments with distance and duration
SELECT 
  TO_CHAR(started_at AT TIME ZONE 'America/Chicago', 'HH24:MI') as start_time,
  TO_CHAR(ended_at AT TIME ZONE 'America/Chicago', 'HH24:MI') as end_time,
  ROUND(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) as duration_min,
  place_label,
  inferred_activity,
  activity_confidence,
  -- Extract movement type from top_apps metadata if available
  CASE 
    WHEN top_apps::text LIKE '%walking%' THEN 'Walking'
    WHEN top_apps::text LIKE '%cycling%' THEN 'Cycling'
    WHEN top_apps::text LIKE '%driving%' THEN 'Driving'
    ELSE 'Movement'
  END as movement_type
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(started_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE
  AND inferred_activity = 'commute'
ORDER BY started_at;

-- 3. Check for short segments (1-2 minutes) that are now detected
SELECT 
  TO_CHAR(started_at AT TIME ZONE 'America/Chicago', 'HH24:MI') as time,
  ROUND(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60, 1) as duration_min,
  place_label,
  inferred_activity,
  total_screen_seconds
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(started_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE
  AND EXTRACT(EPOCH FROM (ended_at - started_at)) / 60 BETWEEN 1 AND 3
ORDER BY started_at;

-- 4. Summary stats for the day
SELECT 
  COUNT(*) as total_segments,
  COUNT(*) FILTER (WHERE inferred_activity = 'commute') as commute_segments,
  ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60), 1) as avg_duration_min,
  MIN(started_at AT TIME ZONE 'America/Chicago') as first_activity,
  MAX(ended_at AT TIME ZONE 'America/Chicago') as last_activity
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(started_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE;

-- 5. Check location samples for today (raw data)
SELECT 
  COUNT(*) as sample_count,
  MIN(recorded_at AT TIME ZONE 'America/Chicago') as first_sample,
  MAX(recorded_at AT TIME ZONE 'America/Chicago') as last_sample,
  COUNT(DISTINCT DATE_TRUNC('hour', recorded_at)) as hours_with_data
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND DATE(recorded_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE;

-- 6. Expected improvements checklist
-- Run this after reprocessing today's data
SELECT 
  'Expected Improvements' as category,
  CASE 
    WHEN (SELECT COUNT(*) FROM tm.activity_segments 
          WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
            AND DATE(started_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE
            AND inferred_activity = 'commute') > 0 
    THEN '✅ Commute segments detected'
    ELSE '❌ No commute segments (reprocess needed?)'
  END as status
UNION ALL
SELECT 
  'Short trips (1-2 min)',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM tm.activity_segments 
      WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
        AND DATE(started_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE
        AND inferred_activity = 'commute'
        AND EXTRACT(EPOCH FROM (ended_at - started_at)) / 60 BETWEEN 1 AND 2
    ) THEN '✅ Brief trips detected'
    ELSE '⚠️ No brief trips (may not have occurred today)'
  END;
