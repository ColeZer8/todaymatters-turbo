# TodayMatters Android Background Location - Gap Analysis & Action Plan

**Date:** February 9, 2026  
**Context:** Samsung device collected 667 GPS samples in 1 hour, then only 8 samples for the rest of the day  
**Goal:** Diagnose root cause and provide prioritized implementation plan

---

## 1. Current Architecture Assessment

### What We Do Well ✅

| Component | Implementation | Location |
|-----------|----------------|----------|
| **Foreground service type** | Properly declared `foregroundServiceType="location"` | `AndroidManifest.xml:45` |
| **FOREGROUND_SERVICE_LOCATION permission** | Declared | `AndroidManifest.xml:12` |
| **START_STICKY** | Service restarts after system kill | `LocationForegroundService.kt:68` |
| **Boot receiver** | Restarts service after device reboot | `BootReceiver.kt` |
| **stopWithTask="false"** | Service survives app close | `AndroidManifest.xml:45` |
| **WorkManager backup** | Periodic fallback mechanism | `LocationWorker.kt` |
| **Wake lock** | Acquires PARTIAL_WAKE_LOCK | `LocationForegroundService.kt:272-282` |
| **Persistent notification** | Ongoing, non-dismissible | `LocationForegroundService.kt:240-256` |
| **Supabase direct upload** | Reduces JS dependency | `LocationForegroundService.kt:183-196` |
| **Local queue fallback** | Handles offline scenarios | `LocationForegroundService.kt:200-202` |

### What's Missing ❌

| Gap | Impact | Research Reference |
|-----|--------|-------------------|
| **Callback-based location updates** | Samsung Android 11+ throttles callbacks but honors PendingIntent | Samsung Research §7.1 |
| **PRIORITY_HIGH_ACCURACY in background** | Triggers Samsung's "excessive battery drain" detection | Android API Research §5 |
| **No health monitoring** | Cannot detect when location updates stop | Industry Research §12.1 |
| **No periodic restart of location requests** | Samsung throttles persistent callbacks over time | Samsung Research §7.2 |
| **No Significant Motion Sensor** | Missing industry-standard trigger for battery efficiency | Industry Research §2 |
| **setWaitForAccurateLocation(true)** | Causes initial delays, may miss first updates | Android API Research §4 |
| **Wake lock ineffective** | Samsung Android 11+ ignores wake locks in foreground services | Samsung Research §6.1 |
| **No Samsung-specific user setup** | User must whitelist app in 10+ Samsung settings | Samsung Research §10 |
| **LocationRequest interval too short** | 15-minute interval × 60s = 900,000ms, but we use intervalMinutes × 60 × 1000 | `LocationForegroundService.kt:156` |

---

## 2. Gap Analysis Table

| Best Practice | Our Implementation | Gap | Severity |
|--------------|-------------------|-----|----------|
| **Use PendingIntent for location updates** | Using `LocationCallback` (line 165) | **CRITICAL** — Samsung throttles callbacks after ~1 hour | 🔴 Critical |
| **Use PRIORITY_BALANCED_POWER_ACCURACY in background** | Using `PRIORITY_HIGH_ACCURACY` (line 153) | **HIGH** — Triggers Samsung battery throttling | 🔴 Critical |
| **Health monitoring with self-recovery** | No implementation | **HIGH** — Cannot detect/recover from throttling | 🟠 High |
| **Periodic restart of location requests** | No implementation | **HIGH** — Samsung throttles persistent listeners | 🟠 High |
| **Significant Motion Sensor** | No implementation | **MEDIUM** — Missing efficient motion-triggered updates | 🟡 Medium |
| **setWaitForAccurateLocation(false)** | Using `true` (line 157) | **MEDIUM** — Causes initial delays | 🟡 Medium |
| **Samsung user setup wizard** | No implementation | **HIGH** — 90% of Samsung issues are user settings | 🟠 High |
| **Motion-adaptive priority** | Static priority | **MEDIUM** — Should use high accuracy only when moving | 🟡 Medium |
| **Geofencing for place detection** | No implementation | **LOW** — Would improve battery life | 🟢 Low |
| **Displacement-based updates** | Using time-based only | **LOW** — Could reduce updates when stationary | 🟢 Low |

