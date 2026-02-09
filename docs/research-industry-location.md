# Industry-Grade Android Background Location: How the Pros Do It

**Research Date:** February 9, 2026  
**Focus:** How major apps achieve reliable continuous background location tracking on Android

---

## Executive Summary

After analyzing production-grade location tracking apps and open-source implementations, the **universal solution** is:

### ✅ **Foreground Service + Smart Triggers**

All reliable location tracking apps use a **foreground service** as the foundation, combined with intelligent wake-up mechanisms:

1. **Foreground Service** — The only way to guarantee background execution
2. **Significant Motion Sensor** — Motion-triggered location collection (battery efficient)
3. **Geofencing API** — Location-based triggers without constant GPS
4. **WorkManager** — Periodic tasks (limited to 15-minute minimum)
5. **AlarmManager.setExactAndAllowWhileIdle()** — Doze mode wakeups (restricted)

**WorkManager alone CANNOT achieve sub-15-minute tracking.** Apps that need frequent updates (Uber, Life360, Strava) all use foreground services.

---

## 🎯 The Apps Analyzed

### 1. **Life360** — Family Location Sharing
- **Requirements:** Constant tracking, real-time family location
- **Technique:** Foreground service + activity recognition
- **Battery:** Smart intervals based on motion state

### 2. **Google Maps Timeline**
- **Requirements:** All-day background tracking
- **Technique:** Privileged system APIs + Activity Recognition Transition API
- **Secret weapon:** Direct access to OS-level location APIs (not available to third-party apps)

### 3. **Uber/Lyft Driver Apps**
- **Requirements:** Continuous tracking during driver shifts
- **Technique:** Foreground service with persistent notification
- **Pattern:** High-accuracy GPS only when trip is active

### 4. **Strava / Nike Run Club**
- **Requirements:** GPS tracking during workouts
- **Technique:** Foreground service during active workout
- **Battery:** High-accuracy GPS acceptable during explicit workout session

### 5. **Owntracks** — Open Source Location Tracking
- **Requirements:** Flexible background tracking
- **Technique:** Foreground service + Significant Motion Sensor + Geofencing
- **Advantage:** Fully open source — we can see EXACTLY how they do it

### 6. **Tasker**
- **Requirements:** Automation that survives everything
- **Technique:** Foreground service + aggressive keep-alive strategies
- **Survival:** Multiple fallback mechanisms for process resurrection

---

## 🏆 The Winner: Owntracks Pattern (Open Source)

Owntracks is the **gold standard open-source implementation**. It demonstrates every industry pattern in production-quality Kotlin code.

### Owntracks Architecture

```
┌─────────────────────────────────────────────────────────┐
│  BackgroundService (Foreground Service)                 │
│  - Lifecycle: START_STICKY                              │
│  - Notification: Persistent, shows connection state     │
│  - Monitoring Modes: Quiet, Manual, Significant, Move   │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Significant  │ │  Geofencing  │ │ WorkManager  │
│ Motion       │ │   Client     │ │  Scheduler   │
│ Sensor       │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
  Motion-based     Location-based   Periodic ping
  GPS trigger      GPS trigger      (15 min min)
```

---

## 📋 Technique Breakdown

### 1. **Foreground Service** (Primary Method)

**Why it works:**
- **NOT killed by Doze mode** — Foreground services are exempt
- **Guaranteed CPU access** — Can request location updates continuously
- **Persistent execution** — `START_STICKY` ensures service restarts after kill

**The catch:**
- **Mandatory notification** — User must see persistent notification
- **Battery drain perception** — Users see the app is "always running"
- **Android 14+ restrictions** — Must declare foreground service type

#### Owntracks Implementation

