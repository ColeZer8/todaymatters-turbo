# Samsung/OneUI Background Location Issues - Research Findings

**Date:** February 9, 2026  
**Context:** TodayMatters app experiencing location tracking failures on Samsung devices (667 GPS samples in 1 hour → only 8 samples rest of day)

## Executive Summary

Samsung devices with OneUI have **multiple layers** of battery optimization that go **far beyond stock Android (AOSP)**. Even with a properly configured foreground service, all permissions granted, and battery optimization disabled, Samsung's additional restrictions can still kill or throttle background location updates. This is a well-documented industry problem with no simple programmatic fix.

### The Core Problem

Samsung has implemented proprietary app-killing mechanisms that are more aggressive than standard Android:
- **Sleeping Apps** (unused for ~3 days) - Background processing restricted
- **Deep Sleeping Apps** (unused for ~16 days) - NEVER run in background
- **Adaptive Battery** - Samsung's version is more aggressive than AOSP
- **Device Care** - Additional monitoring and app killing
- **Wake Lock Restrictions** - Foreground services can't hold wake locks on Android 11+ (Samsung-specific limitation)

**Critical:** Even if you disable these settings, Samsung may **re-enable them** after firmware updates or when it detects "high battery usage."

---

## 1. Samsung's "Sleeping Apps" and "Deep Sleeping Apps"

### Overview

Samsung's most notorious battery-saving feature. This is **NOT part of stock Android (AOSP)** — it's a Samsung-only addition.

#### Sleeping Apps
- **Trigger:** Apps not used for ~3 days (or detected as causing "poor system health")
- **Effect:** Placed into Android's "Restricted" bucket
  - Job scheduling restricted
  - Alarms restricted
  - **Foreground services may be restricted** (yes, even foreground services!)
- **User control:** Can be added manually by user or automatically by system
- **Settings path:** `Settings → Battery → Background usage limits → Sleeping apps`

#### Deep Sleeping Apps
- **Trigger:** Apps not used for ~16 days (configurable by Samsung policy)
- **Effect:** Apps **NEVER** run in the background - only active when in foreground
  - All background activities blocked
  - No notifications, no updates, no location tracking
  - Essentially "hibernated"
- **Settings path:** `Settings → Battery → Background usage limits → Deep sleeping apps`

#### Never Sleeping Apps
- **Purpose:** Whitelist to prevent auto-sleep
- **Critical Note:** Apps that are "Not Optimized" (battery optimization disabled) often **cannot** be added to "Never Sleeping" list - they're mutually exclusive on some OneUI versions
- **Settings path:** `Settings → Battery → Background usage limits → Never sleeping apps`

### The Auto-Sleep Problem

**"Put unused apps to sleep"** setting:
- If enabled (default ON), Samsung will **automatically** move apps to Sleeping or Deep Sleeping after periods of non-use
- **Even if you manually wake them up**, Samsung will put them back to sleep after a few days
- This must be **DISABLED** or your whitelisting efforts are pointless

