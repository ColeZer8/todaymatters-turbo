-- Add geohash7 column to tm.user_places for fast location label lookups
-- This allows the timeline to quickly find user-defined labels without spatial queries

-- Add geohash7 column
ALTER TABLE tm.user_places 
ADD COLUMN IF NOT EXISTS geohash7 TEXT NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS user_places_user_geohash7_idx 
  ON tm.user_places (user_id, geohash7);

-- Add unique constraint (one label per user per geohash7)
CREATE UNIQUE INDEX IF NOT EXISTS user_places_user_geohash7_uniq
  ON tm.user_places (user_id, geohash7)
  WHERE geohash7 IS NOT NULL;

-- Backfill geohash7 for existing places (if any)
-- Uses ST_GeoHash to generate geohash7 from the center geography point
UPDATE tm.user_places
SET geohash7 = ST_GeoHash(center::geometry, 7)
WHERE geohash7 IS NULL AND center IS NOT NULL;

-- Create trigger function to auto-generate geohash7 from center
CREATE OR REPLACE FUNCTION tm.auto_generate_geohash7()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate geohash7 from center if not explicitly set
  IF NEW.geohash7 IS NULL AND NEW.center IS NOT NULL THEN
    NEW.geohash7 := ST_GeoHash(NEW.center::geometry, 7);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert/update
DROP TRIGGER IF EXISTS user_places_auto_geohash7 ON tm.user_places;
CREATE TRIGGER user_places_auto_geohash7
  BEFORE INSERT OR UPDATE ON tm.user_places
  FOR EACH ROW
  EXECUTE FUNCTION tm.auto_generate_geohash7();

-- Add comment
COMMENT ON COLUMN tm.user_places.geohash7 IS 
  'Geohash-7 prefix for fast location label lookups (7 chars ≈ 150m precision). Auto-generated from center if not provided.';