---

## 3. Root Cause Hypothesis — Why 667→8?

Based on research, the symptom pattern (667 samples in first hour → only 8 for rest of day) points to **Samsung's battery management throttling location callbacks**.

### Top 3 Theories (Ranked by Evidence)

#### 🥇 Theory 1: Samsung Wake Lock + Callback Throttling (90% Confidence)

**Evidence from Samsung Research §6.1:**
> "In Android 11 Samsung has introduced a new severe (default ON) restriction. Apps can no longer hold wake lock in foreground services. This breaks many use-cases."

**How it explains 667→8:**
1. **Hour 1:** Foreground service starts fresh, Samsung hasn't detected "high battery usage" yet
2. **After ~1 hour:** Samsung's Adaptive Battery flags app as "battery draining"
3. **Throttling applied:** `LocationCallback.onLocationResult()` stops being called
4. **Service appears alive:** Notification visible, but callbacks don't fire
5. **8 samples:** Only when user interacts with phone or other events temporarily wake GPS

**Supporting Code Analysis:**
- `LocationForegroundService.kt:165-173` — Uses callback-based location
- `LocationForegroundService.kt:272-282` — Acquires `PARTIAL_WAKE_LOCK` (ignored by Samsung)

**Fix:** Switch to **PendingIntent-based location updates** (Samsung honors these more reliably)

---

#### 🥈 Theory 2: PRIORITY_HIGH_ACCURACY Triggering Battery Management (75% Confidence)

**Evidence from Android API Research §5:**
> "PRIORITY_HIGH_ACCURACY drains 15-30% battery per hour. Using it continuously in background triggers Android Vitals penalties and Samsung's 'excessive drain' detection."

**How it explains 667→8:**
1. **Hour 1:** GPS runs continuously at high accuracy (667 samples = ~11/minute = good GPS fix)
2. **Battery drain detected:** Samsung sees 15-30% battery drain from location
3. **Automatic throttling:** Samsung moves app to "Restricted" standby bucket
4. **Callbacks stop:** FusedLocationProviderClient stops delivering updates

**Supporting Code Analysis:**
- `LocationForegroundService.kt:153` — `Priority.PRIORITY_HIGH_ACCURACY`
- No adaptive priority based on motion state

**Fix:** Use **PRIORITY_BALANCED_POWER_ACCURACY** for background, only HIGH_ACCURACY when actively navigating

---

#### 🥉 Theory 3: Samsung Sleeping Apps Re-Addition (50% Confidence)

**Evidence from Samsung Research §2:**
> "Even if you manually remove an app from the restricted list, Samsung may re-add them later after a firmware update or when it thinks it is using too much resources!"

**How it explains 667→8:**
1. **Initial setup:** User configured app correctly
2. **After ~1 hour:** Samsung's Device Care detects high battery usage
3. **Auto-sleep applied:** App automatically added to "Sleeping Apps" list
4. **Background restricted:** Foreground service continues but location callbacks throttled

**Note:** This is harder to verify without checking device settings

**Fix:** Implement **Samsung device detection + setup wizard** to guide users through all Samsung battery settings

---

### Secondary Factors (Contributing but Not Root Cause)

| Factor | Impact | Evidence |
|--------|--------|----------|
| **setWaitForAccurateLocation(true)** | May cause initial delays but doesn't explain ongoing throttling | Android API Research §4 |
| **No health monitoring** | Can't detect problem, but doesn't cause it | Industry Research §12.1 |
| **WorkManager backup insufficient** | 15-minute minimum interval can't compensate for throttled service | `ExpoBackgroundLocationModule.kt:72` |

---

## 4. Prioritized Action Plan

### Priority 1: Critical — Fix Callback Throttling

#### Action 1.1: Switch to PendingIntent-Based Location Updates

**What to change:**
- File: `LocationForegroundService.kt`
- Functions: `startLocationUpdates()` (line 149-173), add new `LocationUpdatesBroadcastReceiver`

**Why (Research Finding):**
- Samsung Research §7.1: "PendingIntent-based location updates are more resilient to Samsung's restrictions"
- Industry Research §3: Owntracks and other production apps use PendingIntent for reliability