**Reference:** [Samsung Developer Documentation](https://developer.samsung.com/mobile/app-management.html)

---

## 2. Samsung's "Adaptive Battery"

### What It Is

Samsung's proprietary version of Android's Adaptive Battery feature - but **significantly more aggressive** than stock Android.

### How It Differs from AOSP

- Uses machine learning to predict app usage patterns
- More aggressive at putting unused apps into restrictive buckets
- Can restrict apps after as little as **3 days** of non-use (compared to weeks on stock Android)
- **Foreground services are NOT exempt** from some restrictions

### Effects on Location Tracking

- Can throttle or stop location callbacks even for foreground services
- May interfere with FusedLocationProviderClient updates
- Has been observed to trigger after the app is detected as "using too much battery"

### Disabling It

**Path (OneUI 6 / Android 14):**
```
Settings → Battery and device care → Battery → More battery settings → Adaptive battery → OFF
```

**Path (OneUI 5 / Android 13):**
```
Settings → Battery → More battery settings → Adaptive battery → OFF
```

**Path (Android 11-12):**
```
Settings → Device care → Battery → (⁝) menu → Settings → Adaptive battery → OFF
```

**Warning:** Samsung may re-enable this after major system updates.

---

## 3. OneUI Background Limits - Complete Inventory

### All Samsung-Specific Restrictions

Samsung has layered multiple proprietary restrictions on top of stock Android. Here's every setting that can kill background location:

#### Per-App Battery Settings
**Path:** `Settings → Apps → [Your App] → Battery`

Options:
- **Unrestricted** - Best for background location
- **Optimized** - May restrict background work
- **Restricted** - Severe limitations, will break location tracking

**Recommendation:** Set to "Unrestricted"

#### Background Usage Limits
**Path:** `Settings → Battery and device care → Battery → Background usage limits`

Lists to manage:
- **Sleeping apps** - Remove your app from this list
- **Deep sleeping apps** - Remove your app from this list
- **Never sleeping apps** - Add your app here (if possible)

Settings to DISABLE:
- **Put unused apps to sleep** - Must be OFF
- **Auto-disable unused apps** - Must be OFF (older OneUI versions)

#### Battery Optimization (Standard Android Setting)
**Path:** `Settings → Apps → (⁝) menu → Special access → Battery optimization`

- Find your app and set to "Not optimized"
- This is standard Android, but Samsung adds additional restrictions on top

#### Auto-Optimize Daily
**Path (older versions):** `Settings → Device care → Battery → (⁝) menu → Automation`

- Disable "Auto-restart" or "Auto-optimize daily"
- This can reset your manual exclusions

#### Adaptive Power Saving
**Path:** `Settings → Battery → Adaptive power saving`

- Automatically adjusts power-saving mode based on usage patterns
- Can interfere with location services
- **Disable** for consistent location tracking

#### Remove Permissions if App is Unused (Android 13+)
**Path:** `Settings → Apps → [Your App] → Permissions → Remove if unused`

- Android 13+ can auto-revoke permissions for unused apps
- Make sure this is DISABLED for your app

#### Game Booster / Game Optimizing Service
**Path:** `Settings → Advanced features → Game Booster`

- Samsung's gaming optimization can kill background processes during gameplay
- Can affect location tracking if user plays games while your app tracks location
- Disable or configure to exclude your app

---

## 4. Samsung's "App Power Monitor" (Older Devices)

### What It Is

On **Android Oreo (8.0) and Nougat (7.0)** Samsung devices, before "Device Care" existed, Samsung used "App Power Monitor."

### Configuration

**Path:** `Settings → Device maintenance → Battery`

Lists:
- **Sleeping apps** - Shows apps being restricted
- **Unmonitored apps** - Whitelist to prevent restrictions

**Setup:**
1. Scroll to bottom to find "Unmonitored apps"
2. Tap 3-dot menu → Add apps
3. Select your app
4. Confirm

### On Android Marshmallow and Below

**Path:** `Settings → Smart Manager → Battery → App Power Saving → Detail → [Your App] → Disable`

---

## 5. Device Care / Battery Optimization (Modern Samsung)

### Overview

"Device Care" is Samsung's integrated battery, storage, and memory management system introduced on Android Pie (9.0) and newer.

### Access Path

```
Settings → Battery and device care → Battery
```

### Key Features That Kill Apps

#### Storage Optimization
- Can clear app data/cache for "unused" apps
- May interfere with app state

#### Memory Optimization
- Closes background apps to free RAM
- Can kill foreground services under memory pressure

#### App Power Management
- Monitors battery usage per-app
- Automatically restricts apps detected as "battery draining"
- **Your location-tracking app WILL be flagged** as high battery usage

### Disable Auto-Optimizations

**Path:** `Settings → Battery and device care → Battery → (⁝) menu → Automation`

Disable:
- Auto-restart app
- Auto-optimize daily
- Any other automatic power management

---

## 6. The 667→8 Sample Pattern: Root Cause Analysis

### Your Specific Symptom

- Foreground service starts successfully
- Collects 667 GPS samples in first hour (normal operation)
- Then basically STOPS - only 8 samples rest of day
- Service appears to still be running (notification present)
- But location callbacks stop firing

### Possible Causes

#### 1. **Samsung's Wake Lock Restriction (Most Likely)**

**Source:** [dontkillmyapp.com](https://dontkillmyapp.com/samsung)

> "In Android 11 Samsung has introduced a new severe (default ON) restriction. Apps can no longer hold wake lock in foreground services. This breaks many use-cases, for instance, health apps are now unable to gather sensoric data for their users."

**Impact:**
- Your `PARTIAL_WAKE_LOCK` may be getting ignored
- When screen turns off, CPU may sleep
- FusedLocationProviderClient stops getting updates from GPS hardware
- Service is "alive" but callbacks don't fire

**Workaround:** Use `PendingIntent` approach instead of callback listeners (see Section 7)

#### 2. **Adaptive Battery Learning Pattern**

**Theory:**
- First hour: System hasn't detected high battery usage yet
- After 1 hour: Samsung's Adaptive Battery flags your app as "battery draining"
- System automatically throttles location callbacks to save battery
- App moves to restricted bucket even though it's a foreground service

**Evidence:**
- dontkillmyapp.com reports: "The latest feedback suggests even when you remove an app from the restricted list, Samsung may re-add them later after a firmware update or when it thinks it is using too much resources!"

#### 3. **FusedLocationProviderClient Doze Interaction**

When device enters Doze mode (screen off, stationary):
- Standard Android: Foreground services with location type are exempt
- Samsung's version: May still restrict location updates during Doze
- Callbacks stop firing, but PendingIntent-based updates may continue

#### 4. **Foreground Service Type Not Properly Declared**

**Critical for Android 14 / OneUI 6+:**

Your AndroidManifest.xml MUST include:
```xml
<service
    android:name=".LocationForegroundService"
    android:foregroundServiceType="location"
    android:exported="false">
</service>
```

And you must request the permission:
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

**If this is missing**, the system may silently throttle your service after initial period.

**Reference:** [Stack Overflow](https://stackoverflow.com/questions/75687806/android-foreground-service-stops-requesting-updates-for-locations-after-some-day)

#### 5. **Foreground Service Timeout (Android 13+)**

Android 13+ introduced foreground service timeouts:
- Location services: No hard limit, but system monitors battery impact
- If detected as "excessive drain," system can throttle even without user intervention

**Note:** The 667→8 pattern suggests throttling, not complete termination.

---

## 7. FusedLocationProviderClient on Samsung - Known Issues & Workarounds

### Known Issues

#### Problem 1: Callbacks Stop Firing When Screen Off
- **Symptoms:** Exactly what you're experiencing
- **Devices:** Widely reported on Samsung A-series and S-series
- **Cause:** Samsung's wake lock restrictions + aggressive battery management

#### Problem 2: LocationRequest Settings Ignored
- FusedLocationProviderClient may accept your LocationRequest but then ignore interval/priority settings
- Samsung's battery manager overrides your app's requests

#### Problem 3: Play Services Updates Break Things
- Some Google Play Services updates have caused location callback issues specifically on Samsung devices
- Check Play Services version: Settings → Apps → Google Play services

### Recommended Workarounds

#### ✅ Workaround 1: Use PendingIntent Instead of Callback

**Why this works:**
- PendingIntent-based location updates are more resilient to Samsung's restrictions
- System can wake your BroadcastReceiver even when callbacks would be throttled
- Better survival through Doze and deep sleep

**Implementation:**

```kotlin
// Instead of this (callback-based):
fusedLocationClient.requestLocationUpdates(
    locationRequest,
    locationCallback,  // ❌ May stop firing
    Looper.getMainLooper()
)

// Use this (PendingIntent-based):
val intent = Intent(this, LocationUpdatesBroadcastReceiver::class.java)
intent.action = "com.todaymatters.LOCATION_UPDATE"

val pendingIntent = PendingIntent.getBroadcast(
    this,
    0,
    intent,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
)

fusedLocationClient.requestLocationUpdates(
    locationRequest,
    pendingIntent  // ✅ More reliable on Samsung
)
```

**BroadcastReceiver:**

```kotlin
class LocationUpdatesBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (LocationResult.hasResult(intent)) {
            val locationResult = LocationResult.extractResult(intent)
            val location = locationResult?.lastLocation
            // Process location update
            
            // Can wake your foreground service to process the update
            val serviceIntent = Intent(context, LocationForegroundService::class.java)
            serviceIntent.putExtra("location", location)
            context.startForegroundService(serviceIntent)
        }
    }
}
```

**Register in AndroidManifest.xml:**

```xml
<receiver
    android:name=".LocationUpdatesBroadcastReceiver"
    android:exported="false">
    <intent-filter>
        <action android:name="com.todaymatters.LOCATION_UPDATE" />
    </intent-filter>
</receiver>
```

**Why this is better:**
- BroadcastReceivers can be woken up by system even during Doze
- Less affected by wake lock restrictions
- More battery efficient (system batches updates)

**References:**
- [Stack Overflow: Foreground service not receiving location updates](https://stackoverflow.com/questions/48509117/foreground-service-not-receiving-location-updates-in-android-7-0-when-screen-is)
- [Android Documentation: Background Location Limits](https://developer.android.com/about/versions/oreo/background-location-limits)

#### ✅ Workaround 2: Adjust Location Request Parameters

**Reduce battery impact to avoid throttling:**

```kotlin
val locationRequest = LocationRequest.Builder(
    Priority.PRIORITY_HIGH_ACCURACY,
    30_000L  // 30 seconds instead of aggressive intervals
).apply {
    setMinUpdateIntervalMillis(15_000L)  // Min 15 seconds
    setMaxUpdateDelayMillis(60_000L)     // Batch up to 1 minute
    setWaitForAccurateLocation(false)    // Don't wait, take what you get
}.build()
```

**Trade-off:** Less frequent updates, but more consistent operation on Samsung devices.

#### ✅ Workaround 3: Keep Screen On (for testing)

```kotlin
// In your service's onCreate or onStartCommand
powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
wakeLock = powerManager.newWakeLock(
    PowerManager.SCREEN_DIM_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
    "TodayMatters::LocationWakeLock"
)
wakeLock.acquire(10*60*1000L /*10 minutes*/)
```

**Warning:** This is NOT a production solution (battery drain), but useful for testing to isolate whether the issue is wake-lock related.

#### ✅ Workaround 4: Request Ignore Battery Optimization Programmatically

Show user dialog to whitelist app:

```kotlin
val intent = Intent()
intent.action = Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
intent.data = Uri.parse("package:${packageName}")
startActivity(intent)
```

**Note:** Google Play policy restricts when you can request this. Must have legitimate use case (fitness tracking qualifies).

#### ✅ Workaround 5: Deep Link to Samsung's Never Sleeping Apps

Samsung provides a deep link API to jump directly to their battery settings:

```kotlin
val intent = Intent()
intent.action = "com.samsung.android.sm.ACTION_OPEN_CHECKABLE_LISTACTIVITY"
intent.setPackage("com.samsung.android.lool")
intent.putExtra("activity_type", 2) // 0: sleeping, 1: deep sleeping, 2: never sleeping
try {
    startActivity(intent)
} catch (e: ActivityNotFoundException) {
    // Not a Samsung device or old OneUI version
    // Fall back to standard battery settings
}
```

**Reference:** [Samsung Developer Documentation](https://developer.samsung.com/mobile/app-management.html)

---

## 8. Doze Mode Interaction - Samsung vs Stock Android

### Standard Android Doze

**Entry conditions:**
- Screen off
- Device stationary
- Not charging
- After ~30-60 minutes

**Foreground service behavior:**
- Location-type foreground services are **exempt** from Doze restrictions
- Can continue receiving location updates normally

### Samsung's Doze Implementation

**Differences from AOSP:**
- **More aggressive entry** - May enter Doze-like state faster
- **Wake lock restrictions** - Even foreground services can't reliably hold wake locks
- **Combined with Sleeping Apps** - Doze + Samsung's proprietary sleep = double restriction
- **Background restrictions persist** - Coming out of Doze doesn't guarantee location updates resume

### Testing Doze Behavior

```bash
# Force device into Doze mode (for testing)
adb shell dumpsys deviceidle force-idle

# Exit Doze mode
adb shell dumpsys deviceidle unforce

# Check Doze state
adb shell dumpsys deviceidle get deep

# Monitor battery stats
adb shell dumpsys battery
```

**On Samsung devices:**
- Even after exiting Doze, location callbacks may not resume
- May need to restart location requests
- PendingIntent approach is more resilient to Doze cycles

---

## 9. OneUI 6 (Android 14) Improvements

### Official Samsung Commitment

From [Samsung Developer Documentation](https://developer.samsung.com/mobile/app-management.html):

> "To strengthen the Android platform, our collaboration with Google has resulted in a unified policy that we expect will create a more consistent and reliable user experience for Galaxy users. **Since One UI 6.0, foreground services of apps targeting Android 14 will be guaranteed to work as intended** so long as they are developed according to Android's new foreground service API policy."

### What This Means

**Good news:**
- Samsung committed to honoring standard Android foreground service behavior
- No more proprietary restrictions on properly declared foreground services
- Apps targeting API 34+ should have better reliability

**Requirements:**
- Must target Android 14 (API 34) or higher
- Must properly declare `android:foregroundServiceType="location"`
- Must request `FOREGROUND_SERVICE_LOCATION` permission
- Must follow Android 14's stricter foreground service rules

**Reality check:**
- User feedback is mixed - some still report issues
- Samsung's commitment applies to "properly developed" services
- Sleeping Apps / Deep Sleeping Apps still exist - user must still whitelist
- Adaptive Battery can still interfere

### Android 14 Required Changes

**Manifest:**
```xml
<manifest>
    <!-- Foreground service type permission -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    
    <application>
        <service
            android:name=".LocationForegroundService"
            android:foregroundServiceType="location"
            android:exported="false" />
    </application>
</manifest>
```

**Runtime permission check:**
```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
    if (ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.FOREGROUND_SERVICE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        // Request permission
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.FOREGROUND_SERVICE_LOCATION),
            REQUEST_CODE
        )
    }
}
```

**Starting service with type:**
```kotlin
val serviceIntent = Intent(this, LocationForegroundService::class.java)
ContextCompat.startForegroundService(this, serviceIntent)

// In service's onStartCommand, within 10 seconds:
startForeground(
    NOTIFICATION_ID,
    notification,
    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION  // Must specify type
)
```

---

## 10. Complete User Setup Guide

### Step-by-Step Instructions for Samsung Users

Provide these instructions to TodayMatters users to maximize location tracking reliability:

#### Step 1: Disable Battery Optimization (Standard Android)

1. Open **Settings**
2. Go to **Apps**
3. Find **TodayMatters**
4. Tap **Battery**
5. Select **Unrestricted**

#### Step 2: Remove from Sleeping Apps Lists (Samsung-specific)

1. Open **Settings**
2. Go to **Battery and device care**
3. Tap **Battery**
4. Tap **Background usage limits**
5. Check **Sleeping apps** list
   - If TodayMatters is there, tap it and select "Remove"
6. Check **Deep sleeping apps** list
   - If TodayMatters is there, tap it and select "Remove"
7. Go to **Never sleeping apps**
   - Tap "Add apps" (+ button)
   - Find and select **TodayMatters**
   - Tap "Add"

#### Step 3: Disable Auto-Sleep Feature

While still in **Background usage limits**:
1. Find the toggle **"Put unused apps to sleep"**
2. Turn it **OFF**

**Important:** If this remains ON, Samsung will automatically move TodayMatters back to Sleeping Apps after a few days of non-use.

#### Step 4: Disable Adaptive Battery

1. Go back to **Battery** settings
2. Tap **More battery settings** (or three-dot menu)
3. Find **Adaptive battery**
4. Turn it **OFF**

#### Step 5: Disable Adaptive Power Saving

1. In **Battery** settings
2. Find **Adaptive power saving**
3. Turn it **OFF**

#### Step 6: Allow Background Location Permission

1. Go to **Settings → Apps → TodayMatters → Permissions**
2. Tap **Location**
3. Select **"Allow all the time"**
4. Make sure **"Use precise location"** is enabled

#### Step 7: Prevent Permission Auto-Revoke (Android 13+)

1. While in **Permissions** for TodayMatters
2. Look for **"Remove permissions if app isn't used"**
3. Turn it **OFF**

#### Step 8: Disable Battery Optimization (Alternate Path)

1. Go to **Settings → Apps**
2. Tap three-dot menu (⁝)
3. Select **Special access**
4. Tap **Optimize battery usage**
5. Change dropdown from "Apps that can optimize" to **"All"**
6. Find **TodayMatters**
7. Turn the toggle **OFF**

### Quick Diagnostic Checklist

Provide this checklist for users to verify setup:

- [ ] Battery setting: Unrestricted
- [ ] Battery optimization: Not optimized
- [ ] Sleeping apps: NOT in this list
- [ ] Deep sleeping apps: NOT in this list
- [ ] Never sleeping apps: IS in this list
- [ ] Put unused apps to sleep: OFF
- [ ] Adaptive battery: OFF
- [ ] Adaptive power saving: OFF
- [ ] Location permission: Allow all the time
- [ ] Background location: Granted
- [ ] Remove permissions if unused: OFF

---

## 11. Samsung Good Guardians & Good Lock Apps

### Good Guardians

Samsung offers additional app called "Good Guardians" available in Galaxy Store. It has modules that affect background app behavior:

#### Memory Guardian
- **"Quick switching mode"** keeps more apps in background
- Quote: "Keep more apps in the background. When using the previously used app again, it is more likely to run with the last state of the app, not starting from the beginning."
- **Recommendation:** Enable "Quick switching mode"

#### Battery Guardian
- Monitors battery usage per-app
- **"App power saving"** can automatically close apps using increased battery
- **Recommendation:** Disable "App power saving" or whitelist TodayMatters

#### Galaxy App Booster
- Purpose unclear, seems to optimize app performance
- May affect background processes

**Access:** Download from Galaxy Store if not pre-installed

### Good Lock - "Long Live App"

Another Samsung utility with module called "Long Live App":
- Designed to protect specific apps from being killed in background
- May help keep location tracking active
- **Recommendation:** Add TodayMatters to protection list

**Note:** These apps are optional and not always reliable. Focus on the main settings first.

---

## 12. Additional Programmatic Recommendations

### 1. Implement Health Monitoring

Add self-diagnostics to detect when location stops working:

```kotlin
class LocationHealthMonitor {
    private var lastLocationTime = 0L
    private val HEALTH_CHECK_INTERVAL = 5 * 60 * 1000L // 5 minutes
    
    fun checkHealth() {
        val timeSinceLastUpdate = System.currentTimeMillis() - lastLocationTime
        
        if (timeSinceLastUpdate > HEALTH_CHECK_INTERVAL) {
            // Location updates have stopped!
            Log.w("LocationHealth", "No location for ${timeSinceLastUpdate}ms")
            
            // Attempt recovery
            restartLocationUpdates()
            
            // Notify user
            showLocationIssueNotification()
        }
    }
    
    fun recordLocation(location: Location) {
        lastLocationTime = location.time
    }
}
```

### 2. Add Restart Logic

Periodically restart location requests to work around Samsung throttling:

```kotlin
private val locationRestartHandler = Handler(Looper.getMainLooper())
private val restartInterval = 30 * 60 * 1000L // 30 minutes

private val restartRunnable = object : Runnable {
    override fun run() {
        stopLocationUpdates()
        startLocationUpdates()
        locationRestartHandler.postDelayed(this, restartInterval)
    }
}

fun startPeriodicRestart() {
    locationRestartHandler.postDelayed(restartRunnable, restartInterval)
}
```

### 3. Log Battery Restrictions State

Log what restrictions are active so users can report issues:

```kotlin
fun logBatteryRestrictions(context: Context) {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val isIgnoringOptimization = powerManager.isIgnoringBatteryOptimizations(context.packageName)
        Log.d("BatteryState", "Ignoring optimization: $isIgnoringOptimization")
        
        val isPowerSaveMode = powerManager.isPowerSaveMode
        Log.d("BatteryState", "Power save mode: $isPowerSaveMode")
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val locationMode = powerManager.locationPowerSaveMode
            Log.d("BatteryState", "Location power save mode: $locationMode")
        }
    }
    
    // Check app standby bucket
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val bucket = usageStatsManager.appStandbyBucket
        Log.d("BatteryState", "App standby bucket: ${bucketToString(bucket)}")
    }
}

fun bucketToString(bucket: Int): String {
    return when (bucket) {
        5 -> "STANDBY_BUCKET_ACTIVE"
        10 -> "STANDBY_BUCKET_WORKING_SET"
        20 -> "STANDBY_BUCKET_FREQUENT"
        30 -> "STANDBY_BUCKET_RARE"
        40 -> "STANDBY_BUCKET_RESTRICTED"
        45 -> "STANDBY_BUCKET_NEVER"
        else -> "UNKNOWN ($bucket)"
    }
}
```

### 4. Request Disable Doze (Last Resort)

Request exemption from Doze mode (use sparingly, Google restricts this):

```kotlin
@RequiresApi(Build.VERSION_CODES.M)
fun requestDisableDoze(activity: Activity) {
    val powerManager = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
    
    if (!powerManager.isIgnoringBatteryOptimizations(activity.packageName)) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        intent.data = Uri.parse("package:${activity.packageName}")
        
        try {
            activity.startActivityForResult(intent, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        } catch (e: ActivityNotFoundException) {
            // Some devices don't support this
            Log.e("Battery", "Unable to request battery optimization exemption", e)
        }
    }
}
```

---

## 13. Testing & Validation

### Testing on Samsung Devices

#### Baseline Test
1. Factory reset test device OR clear all battery optimizations
2. Install TodayMatters
3. Grant all permissions
4. Start location tracking
5. Let run for 24 hours
6. **Expected result:** Should fail after 1-2 hours (reproduces issue)

#### Optimized Configuration Test
1. Apply ALL user setup steps from Section 10
2. Implement PendingIntent workaround (Section 7)
3. Declare proper foreground service type (Section 9)
4. Start location tracking
5. Let run for 24 hours with screen off
6. Monitor location sample count

#### Monitoring During Test

```bash
# Watch service state
adb shell dumpsys activity services | grep -A 20 LocationForegroundService

# Monitor location permissions
adb shell dumpsys package com.todaymatters | grep -A 5 "permission"

# Check battery stats
adb shell dumpsys batterystats | grep -A 50 com.todaymatters

# Watch logcat for location updates
adb logcat | grep -i location
```

### Success Criteria

- **Baseline:** 100+ location samples per hour consistently
- **With optimization:** No more than 20% variance hour-to-hour
- **After 6 hours:** Still receiving regular updates (no dropoff)
- **After screen off:** Continues working (no 667→8 pattern)

---

## 14. Community Resources & Issue Trackers

### Don't Kill My App
- **Website:** https://dontkillmyapp.com/samsung
- **Most comprehensive documentation** of manufacturer battery restrictions
- Samsung-specific section with user-reported issues and workarounds
- Updated regularly with new OneUI versions

### Samsung Developer Resources
- **App Management Guide:** https://developer.samsung.com/mobile/app-management.html
- Official documentation on Sleeping/Deep Sleeping apps
- Includes deeplink API for Samsung settings

### Issue Trackers

#### Google Issue Tracker - Samsung Wake Lock Restriction
- **Issue:** https://issuetracker.google.com/issues/179644471
- Tracks the Android 11+ Samsung wake lock restriction in foreground services
- 500+ starred, marked as "Acknowledged"
- Google response: "OEM behavior, contact Samsung"

#### GitHub - Don't Kill My App
- **Repo:** https://github.com/urbandroid-team/dont-kill-my-app
- Open issues for specific Samsung models
- Community workarounds and solutions

### Stack Overflow Tags
- `[android-foreground-service]` + `[samsung]`
- `[fusedlocationproviderclient]` + `[android-battery]`
- `[oneui]` + `[background]`

---

## 15. Summary & Recommendations

### The Reality

Samsung's battery management is **the most aggressive in the Android ecosystem**. Even with proper implementation, user configuration is **essential**. There is **no 100% programmatic solution** that bypasses all Samsung restrictions.

### Critical Actions for TodayMatters

#### Immediate (Code Changes)

1. **Switch to PendingIntent-based location updates** (highest priority)
2. **Declare foreground service type** in manifest
3. **Target Android 14** (API 34) to benefit from Samsung's commitment
4. **Add health monitoring** to detect and recover from throttling
5. **Implement periodic restart** of location requests (every 30 min)

#### User Onboarding

1. **Create setup wizard** that guides users through all Samsung battery settings
2. **Detect Samsung devices** at runtime and show Samsung-specific instructions
3. **Use deep link API** to jump directly to Samsung's battery settings
4. **Implement diagnostics screen** showing which restrictions are active
5. **Notify users** if location tracking appears to have stopped

#### Documentation

1. **In-app help** specific to Samsung devices
2. **Video tutorial** showing exact settings on current OneUI version
3. **Troubleshooting guide** for when location tracking stops
4. **"Why Samsung?" explainer** to set user expectations

### Expected Outcome

With all workarounds implemented + user configuration:
- **Best case:** 95%+ reliability on Samsung devices
- **Typical:** 85-90% reliability (occasional gaps during deep Doze or after updates)
- **Worst case:** User doesn't configure settings properly → same issue persists

### Long-Term Hope

Samsung's Android 14 commitment suggests future OneUI versions may be less aggressive. Monitor user reports on OneUI 6.1+ devices to see if improvements materialize.

---

## Appendix: Samsung Device Testing Matrix

### Priority Test Devices

Based on market share and reported issues:

1. **Samsung Galaxy S24 Series** - Current flagship, OneUI 6+
2. **Samsung Galaxy S23 Series** - Previous flagship, OneUI 5-6
3. **Samsung Galaxy A54/A34** - Mid-range, high volume
4. **Samsung Galaxy A23/A13** - Budget, most aggressive restrictions reported
5. **Samsung Galaxy Z Fold/Flip** - Foldables, unique power profiles

### OneUI Versions to Test

- **OneUI 6.1** (Android 14) - Latest, Samsung's commitment should apply
- **OneUI 6.0** (Android 14) - Samsung commitment threshold
- **OneUI 5.1** (Android 13) - Previous stable
- **OneUI 4.1** (Android 12) - Still in wide use

### Test Scenarios

1. **Clean boot** → track 24h → measure sample count
2. **After app unused 3 days** → reopen → verify still works
3. **During gaming** → verify Game Booster doesn't interfere
4. **With phone call** → verify doesn't stop tracking
5. **Firmware update** → verify settings didn't reset
6. **Low battery mode** → verify graceful degradation vs. complete stop

---

**Research completed:** February 9, 2026  
**Last updated:** February 9, 2026  
**TodayMatters App**

---

## References

1. Don't Kill My App - Samsung: https://dontkillmyapp.com/samsung
2. Samsung Developer - Application Management: https://developer.samsung.com/mobile/app-management.html
3. Android Developers - Doze and App Standby: https://developer.android.com/training/monitoring-device-state/doze-standby
4. Android Developers - Background Location Limits: https://developer.android.com/about/versions/oreo/background-location-limits
5. Android Developers - Foreground Service Timeouts: https://developer.android.com/develop/background-work/services/fgs/timeout
6. Google Issue Tracker #179644471: Samsung foreground service wake lock restriction
7. Stack Overflow: Multiple threads on Samsung location tracking issues (linked throughout document)
