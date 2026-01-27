# Android Physical Device Data Collection Issues

## Problem Summary

Data collection works on Android **simulator** but NOT on **physical device**. This is a classic Android permissions/optimization issue.

---

## Root Causes

### 1. **Usage Access (Screen Time) - CRITICAL**

**The Problem:**

- `PACKAGE_USAGE_STATS` permission **CANNOT** be granted via runtime permission
- User **MUST** manually enable it in Android Settings
- Current code opens **general Settings** instead of the **Usage Access screen**

**Current Code Issue:**

```typescript
// In permissions.tsx line 132
await Linking.openSettings(); // ❌ Opens general Settings, not Usage Access screen
```

**What Should Happen:**

- Should open the **specific Usage Access settings screen** for the app
- The native module has `openUsageAccessSettingsAsync()` but it's not being used correctly

**Fix Required:**

```typescript
// Should use:
await openUsageAccessSettingsSafeAsync(); // ✅ Opens Usage Access screen directly
```

**How to Verify:**

1. Go to Android Settings > Apps > Special app access > Usage access
2. Check if "TodayMatters" is listed and **enabled**
3. If not listed or disabled, that's the problem

---

### 2. **Background Location Permission**

**The Problem:**

- On Android 10+, background location requires **TWO steps**:
  1. Grant foreground location permission (runtime)
  2. Grant background location permission (may require Settings)

**Current Code:**

- Code checks for background permission but may not be requesting it properly
- User might have granted foreground but not background

**How to Verify:**

1. Android Settings > Apps > TodayMatters > Permissions > Location
2. Should show "Allow all the time" (not just "While using the app")
3. If only "While using the app" is enabled, background won't work

---

### 3. **Battery Optimization**

**The Problem:**

- Physical devices often have **battery optimization** enabled
- This kills background tasks even if permissions are granted
- App needs to request exemption from battery optimization

**Current Status:**

- ❌ **NOT IMPLEMENTED** - No battery optimization exemption request

**Fix Required:**

- Add code to check and request battery optimization exemption
- Use `Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` or `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

**How to Verify:**

1. Android Settings > Apps > TodayMatters > Battery
2. Check if "Unrestricted" or "Not optimized" is selected
3. If "Optimized" or "Restricted", that's blocking background tasks

---

### 4. **Foreground Service Notification**

**The Problem:**

- Android requires a **persistent notification** for background location
- Code has this configured, but if notification is dismissed or blocked, location stops

**Current Code:**

```typescript
foregroundService: {
  notificationTitle: 'TodayMatters is tracking your day',
  notificationBody: 'Used to build an hour-by-hour view of your day for schedule comparison.',
  notificationColor: '#2563EB',
}
```

**How to Verify:**

1. Check notification shade - should see persistent "TodayMatters is tracking your day" notification
2. If notification is missing, location tracking stopped
3. Check if notifications are disabled for the app

---

## Diagnostic Steps for Client

### Step 1: Check Usage Access (Screen Time)

1. Open Android Settings
2. Go to **Apps** > **Special app access** > **Usage access**
3. Find **TodayMatters** in the list
4. **Enable** it if disabled
5. Return to app and check if screen time data appears

**Alternative Path:**

- Settings > Apps > TodayMatters > App data > Usage access > Enable

### Step 2: Check Location Permissions

1. Open Android Settings
2. Go to **Apps** > **TodayMatters** > **Permissions** > **Location**
3. Should show **"Allow all the time"** (not "While using the app")
4. If not, change it to "Allow all the time"
5. Return to app

### Step 3: Check Battery Optimization

1. Open Android Settings
2. Go to **Apps** > **TodayMatters** > **Battery**
3. Select **"Unrestricted"** or **"Not optimized"**
4. Some devices: Settings > Battery > Battery optimization > TodayMatters > Don't optimize

### Step 4: Check Foreground Service Notification

1. Pull down notification shade
2. Should see persistent notification: "TodayMatters is tracking your day"
3. If missing, location tracking may have stopped
4. Check: Settings > Apps > TodayMatters > Notifications > Enable all

### Step 5: Restart App

After making changes:

1. **Force stop** the app (Settings > Apps > TodayMatters > Force stop)
2. **Reopen** the app
3. Wait 5-10 minutes for sync
4. Check database again

---

## Code Fixes Needed

### Fix 1: Use Correct Usage Access Settings Screen

**File:** `apps/mobile/src/app/permissions.tsx`

**Current (line 132):**

```typescript
await Linking.openSettings(); // ❌ Wrong
```

**Should be:**

```typescript
await openUsageAccessSettingsSafeAsync(); // ✅ Correct
```

### Fix 2: Add Battery Optimization Check

**New function needed:**

```typescript
import { Linking, Platform } from "react-native";

async function checkBatteryOptimization(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  // Check if battery optimization is enabled
  // Request exemption if needed
  // This requires native module or deep link to Settings
}
```

### Fix 3: Better Permission Status Display

Add UI to show:

- Usage Access status (authorized/denied)
- Background location status
- Battery optimization status
- Foreground service notification status

---

## Quick Test Query

Run this to see if data is being collected:

```sql
-- Check recent Android data collection
SELECT
  'Location Samples (last 24h)' AS type,
  COUNT(*) AS count,
  MAX(recorded_at) AS latest
FROM tm.location_samples
WHERE user_id = 'YOUR_USER_ID'
  AND recorded_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Screen Time Daily (last 7 days)' AS type,
  COUNT(*) AS count,
  MAX(local_date)::text AS latest
FROM tm.screen_time_daily
WHERE user_id = 'YOUR_USER_ID'
  AND platform = 'android'
  AND local_date >= CURRENT_DATE - INTERVAL '7 days';
```

---

## Expected Behavior After Fixes

### Location:

- Persistent notification appears immediately
- Location samples appear in database within 2-5 minutes
- Samples continue even when app is backgrounded

### Screen Time:

- Usage access enabled in Settings
- Screen time data appears after first sync (5 min interval)
- Data appears in `tm.screen_time_daily` and `tm.screen_time_app_sessions`

---

## Manufacturer-Specific Issues

Some Android manufacturers (Samsung, Xiaomi, Huawei, etc.) have additional restrictions:

1. **Samsung**: May require "Allow background activity" toggle
2. **Xiaomi**: Requires "Autostart" permission
3. **Huawei**: Requires "Protected apps" whitelist
4. **OnePlus**: May require "Battery optimization" exemption

Check device-specific settings if standard Android settings don't work.
