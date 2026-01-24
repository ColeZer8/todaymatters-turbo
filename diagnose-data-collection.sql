-- Diagnostic Query: Why Location & Screen Time Data Isn't Being Collected
-- Replace '62c02dff-42ef-4d0d-ae60-445adc464cc6' with your account ID

WITH account_id AS (
  SELECT '62c02dff-42ef-4d0d-ae60-445adc464cc6'::uuid AS user_id
)
-- Check data sync state (tells us if sync has ever run and when)
SELECT 
  'Data Sync State' AS diagnostic_type,
  dataset,
  platform,
  provider,
  oldest_synced_local_date,
  newest_synced_local_date,
  last_sync_started_at,
  last_sync_finished_at,
  last_sync_status,
  last_sync_error,
  CASE 
    WHEN last_sync_finished_at IS NULL THEN 'Never synced'
    WHEN last_sync_status = 'error' THEN 'Last sync failed: ' || COALESCE(last_sync_error, 'Unknown error')
    WHEN last_sync_finished_at < NOW() - INTERVAL '24 hours' THEN 'Last sync was over 24 hours ago'
    ELSE 'Sync appears active'
  END AS status_summary
FROM tm.data_sync_state dss
CROSS JOIN account_id ai
WHERE dss.user_id = ai.user_id
ORDER BY dataset, platform, provider;

-- Check if location samples are being queued but not uploaded
-- (This would show if background task is working but flush isn't happening)
-- Note: This requires checking the app's local storage, which we can't query from SQL
-- But we can check if ANY location samples exist vs events with location

SELECT 
  'Location Data Gap Analysis' AS diagnostic_type,
  (SELECT COUNT(*) FROM tm.location_samples ls WHERE ls.user_id = ai.user_id) AS raw_location_samples,
  (SELECT COUNT(*) FROM tm.events e WHERE e.user_id = ai.user_id AND (e.location IS NOT NULL OR e.meta->>'location' IS NOT NULL)) AS events_with_location,
  CASE 
    WHEN (SELECT COUNT(*) FROM tm.location_samples ls WHERE ls.user_id = ai.user_id) = 0 
         AND (SELECT COUNT(*) FROM tm.events e WHERE e.user_id = ai.user_id AND (e.location IS NOT NULL OR e.meta->>'location' IS NOT NULL)) > 0
    THEN '⚠️ Location data exists in events but NO raw location samples. Background location task may not be running or permissions not granted.'
    WHEN (SELECT COUNT(*) FROM tm.location_samples ls WHERE ls.user_id = ai.user_id) = 0
    THEN '❌ No location samples collected. Check: 1) Background location permission granted? 2) Background task started? 3) Device location services enabled?'
    ELSE '✅ Location samples are being collected'
  END AS location_status
FROM account_id ai;

-- Check screen time sync state specifically
SELECT 
  'Screen Time Sync Status' AS diagnostic_type,
  dataset,
  platform,
  provider,
  newest_synced_local_date AS last_synced_date,
  last_sync_finished_at,
  last_sync_status,
  last_sync_error,
  CASE 
    WHEN last_sync_finished_at IS NULL THEN '❌ Screen Time has never been synced. Check: 1) Screen Time authorization approved? 2) iOS Screen Time report extension working? 3) App rebuilt after adding extension?'
    WHEN last_sync_status = 'error' THEN '❌ Last sync failed: ' || COALESCE(last_sync_error, 'Unknown error')
    WHEN newest_synced_local_date < CURRENT_DATE - INTERVAL '1 day' THEN '⚠️ Screen Time sync is stale (last synced: ' || newest_synced_local_date::text || ')'
    ELSE '✅ Screen Time sync appears active'
  END AS screen_time_status
FROM tm.data_sync_state dss
CROSS JOIN account_id ai
WHERE dss.user_id = ai.user_id
  AND dss.dataset = 'screen_time'
ORDER BY platform, provider;

-- Summary: What permissions/features need to be checked
SELECT 
  'Action Items' AS diagnostic_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM tm.location_samples ls WHERE ls.user_id = ai.user_id) = 0
    THEN '📍 LOCATION: Verify background location permission is granted in iOS Settings > Privacy & Security > Location Services > TodayMatters > Always. Also check that location services are enabled on device.'
    ELSE NULL
  END AS location_action,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM tm.data_sync_state dss 
      WHERE dss.user_id = ai.user_id 
        AND dss.dataset = 'screen_time' 
        AND dss.last_sync_status = 'ok'
        AND dss.newest_synced_local_date >= CURRENT_DATE - INTERVAL '1 day'
    )
    THEN '📊 SCREEN TIME: Verify Screen Time authorization is approved (check app permissions screen). Ensure iOS Screen Time report extension is installed and working. May need to rebuild app if extension was recently added.'
    ELSE NULL
  END AS screen_time_action
FROM account_id ai;
