-- ============================================================================
-- COMPREHENSIVE PIPELINE TEST (FIXED v3)
-- User: b9ca3335-9929-4d54-a3fc-18883c5f3375
-- Date: 2026-02-02 (today)
-- ============================================================================

-- ============================================================================
-- 1. ALL LOCATION SAMPLES FOR TODAY
-- ============================================================================
SELECT 
    recorded_at AT TIME ZONE 'America/Chicago' as local_time,
    latitude,
    longitude,
    accuracy_m,
    source
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-02 00:00:00+00'
  AND recorded_at < '2026-02-03 00:00:00+00'
ORDER BY recorded_at;

-- ============================================================================
-- 2. USER PLACES (for location matching)
-- ============================================================================
SELECT 
    id,
    label,
    category,
    ST_Y(center::geometry) as latitude,
    ST_X(center::geometry) as longitude,
    radius_m,
    created_at
FROM tm.user_places
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
ORDER BY label;

-- ============================================================================
-- 3. SCREEN TIME SESSIONS FOR TODAY
-- ============================================================================
SELECT 
    started_at AT TIME ZONE 'America/Chicago' as local_start,
    ended_at AT TIME ZONE 'America/Chicago' as local_end,
    app_id,
    display_name,
    duration_seconds,
    ROUND(duration_seconds / 60.0, 1) as minutes
FROM tm.screen_time_app_sessions
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-02 00:00:00+00'
  AND started_at < '2026-02-03 00:00:00+00'
ORDER BY started_at;

-- ============================================================================
-- 4. SCREEN TIME BY HOUR (aggregated)
-- ============================================================================
SELECT 
    date_trunc('hour', started_at) AT TIME ZONE 'America/Chicago' as hour_cst,
    count(*) as session_count,
    sum(duration_seconds) as total_seconds,
    ROUND(sum(duration_seconds) / 60.0, 1) as total_minutes,
    array_agg(DISTINCT display_name ORDER BY display_name) as apps_used
FROM tm.screen_time_app_sessions
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-02 00:00:00+00'
  AND started_at < '2026-02-03 00:00:00+00'
GROUP BY date_trunc('hour', started_at)
ORDER BY hour_cst;

-- ============================================================================
-- 5. CURRENT EVENTS (what's showing in the app now)
-- tm.events uses: scheduled_start, scheduled_end, type, title, meta, locked_at
-- ============================================================================
SELECT 
    scheduled_start AT TIME ZONE 'America/Chicago' as local_start,
    scheduled_end AT TIME ZONE 'America/Chicago' as local_end,
    title,
    type,
    locked_at,
    meta
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND scheduled_start >= '2026-02-02 00:00:00+00'
  AND scheduled_start < '2026-02-03 00:00:00+00'
ORDER BY scheduled_start;

-- ============================================================================
-- 6. HEALTH WORKOUTS FOR TODAY
-- ============================================================================
SELECT 
    started_at AT TIME ZONE 'America/Chicago' as local_start,
    ended_at AT TIME ZONE 'America/Chicago' as local_end,
    activity_type,
    duration_seconds,
    ROUND(duration_seconds / 60.0, 1) as minutes
FROM tm.health_workouts
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-02 00:00:00+00'
  AND started_at < '2026-02-03 00:00:00+00'
ORDER BY started_at;

-- ============================================================================
-- 7. HOURLY SUMMARY OF ALL DATA (what the new pipeline would process)
-- ============================================================================
WITH hourly_locations AS (
    SELECT 
        date_trunc('hour', recorded_at) as hour_utc,
        count(*) as location_count,
        avg(latitude) as avg_lat,
        avg(longitude) as avg_lng,
        avg(accuracy_m) as avg_accuracy
    FROM tm.location_samples
    WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
      AND recorded_at >= '2026-02-02 00:00:00+00'
      AND recorded_at < '2026-02-03 00:00:00+00'
    GROUP BY date_trunc('hour', recorded_at)
),
hourly_screen AS (
    SELECT 
        date_trunc('hour', started_at) as hour_utc,
        count(*) as session_count,
        sum(duration_seconds) as screen_seconds,
        array_agg(DISTINCT display_name ORDER BY display_name) as apps
    FROM tm.screen_time_app_sessions
    WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
      AND started_at >= '2026-02-02 00:00:00+00'
      AND started_at < '2026-02-03 00:00:00+00'
    GROUP BY date_trunc('hour', started_at)
),
hourly_events AS (
    SELECT 
        date_trunc('hour', scheduled_start) as hour_utc,
        count(*) as event_count,
        array_agg(title ORDER BY scheduled_start) as event_titles
    FROM tm.events
    WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
      AND scheduled_start >= '2026-02-02 00:00:00+00'
      AND scheduled_start < '2026-02-03 00:00:00+00'
    GROUP BY date_trunc('hour', scheduled_start)
)
SELECT 
    COALESCE(l.hour_utc, s.hour_utc, e.hour_utc) AT TIME ZONE 'America/Chicago' as hour_cst,
    COALESCE(l.location_count, 0) as locations,
    COALESCE(s.session_count, 0) as screen_sessions,
    COALESCE(ROUND(s.screen_seconds / 60.0, 1), 0) as screen_minutes,
    COALESCE(e.event_count, 0) as current_events,
    l.avg_lat,
    l.avg_lng,
    s.apps as apps_used,
    e.event_titles as current_titles
FROM hourly_locations l
FULL OUTER JOIN hourly_screen s ON l.hour_utc = s.hour_utc
FULL OUTER JOIN hourly_events e ON COALESCE(l.hour_utc, s.hour_utc) = e.hour_utc
ORDER BY hour_cst;

-- ============================================================================
-- 8. TOP APPS TODAY (for activity inference)
-- ============================================================================
SELECT 
    display_name,
    app_id,
    count(*) as session_count,
    sum(duration_seconds) as total_seconds,
    ROUND(sum(duration_seconds) / 60.0, 1) as total_minutes
FROM tm.screen_time_app_sessions
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-02 00:00:00+00'
  AND started_at < '2026-02-03 00:00:00+00'
GROUP BY display_name, app_id
ORDER BY total_seconds DESC
LIMIT 15;

-- ============================================================================
-- 9. LOCATION HOURLY VIEW (pre-built view with place matching)
-- ============================================================================
SELECT 
    hour_start AT TIME ZONE 'America/Chicago' as hour_cst,
    sample_count,
    avg_accuracy_m,
    geohash7,
    radius_m,
    place_id,
    place_label,
    place_category
FROM tm.location_hourly
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND hour_start >= '2026-02-02 00:00:00+00'
  AND hour_start < '2026-02-03 00:00:00+00'
ORDER BY hour_start;