**Implementation:**

```kotlin
// NEW FILE: LocationUpdatesBroadcastReceiver.kt
package expo.modules.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.LocationResult

class LocationUpdatesBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (LocationResult.hasResult(intent)) {
            val locationResult = LocationResult.extractResult(intent)
            locationResult?.lastLocation?.let { location ->
                Log.d(TAG, "PendingIntent location: lat=${location.latitude}, lng=${location.longitude}")
                
                // Forward to service for processing
                val serviceIntent = Intent(context, LocationForegroundService::class.java).apply {
                    action = ACTION_PROCESS_LOCATION
                    putExtra("latitude", location.latitude)
                    putExtra("longitude", location.longitude)
                    putExtra("accuracy", location.accuracy)
                    putExtra("altitude", location.altitude)
                    putExtra("speed", location.speed)
                    putExtra("bearing", location.bearing)
                    putExtra("time", location.time)
                }
                context.startService(serviceIntent)
            }
        }
    }

    companion object {
        private const val TAG = "LocationBroadcastRcvr"
        const val ACTION_PROCESS_LOCATION = "expo.modules.backgroundlocation.PROCESS_LOCATION"
    }
}
```

**Changes to LocationForegroundService.kt:**

```kotlin
// Replace callback-based approach (lines 149-173) with:
private var locationPendingIntent: PendingIntent? = null

private fun startLocationUpdates() {
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
        != PackageManager.PERMISSION_GRANTED) {
        Log.w(TAG, "Location permission not granted")
        return
    }

    val intervalMs = (intervalMinutes * 60 * 1000).toLong()
    
    val locationRequest = LocationRequest.Builder(
        Priority.PRIORITY_BALANCED_POWER_ACCURACY,  // Changed from HIGH_ACCURACY
        intervalMs
    )
        .setMinUpdateIntervalMillis(intervalMs / 2)
        .setMaxUpdateDelayMillis(intervalMs)  // No batching
        .setWaitForAccurateLocation(false)    // Changed from true
        .build()

    // Use PendingIntent instead of callback
    val intent = Intent(this, LocationUpdatesBroadcastReceiver::class.java)
    locationPendingIntent = PendingIntent.getBroadcast(
        this,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    )

    fusedLocationClient.requestLocationUpdates(
        locationRequest,
        locationPendingIntent!!,
        Looper.getMainLooper()
    )
    
    Log.d(TAG, "Location updates started with PendingIntent, interval=${intervalMs}ms")
}
```

**Add to AndroidManifest.xml:**
```xml
<receiver
    android:name=".LocationUpdatesBroadcastReceiver"
    android:enabled="true"
    android:exported="false">
</receiver>
```

**Expected Impact:** 🔴 HIGH — This is the primary fix for Samsung callback throttling  
**Implementation Complexity:** 🟡 Medium — Requires refactoring location handling

---

#### Action 1.2: Change Location Priority to BALANCED_POWER_ACCURACY

**What to change:**
- File: `LocationForegroundService.kt`
- Line: 153

**Current:**
```kotlin
val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
```

**Change to:**
```kotlin
val locationRequest = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, intervalMs)
```

**Why (Research Finding):**
- Android API Research §5: "PRIORITY_HIGH_ACCURACY drains 15-30% battery/hour... triggers Samsung's 'excessive drain' detection"
- Android API Research §13: "50-70% less battery drain with BALANCED_POWER_ACCURACY"

**Expected Impact:** 🔴 HIGH — Reduces battery drain significantly, avoids Samsung throttling trigger  
**Implementation Complexity:** 🟢 Simple — Single line change

---

#### Action 1.3: Set waitForAccurateLocation to false

**What to change:**
- File: `LocationForegroundService.kt`
- Line: 157

**Current:**
```kotlin
.setWaitForAccurateLocation(true)
```

**Change to:**
```kotlin
.setWaitForAccurateLocation(false)
```

**Why (Research Finding):**
- Android API Research §4: "Delays delivery of initial low-accuracy locations... causes 2-10 second delays"
- For continuous tracking, any location is better than no location

