# Android Physical Device Debug Guide

## The Core Issue

The `startAndroidBackgroundLocationAsync()` function has **6 silent early returns** that fail without any error or logging. On a physical device, any of these could be failing and you'd never know.

## Quick Diagnostic

I've added a diagnostic function you can call. Add this to your dev location screen or create a test button:

```typescript
import { getAndroidLocationDiagnostics } from '@/lib/android-location';

// Call this function to see what's wrong
const diagnostics = await getAndroidLocationDiagnostics();
console.log('Android Location Diagnostics:', JSON.stringify(diagnostics, null, 2));
```

This will tell you:
- ✅ What's working
- ❌ What's failing
- 📊 How many samples are queued locally
- 🔍 Exact error messages

## Most Likely Issues (In Order)

### 1. **Background Permission Not Actually Granted** (90% likely)

Even if the user thinks they granted it, Android 10+ requires:
1. First grant **foreground** permission (runtime prompt)
2. Then separately grant **background** permission (may require Settings)

**The diagnostic will show:** `backgroundPermission: 'denied'` or `'undetermined'`

**Fix:**
- Settings > Apps > TodayMatters > Permissions > Location
- Must show **"Allow all the time"** (not "While using the app")
- If it shows "While using the app", change it to "Allow all the time"

### 2. **Battery Optimization Killing Background Tasks** (70% likely)

Even with all permissions, battery optimization can kill background tasks.

**Check:** Settings > Apps > TodayMatters > Battery > Should be **"Unrestricted"** or **"Not optimized"**

**Fix:** Change to "Unrestricted" or "Don't optimize"

### 3. **Foreground Service Notification Missing** (50% likely)

If the notification **"TodayMatters is tracking your day"** is not visible:
- Background location task is NOT running
- Android killed the service
- Notification permission denied

**Check:** Pull down notification shade - should see persistent notification

**Fix:** 
- Settings > Apps > TodayMatters > Notifications > Enable all
- Restart app

### 4. **Location Services Disabled** (30% likely)

Device location services might be disabled globally.

**Check:** Settings > Location > Should be ON

### 5. **TaskManager Not Registered** (20% likely)

The background task is only registered if `ExpoTaskManager` exists. On some builds, this might not be available.

**The diagnostic will show:** `locationModule: false` or `support: 'expoGo'`

**Fix:** Rebuild the app with native modules

### 6. **Samples Queued But Not Uploaded** (10% likely)

Samples might be collected locally but not uploaded to Supabase.

**The diagnostic will show:** `pendingSamples: > 0` but no data in database

**Fix:** Check network connection, Supabase credentials, or manually trigger flush

## Step-by-Step Debugging

### Step 1: Run Diagnostic

```typescript
const diag = await getAndroidLocationDiagnostics();
console.log(diag);
```

### Step 2: Check Each Error

For each error in `diag.errors`:
1. Read the error message
2. Follow the fix instructions above
3. Re-run diagnostic

### Step 3: Verify Task Started

```typescript
const Location = await loadExpoLocationAsync();
const isStarted = await Location.hasStartedLocationUpdatesAsync(ANDROID_BACKGROUND_LOCATION_TASK_NAME);
console.log('Task started:', isStarted);
```

### Step 4: Check Pending Samples

```typescript
import { peekPendingAndroidLocationSamplesAsync } from '@/lib/android-location/queue';

const pending = await peekPendingAndroidLocationSamplesAsync(userId, 1000);
console.log('Pending samples:', pending.length);
```

If `pending.length > 0` but no data in database:
- Samples are being collected ✅
- Upload is failing ❌
- Check network, Supabase, or manually flush

### Step 5: Check Foreground Service

Look for notification: **"TodayMatters is tracking your day"**

If missing:
- Task is not running
- Check all permissions again
- Check battery optimization
- Restart app

## Why Simulator Works But Physical Device Doesn't

**Simulator:**
- Often has relaxed permission restrictions
- May auto-grant background permissions
- Battery optimization typically disabled
- Foreground service restrictions relaxed

**Physical Device:**
- Strict permission enforcement
- Background permission requires explicit Settings change
- Battery optimization often enabled by default
- Foreground service restrictions enforced
- Manufacturer-specific restrictions may apply

## Quick Fix Checklist

- [ ] Background location permission: Settings > Apps > TodayMatters > Permissions > Location > "Allow all the time"
- [ ] Battery optimization: Settings > Apps > TodayMatters > Battery > "Unrestricted"
- [ ] Foreground service notification visible: "TodayMatters is tracking your day"
- [ ] Location services enabled: Settings > Location > ON
- [ ] Run diagnostic function and fix all errors
- [ ] Restart app after making changes
- [ ] Wait 5-10 minutes for data to appear

## Next Steps

1. **Add diagnostic call** to dev screen or test button
2. **Run diagnostic** on physical device
3. **Fix each error** reported
4. **Re-run diagnostic** until `errors: []` and `taskStarted: true`
5. **Check for pending samples** - if > 0, samples are being collected
6. **Check database** - if pending > 0 but no DB data, upload is failing

The diagnostic function will tell you exactly what's wrong!
