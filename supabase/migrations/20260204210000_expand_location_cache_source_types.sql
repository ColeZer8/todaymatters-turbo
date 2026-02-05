-- Expand location_place_cache source column to support reverse_geocode and negative caching
-- This allows us to:
-- 1. Cache reverse geocode results ("Near [Neighborhood]") when no POI is found
-- 2. Cache negative results (no place found at all) to avoid repeated failed API calls

-- Drop and recreate the check constraint with new allowed values
ALTER TABLE tm.location_place_cache 
DROP CONSTRAINT IF EXISTS location_place_cache_source_check;

ALTER TABLE tm.location_place_cache 
ADD CONSTRAINT location_place_cache_source_check 
CHECK (source IN ('google_places_nearby', 'reverse_geocode', 'none'));

-- Update the view to also consider the source for the google_match join
-- (We want to include reverse_geocode results in the google_place_name column)
CREATE OR REPLACE VIEW tm.location_hourly AS
WITH hourly AS (
  SELECT
    user_id,
    date_trunc('hour', recorded_at) AS hour_start,
    count(*) AS sample_count,
    avg(accuracy_m) AS avg_accuracy_m,
    st_centroid(st_collect(geom::geometry)) AS centroid_geom,
    array_agg(geom) AS geoms
  FROM tm.location_samples
  GROUP BY 1, 2
)
SELECT
  h.user_id,
  h.hour_start,
  h.sample_count,
  h.avg_accuracy_m,
  -- Keep original centroid for backward compatibility
  (h.centroid_geom::geography) AS centroid,
  -- Add explicit lat/lng for easy client parsing
  st_y(h.centroid_geom) AS centroid_latitude,
  st_x(h.centroid_geom) AS centroid_longitude,
  st_geohash(h.centroid_geom, 7) AS geohash7,
  (
    SELECT max(st_distance(g, h.centroid_geom::geography))
    FROM unnest(h.geoms) AS g
  ) AS radius_m,
  place_match.id AS place_id,
  place_match.label AS place_label,
  place_match.category AS place_category,
  google_match.google_place_id AS google_place_id,
  -- Filter out negative cache placeholder from display
  CASE 
    WHEN google_match.place_name = '__NO_RESULT__' THEN NULL
    ELSE google_match.place_name
  END AS google_place_name,
  google_match.place_vicinity AS google_place_vicinity,
  google_match.place_types AS google_place_types
FROM hourly h
LEFT JOIN LATERAL (
  SELECT p.id, p.label, p.category
  FROM tm.user_places p
  WHERE p.user_id = h.user_id
    AND st_dwithin(p.center, h.centroid_geom::geography, p.radius_m)
  ORDER BY p.radius_m ASC
  LIMIT 1
) place_match ON true
LEFT JOIN LATERAL (
  SELECT c.google_place_id, c.place_name, c.place_vicinity, c.place_types
  FROM tm.location_place_cache c
  WHERE c.user_id = h.user_id
    AND c.expires_at > now()
    AND st_dwithin(c.geom, h.centroid_geom::geography, 150)
  ORDER BY st_distance(c.geom, h.centroid_geom::geography) ASC, c.fetched_at DESC
  LIMIT 1
) google_match ON true;