**Expected Impact:** 🟡 Medium — Faster initial location, no perceived gaps  
**Implementation Complexity:** 🟢 Simple — Single line change

---

### Priority 2: High — Add Resilience Mechanisms

#### Action 2.1: Implement Health Monitoring with Self-Recovery

**What to change:**
- File: `LocationForegroundService.kt`
- Add new: Health monitoring Runnable

**Why (Research Finding):**
- Samsung Research §12.1: "Add self-diagnostics to detect when location stops working"
- Industry Research: All production apps implement health monitoring

**Implementation:**

```kotlin
// Add to LocationForegroundService.kt

private var lastLocationTime = 0L
private val healthCheckHandler = Handler(Looper.getMainLooper())
private val HEALTH_CHECK_INTERVAL = 5 * 60 * 1000L // 5 minutes
private val MAX_LOCATION_GAP = 10 * 60 * 1000L // 10 minutes without location = problem

private val healthCheckRunnable = object : Runnable {
    override fun run() {
        checkLocationHealth()
        healthCheckHandler.postDelayed(this, HEALTH_CHECK_INTERVAL)
    }
}

private fun checkLocationHealth() {
    val timeSinceLastLocation = System.currentTimeMillis() - lastLocationTime
    
    if (lastLocationTime > 0 && timeSinceLastLocation > MAX_LOCATION_GAP) {
        Log.w(TAG, "⚠️ Location gap detected: ${timeSinceLastLocation / 1000}s since last update")
        
        // Attempt recovery: restart location updates
        stopLocationUpdates()
        startLocationUpdates()
        
        updateNotification("🔄 Restarting location tracking...")
    }
}

private fun startHealthMonitoring() {
    healthCheckHandler.postDelayed(healthCheckRunnable, HEALTH_CHECK_INTERVAL)
}

private fun stopHealthMonitoring() {
    healthCheckHandler.removeCallbacks(healthCheckRunnable)
}

// Update handleNewLocation() to record timestamp
private fun handleNewLocation(location: Location) {
    lastLocationTime = System.currentTimeMillis()  // Add this line
    // ... rest of existing code
}

// Call in startForegroundTracking()
private fun startForegroundTracking() {
    // ... existing code ...
    startHealthMonitoring()  // Add this
}

// Call in stopForegroundTracking()
private fun stopForegroundTracking() {
    stopHealthMonitoring()  // Add this
    // ... existing code ...
}
```

**Expected Impact:** 🟠 HIGH — Detects throttling and auto-recovers  
**Implementation Complexity:** 🟡 Medium — New feature

---

#### Action 2.2: Implement Periodic Location Request Restart

**What to change:**
- File: `LocationForegroundService.kt`
- Add periodic restart mechanism

**Why (Research Finding):**
- Samsung Research §12.2: "Periodically restart location requests to work around Samsung throttling"
- Recommended interval: 30 minutes

**Implementation:**

```kotlin
// Add to LocationForegroundService.kt

private val restartHandler = Handler(Looper.getMainLooper())
private val RESTART_INTERVAL = 30 * 60 * 1000L // 30 minutes

private val restartRunnable = object : Runnable {
    override fun run() {
        Log.d(TAG, "Periodic location restart triggered")
        stopLocationUpdates()
        startLocationUpdates()
        restartHandler.postDelayed(this, RESTART_INTERVAL)
    }
}

private fun startPeriodicRestart() {
    restartHandler.postDelayed(restartRunnable, RESTART_INTERVAL)
}

private fun stopPeriodicRestart() {
    restartHandler.removeCallbacks(restartRunnable)
}
```

**Expected Impact:** 🟠 HIGH — Preemptively clears any Samsung throttling before it fully kicks in  
**Implementation Complexity:** 🟢 Simple — Few lines of code

---

### Priority 3: Medium — Improve User Experience

#### Action 3.1: Add Samsung Device Detection and Setup Prompt

**What to change:**
- File: `ExpoBackgroundLocationModule.kt`
- Add new function

**Why (Research Finding):**
- Samsung Research §10: "Provide these instructions to TodayMatters users to maximize location tracking reliability"
- 90% of Samsung issues are caused by user settings

