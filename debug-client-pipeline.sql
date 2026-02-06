-- =============================================================================
-- TODAY MATTERS: NEW PIPELINE DIAGNOSTIC QUERIES
-- =============================================================================
-- Purpose: Debug a client's new pipeline to verify:
--   1. Data is loading properly (ALPHA layer)
--   2. Events/segments are labeled correctly (BRAVO/CHARLIE layers)
--
-- Usage: Replace the user_id in the CTE with the client's actual user_id
-- =============================================================================

-- Set the client's user_id here:
WITH client AS (
  SELECT 'REPLACE-WITH-CLIENT-UUID'::uuid AS user_id
)

-- =============================================================================
-- SECTION 1: PIPELINE HEALTH OVERVIEW
-- =============================================================================
-- Quick snapshot of data across all pipeline layers

SELECT '📊 PIPELINE HEALTH OVERVIEW' AS section;

SELECT
  'ALPHA: Raw Location Samples' AS layer,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '24 hours') AS last_24h,
  COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '7 days') AS last_7d,
  MIN(recorded_at)::date AS oldest_record,
  MAX(recorded_at)::date AS newest_record
FROM tm.location_samples, client
WHERE user_id = client.user_id

UNION ALL

SELECT
  'ALPHA: Screen Time Daily' AS layer,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE local_date > CURRENT_DATE - 1) AS last_24h,
  COUNT(*) FILTER (WHERE local_date > CURRENT_DATE - 7) AS last_7d,
  MIN(local_date) AS oldest_record,
  MAX(local_date) AS newest_record
FROM tm.screen_time_daily, client
WHERE user_id = client.user_id

UNION ALL

SELECT
  'BRAVO: Activity Segments' AS layer,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS last_24h,
  COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') AS last_7d,
  MIN(started_at)::date AS oldest_record,
  MAX(started_at)::date AS newest_record
FROM tm.activity_segments, client
WHERE user_id = client.user_id

UNION ALL

SELECT
  'CHARLIE: Hourly Summaries' AS layer,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE hour_start > NOW() - INTERVAL '24 hours') AS last_24h,
  COUNT(*) FILTER (WHERE hour_start > NOW() - INTERVAL '7 days') AS last_7d,
  MIN(hour_start)::date AS oldest_record,
  MAX(hour_start)::date AS newest_record
FROM tm.hourly_summaries, client
WHERE user_id = client.user_id;


-- =============================================================================
-- SECTION 2: DATA SYNC STATE (Is data syncing properly?)
-- =============================================================================

SELECT '🔄 DATA SYNC STATE' AS section;

SELECT
  dataset,
  platform,
  provider,
  newest_synced_local_date AS last_synced_date,
  last_sync_started_at,
  last_sync_finished_at,
  last_sync_status,
  CASE
    WHEN last_sync_status = 'error' THEN '❌ Error: ' || COALESCE(last_sync_error, 'Unknown')
    WHEN last_sync_finished_at IS NULL THEN '⚠️ Never synced'
    WHEN last_sync_finished_at < NOW() - INTERVAL '24 hours' THEN '⚠️ Stale (>24h ago)'
    ELSE '✅ OK'
  END AS status
FROM tm.data_sync_state, client
WHERE user_id = client.user_id
ORDER BY dataset, platform;


-- =============================================================================
-- SECTION 3: ALPHA LAYER - RAW DATA QUALITY
-- =============================================================================

SELECT '📍 ALPHA: LOCATION SAMPLES (Last 24h)' AS section;

-- Recent location samples with quality indicators
SELECT
  recorded_at,
  latitude,
  longitude,
  accuracy_m,
  speed_mps,
  is_mocked,
  CASE
    WHEN accuracy_m IS NULL THEN '⚠️ No accuracy'
    WHEN accuracy_m > 100 THEN '⚠️ Low accuracy (>100m)'
    WHEN accuracy_m > 50 THEN '⚡ Medium accuracy'
    ELSE '✅ Good accuracy'
  END AS quality
FROM tm.location_samples, client
WHERE user_id = client.user_id
  AND recorded_at > NOW() - INTERVAL '24 hours'
ORDER BY recorded_at DESC
LIMIT 20;

-- Location coverage by hour
SELECT
  DATE_TRUNC('hour', recorded_at) AS hour,
  COUNT(*) AS samples,
  ROUND(AVG(accuracy_m)::numeric, 1) AS avg_accuracy_m,
  COUNT(*) FILTER (WHERE accuracy_m < 50) AS good_samples
FROM tm.location_samples, client
WHERE user_id = client.user_id
  AND recorded_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', recorded_at)
ORDER BY hour DESC;


SELECT '📱 ALPHA: SCREEN TIME (Last 7 days)' AS section;