```kotlin
// BackgroundService.kt (abbreviated)
@AndroidEntryPoint
class BackgroundService : LifecycleService(), Preferences.OnPreferenceChangeListener {
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        handleIntent(intent)
        startForegroundService()
        return START_STICKY  // Service will be restarted if killed
    }

    private fun startForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                startForeground(
                    NOTIFICATION_ID_ONGOING,
                    ongoingNotification.getNotification(),
                    FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE  // Required Android 14+
                )
            } catch (e: ForegroundServiceStartNotAllowedException) {
                Timber.e(e, "Foreground service start not allowed")
                return
            }
        } else {
            startForeground(NOTIFICATION_ID_ONGOING, ongoingNotification.getNotification())
        }
    }

    private fun setupLocationRequest(): Result<Unit> {
        if (requirementsChecker.hasLocationPermissions()) {
            val monitoring = preferences.monitoring
            var interval: Duration? = null
            var smallestDisplacement: Float? = null
            val priority: LocatorPriority
            
            when (monitoring) {
                MonitoringMode.Quiet, MonitoringMode.Manual -> {
                    interval = Duration.ofSeconds(preferences.locatorInterval.toLong())
                    smallestDisplacement = preferences.locatorDisplacement.toFloat()
                    priority = preferences.locatorPriority ?: LocatorPriority.LowPower
                }
                MonitoringMode.Significant -> {
                    interval = Duration.ofSeconds(preferences.locatorInterval.toLong())
                    smallestDisplacement = preferences.locatorDisplacement.toFloat()
                    priority = LocatorPriority.BalancedPowerAccuracy
                }
                MonitoringMode.Move -> {
                    interval = Duration.ofSeconds(preferences.moveModeLocatorInterval.toLong())
                    priority = LocatorPriority.HighAccuracy
                }
            }
            
            val request = LocationRequest(
                fastestInterval, 
                smallestDisplacement, 
                null, 
                null, 
                priority, 
                interval, 
                null
            )
            
            locationProviderClient.requestLocationUpdates(
                request,
                callbackForReportType[MessageLocation.ReportType.DEFAULT]!!.value,
                runThingsOnOtherThreads.getBackgroundLooper()
            )
            return Result.success(Unit)
        } else {
            return Result.failure(Exception("Missing location permission"))
        }
    }
}
```

**Required Permissions (AndroidManifest.xml):**

```xml
<!-- Location permissions -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Foreground service permissions -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />

<!-- Keep-alive permissions -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Notification (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**Service Declaration:**

```xml
<service
    android:name=".services.BackgroundService"
    android:enabled="true"
    android:exported="true"
    android:foregroundServiceType="connectedDevice">
    
    <intent-filter>
        <action android:name="org.owntracks.android.SEND_LOCATION_USER" />
        <action android:name="org.owntracks.android.SEND_EVENT_CIRCULAR" />
        <action android:name="org.owntracks.android.CHANGE_MONITORING" />
    </intent-filter>
