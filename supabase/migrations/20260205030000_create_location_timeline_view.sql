-- Migration: Create polished location timeline view for client demos
-- Description: Human-readable view of location activity with place names

-- =============================================================================
-- tm.location_timeline - Polished location timeline for display
-- =============================================================================
create or replace view tm.location_timeline as
select
  s.id,
  s.user_id,
  s.started_at,
  s.ended_at,
  -- Duration in minutes
  extract(epoch from (s.ended_at - s.started_at)) / 60 as duration_minutes,
  -- Date for grouping
  (s.started_at at time zone 'America/Chicago')::date as local_date,
  -- Time display (e.g., "9:30 AM - 10:45 AM")
  to_char(s.started_at at time zone 'America/Chicago', 'HH:MI AM') as start_time,
  to_char(s.ended_at at time zone 'America/Chicago', 'HH:MI AM') as end_time,
  -- Location name (prioritize user place label, then google name, then category)
  coalesce(
    s.place_label,
    pc.place_name,
    initcap(replace(s.place_category, '_', ' ')),
    'Unknown Location'
  ) as location_name,
  -- Category for styling/icons
  coalesce(s.place_category, 'other') as category,
  -- Activity type
  coalesce(s.inferred_activity, 'unknown') as activity,
  -- Confidence (0-100%)
  round(coalesce(s.activity_confidence, 0) * 100)::int as confidence_pct,
  -- Coordinates for map
  s.location_lat as latitude,
  s.location_lng as longitude,
  -- Is this a commute/travel segment?
  (s.place_category = 'commute' or s.inferred_activity = 'commute') as is_traveling
from tm.activity_segments s
-- Join to get Google place name if place_label is null
left join lateral (
  select c.place_name
  from tm.location_place_cache c
  where c.user_id = s.user_id
    and s.location_lat is not null
    and s.location_lng is not null
    and abs(c.latitude - s.location_lat) < 0.001
    and abs(c.longitude - s.location_lng) < 0.001
    and c.expires_at > now()
  order by c.fetched_at desc
  limit 1
) pc on s.place_label is null
order by s.started_at desc;

-- Grant access
grant select on tm.location_timeline to authenticated;

-- Add comment
comment on view tm.location_timeline is 'Polished location timeline for client display - shows where user was and when with human-readable place names';
