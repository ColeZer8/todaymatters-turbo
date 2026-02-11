-- 🔍 Quick Verification Queries for Location Tagging Fix
-- Run these in Supabase SQL Editor

-- =====================================================================
-- STEP 1: Get your user_id (copy the result for next queries)
-- =====================================================================
SELECT 
  id as user_id,
  email
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com';  -- ← REPLACE with your email

-- =====================================================================
-- STEP 2: Check your recent user_places (replace <USER_ID> with result from step 1)
-- =====================================================================
SELECT 
  id,
  label,
  category,
  geohash7,  -- ✅ This should NOT be NULL after the fix
  ST_AsText(center) as coordinates,
  radius_m,
  created_at,
  updated_at
FROM tm.user_places
WHERE user_id = '<USER_ID>'  -- ← REPLACE with your user_id
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================================
-- STEP 3: Check for the specific place you just tagged (e.g., "Home")
-- =====================================================================
SELECT 
  id,
  label,
  category,
  geohash7,
  ST_X(center) as longitude,
  ST_Y(center) as latitude,
  radius_m,
  created_at
FROM tm.user_places
WHERE user_id = '<USER_ID>'  -- ← REPLACE with your user_id
  AND label = 'Home'  -- ← REPLACE with your label
ORDER BY created_at DESC;

-- =====================================================================
-- STEP 4: Find any places WITHOUT geohash7 (should be empty after fix)
-- =====================================================================
SELECT 
  id,
  label,
  category,
  created_at
FROM tm.user_places
WHERE user_id = '<USER_ID>'  -- ← REPLACE with your user_id
  AND geohash7 IS NULL;

-- If this returns any rows, those places were created with the old buggy code
-- You can delete them and re-create them with the fixed code:
-- DELETE FROM tm.user_places WHERE id = '<BAD_PLACE_ID>';

-- =====================================================================
-- STEP 5: Count total places and places with geohash7
-- =====================================================================
SELECT 
  COUNT(*) as total_places,
  COUNT(geohash7) as places_with_geohash7,
  COUNT(*) - COUNT(geohash7) as places_missing_geohash7
FROM tm.user_places
WHERE user_id = '<USER_ID>';  -- ← REPLACE with your user_id

-- Expected result after fix:
-- total_places = places_with_geohash7
-- places_missing_geohash7 = 0