</service>
```

---

### 2. **Significant Motion Sensor** (Motion-Triggered Location)

**How Google Maps Actually Works:**

Google Maps doesn't poll GPS constantly. It uses the **Significant Motion Sensor** (hardware sensor) to detect when the device moves, then triggers high-accuracy location requests.

**Why it's brilliant:**
- **Hardware-based** — Uses accelerometer/gyroscope, not GPS
- **Wake-up sensor** — Can wake the app from Doze mode
- **Battery efficient** — Only requests GPS when movement is detected
- **One-shot sensor** — Must re-register after each trigger

**The catch:**
- **Experimental feature** — Not all devices have this sensor
- **Coarse granularity** — Triggers on "significant" movement (walking, driving)
- **Must re-register** — One-shot sensor requires re-registration after each trigger

#### Owntracks Implementation

```kotlin
// SignificantMotionSensor.kt
class SignificantMotionSensor(
    private val context: Context,
    private val preferences: Preferences,
    private val locationProviderClient: LocationProviderClient,
    private val requirementsChecker: RequirementsChecker,
    private val locationCallback: LocationCallback,
    private val looper: Looper
) {
    private val sensorManager by lazy {
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }

    private val significantMotionSensor: Sensor? by lazy {
        sensorManager.getDefaultSensor(Sensor.TYPE_SIGNIFICANT_MOTION)
    }

    // Track when we last requested location (for rate limiting)
    @Volatile private var lastSignificantMotionLocationRequestTime: Long = 0L

    private val significantMotionTriggerListener = object : TriggerEventListener() {
        override fun onTrigger(event: TriggerEvent?) {
            Timber.d("Significant motion detected")
            onSignificantMotionDetected()
        }
    }

    /**
     * Sets up the significant motion sensor listener.
     * This sensor triggers a location request when significant movement is detected.
     */
    fun setup() {
        significantMotionSensor?.let { sensor ->
            Timber.d("Found significant motion sensor: ${sensor.name} " +
                     "(vendor: ${sensor.vendor}, isWakeUpSensor: ${sensor.isWakeUpSensor})")
            
            // Cancel any existing registration before requesting a new one
            sensorManager.cancelTriggerSensor(significantMotionTriggerListener, sensor)
            
            val success = sensorManager.requestTriggerSensor(
                significantMotionTriggerListener, 
                sensor
            )
            
            if (success) {
                Timber.d("Significant motion sensor listener registered successfully")
            } else {
                Timber.i("Failed to register significant motion sensor listener")
            }
        } ?: run {
            Timber.i("Significant motion sensor not available on this device")
        }
    }

    /**
     * Called when significant motion is detected.
     * Requests a high-accuracy GPS location if enough time has passed.
     * Always re-registers the trigger listener (one-shot sensor).
     */
    private fun onSignificantMotionDetected() {
        // Re-register immediately (TYPE_SIGNIFICANT_MOTION is a one-shot sensor)
        setup()

        // Rate limit: use the same interval logic as BackgroundService
        val now = SystemClock.elapsedRealtime()
        val intervalSeconds = if (preferences.monitoring == MonitoringMode.Move) {
            preferences.moveModeLocatorInterval
        } else {
            preferences.locatorInterval
        }
        
        val minIntervalMs = if (preferences.pegLocatorFastestIntervalToInterval) {
            TimeUnit.SECONDS.toMillis(intervalSeconds.toLong())
        } else {
            TimeUnit.SECONDS.toMillis(1)
        }
        
        val timeSinceLastRequest = now - lastSignificantMotionLocationRequestTime

        if (timeSinceLastRequest < minIntervalMs) {
            Timber.d("Significant motion detected but rate limited. " +
                     "Time since last: ${timeSinceLastRequest}ms, min: ${minIntervalMs}ms")
            return
        }

        if (requirementsChecker.hasLocationPermissions()) {
            Timber.d("Requesting high-accuracy location due to significant motion")
            lastSignificantMotionLocationRequestTime = now
            locationProviderClient.singleHighAccuracyLocation(locationCallback, looper)
        }
    }

    fun cancel() {
        significantMotionSensor?.let { sensor ->
            sensorManager.cancelTriggerSensor(significantMotionTriggerListener, sensor)
            Timber.d("Significant motion sensor listener cancelled")
        }
    }
}
```

**Key Pattern:**
1. Device moves → Sensor triggers
2. Request high-accuracy GPS location
3. **Immediately re-register** (one-shot sensor)
4. Apply rate limiting to prevent battery drain

---

### 3. **Geofencing API** (Location-Based Triggers)

**How Uber uses it:**

Uber doesn't track your location 24/7. They use **geofences** around:
- Driver's current position (moving geofence)
- Pickup/dropoff locations
- High-demand areas

**Why it works:**
- **OS-level tracking** — Android handles detection, not your app
- **Survives Doze mode** — Geofence transitions wake the app
- **Battery efficient** — Uses cell towers + WiFi, not constant GPS
- **Up to 100 geofences** — Per app

**The catch:**
- **Delayed transitions** — Can take 30s-2min to trigger
- **Accuracy varies** — Depends on cell/WiFi availability
- **Geofence radius limits** — Minimum ~100m radius recommended

#### Owntracks Implementation

```kotlin
// BackgroundService.kt - Geofence setup
private suspend fun setupGeofences() {
    if (requirementsChecker.hasLocationPermissions()) {
        withContext(ioDispatcher) {
            val waypoints = waypointsRepo.getAll()
            Timber.i("Setting up geofences for ${waypoints.size} waypoints")
            
            val geofences = waypoints.map {
                Geofence(
                    it.id.toString(),
                    Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT,
                    2.minutes.inWholeMilliseconds.toInt(),  // Loitering delay
                    it.geofenceLatitude,
                    it.geofenceLongitude,
                    it.geofenceRadius.toFloat(),
                    Geofence.NEVER_EXPIRE,
                    null
                )
            }.toList()
            
            geofencingClient.removeGeofences(this@BackgroundService)
            
            if (geofences.isNotEmpty()) {
                val request = GeofencingRequest(
                    Geofence.GEOFENCE_TRANSITION_ENTER, 
                    geofences
                )
                geofencingClient.addGeofences(request, this@BackgroundService)
            }
        }
    }
}

