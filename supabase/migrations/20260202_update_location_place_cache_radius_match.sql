-- Expand Google place cache matching to within a radius (vs exact geohash cell).
-- This allows associating a cached place name when the user is near the same spot.

create or replace view tm.location_hourly as
with hourly as (
  select
    user_id,
    date_trunc('hour', recorded_at) as hour_start,
    count(*) as sample_count,
    avg(accuracy_m) as avg_accuracy_m,
    st_centroid(st_collect(geom::geometry)) as centroid_geom,
    array_agg(geom) as geoms
  from tm.location_samples
  group by 1, 2
)
select
  h.user_id,
  h.hour_start,
  h.sample_count,
  h.avg_accuracy_m,
  (h.centroid_geom::geography) as centroid,
  st_geohash(h.centroid_geom, 7) as geohash7,
  (
    select max(st_distance(g, h.centroid_geom::geography))
    from unnest(h.geoms) as g
  ) as radius_m,
  place_match.id as place_id,
  place_match.label as place_label,
  place_match.category as place_category,
  google_match.google_place_id as google_place_id,
  google_match.place_name as google_place_name,
  google_match.place_vicinity as google_place_vicinity,
  google_match.place_types as google_place_types
from hourly h
left join lateral (
  select p.id, p.label, p.category
  from tm.user_places p
  where p.user_id = h.user_id
    and st_dwithin(p.center, h.centroid_geom::geography, p.radius_m)
  order by p.radius_m asc
  limit 1
) place_match on true
left join lateral (
  select c.google_place_id, c.place_name, c.place_vicinity, c.place_types
  from tm.location_place_cache c
  where c.user_id = h.user_id
    and c.expires_at > now()
    and st_dwithin(c.geom, h.centroid_geom::geography, 150)
  order by st_distance(c.geom, h.centroid_geom::geography) asc, c.fetched_at desc
  limit 1
) google_match on true;
