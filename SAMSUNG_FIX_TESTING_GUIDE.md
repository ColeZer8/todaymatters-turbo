# Samsung Location Fix — Testing Guide

## Quick Verification

### 1. Build Check
```bash
cd /Users/colezerman/Projects/todaymatters-turbo
npx expo prebuild --clean
# or
cd apps/mobile && npx expo run:android
```

If build succeeds, Kotlin syntax is correct ✅

### 2. Code Verification Checklist

#### ✅ LocationUpdatesBroadcastReceiver.kt
- [x] File created at correct path
- [x] Receives PendingIntent location updates
- [x] Extracts LocationResult from intent
- [x] Forwards to service with ACTION_PROCESS_LOCATION
- [x] All extras included (lat, lng, accuracy, altitude, speed, bearing, time)

#### ✅ LocationForegroundService.kt
- [x] Replaced `locationCallback` with `locationPendingIntent`
- [x] ACTION_PROCESS_LOCATION handling in onStartCommand
- [x] Reconstructs Location object from intent extras
- [x] Changed to PRIORITY_BALANCED_POWER_ACCURACY
- [x] Changed to setWaitForAccurateLocation(false)
- [x] Changed to setMaxUpdateDelayMillis(intervalMs) — no batching
- [x] Creates PendingIntent targeting BroadcastReceiver
- [x] Uses requestLocationUpdates(request, pendingIntent, looper)
- [x] Health monitoring checks every 5 minutes
- [x] Restarts if no location in 10 minutes
- [x] Periodic restart every 30 minutes
- [x] Tracks lastLocationTime in handleNewLocation()
- [x] Stops handlers in stopForegroundTracking()
- [x] ACTION_PROCESS_LOCATION constant added

#### ✅ AndroidManifest.xml
- [x] BroadcastReceiver declaration added
- [x] android:enabled="true"
- [x] android:exported="false"

#### ✅ ExpoBackgroundLocationModule.kt
- [x] getSamsungSetupInfo() added
- [x] getDiagnostics() added
- [x] openSamsungBatterySettings() added
- [x] All return correct data structures

### 3. Runtime Testing

#### Test on ANY Android Device First
```typescript
// 1. Check if service starts
const { isTracking } = await ExpoBackgroundLocation.isTracking();
console.log('Tracking:', isTracking);

// 2. Check diagnostics
const diagnostics = await ExpoBackgroundLocation.getDiagnostics();
console.log('Diagnostics:', diagnostics);

// 3. Check Samsung info
const samsungInfo = await ExpoBackgroundLocation.getSamsungSetupInfo();
console.log('Samsung Info:', samsungInfo);
```

#### Test on Samsung Android 11+ Device
```typescript
// 1. Start tracking
await ExpoBackgroundLocation.configureSupabase(url, key, jwt, userId);
await ExpoBackgroundLocation.startLocationTracking(userId, 15);

// 2. Open battery settings
await ExpoBackgroundLocation.openSamsungBatterySettings();
// User should see Samsung's "Never sleeping apps" page

// 3. Monitor for 2 hours
// Check logs for:
// - "Location updates started (PendingIntent)"
// - "Forwarding location to service"
// - "Periodic restart to prevent Samsung throttling"
// - Regular "New location:" entries

// 4. Check sample count after 2 hours
// Should see ~8 samples per hour (with 15-minute interval)
// NOT dropping to 1-2 samples after hour 1
```

### 4. Expected Log Output

```
LocationForegroundSvc: Location updates started (PendingIntent) with interval=900000ms
LocationUpdatesBR: Received location update broadcast
LocationUpdatesBR: Forwarding location to service: lat=XX.XXXX, lng=-XX.XXXX
LocationForegroundSvc: New location: lat=XX.XXXX, lng=-XX.XXXX
LocationForegroundSvc: Successfully uploaded location to Supabase

... 30 minutes later ...
LocationForegroundSvc: Periodic restart to prevent Samsung throttling
LocationForegroundSvc: Restarting location updates
LocationForegroundSvc: Location updates started (PendingIntent) with interval=900000ms
```

### 5. Diagnostic Output Examples

#### Samsung Device
```json
{
  "isSamsung": true,
  "manufacturer": "samsung",
  "model": "SM-G991U",
  "androidVersion": 33,
  "setupRequired": true
}
```

#### Battery Diagnostics
```json
{
  "batteryOptimization": {
    "isIgnoringBatteryOptimizations": true,  // Should be true!
    "isPowerSaveMode": false,
    "appStandbyBucket": 10  // ACTIVE = 10, WORKING_SET = 20
  },
  "device": {
    "manufacturer": "samsung",
    "model": "SM-G991U",
    "androidVersion": 33,
    "androidRelease": "13"
  },
  "service": {
    "isRunning": true,
    "storedUserId": "abc123",
    "storedInterval": 15
  }
}
```

### 6. Success Criteria

✅ **Build:** Compiles without errors
✅ **Service Start:** PendingIntent-based updates start successfully
✅ **Location Receipt:** BroadcastReceiver receives and forwards locations
✅ **Health Check:** Restarts if no location in 10 minutes
✅ **Periodic Restart:** Restarts every 30 minutes (check logs)
✅ **24-Hour Test:** Consistent sample rate throughout (e.g., ~96 samples for 15-min interval)
✅ **Battery Settings:** Deep link opens Samsung settings page

### 7. Troubleshooting

#### No locations received
- Check permission granted: `ACCESS_FINE_LOCATION` and `ACCESS_BACKGROUND_LOCATION`
- Check battery optimization: `isIgnoringBatteryOptimizations` should be `true`
- Check app standby bucket: Should be `10` (ACTIVE) or `20` (WORKING_SET)

#### Locations stop after 1 hour
- Verify PendingIntent is being used (check logs for "PendingIntent")
- Verify periodic restart is running (check logs for "Periodic restart")
- Verify health check is running (check logs every 5 minutes)

#### Build errors
- Check Kotlin syntax carefully
- Verify all imports are present
- Check that PendingIntent.FLAG_MUTABLE is available (requires compile SDK 31+)

## Quick Commands

```bash
# Build Android
cd apps/mobile && npx expo run:android

# Watch logs
adb logcat | grep -E "LocationForegroundSvc|LocationUpdatesBR"

# Check service running
adb shell dumpsys activity services | grep LocationForegroundService

# Clear data and restart
adb shell pm clear com.todaymatters.app
```

## Next Steps After Testing

1. If 24-hour test passes → Deploy to production
2. If issues persist → Check device-specific logs and diagnostics
3. Monitor Sentry/analytics for location sample rates across Samsung devices
4. Consider adding manual "Force Restart" button in app for edge cases