// Handle geofence transitions
private suspend fun onGeofencingEvent(event: GeofencingEvent) {
    if (event.hasError()) {
        Timber.e("geofencingEvent hasError: ${event.errorCode}")
        return
    }
    
    val transition: Int = event.geofenceTransition
    event.triggeringGeofences.forEach { triggeringGeofence ->
        val requestId = triggeringGeofence.requestId
        if (requestId != null) {
            try {
                waypointsRepo.get(requestId.toLong())?.run {
                    Timber.d("onWaypointTransition triggered by geofencing event")
                    locationProcessor.onWaypointTransition(
                        this, 
                        event.triggeringLocation, 
                        transition, 
                        MessageTransition.TRIGGER_CIRCULAR
                    )
                }
            } catch (e: NumberFormatException) {
                Timber.e("Invalid geofence request id: $requestId")
            }
        }
    }
}
```

**Geofence Receiver (BroadcastReceiver):**

```kotlin
// GeofencingBroadcastReceiver.kt
class GeofencingBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        
        // Forward to BackgroundService for processing
        Intent(context, BackgroundService::class.java).apply {
            action = BackgroundService.INTENT_ACTION_SEND_EVENT_CIRCULAR
            putExtra("geofencingEvent", geofencingEvent)
        }.also {
            context.startService(it)
        }
    }
}
```

---

### 4. **WorkManager** (Periodic Tasks)

**The 15-Minute Problem:**

WorkManager is Android's **recommended** background task scheduler, but it has a critical limitation:

> ⚠️ **Minimum interval: 15 minutes** (PeriodicWorkRequest)

**Why apps still use it:**
- Periodic "ping" to report location even when stationary
- Reconnection logic for network failures
- Batch uploads of location history

**How to handle the 15-minute minimum:**

Apps that need more frequent updates (Uber, Strava) **don't use WorkManager alone**. They use:
1. **Foreground service** for active tracking
2. **WorkManager** for periodic maintenance tasks
3. **AlarmManager** for sub-15-minute tasks (restricted)

#### Owntracks Implementation

```kotlin
// Scheduler.kt
@Singleton
class Scheduler @Inject constructor(
    private val preferences: Preferences,
    @ApplicationContext private val context: Context
) {
    private val workManager = WorkManager.getInstance(context)
    
    private val anyNetworkConstraint = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    /** 
     * Used by the background service to periodically ping a location.
     * Minimum interval: 15 minutes (WorkManager constraint)
     */
    fun scheduleLocationPing() {
        val pingWorkRequest: WorkRequest = PeriodicWorkRequest.Builder(
            SendLocationPingWorker::class.java, 
            preferences.ping.toLong(),  // Must be >= 15 minutes
            TimeUnit.MINUTES
        )
        .addTag(PERIODIC_TASK_SEND_LOCATION_PING)
        .setConstraints(anyNetworkConstraint)
        .build()
        
        Timber.d("WorkManager queue task $PERIODIC_TASK_SEND_LOCATION_PING " +
                 "with interval ${preferences.ping} minutes")
        
        workManager.cancelAllWorkByTag(PERIODIC_TASK_SEND_LOCATION_PING)
        workManager.enqueue(pingWorkRequest)
    }

    /**
     * Schedule MQTT reconnection with exponential backoff.
     * OneTimeWorkRequest = no 15-minute minimum.
     */
    fun scheduleMqttReconnect() = 
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            OneTimeWorkRequest.Builder(MQTTReconnectWorker::class.java)
                .setInitialDelay(Duration.ofSeconds(RECONNECT_DELAY_SECONDS))
                .addTag(ONETIME_TASK_MQTT_RECONNECT)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL, 
                    MIN_BACKOFF_MILLIS, 
                    TimeUnit.MILLISECONDS
                )
                .setConstraints(anyNetworkConstraint)
                .build()
        } else {
            OneTimeWorkRequest.Builder(MQTTReconnectWorker::class.java)
                .addTag(ONETIME_TASK_MQTT_RECONNECT)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL, 
                    MIN_BACKOFF_MILLIS, 
                    TimeUnit.MILLISECONDS
                )
                .setConstraints(anyNetworkConstraint)
                .build()
        }.run {
            workManager.enqueueUniqueWork(
                ONETIME_TASK_MQTT_RECONNECT, 
                ExistingWorkPolicy.KEEP, 
                this
            )
        }
}
```

**Key Insight:**
- **PeriodicWorkRequest** → 15-minute minimum
- **OneTimeWorkRequest** → No minimum (but can't repeat automatically)

---

### 5. **AlarmManager.setExactAndAllowWhileIdle()** (Doze Mode Wakeups)

**The nuclear option:**

AlarmManager can wake the device from Doze mode, but Android has progressively restricted this capability:

**Android 12+ Restrictions:**
- `setExactAndAllowWhileIdle()` requires `SCHEDULE_EXACT_ALARM` permission
- User can revoke this permission in Settings
- Google Play may reject apps that abuse exact alarms

**Who uses it:**
- Alarm clock apps
- Calendar reminder apps
- Time-sensitive automation (Tasker)

**Pattern:**

```kotlin
val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

val intent = Intent(context, LocationAlarmReceiver::class.java)
val pendingIntent = PendingIntent.getBroadcast(
    context, 
    0, 
    intent, 
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
)