**Implementation:**

```kotlin
// Add to ExpoBackgroundLocationModule.kt

/**
 * Check if device is Samsung and return setup instructions URL.
 */
AsyncFunction("getSamsungSetupInfo") { promise: Promise ->
    try {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val isSamsung = manufacturer.contains("samsung")
        
        val result = mapOf(
            "isSamsung" to isSamsung,
            "manufacturer" to Build.MANUFACTURER,
            "model" to Build.MODEL,
            "androidVersion" to Build.VERSION.SDK_INT,
            "setupRequired" to isSamsung
        )
        
        promise.resolve(result)
    } catch (e: Exception) {
        promise.reject("SAMSUNG_CHECK_FAILED", e.message, e)
    }
}

/**
 * Open Samsung battery settings directly (deep link).
 */
AsyncFunction("openSamsungBatterySettings") { promise: Promise ->
    try {
        val intent = Intent()
        intent.action = "com.samsung.android.sm.ACTION_OPEN_CHECKABLE_LISTACTIVITY"
        intent.setPackage("com.samsung.android.lool")
        intent.putExtra("activity_type", 2) // 2 = never sleeping apps
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        
        try {
            context.startActivity(intent)
            promise.resolve(mapOf("success" to true))
        } catch (e: ActivityNotFoundException) {
            // Not Samsung or old OneUI - fall back to standard battery settings
            val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            fallbackIntent.data = Uri.parse("package:${context.packageName}")
            fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(fallbackIntent)
            promise.resolve(mapOf("success" to true, "fallback" to true))
        }
    } catch (e: Exception) {
        promise.reject("OPEN_SETTINGS_FAILED", e.message, e)
    }
}
```

**Expected Impact:** 🟠 HIGH — Guides users through Samsung-specific settings  
**Implementation Complexity:** 🟡 Medium — New functionality + JS integration

---

#### Action 3.2: Log Battery Restriction State for Debugging

**What to change:**
- File: `ExpoBackgroundLocationModule.kt`
- Add diagnostic function

**Why (Research Finding):**
- Samsung Research §12.3: "Log what restrictions are active so users can report issues"

**Implementation:**

```kotlin
/**
 * Get detailed battery and location diagnostics.
 */
AsyncFunction("getDiagnostics") { promise: Promise ->
    try {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val diagnostics = mutableMapOf<String, Any>()
        
        // Battery optimization status
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            diagnostics["isIgnoringBatteryOptimizations"] = 
                powerManager.isIgnoringBatteryOptimizations(context.packageName)
            diagnostics["isPowerSaveMode"] = powerManager.isPowerSaveMode
        }
        
        // App standby bucket (Android 9+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            usageStatsManager?.let {
                val bucket = it.appStandbyBucket
                diagnostics["appStandbyBucket"] = when (bucket) {
                    5 -> "ACTIVE"
                    10 -> "WORKING_SET"
                    20 -> "FREQUENT"
                    30 -> "RARE"
                    40 -> "RESTRICTED"
                    45 -> "NEVER"
                    else -> "UNKNOWN ($bucket)"
                }
            }
        }
        
        // Device info
        diagnostics["manufacturer"] = Build.MANUFACTURER
        diagnostics["model"] = Build.MODEL
        diagnostics["androidVersion"] = Build.VERSION.SDK_INT
        diagnostics["isSamsung"] = Build.MANUFACTURER.lowercase().contains("samsung")
        
        // Service state
        diagnostics["serviceRunning"] = LocationForegroundService.shouldBeRunning(context)
        diagnostics["storedUserId"] = LocationForegroundService.getStoredUserId(context) ?: ""
        diagnostics["storedInterval"] = LocationForegroundService.getStoredInterval(context)
        
        promise.resolve(diagnostics)
    } catch (e: Exception) {
        promise.reject("DIAGNOSTICS_FAILED", e.message, e)
    }
}
```

**Expected Impact:** 🟡 Medium — Enables debugging of throttling issues  
**Implementation Complexity:** 🟢 Simple — Utility function

---

### Priority 4: Lower — Future Improvements

#### Action 4.1: Add Significant Motion Sensor (Future)

