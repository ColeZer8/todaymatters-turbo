-- Paul's location timeline for Feb 10, 2026
-- Compare with Google Maps Timeline

-- Raw location samples (to see GPS accuracy)
SELECT 
  recorded_at AT TIME ZONE 'America/Chicago' as local_time,
  latitude,
  longitude,
  accuracy_meters,
  activity_type,
  speed_mps
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-10T00:00:00+00:00'
  AND recorded_at < '2026-02-11T00:00:00+00:00'
ORDER BY recorded_at
LIMIT 100;

-- Hourly aggregated location data
SELECT 
  hour_start AT TIME ZONE 'America/Chicago' as local_hour,
  geohash7,
  sample_count,
  place_label,
  google_place_name,
  google_place_types,
  radius_m
FROM tm.location_hourly
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND hour_start >= '2026-02-10T00:00:00'
  AND hour_start < '2026-02-11T00:00:00'
ORDER BY hour_start;

-- Activity segments (detected stays and commutes)
SELECT 
  started_at AT TIME ZONE 'America/Chicago' as start_local,
  ended_at AT TIME ZONE 'America/Chicago' as end_local,
  segment_type,
  place_label,
  activity_type,
  distance_m,
  EXTRACT(EPOCH FROM (ended_at - started_at))/60 as duration_minutes,
  latitude,
  longitude
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-10T00:00:00+00:00'
  AND started_at < '2026-02-11T00:00:00+00:00'
ORDER BY started_at;