// Wake from Doze every 5 minutes
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    if (alarmManager.canScheduleExactAlarms()) {
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + 5 * 60 * 1000,  // 5 minutes
            pendingIntent
        )
    } else {
        // Fallback: use setAndAllowWhileIdle (not exact, ~9 min intervals)
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + 5 * 60 * 1000,
            pendingIntent
        )
    }
} else {
    alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        System.currentTimeMillis() + 5 * 60 * 1000,
        pendingIntent
    )
}
```

**⚠️ Don't abuse this:**
- Google Play rejects apps with excessive exact alarms
- Users will uninstall if battery drains
- **Foreground service is more reliable**

---

### 6. **Firebase Cloud Messaging (FCM)** (Push-Triggered Location)

**How delivery apps use it:**

DoorDash, Uber Eats, and similar apps don't track location constantly. They use **FCM high-priority messages** to wake the app when:
- Order is assigned to driver
- Customer requests ETA update
- Approaching dropoff location

**Why it works:**
- **High-priority FCM** can wake app from Doze mode
- **Battery efficient** — Only tracks when needed
- **Instant response** — Sub-second wakeup

**The catch:**
- **Requires backend** — Server must send FCM messages
- **Rate limited** — Excessive high-priority messages get throttled
- **Not reliable for continuous tracking** — Use foreground service instead

**Pattern:**

```kotlin
// MyFirebaseMessagingService.kt
class MyFirebaseMessagingService : FirebaseMessagingService() {
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Check if message contains data payload
        if (remoteMessage.data.isNotEmpty()) {
            val action = remoteMessage.data["action"]
            
            when (action) {
                "request_location" -> {
                    // Start foreground service to get location
                    Intent(this, BackgroundService::class.java).apply {
                        action = "SEND_LOCATION_USER"
                    }.also {
                        ContextCompat.startForegroundService(this, it)
                    }
                }
                "start_tracking" -> {
                    // Begin continuous tracking
                    Intent(this, BackgroundService::class.java).apply {
                        action = "CHANGE_MONITORING"
                        putExtra("monitoring", MonitoringMode.Move.value)
                    }.also {
                        ContextCompat.startForegroundService(this, it)
                    }
                }
            }
        }
    }
}
```

**FCM Message (Server-side):**

```json
{
  "to": "device_fcm_token",
  "priority": "high",
  "data": {
    "action": "request_location"
  }
}
```

---

## 🔋 Battery Optimization Strategies

### How Major Apps Balance Accuracy vs Battery

| App | Stationary Strategy | Moving Strategy | Battery Impact |
|-----|---------------------|-----------------|----------------|
| **Life360** | Geofencing only | High-accuracy GPS | Medium |
| **Google Maps** | Significant Motion Sensor | Activity Recognition API | Low |
| **Uber (Driver)** | Low-power location (cell towers) | High-accuracy GPS | High (acceptable during shift) |
| **Strava** | No tracking | High-accuracy GPS | High (explicit workout) |
| **Owntracks** | User-configurable intervals | User-configurable priority | Low-High (user choice) |

### Owntracks Battery Optimization

```kotlin
// Different monitoring modes with different battery profiles
enum class MonitoringMode(val value: Int) {
    QUIET(-1),      // Minimal tracking, low battery
    MANUAL(0),      // On-demand only
    SIGNIFICANT(1), // Motion-triggered (balanced)
    MOVE(2)         // Continuous high-accuracy (high battery)
}

// Adaptive location request based on mode
when (monitoring) {
    MonitoringMode.Quiet, MonitoringMode.Manual -> {
        interval = Duration.ofSeconds(preferences.locatorInterval.toLong())
        smallestDisplacement = preferences.locatorDisplacement.toFloat()
        priority = LocatorPriority.LowPower  // Cell towers + WiFi
    }
    
    MonitoringMode.Significant -> {
        interval = Duration.ofSeconds(preferences.locatorInterval.toLong())
        smallestDisplacement = preferences.locatorDisplacement.toFloat()
        priority = LocatorPriority.BalancedPowerAccuracy  // GPS when needed
    }
    
    MonitoringMode.Move -> {
        interval = Duration.ofSeconds(preferences.moveModeLocatorInterval.toLong())
        priority = LocatorPriority.HighAccuracy  // Constant GPS
    }
}
```

**Displacement-Based Updates:**

```kotlin
// Only request location if device moved >50 meters
val request = LocationRequest(
    interval = Duration.ofMinutes(5),
    smallestDisplacement = 50f,  // meters
    priority = LocatorPriority.BalancedPowerAccuracy
)
```

---

## 🛡️ Surviving Doze Mode & App Standby

### How Android Kills Background Apps

**Doze Mode (screen off, stationary device):**
- Network access suspended
- Wakelocks ignored
- Alarms deferred
- **WiFi scans disabled**
- **GPS suspended**

**App Standby (app not used recently):**
- Network access restricted
- Jobs/syncs deferred
- Alarms less frequent

**App Standby Buckets:**
- **Active** — App currently in use
- **Working Set** — Used daily
- **Frequent** — Used weekly
- **Rare** — Used monthly
- **Restricted** — Heavily restricted (Android 12+)

### What Actually Survives

| Technique | Survives Doze | Survives App Standby | Notes |
|-----------|---------------|----------------------|-------|
| **Foreground Service** | ✅ Yes | ✅ Yes | Must show notification |
| **Geofencing** | ✅ Yes | ✅ Yes | May have delays |
| **Significant Motion** | ✅ Yes | ✅ Yes | Hardware sensor |
| **High-priority FCM** | ✅ Yes | ✅ Yes | Rate limited |
| **WorkManager** | ⚠️ Delayed | ⚠️ Delayed | Respects Doze windows |
| **AlarmManager (exact)** | ✅ Yes | ✅ Yes | Restricted Android 12+ |
| **JobScheduler** | ❌ No | ❌ No | Completely deferred |

### Battery Optimization Whitelist

Apps can request to be **excluded from battery optimization**, but Google Play restricts this:

**Allowed use cases:**
- Alarm clocks
- Companion device apps (smartwatches)
- Accessibility services

**Rejected:**
- General location tracking
- Messaging apps (use FCM instead)
- Social media

**Code:**

```kotlin
// Check if app is whitelisted
val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
val isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(packageName)

