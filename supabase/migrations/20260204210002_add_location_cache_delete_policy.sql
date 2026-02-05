-- Add missing DELETE policy for location_place_cache
-- The edge function uses delete + insert pattern for cache updates,
-- but RLS was blocking the delete operation.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'tm' 
      AND tablename = 'location_place_cache' 
      AND policyname = 'location_place_cache_delete_own'
  ) THEN
    CREATE POLICY location_place_cache_delete_own
      ON tm.location_place_cache
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Also grant DELETE permission to authenticated role
GRANT DELETE ON tm.location_place_cache TO authenticated;