-- Screen time daily totals
SELECT
  local_date,
  ROUND(total_seconds / 3600.0, 2) AS hours,
  pickups,
  notifications,
  platform,
  provider
FROM tm.screen_time_daily, client
WHERE user_id = client.user_id
ORDER BY local_date DESC
LIMIT 10;

-- App sessions breakdown (last 24h)
SELECT
  DATE(started_at) AS date,
  app_id,
  COALESCE(display_name, bundle_id) AS app_name,
  category,
  COUNT(*) AS sessions,
  SUM(duration_seconds) / 60 AS total_minutes
FROM tm.screen_time_app_sessions, client
WHERE user_id = client.user_id
  AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE(started_at), app_id, display_name, bundle_id, category
ORDER BY total_minutes DESC NULLS LAST
LIMIT 15;


-- =============================================================================
-- SECTION 4: BRAVO LAYER - ACTIVITY SEGMENTS
-- =============================================================================

SELECT '🎯 BRAVO: ACTIVITY SEGMENTS (Last 24h)' AS section;

-- Activity segments with label analysis
SELECT
  started_at,
  ended_at,
  EXTRACT(EPOCH FROM (ended_at - started_at)) / 60 AS duration_min,
  place_label,
  place_category,
  inferred_activity,
  ROUND(activity_confidence * 100)::int AS confidence_pct,
  total_screen_seconds / 60 AS screen_min,
  CASE
    WHEN place_label IS NULL AND place_category IS NULL THEN '❌ No place info'
    WHEN place_label IS NULL THEN '⚠️ Category only: ' || place_category
    WHEN place_label = 'Unknown Location' THEN '⚠️ Unknown Location'
    ELSE '✅ ' || place_label
  END AS place_status
FROM tm.activity_segments, client
WHERE user_id = client.user_id
  AND started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC
LIMIT 20;

-- Activity type distribution (last 7 days)
SELECT
  inferred_activity,
  COUNT(*) AS segment_count,
  ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 3600, 1) AS total_hours,
  ROUND(AVG(activity_confidence) * 100)::int AS avg_confidence_pct
FROM tm.activity_segments, client
WHERE user_id = client.user_id
  AND started_at > NOW() - INTERVAL '7 days'
GROUP BY inferred_activity
ORDER BY total_hours DESC NULLS LAST;

-- Place label distribution (are places being identified?)
SELECT
  COALESCE(place_label, '(null)') AS place_label,
  COALESCE(place_category, '(null)') AS place_category,
  COUNT(*) AS segment_count,
  ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 3600, 1) AS total_hours
FROM tm.activity_segments, client
WHERE user_id = client.user_id
  AND started_at > NOW() - INTERVAL '7 days'
GROUP BY place_label, place_category
ORDER BY total_hours DESC NULLS LAST
LIMIT 15;


-- =============================================================================
-- SECTION 5: CHARLIE LAYER - HOURLY SUMMARIES
-- =============================================================================

SELECT '📋 CHARLIE: HOURLY SUMMARIES (Last 24h)' AS section;

-- Recent hourly summaries with quality check
SELECT
  hour_start,
  hour_of_day,
  title,
  primary_place_label,
  primary_activity,
  total_screen_minutes,
  evidence_strength,
  ROUND(confidence_score * 100)::int AS confidence_pct,
  user_feedback,
  CASE
    WHEN title LIKE '%Unknown%' THEN '⚠️ Has "Unknown" in title'
    WHEN primary_place_label IS NULL THEN '⚠️ No place label'
    ELSE '✅ OK'
  END AS quality_check
FROM tm.hourly_summaries, client
WHERE user_id = client.user_id
  AND hour_start > NOW() - INTERVAL '24 hours'
ORDER BY hour_start DESC;

-- Daily coverage check (are we getting all hours?)
SELECT
  local_date,
  COUNT(*) AS hours_covered,
  COUNT(*) FILTER (WHERE primary_place_label IS NOT NULL) AS hours_with_place,
  COUNT(*) FILTER (WHERE title LIKE '%Unknown%') AS hours_with_unknown,
  COUNT(*) FILTER (WHERE evidence_strength = 'high') AS high_confidence,
  COUNT(*) FILTER (WHERE evidence_strength = 'low') AS low_confidence
FROM tm.hourly_summaries, client
WHERE user_id = client.user_id
  AND local_date > CURRENT_DATE - 7
GROUP BY local_date
ORDER BY local_date DESC;


-- =============================================================================
-- SECTION 6: POLISHED TIMELINE VIEW
-- =============================================================================

SELECT '🗺️ LOCATION TIMELINE (Last 24h)' AS section;

-- This is what the client sees in the UI
SELECT
  start_time,
  end_time,
  ROUND(duration_minutes::numeric, 0) AS minutes,
  location_name,
  category,
  activity,
  confidence_pct,
  is_traveling,
  CASE
    WHEN location_name = 'Unknown Location' THEN '⚠️'
    WHEN location_name LIKE 'Other%' THEN '⚡'
    ELSE '✅'
  END AS status