**Why (Research Finding):**
- Industry Research §2: "Google Maps uses Significant Motion Sensor to detect when device moves, then triggers high-accuracy location requests"
- Battery efficient: only requests GPS when movement detected

**Implementation Complexity:** 🟠 Complex — Requires sensor integration, state machine  
**Expected Impact:** 🟡 Medium — Better battery life, more intelligent tracking

---

#### Action 4.2: Add Geofencing for Place Detection (Future)

**Why (Research Finding):**
- Industry Research §3: "Uber uses geofences around driver's position, pickup/dropoff locations"
- Battery efficient: uses cell towers + WiFi, not constant GPS

**Implementation Complexity:** 🔴 Complex — Requires geofence management, place detection  
**Expected Impact:** 🟢 Low-Medium — Optimization, not critical fix

---

## 5. Samsung-Specific Checklist (User-Facing Instructions)

Provide these instructions to TodayMatters users with Samsung devices:

### Step-by-Step Samsung Setup

#### Step 1: Set Battery to Unrestricted
1. Open **Settings**
2. Go to **Apps**
3. Find **TodayMatters**
4. Tap **Battery**
5. Select **Unrestricted** ✅

#### Step 2: Remove from Sleeping Apps
1. Open **Settings**
2. Go to **Battery and device care**
3. Tap **Battery**
4. Tap **Background usage limits**
5. Check **Sleeping apps** — If TodayMatters is there, tap to remove
6. Check **Deep sleeping apps** — If TodayMatters is there, tap to remove

#### Step 3: Add to Never Sleeping Apps
1. While in **Background usage limits**
2. Tap **Never sleeping apps**
3. Tap **+ Add apps**
4. Select **TodayMatters**
5. Tap **Add** ✅

#### Step 4: Disable Auto-Sleep
1. While in **Background usage limits**
2. Find **"Put unused apps to sleep"**
3. Turn it **OFF** ✅

#### Step 5: Disable Adaptive Battery
1. Go back to **Battery** settings
2. Tap **More battery settings**
3. Find **Adaptive battery**
4. Turn it **OFF** ✅

#### Step 6: Disable Adaptive Power Saving
1. In **Battery** settings
2. Find **Adaptive power saving**
3. Turn it **OFF** ✅

#### Step 7: Verify Location Permission
1. Go to **Settings → Apps → TodayMatters → Permissions**
2. Tap **Location**
3. Select **"Allow all the time"** ✅
4. Enable **"Use precise location"** ✅

#### Step 8: Prevent Permission Auto-Revoke
1. While in **Permissions**
2. Find **"Remove permissions if app isn't used"**
3. Turn it **OFF** ✅

#### Step 9: Disable Battery Optimization (Alternate Path)
1. Go to **Settings → Apps**
2. Tap **⁝** menu
3. Select **Special access**
4. Tap **Optimize battery usage**
5. Change dropdown to **"All"**
6. Find **TodayMatters**
7. Turn toggle **OFF** ✅

---

### Quick Verification Checklist

After completing setup, verify:

| Setting | Status |
|---------|--------|
| Battery: Unrestricted | ☐ |
| Battery optimization: Not optimized | ☐ |
| Sleeping apps: NOT in list | ☐ |
| Deep sleeping apps: NOT in list | ☐ |
| Never sleeping apps: IS in list | ☐ |
| Put unused apps to sleep: OFF | ☐ |
| Adaptive battery: OFF | ☐ |
| Adaptive power saving: OFF | ☐ |
| Location: Allow all the time | ☐ |
| Precise location: ON | ☐ |
| Remove permissions if unused: OFF | ☐ |

---

## 6. Recommended LocationRequest Parameters

### Current Parameters (LocationForegroundService.kt lines 153-158)

```kotlin
val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
    .setMinUpdateIntervalMillis(intervalMs / 2)
    .setMaxUpdateDelayMillis(intervalMs * 2)
    .setWaitForAccurateLocation(true)
    .build()
```

### Recommended Parameters