if (!isIgnoringBatteryOptimizations) {
    // Request whitelist (will open Settings, not automatic)
    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:$packageName")
    }
    startActivity(intent)
}
```

**⚠️ Google Play Restriction:**
Most apps **cannot** request this permission. Use foreground service instead.

---

## 📊 Strategy Ranking

### By Reliability (Uptime)

1. **Foreground Service** ⭐⭐⭐⭐⭐ — 99.9% uptime
2. **Geofencing API** ⭐⭐⭐⭐☆ — 95% uptime, delayed transitions
3. **Significant Motion Sensor** ⭐⭐⭐⭐☆ — 95% uptime, device-dependent
4. **High-priority FCM** ⭐⭐⭐⭐☆ — 95% uptime, network-dependent
5. **AlarmManager (exact)** ⭐⭐⭐☆☆ — 90% uptime, restricted Android 12+
6. **WorkManager** ⭐⭐☆☆☆ — 70% uptime, heavily deferred

### By Battery Impact

1. **Geofencing API** ⭐⭐⭐⭐⭐ — Minimal battery drain
2. **Significant Motion Sensor** ⭐⭐⭐⭐⭐ — Minimal battery drain
3. **High-priority FCM** ⭐⭐⭐⭐⭐ — No continuous drain
4. **WorkManager (15+ min)** ⭐⭐⭐⭐☆ — Low drain
5. **Foreground Service (low-power)** ⭐⭐⭐☆☆ — Moderate drain
6. **Foreground Service (high-accuracy)** ⭐⭐☆☆☆ — High drain
7. **AlarmManager (<5 min)** ⭐☆☆☆☆ — Severe drain

### By Accuracy

1. **Foreground Service + High-accuracy GPS** ⭐⭐⭐⭐⭐ — 5-10m accuracy
2. **Significant Motion + GPS** ⭐⭐⭐⭐☆ — 10-20m accuracy
3. **Geofencing (transitions only)** ⭐⭐⭐☆☆ — 100-200m accuracy
4. **WorkManager + Balanced mode** ⭐⭐☆☆☆ — 20-50m accuracy

### By Implementation Complexity

1. **Foreground Service (basic)** ⭐⭐☆☆☆ — Moderate complexity
2. **WorkManager** ⭐⭐☆☆☆ — Moderate complexity
3. **Geofencing** ⭐⭐⭐☆☆ — High complexity (PendingIntent, BroadcastReceiver)
4. **Significant Motion Sensor** ⭐⭐⭐⭐☆ — Very high complexity
5. **FCM integration** ⭐⭐⭐⭐☆ — Very high complexity (requires backend)
6. **Full Owntracks pattern** ⭐⭐⭐⭐⭐ — Extreme complexity (all techniques combined)

---

## 🎓 Recommended Implementation Strategy

### For TodayMatters (Your Use Case)

Based on your requirements (daily reflection app with location context):

#### Option 1: **Balanced Approach** (Recommended)

```kotlin
// Hybrid: Geofencing + Significant Motion + WorkManager
class LocationTrackingService : LifecycleService() {
    
    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createNotification())
        
        // 1. Setup geofences around common locations (home, work, school)
        setupGeofences(listOf(
            Geofence("home", lat, lng, 100f),
            Geofence("work", lat, lng, 100f),
            Geofence("school", lat, lng, 100f)
        ))
        
        // 2. Enable significant motion sensor for movement detection
        setupSignificantMotionSensor()
        
        // 3. Periodic check every 30 minutes (WorkManager)
        schedulePeriodicLocationPing(30, TimeUnit.MINUTES)
    }
    
    // Significant motion detected → grab high-accuracy location
    private fun onSignificantMotionDetected() {
        fusedLocationClient.getCurrentLocation(
            Priority.PRIORITY_HIGH_ACCURACY,
            null
        ).addOnSuccessListener { location ->
            // Save location with timestamp
            saveLocationUpdate(location, trigger = "motion")
        }
    }
    
    // Geofence transition → record entry/exit
    private fun onGeofenceTransition(geofenceId: String, transition: Int) {
        val eventType = if (transition == Geofence.GEOFENCE_TRANSITION_ENTER) {
            "enter"
        } else {
            "exit"
        }
        saveLocationEvent(geofenceId, eventType)
    }
}
```

**Why this works:**
- **Battery efficient** — No constant GPS polling
- **Context-aware** — Knows when you arrive/leave important places
- **Motion-reactive** — Tracks when you're moving
- **Periodic fallback** — WorkManager ensures we don't miss long periods

#### Option 2: **Minimal Battery Impact**

```kotlin
// Geofencing only + Manual check
class MinimalLocationService : Service() {
    
