# Android Physical Device Fix Summary

## The Problem

Data collection (location + screen time) works on Android **simulator** but NOT on **physical device**.

## Root Cause

The app was opening **general Android Settings** instead of the **specific Usage Access settings screen**. On Android, Usage Access (`PACKAGE_USAGE_STATS`) **cannot** be granted via runtime permission - it **must** be enabled manually in a specific Settings screen.

## What I Fixed

### Fixed: Usage Access Settings Screen

**File:** `apps/mobile/src/app/permissions.tsx`

**Before:**
```typescript
await Linking.openSettings(); // ❌ Opens general Settings
```

**After:**
```typescript
await openUsageAccessSettingsSafeAsync(); // ✅ Opens Usage Access screen directly
```

This now opens the **exact Settings screen** where the user needs to enable Usage Access for the app.

---

## What Your Client Needs to Do

### Step 1: Update the App
- Pull the latest code with this fix
- Rebuild and reinstall the app on the physical device

### Step 2: Enable Usage Access (Screen Time)

When the client taps "Enable Screen Time" in the app:
1. The app will now open the **Usage Access settings screen** directly
2. Client should see "TodayMatters" in the list
3. Client must **toggle it ON**
4. Return to the app

**Manual Path (if needed):**
- Settings > Apps > Special app access > Usage access > TodayMatters > Enable

### Step 3: Verify Background Location

1. Settings > Apps > TodayMatters > Permissions > Location
2. Should show **"Allow all the time"** (not "While using the app")
3. If not, change to "Allow all the time"

### Step 4: Check Battery Optimization (Optional but Recommended)

Some devices kill background tasks even with permissions:
1. Settings > Apps > TodayMatters > Battery
2. Select **"Unrestricted"** or **"Not optimized"**

**Alternative path:**
- Settings > Battery > Battery optimization > TodayMatters > Don't optimize

### Step 5: Restart App

After making changes:
1. Force stop the app
2. Reopen it
3. Wait 5-10 minutes
4. Check database for data

---

## Additional Issues to Check

### 1. Foreground Service Notification

The app should show a persistent notification: **"TodayMatters is tracking your day"**

- If notification is missing, location tracking may have stopped
- Check: Settings > Apps > TodayMatters > Notifications > Enable all

### 2. Device-Specific Restrictions

Some manufacturers have additional restrictions:

- **Samsung**: May need "Allow background activity" toggle
- **Xiaomi**: May need "Autostart" permission  
- **Huawei**: May need "Protected apps" whitelist
- **OnePlus**: May need battery optimization exemption

---

## Testing

After the fix, run this SQL to verify data collection:

```sql
-- Check if data is being collected
SELECT 
  'Location Samples (last 24h)' AS type,
  COUNT(*) AS count,
  MAX(recorded_at) AS latest
FROM tm.location_samples
WHERE user_id = 'CLIENT_USER_ID'
  AND recorded_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Screen Time Daily (last 7 days)' AS type,
  COUNT(*) AS count,
  MAX(local_date)::text AS latest
FROM tm.screen_time_daily
WHERE user_id = 'CLIENT_USER_ID'
  AND platform = 'android'
  AND local_date >= CURRENT_DATE - INTERVAL '7 days';
```

---

## Why Simulator Works But Physical Device Doesn't

**Simulator:**
- Often has relaxed permission restrictions
- May auto-grant certain permissions
- Battery optimization typically disabled

**Physical Device:**
- Strict permission enforcement
- Usage Access **must** be manually enabled
- Battery optimization often enabled by default
- Manufacturer-specific restrictions may apply

---

## Next Steps

1. ✅ **Fixed:** Usage Access settings screen navigation
2. ⚠️ **Still Needed:** Battery optimization exemption request (future enhancement)
3. ⚠️ **Still Needed:** Better permission status UI showing all states
4. ⚠️ **Still Needed:** Device-specific permission handling

The immediate fix should resolve the Usage Access issue. Battery optimization and other enhancements can be added later if needed.
