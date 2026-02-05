-- Fix: Dynamically find and drop the source check constraint regardless of name
-- PostgreSQL auto-generates constraint names for inline CHECK constraints,
-- and the name may not match our expected "location_place_cache_source_check"

-- Step 1: Find and drop ANY check constraints on the 'source' column
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find all check constraints on tm.location_place_cache that reference 'source'
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) 
      AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'tm.location_place_cache'::regclass
      AND c.contype = 'c'  -- check constraint
      AND a.attname = 'source'
  LOOP
    RAISE NOTICE 'Dropping constraint: %', constraint_name;
    EXECUTE format('ALTER TABLE tm.location_place_cache DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

-- Step 2: Add the new constraint with expanded values
ALTER TABLE tm.location_place_cache 
DROP CONSTRAINT IF EXISTS location_place_cache_source_check;

ALTER TABLE tm.location_place_cache 
ADD CONSTRAINT location_place_cache_source_check 
CHECK (source IN ('google_places_nearby', 'reverse_geocode', 'none'));

-- Verify the constraint exists
DO $$
DECLARE
  constraint_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conrelid = 'tm.location_place_cache'::regclass
    AND conname = 'location_place_cache_source_check';
  
  IF constraint_def IS NULL THEN
    RAISE EXCEPTION 'Failed to create location_place_cache_source_check constraint!';
  ELSE
    RAISE NOTICE 'New constraint: %', constraint_def;
  END IF;
END $$;
