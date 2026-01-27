# Data Collection Status Analysis

## Summary

Based on the SQL query results, here's what's happening:

### ✅ **Location Data in Events** (Working)

- **47,870 events** have location data
- **2,523 events** have location in the `location` column
- **2,031 events** have location in the `meta` column
- This suggests location data IS being collected, but it's coming from **calendar events** (Google Calendar sync), not from raw location samples

### ❌ **Raw Location Samples** (Not Working)

- **0 location samples** in `tm.location_samples`
- This means the **iOS background location task is NOT collecting raw location data**

### ❌ **Screen Time Data** (Not Working)

- **0 screen time records** in any screen time tables
- This means **Screen Time sync is NOT working**

---

## Why This Is Happening

### Location Samples Issue

The app has code to collect location samples via a background task (`useLocationSamplesSync` hook), but it requires:

1. **Background Location Permission**: User must grant "Always" location permission
   - Check: iOS Settings > Privacy & Security > Location Services > TodayMatters > Allow Location Access: **Always**
2. **Background Task Started**: The app must successfully start the background location task
   - The code checks permissions before starting (see `startIosBackgroundLocationAsync`)
   - If permissions aren't granted, the task won't start

3. **Device Location Services**: Must be enabled on the device

4. **App in Background**: The background task only runs when the app is backgrounded (or killed)

**Most likely cause**: Background location permission is not granted, or the permission was granted but the app hasn't been restarted since granting it.

### Screen Time Issue

The app has code to sync Screen Time (`useInsightsSync` hook), but it requires:

1. **Screen Time Authorization**: User must approve Screen Time access
   - This is a separate permission from location
   - Check the app's permissions screen or iOS Settings

2. **iOS Screen Time Report Extension**: Must be installed and working
   - This is a native iOS extension that reads Screen Time data
   - If the extension wasn't included in the build, sync won't work
   - May require rebuilding the app after adding the extension

3. **Cached Summary Available**: The extension must write data to a shared cache that the app can read

**Most likely cause**: Screen Time authorization not approved, or the Screen Time report extension isn't working/installed.

---

## How to Fix

### For Location Samples:

1. **Check Permissions**:
   - Open the app
   - Go to the Permissions screen (or Profile > Permissions)
   - Ensure "Background Location" shows as granted
   - If not, grant it and restart the app

2. **Verify in iOS Settings**:
   - Settings > Privacy & Security > Location Services > TodayMatters
   - Should show "Always" (not "While Using App" or "Never")

3. **Test Background Collection**:
   - Grant permission
   - Close the app completely
   - Wait 10-15 minutes
   - Reopen app (this triggers a flush)
   - Check if location samples appear in the database

### For Screen Time:

1. **Check Screen Time Authorization**:
   - Open the app
   - Go to Permissions screen
   - Look for Screen Time authorization status
   - If not approved, approve it

2. **Verify Extension is Installed**:
   - This requires checking the iOS build
   - The extension should be included in the app bundle
   - May need to rebuild: `pnpm --filter mobile ios`

3. **Test Screen Time Sync**:
   - After granting permission, wait for the sync interval (5 minutes)
   - Or manually trigger sync from Profile > Dev Tools (if available)
   - Check if screen time data appears

---

## Diagnostic Queries

Run the `diagnose-data-collection.sql` query to get detailed status on:

- When sync last ran
- Any sync errors
- Specific action items

---

## Expected Behavior Once Fixed

### Location Samples:

- Should see location samples appearing in `tm.location_samples` within minutes of granting permission
- Samples should appear even when app is backgrounded
- Flush happens every 2 minutes when app is foregrounded

### Screen Time:

- Should see records in `tm.screen_time_daily` after first sync
- Should see app sessions in `tm.screen_time_app_sessions`
- Sync happens every 5 minutes when app is active

---

## Code References

- Location sync hook: `apps/mobile/src/lib/supabase/hooks/use-location-samples-sync.ts`
- Screen Time sync hook: `apps/mobile/src/lib/supabase/hooks/use-insights-sync.ts`
- Location background task: `apps/mobile/src/lib/ios-location/location-task.ts`
- Screen Time sync service: `apps/mobile/src/lib/supabase/services/screen-time-sync.ts`
