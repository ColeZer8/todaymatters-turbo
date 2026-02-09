# Samsung Location Fix — Implementation Complete

## Summary
Implemented critical Samsung Android location fixes to prevent GPS sample throttling on Samsung Android 11+ devices.

**Problem:** Gravy's Samsung phone collected 667 GPS samples in hour 1, then dropped to 8 for the rest of the day.

**Root Cause:** Samsung Android 11+ throttles LocationCallback-based updates but honors PendingIntent-based updates. Also, PRIORITY_HIGH_ACCURACY triggers Samsung's "excessive battery drain" detection.

## Changes Implemented

### 1. ✅ LocationUpdatesBroadcastReceiver.kt (NEW FILE)
**Path:** `apps/mobile/modules/expo-background-location/android/src/main/java/expo/modules/backgroundlocation/LocationUpdatesBroadcastReceiver.kt`

- BroadcastReceiver that receives PendingIntent-based location updates
- Extracts location from `LocationResult.extractResult(intent)`
- Forwards to LocationForegroundService via `ACTION_PROCESS_LOCATION` with lat, lng, accuracy, altitude, speed, bearing, time

### 2. ✅ LocationForegroundService.kt (MODIFIED)
**Path:** `apps/mobile/modules/expo-background-location/android/src/main/java/expo/modules/backgroundlocation/LocationForegroundService.kt`

**Key Changes:**
- **a) Replaced LocationCallback with PendingIntent**
  - Changed `locationCallback: LocationCallback?` → `locationPendingIntent: PendingIntent?`
  
- **b) Added ACTION_PROCESS_LOCATION handling**
  - New action in `onStartCommand()` reconstructs Location from extras and calls `handleNewLocation()`
  
- **c) Refactored startLocationUpdates()**
  - Changed `Priority.PRIORITY_HIGH_ACCURACY` → `Priority.PRIORITY_BALANCED_POWER_ACCURACY`
  - Changed `.setWaitForAccurateLocation(true)` → `.setWaitForAccurateLocation(false)`
  - Changed `.setMaxUpdateDelayMillis(intervalMs * 2)` → `.setMaxUpdateDelayMillis(intervalMs)` (no batching)
  - Creates PendingIntent targeting LocationUpdatesBroadcastReceiver
  - Uses `fusedLocationClient.requestLocationUpdates(request, pendingIntent, looper)`
  
- **d) Updated stopForegroundTracking()**
  - Removes PendingIntent updates and cancels the intent
  - Stops health monitoring and periodic restart handlers
  
- **e) Added Health Monitoring**
  - Handler-based Runnable checks every 5 minutes
  - If no location received in last 10 minutes, restarts location updates
  - Tracks `lastLocationTime` in `handleNewLocation()`
  
- **f) Added Periodic Restart**
  - Handler-based Runnable every 30 minutes
  - Proactively restarts location updates to preempt Samsung throttling
  
- **g) Added companion object constant**
  - `ACTION_PROCESS_LOCATION = "expo.modules.backgroundlocation.ACTION_PROCESS_LOCATION"`

### 3. ✅ AndroidManifest.xml (MODIFIED)
**Path:** `apps/mobile/modules/expo-background-location/android/src/main/AndroidManifest.xml`

Added BroadcastReceiver declaration:
```xml
<receiver
    android:name=".LocationUpdatesBroadcastReceiver"
    android:enabled="true"
    android:exported="false" />
```

### 4. ✅ ExpoBackgroundLocationModule.kt (MODIFIED)
**Path:** `apps/mobile/modules/expo-background-location/android/src/main/java/expo/modules/backgroundlocation/ExpoBackgroundLocationModule.kt`

Added three new AsyncFunctions:

**a) getSamsungSetupInfo()**
- Returns: `isSamsung`, `manufacturer`, `model`, `androidVersion`, `setupRequired`
- Detects if device is Samsung Android 11+ requiring special handling

**b) getDiagnostics()**
- Returns comprehensive diagnostics:
  - Battery optimization status (`isIgnoringBatteryOptimizations`)
  - Power save mode
  - App standby bucket (API 28+)
  - Device info (manufacturer, model, Android version)
  - Service running state
  - Stored userId and interval

**c) openSamsungBatterySettings()**
- Deep links to Samsung's "Never sleeping apps" list
- Uses `com.samsung.android.sm.ACTION_OPEN_CHECKABLE_LISTACTIVITY`
- Falls back to standard app details if not Samsung or if intent fails

## Preserved Functionality
✅ All existing functionality maintained:
- START_STICKY for service restart
- Wake lock for CPU
- WorkManager backup mechanism
- Boot receiver for device restarts
- Supabase upload with fallback to local storage
- Pending location store
- Notification updates
- Same logging style (TAG = "LocationForegroundSvc")

## Technical Details

### Why PendingIntent?
Samsung Android 11+ has aggressive battery optimization that throttles LocationCallback-based updates after an hour. However, PendingIntent-based updates are honored consistently.

### Why BALANCED_POWER_ACCURACY?
Samsung's battery optimization system flags apps using PRIORITY_HIGH_ACCURACY as "excessive battery drain" and throttles them. BALANCED_POWER_ACCURACY provides sufficient accuracy while avoiding detection.

### Why Health Monitoring?
Even with PendingIntent, Samsung may still throttle in extreme cases. Health monitoring detects silent failures and restarts location updates automatically.

### Why Periodic Restart?
Proactive restart every 30 minutes prevents Samsung's throttling logic from accumulating. Fresh location requests reset internal counters.

## Next Steps
1. Build and test on Samsung Android 11+ device
2. Monitor GPS sample collection over 24 hours
3. Check diagnostics using `getDiagnostics()` to verify battery optimization status
4. Guide users to add app to "Never sleeping apps" using `openSamsungBatterySettings()`

## Testing Checklist
- [ ] Code compiles without errors
- [ ] Service starts and receives PendingIntent-based location updates
- [ ] BroadcastReceiver forwards locations to service correctly
- [ ] Health monitoring restarts updates when no location received
- [ ] Periodic restart occurs every 30 minutes
- [ ] Samsung diagnostics return correct device info
- [ ] Battery settings deep link works on Samsung devices
- [ ] 24-hour collection test shows consistent sample rate

## Files Modified
1. `LocationUpdatesBroadcastReceiver.kt` (NEW)
2. `LocationForegroundService.kt` (MODIFIED)
3. `AndroidManifest.xml` (MODIFIED)
4. `ExpoBackgroundLocationModule.kt` (MODIFIED)

All changes follow the specification exactly. No unrelated refactoring performed.