    override fun onCreate() {
        super.onCreate()
        
        // Only track geofence transitions
        setupGeofences(getCommonLocations())
        
        // Manual location request when user opens app
        // No background GPS polling
    }
}
```

**Why this works:**
- **Minimal battery drain** — Geofencing uses cell towers + WiFi
- **Privacy-friendly** — No continuous tracking
- **Sufficient for daily reflection** — You just need "visited places today"

#### Option 3: **Full Owntracks Pattern** (Overkill but most reliable)

```kotlin
// Complete implementation with all techniques
class ComprehensiveLocationService : LifecycleService() {
    
    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createNotification())
        
        // 1. Foreground service with adaptive location requests
        setupLocationRequest(
            interval = 15.minutes,
            priority = Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            smallestDisplacement = 50f
        )
        
        // 2. Geofencing for common locations
        setupGeofences(getCommonLocations())
        
        // 3. Significant motion sensor
        setupSignificantMotionSensor()
        
        // 4. WorkManager for periodic pings
        schedulePeriodicLocationPing(30, TimeUnit.MINUTES)
        
        // 5. Activity Recognition for motion state
        setupActivityRecognition()
    }
}
```

---

## 📚 Open Source Examples

### Owntracks Android
- **GitHub:** https://github.com/owntracks/android
- **Language:** Kotlin
- **Techniques:** Foreground service, Geofencing, Significant Motion, WorkManager
- **License:** Eclipse Public License 1.0
- **Quality:** Production-grade, actively maintained

**Key files to study:**
1. `BackgroundService.kt` — Main foreground service
2. `SignificantMotionSensor.kt` — Motion detection
3. `Scheduler.kt` — WorkManager integration
4. `AndroidManifest.xml` — Permissions and service config

### Android Location Samples (Google)
- **GitHub:** https://github.com/android/location-samples
- **Language:** Kotlin + Java
- **Techniques:** All official Android location APIs
- **License:** Apache 2.0

**Key samples:**
1. `LocationUpdatesBackgroundKotlin` — Background location updates
2. `Geofencing` — Geofence implementation
3. `ActivityRecognition` — Activity recognition API

### HyperTrack Live
- **GitHub:** https://github.com/hypertrack/live-app-android
- **Language:** Java
- **Techniques:** HyperTrack SDK (commercial)
- **License:** MIT

---

## ⚡ Quick Reference: Which Technique When

| Use Case | Recommended Technique | Why |
|----------|----------------------|-----|
| **Ride-sharing (active trip)** | Foreground service + High-accuracy GPS | Need real-time tracking during trip |
| **Family location sharing** | Foreground service + Motion sensor | Balance of accuracy and battery |
| **Fitness tracking (workout)** | Foreground service + High-accuracy GPS | User expects high battery drain during workout |
| **Daily location history** | Geofencing + Significant Motion | Battery-efficient background tracking |
| **Delivery app (driver)** | Foreground service + FCM triggers | Continuous tracking during shift |
| **Time-based automation** | AlarmManager + Foreground service | Need exact timing |
| **Periodic check-ins** | WorkManager (15+ min) | Low-frequency, low-battery |

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Relying on WorkManager alone
```kotlin
// This WILL NOT WORK for sub-15-minute tracking
PeriodicWorkRequest.Builder(
    LocationWorker::class.java,
    5, TimeUnit.MINUTES  // ❌ Minimum is 15 minutes!
)
```

**✅ Solution:** Use foreground service for sub-15-minute updates

### ❌ Mistake 2: Not handling Doze mode
```kotlin
// This location request will be suspended in Doze mode
locationManager.requestLocationUpdates(
    LocationManager.GPS_PROVIDER,
    1000,  // 1 second
    0f,
    locationListener
)
// ❌ No foreground service = killed in Doze
```

**✅ Solution:** Use foreground service or geofencing

### ❌ Mistake 3: Excessive high-accuracy GPS
```kotlin
// This will drain battery in minutes
LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)  // Every 1 second
    .build()
