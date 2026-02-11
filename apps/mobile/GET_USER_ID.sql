-- 🔑 Get Your User ID
-- Copy/paste this into Supabase SQL Editor and replace the email

SELECT 
  id as user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'cole@todaymatters.app';  -- ← REPLACE with your email

-- Copy the 'user_id' value from the result
-- Then use it in the QUICK_VERIFY.sql queries
