-- Migration: Add user_places spatial matching to location_timeline view
-- Description: Prioritize user-defined place labels over Google Places using radius-based matching
--
-- PROBLEM:
--   User saves "Home" with 100m radius, but other blocks at the same physical location
--   have slightly different coordinates due to GPS variance. The original place_label
--   (stored at segment generation time) only matches exact coordinates.
--
-- SOLUTION:
--   Add a LEFT JOIN LATERAL to tm.user_places using ST_DWithin with the user's saved radius.
--   This ensures that any segment within the user's defined radius gets the user's label.
--
-- PRIORITY ORDER:
--   1. User-defined place label (spatial match within radius) - HIGHEST PRIORITY
--   2. Segment's stored place_label (set at generation time)
--   3. Google Places cache (location_place_cache)
--   4. Category fallback (e.g., "Home", "Work")
--   5. "Unknown Location"

-- =============================================================================
-- tm.location_timeline - Updated with user_places spatial matching
-- =============================================================================
-- Drop and recreate to allow column changes
drop view if exists tm.location_timeline;

create view tm.location_timeline as
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
  -- Location name: prioritize user place > segment label > google cache > category > unknown
  coalesce(
    up.label,                                               -- 1. User-defined label (HIGHEST PRIORITY)
    s.place_label,                                          -- 2. Segment's stored label
    pc.place_name,                                          -- 3. Google Places cache
    initcap(replace(s.place_category, '_', ' ')),           -- 4. Category fallback
    'Unknown Location'                                      -- 5. Unknown
  ) as location_name,
  -- Original place_label from segment (for debugging/comparison)
  s.place_label as original_place_label,
  -- User place fields (for client-side logic)
  up.id as user_place_id,
  up.label as user_place_label,
  up.category as user_place_category,
  (up.id is not null) as is_user_defined,
  -- Category for styling/icons (prefer user category if available)
  coalesce(up.category, s.place_category, 'other') as category,
  -- Activity type
  coalesce(s.inferred_activity, 'unknown') as activity,
  -- Confidence (0-100%)
  round(coalesce(s.activity_confidence, 0) * 100)::int as confidence_pct,
  -- Coordinates for map
  s.location_lat as latitude,
  s.location_lng as longitude,
  -- Is this a commute/travel segment?
  (s.place_category = 'commute' or s.inferred_activity = 'commute') as is_traveling,
  -- Additional segment fields needed by the client
  s.place_id,
  s.place_category as segment_place_category,
  s.top_apps,
  s.total_screen_seconds,
  s.evidence,
  s.hour_bucket
from tm.activity_segments s
-- Join to get user-defined place label using SPATIAL matching
-- Uses ST_DWithin with the user's saved radius for GPS-variance tolerance
left join lateral (
  select 
    p.id, 
    p.label, 
    p.category
  from tm.user_places p
  where p.user_id = s.user_id
    and s.location_lat is not null
    and s.location_lng is not null
    and st_dwithin(
      p.center,
      st_setsrid(st_makepoint(s.location_lng, s.location_lat), 4326)::geography,
      p.radius_m  -- Use the user's saved radius for matching!
    )
  order by p.radius_m asc  -- Prefer smaller (more specific) radius if multiple matches
  limit 1
) up on true
-- Join to get Google place name if no user place and no segment label
-- Uses closest match by distance (from previous migration fix)
left join lateral (
  select c.place_name
  from tm.location_place_cache c
  where c.user_id = s.user_id
    and s.location_lat is not null
    and s.location_lng is not null
    and abs(c.latitude - s.location_lat) < 0.001
    and abs(c.longitude - s.location_lng) < 0.001
    and c.expires_at > now()
  order by (abs(c.latitude - s.location_lat) + abs(c.longitude - s.location_lng)) asc
  limit 1
) pc on up.id is null and s.place_label is null
order by s.started_at desc;

-- Grant access (idempotent)
grant select on tm.location_timeline to authenticated;

-- Add updated comment
comment on view tm.location_timeline is 'Location timeline for display with user-defined place labels taking priority via spatial matching within saved radius';