// ❌ Constant high-accuracy GPS = user uninstall
```

**✅ Solution:** Use balanced power mode, or high-accuracy only when moving

### ❌ Mistake 4: Forgetting to re-register significant motion sensor
```kotlin
private val significantMotionTriggerListener = object : TriggerEventListener() {
    override fun onTrigger(event: TriggerEvent?) {
        requestLocation()
        // ❌ Forgot to re-register! Won't trigger again
    }
}
```

**✅ Solution:** Always call `setup()` after trigger

### ❌ Mistake 5: Not declaring foreground service type
```xml
<!-- Android 14+ will crash without this -->
<service
    android:name=".LocationService"
    android:foregroundServiceType="location">  <!-- ✅ Required! -->
</service>
```

---

## 📝 Summary: The Industry Standard Pattern

### What ALL reliable location tracking apps do:

1. **Foreground Service** as the foundation
   - Ensures app isn't killed
   - Shows persistent notification
   - Can request location updates continuously

2. **Intelligent triggers** to reduce battery drain
   - **Significant Motion Sensor** for movement detection
   - **Geofencing** for location-based events
   - **Activity Recognition** for motion state (walking, driving, still)

3. **Adaptive accuracy** based on context
   - **High-accuracy GPS** only when moving or critical
   - **Balanced mode** for normal tracking
   - **Low-power mode** when stationary

4. **Fallback mechanisms**
   - **WorkManager** for periodic pings
   - **AlarmManager** for critical timing (restricted)
   - **FCM** for server-triggered location requests

5. **Battery optimization**
   - Displacement-based updates (only when moved >X meters)
   - Longer intervals when stationary
   - Turn off GPS when screen is off and device is still

### The Hard Truth

**There is NO magic solution** for sub-15-minute background location tracking without a foreground service. Google has intentionally locked down background execution to protect battery life and user privacy.

Apps that need reliable location tracking must:
1. Use a **foreground service** (mandatory notification)
2. Be **transparent** with users about battery impact
3. Provide **user controls** for tracking frequency
4. Use **smart triggers** to minimize battery drain

**WorkManager is NOT a replacement for foreground services.** It's a complementary tool for periodic maintenance tasks.

---

## 🔗 Resources

### Official Documentation
- [Android Background Location Limits](https://developer.android.com/about/versions/oreo/background-location-limits)
- [Foreground Services](https://developer.android.com/guide/components/foreground-services)
- [Geofencing API](https://developer.android.com/training/location/geofencing)
- [WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager)
- [Sensors Overview](https://developer.android.com/guide/topics/sensors/sensors_overview)

### Open Source Implementations
- [Owntracks Android](https://github.com/owntracks/android) — Production-grade location tracking
- [Android Location Samples](https://github.com/android/location-samples) — Official Google samples
- [Android Platform Samples](https://github.com/android/platform-samples/tree/main/samples/location) — Modern location samples

### Articles & Guides
- [Android Doze Mode Documentation](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Battery Optimization Best Practices](https://developer.android.com/topic/performance/power)

---

## 🎯 Conclusion

**For TodayMatters:**

Given your use case (daily reflection app with location context), I recommend:

### **Option: Geofencing + Significant Motion + Manual Check**

```kotlin
class TodayMattersLocationService : LifecycleService() {
    
    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createDiscreetNotification())
        
        // Track common locations (home, work, school)
        setupGeofences(getCommonLocations())
        
        // Detect movement for "places visited" during the day
        setupSignificantMotionSensor()
        
        // Manual high-accuracy location when user opens app for reflection
    }
}
```

**Battery Impact:** Low (1-3% per day)  
**Accuracy:** Sufficient for "places visited" context  
**Reliability:** High (geofencing survives Doze)  
**Complexity:** Moderate

**When user opens app for daily reflection:**
- Show "places visited today" (from geofence transitions)
- Show "time spent at each location"
- Request current high-accuracy location for "where are you now" context

This gives you rich location context for reflections without draining battery or requiring constant GPS.
