-- Check Location and Screen Time Data Collection for Account
-- Replace '62c02dff-42ef-4d0d-ae60-445adc464cc6' with your account ID

WITH account_id AS (
  SELECT '62c02dff-42ef-4d0d-ae60-445adc464cc6'::uuid AS user_id
),
location_summary AS (
  SELECT 
    'Location Samples' AS data_type,
    COUNT(*) AS record_count,
    MIN(recorded_at)::text AS oldest_record,
    MAX(recorded_at)::text AS newest_record,
    COUNT(DISTINCT DATE(recorded_at)) AS days_with_data,
    NULL::bigint AS events_with_location,
    NULL::bigint AS events_with_meta_location,
    NULL::bigint AS events_with_evidence_location,
    NULL::numeric AS total_seconds,
    NULL::numeric AS avg_seconds_per_day,
    NULL::bigint AS events_with_screen_time,
    NULL::numeric AS total_screen_time_minutes
  FROM tm.location_samples ls
  CROSS JOIN account_id ai
  WHERE ls.user_id = ai.user_id
),
location_in_events AS (
  SELECT 
    'Location in Events' AS data_type,
    COUNT(*) AS record_count,
    MIN(created_at)::text AS oldest_record,
    MAX(created_at)::text AS newest_record,
    COUNT(DISTINCT DATE(created_at)) AS days_with_data,
    COUNT(*) FILTER (WHERE location IS NOT NULL AND location != '') AS events_with_location,
    COUNT(*) FILTER (WHERE meta->>'location' IS NOT NULL) AS events_with_meta_location,
    COUNT(*) FILTER (WHERE meta->'evidence'->>'locationLabel' IS NOT NULL) AS events_with_evidence_location,
    NULL::numeric AS total_seconds,
    NULL::numeric AS avg_seconds_per_day,
    NULL::bigint AS events_with_screen_time,
    NULL::numeric AS total_screen_time_minutes
  FROM tm.events e
  CROSS JOIN account_id ai
  WHERE e.user_id = ai.user_id
),
screen_time_daily_summary AS (
  SELECT 
    'Screen Time Daily' AS data_type,
    COUNT(*) AS record_count,
    MIN(local_date)::text AS oldest_record,
    MAX(local_date)::text AS newest_record,
    NULL::bigint AS days_with_data,
    NULL::bigint AS events_with_location,
    NULL::bigint AS events_with_meta_location,
    NULL::bigint AS events_with_evidence_location,
    SUM(total_seconds) AS total_seconds,
    AVG(total_seconds) AS avg_seconds_per_day,
    NULL::bigint AS events_with_screen_time,
    NULL::numeric AS total_screen_time_minutes
  FROM tm.screen_time_daily std
  CROSS JOIN account_id ai
  WHERE std.user_id = ai.user_id
),
screen_time_app_sessions_summary AS (
  SELECT 
    'Screen Time App Sessions' AS data_type,
    COUNT(*) AS record_count,
    MIN(started_at)::text AS oldest_record,
    MAX(started_at)::text AS newest_record,
    NULL::bigint AS days_with_data,
    NULL::bigint AS events_with_location,
    NULL::bigint AS events_with_meta_location,
    NULL::bigint AS events_with_evidence_location,
    SUM(duration_seconds) AS total_seconds,
    NULL::numeric AS avg_seconds_per_day,
    NULL::bigint AS events_with_screen_time,
    NULL::numeric AS total_screen_time_minutes
  FROM tm.screen_time_app_sessions stas
  CROSS JOIN account_id ai
  WHERE stas.user_id = ai.user_id
),
screen_time_in_events AS (
  SELECT 
    'Screen Time in Events' AS data_type,
    COUNT(*) AS record_count,
    MIN(created_at)::text AS oldest_record,
    MAX(created_at)::text AS newest_record,
    NULL::bigint AS days_with_data,
    NULL::bigint AS events_with_location,
    NULL::bigint AS events_with_meta_location,
    NULL::bigint AS events_with_evidence_location,
    NULL::numeric AS total_seconds,
    NULL::numeric AS avg_seconds_per_day,
    COUNT(*) AS events_with_screen_time,
    SUM((meta->'evidence'->>'screenTimeMinutes')::numeric) AS total_screen_time_minutes
  FROM tm.events e
  CROSS JOIN account_id ai
  WHERE e.user_id = ai.user_id
    AND meta->'evidence'->>'screenTimeMinutes' IS NOT NULL
)
SELECT * FROM location_summary
UNION ALL
SELECT * FROM location_in_events
UNION ALL
SELECT * FROM screen_time_daily_summary
UNION ALL
SELECT * FROM screen_time_app_sessions_summary
UNION ALL
SELECT * FROM screen_time_in_events
ORDER BY data_type;

-- Detailed Location Samples (last 10)
SELECT 
  'Recent Location Samples' AS section,
  recorded_at,
  latitude,
  longitude,
  accuracy_m,
  speed_mps,
  is_mocked,
  created_at
FROM tm.location_samples
WHERE user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'::uuid
ORDER BY recorded_at DESC
LIMIT 10;

-- Events with Location Data (last 10)
SELECT 
  'Events with Location' AS section,
  id,
  type,
  title,
  location,
  scheduled_start,
  meta->>'location' AS meta_location,
  meta->'evidence'->>'locationLabel' AS evidence_location,
  created_at
FROM tm.events
WHERE user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'::uuid
  AND (
    location IS NOT NULL 
    OR meta->>'location' IS NOT NULL 
    OR meta->'evidence'->>'locationLabel' IS NOT NULL
  )
ORDER BY created_at DESC
LIMIT 10;

-- Screen Time Daily Summary (last 10 days)
SELECT 
  'Screen Time Daily' AS section,
  local_date,
  total_seconds,
  ROUND(total_seconds / 60.0, 2) AS total_minutes,
  ROUND(total_seconds / 3600.0, 2) AS total_hours,
  pickups,
  notifications,
  platform,
  provider
FROM tm.screen_time_daily
WHERE user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'::uuid
ORDER BY local_date DESC
LIMIT 10;

-- Events with Screen Time Evidence (last 10)
SELECT 
  'Events with Screen Time' AS section,
  id,
  type,
  title,
  scheduled_start,
  meta->'evidence'->>'screenTimeMinutes' AS screen_time_minutes,
  meta->'evidence'->>'topApp' AS top_app,
  created_at
FROM tm.events
WHERE user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'::uuid
  AND meta->'evidence'->>'screenTimeMinutes' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
