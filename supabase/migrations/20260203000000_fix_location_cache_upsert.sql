-- Fix upsert conflict detection for location_place_cache
-- Problem: geohash7 is a generated column, can't use it directly in upsert conflict
-- Solution: Add unique index on rounded coordinates (same precision as client deduplication)

-- Create functional index on rounded coordinates for deduplication
-- Round to 4 decimal places (~11m precision, matches client-side rounding)
CREATE UNIQUE INDEX IF NOT EXISTS location_place_cache_user_coords_rounded
  ON tm.location_place_cache (
    user_id,
    ROUND(latitude::numeric, 4),
    ROUND(longitude::numeric, 4)
  );

-- Note: Keep the geohash7 index for query performance in the view join