```kotlin
val locationRequest = LocationRequest.Builder(
    Priority.PRIORITY_BALANCED_POWER_ACCURACY,  // Changed: 50-70% less battery
    60_000L  // 1 minute base interval
)
    .setMinUpdateIntervalMillis(30_000L)        // Accept faster updates
    .setMaxUpdateDelayMillis(60_000L)           // No batching (≤2x interval)
    .setWaitForAccurateLocation(false)          // Changed: faster initial location
    .setGranularity(Granularity.GRANULARITY_FINE)
    .build()
```

### Parameter Rationale

| Parameter | Current | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| **Priority** | `HIGH_ACCURACY` | `BALANCED_POWER_ACCURACY` | Android API Research §5: "50-70% less battery drain", still provides 20-100m accuracy |
| **Interval** | `intervalMinutes * 60 * 1000` | `60_000L` (1 minute) | Industry standard for background tracking (Owntracks uses 60-120s) |
| **MinUpdateInterval** | `interval / 2` | `30_000L` | Accept updates as fast as 30s when available |
| **MaxUpdateDelay** | `interval * 2` | `60_000L` | Set ≤2x interval to disable batching (Android API Research §6) |
| **WaitForAccurateLocation** | `true` | `false` | Android API Research §4: "Causes 2-10 second delays... For background tracking, any location is better than none" |

### Battery Impact Comparison

| Configuration | Battery Drain | Accuracy | Notes |
|--------------|---------------|----------|-------|
| **Current (HIGH_ACCURACY)** | ~15-30% per hour | 5-20m | Triggers Samsung throttling |
| **Recommended (BALANCED)** | ~5-10% per hour | 20-100m | Sustainable for all-day tracking |
| **Low Power (if needed)** | ~1-3% per hour | 1-5km | For coarse tracking only |

---

## 7. Implementation Order Summary

### Phase 1: Critical Fixes (Do First)

1. **Switch to PendingIntent** (Action 1.1) — Primary fix for Samsung throttling
2. **Change to BALANCED_POWER_ACCURACY** (Action 1.2) — Reduce battery, avoid triggers
3. **Set waitForAccurateLocation(false)** (Action 1.3) — Quick win

### Phase 2: Resilience (Do Second)

4. **Add health monitoring** (Action 2.1) — Detect and recover from issues
5. **Add periodic restart** (Action 2.2) — Preemptive throttle clearing

### Phase 3: User Experience (Do Third)

6. **Samsung detection + setup prompt** (Action 3.1) — Guide users
7. **Add diagnostics function** (Action 3.2) — Enable debugging

### Phase 4: Future Optimization

8. Significant Motion Sensor (Action 4.1)
9. Geofencing (Action 4.2)

---

## 8. Expected Outcome

After implementing Phase 1-3:

| Metric | Current | Expected |
|--------|---------|----------|
| **Location samples (Samsung, 12 hours)** | 667 first hour, 8 rest | 500-700 continuous |
| **Battery drain** | ~15-30% per hour | ~5-10% per hour |
| **Service reliability** | Throttled after 1 hour | Self-recovering |
| **User configuration issues** | Unknown | Guided setup |

### Success Criteria

- [ ] 100+ location samples per hour consistently on Samsung devices
- [ ] No more than 20% variance hour-to-hour
- [ ] After 6 hours: Still receiving regular updates
- [ ] After screen off: Continues working (no 667→8 pattern)
- [ ] Battery drain: <10% per hour in background

---

## 9. References

- **Samsung Research:** `/docs/research-samsung-location.md`
- **Industry Research:** `/docs/research-industry-location.md`
- **Android API Research:** `/docs/research-android-api-location.md`
- **Current Implementation:**
  - `apps/mobile/modules/expo-background-location/android/src/main/java/expo/modules/backgroundlocation/LocationForegroundService.kt`
  - `apps/mobile/modules/expo-background-location/android/src/main/java/expo/modules/backgroundlocation/LocationWorker.kt`
  - `apps/mobile/modules/expo-background-location/android/src/main/java/expo/modules/backgroundlocation/ExpoBackgroundLocationModule.kt`
  - `apps/mobile/modules/expo-background-location/android/src/main/AndroidManifest.xml`

---

**Document Prepared:** February 9, 2026  
**For Use By:** Master Implementer  
**TodayMatters Android Location Team**
