-- Migration: Create tm.delete_user() function for self-service account deletion
-- Date: 2026-01-28
-- Description: Allows authenticated users to delete their own account and all associated data
--
-- Security features:
-- - Requires valid Supabase JWT (auth.uid() must be present)
-- - Deletes only the currently authenticated user
-- - Uses SECURITY DEFINER to access auth.users
-- - Locks search_path to prevent schema injection
-- - Executable only by authenticated role

-- Create the delete_user function
CREATE OR REPLACE FUNCTION tm.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = tm, auth, public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the authenticated user ID from JWT
  v_user_id := auth.uid();
  
  -- Ensure user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Delete the user from auth.users
  -- This will cascade to all related data due to foreign key constraints
  DELETE FROM auth.users WHERE id = v_user_id;
  
  -- Note: All tm schema tables with foreign keys to auth.users
  -- will be automatically cleaned up via CASCADE constraints
END;
$$;

-- Grant execute permission only to authenticated users
GRANT EXECUTE ON FUNCTION tm.delete_user() TO authenticated;

-- Revoke from other roles
REVOKE EXECUTE ON FUNCTION tm.delete_user() FROM anon;
REVOKE EXECUTE ON FUNCTION tm.delete_user() FROM public;

-- Add comment for documentation
COMMENT ON FUNCTION tm.delete_user() IS 'Allows an authenticated user to delete their own account and all associated data. Requires valid JWT token.';