FROM tm.location_timeline, client
WHERE user_id = client.user_id
  AND started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;


-- =============================================================================
-- SECTION 7: USER PLACES (Reference data)
-- =============================================================================

SELECT '🏠 USER PLACES' AS section;

-- Check what places the user has defined
SELECT
  id,
  label,
  category,
  is_home,
  is_work,
  latitude,
  longitude,
  radius_meters,
  created_at
FROM tm.user_places, client
WHERE user_id = client.user_id
ORDER BY created_at DESC;


-- =============================================================================
-- SECTION 8: EVENTS WITH LABELS
-- =============================================================================

SELECT '📅 EVENTS (Last 7 days)' AS section;

-- Check if events are being labeled correctly
SELECT
  id,
  type,
  title,
  location,
  scheduled_start,
  scheduled_end,
  meta->>'location' AS meta_location,
  meta->'evidence'->>'locationLabel' AS evidence_location,
  meta->'evidence'->>'inferredActivity' AS evidence_activity,
  CASE
    WHEN location IS NOT NULL AND location != '' THEN '✅ Has location'
    WHEN meta->>'location' IS NOT NULL THEN '⚡ Meta location'
    WHEN meta->'evidence'->>'locationLabel' IS NOT NULL THEN '⚡ Evidence location'
    ELSE '⚠️ No location'
  END AS location_status
FROM tm.events, client
WHERE user_id = client.user_id
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY scheduled_start DESC NULLS LAST
LIMIT 25;


-- =============================================================================
-- SECTION 9: DIAGNOSTIC SUMMARY
-- =============================================================================

SELECT '🔍 DIAGNOSTIC SUMMARY' AS section;

WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM tm.location_samples ls, client WHERE ls.user_id = client.user_id AND recorded_at > NOW() - INTERVAL '24 hours') AS loc_24h,
    (SELECT COUNT(*) FROM tm.activity_segments s, client WHERE s.user_id = client.user_id AND started_at > NOW() - INTERVAL '24 hours') AS seg_24h,
    (SELECT COUNT(*) FROM tm.hourly_summaries h, client WHERE h.user_id = client.user_id AND hour_start > NOW() - INTERVAL '24 hours') AS sum_24h,
    (SELECT COUNT(*) FROM tm.hourly_summaries h, client WHERE h.user_id = client.user_id AND hour_start > NOW() - INTERVAL '24 hours' AND title LIKE '%Unknown%') AS unknown_24h,
    (SELECT COUNT(*) FROM tm.user_places p, client WHERE p.user_id = client.user_id) AS places_defined
)
SELECT
  CASE WHEN loc_24h = 0 THEN '❌' ELSE '✅' END || ' Location samples (24h): ' || loc_24h AS check_1,
  CASE WHEN seg_24h = 0 THEN '❌' ELSE '✅' END || ' Activity segments (24h): ' || seg_24h AS check_2,
  CASE WHEN sum_24h = 0 THEN '❌' ELSE '✅' END || ' Hourly summaries (24h): ' || sum_24h AS check_3,
  CASE WHEN unknown_24h > 0 THEN '⚠️' ELSE '✅' END || ' "Unknown Location" in titles: ' || unknown_24h AS check_4,
  CASE WHEN places_defined = 0 THEN '⚠️' ELSE '✅' END || ' User-defined places: ' || places_defined AS check_5
FROM stats;

-- Final recommendations
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM tm.location_samples ls, client WHERE ls.user_id = client.user_id AND recorded_at > NOW() - INTERVAL '24 hours') = 0
    THEN '🔧 ACTION: No location data in 24h. Check: background location permission, device location services enabled, app running in background.'
    WHEN (SELECT COUNT(*) FROM tm.activity_segments s, client WHERE s.user_id = client.user_id AND started_at > NOW() - INTERVAL '24 hours') = 0
    THEN '🔧 ACTION: Location data exists but no segments. Check: BRAVO layer processing (actual-ingestion), time zone settings.'
    WHEN (SELECT COUNT(*) FROM tm.hourly_summaries h, client WHERE h.user_id = client.user_id AND hour_start > NOW() - INTERVAL '24 hours' AND title LIKE '%Unknown%') > 3
    THEN '🔧 ACTION: Many "Unknown Location" labels. Check: place inference, Google Places enrichment, user_places definition.'
    WHEN (SELECT COUNT(*) FROM tm.user_places p, client WHERE p.user_id = client.user_id) = 0
    THEN '🔧 ACTION: No user places defined. Suggest client add Home/Work in settings for better labeling.'
    ELSE '✅ Pipeline appears healthy! Data is flowing and labels look reasonable.'
  END AS recommendation;
