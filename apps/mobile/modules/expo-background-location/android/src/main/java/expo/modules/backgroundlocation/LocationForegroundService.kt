package expo.modules.backgroundlocation

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.math.roundToLong

/**
 * Persistent ForegroundService for continuous location tracking.
 * This service runs continuously while tracking is enabled, ensuring
 * the notification stays visible and Android doesn't kill the process.
 */
class LocationForegroundService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationPendingIntent: PendingIntent? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    private var userId: String = ""
    private var intervalMinutes: Int = 15
    private var isRunning = false
    private var lastLocationTime: Long = 0
    
    // Health monitoring: Check if we're still receiving locations
    private val healthCheckRunnable = object : Runnable {
        override fun run() {
            val timeSinceLastLocation = System.currentTimeMillis() - lastLocationTime
            val tenMinutesMs = 10 * 60 * 1000L
            
            if (lastLocationTime > 0 && timeSinceLastLocation > tenMinutesMs) {
                Log.w(TAG, "No location received in ${timeSinceLastLocation / 1000 / 60} minutes, restarting updates")
                restartLocationUpdates()
            }
            
            // Check again in 5 minutes
            handler.postDelayed(this, 5 * 60 * 1000L)
        }
    }
    
    // Periodic restart: Proactively restart every 30 minutes to preempt Samsung throttling
    private val periodicRestartRunnable = object : Runnable {
        override fun run() {
            Log.d(TAG, "Periodic restart to prevent Samsung throttling")
            restartLocationUpdates()
            
            // Restart again in 30 minutes
            handler.postDelayed(this, 30 * 60 * 1000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service onCreate")
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service onStartCommand, action=${intent?.action}")
        
        when (intent?.action) {
            ACTION_START -> {
                userId = intent.getStringExtra(EXTRA_USER_ID) ?: ""
                intervalMinutes = intent.getIntExtra(EXTRA_INTERVAL_MINUTES, 15)
                
                if (userId.isBlank()) {
                    Log.e(TAG, "No userId provided, stopping service")
                    stopSelf()
                    return START_NOT_STICKY
                }
                
                startForegroundTracking()
            }
            ACTION_STOP -> {
                stopForegroundTracking()
                stopSelf()
            }
            ACTION_PROCESS_LOCATION -> {
                // Location forwarded from BroadcastReceiver
                val latitude = intent.getDoubleExtra(LocationUpdatesBroadcastReceiver.EXTRA_LATITUDE, 0.0)
                val longitude = intent.getDoubleExtra(LocationUpdatesBroadcastReceiver.EXTRA_LONGITUDE, 0.0)
                val accuracy = intent.getFloatExtra(LocationUpdatesBroadcastReceiver.EXTRA_ACCURACY, -1f)
                val altitude = intent.getDoubleExtra(LocationUpdatesBroadcastReceiver.EXTRA_ALTITUDE, Double.NaN)
                val speed = intent.getFloatExtra(LocationUpdatesBroadcastReceiver.EXTRA_SPEED, -1f)
                val bearing = intent.getFloatExtra(LocationUpdatesBroadcastReceiver.EXTRA_BEARING, -1f)
                val time = intent.getLongExtra(LocationUpdatesBroadcastReceiver.EXTRA_TIME, System.currentTimeMillis())
                
                // Reconstruct Location object
                val location = Location("fused").apply {
                    this.latitude = latitude
                    this.longitude = longitude
                    if (accuracy >= 0) this.accuracy = accuracy
                    if (!altitude.isNaN()) this.altitude = altitude
                    if (speed >= 0) this.speed = speed
                    if (bearing >= 0) this.bearing = bearing
                    this.time = time
                }
                
                handleNewLocation(location)
            }
        }
        
        // START_STICKY ensures Android restarts the service if it's killed
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.d(TAG, "Service onDestroy")
        stopForegroundTracking()
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun startForegroundTracking() {
        if (isRunning) {
            Log.d(TAG, "Already running, updating notification")
            updateNotification("Tracking your location")
            return
        }

        Log.d(TAG, "Starting foreground tracking for user=$userId, interval=$intervalMinutes min")

        // Acquire partial wake lock to keep CPU running for location updates
        acquireWakeLock()

        // Start as foreground service with persistent notification
        val notification = createNotification("Tracking your location")
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Start location updates
        startLocationUpdates()
        
        // Start health monitoring (checks every 5 minutes)
        handler.postDelayed(healthCheckRunnable, 5 * 60 * 1000L)
        
        // Start periodic restart (every 30 minutes)
        handler.postDelayed(periodicRestartRunnable, 30 * 60 * 1000L)
        
        isRunning = true
        
        // Store running state
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_IS_RUNNING, true)
            .putString(KEY_USER_ID, userId)
            .putInt(KEY_INTERVAL, intervalMinutes)
            .apply()
    }

    private fun stopForegroundTracking() {
        Log.d(TAG, "Stopping foreground tracking")
        
        isRunning = false
        
        // Stop location updates
        locationPendingIntent?.let {
            fusedLocationClient.removeLocationUpdates(it)
            it.cancel()
            locationPendingIntent = null
        }

        // Stop health monitoring and periodic restart
        handler.removeCallbacks(healthCheckRunnable)
        handler.removeCallbacks(periodicRestartRunnable)

        // Release wake lock
        releaseWakeLock()

        // Clear running state
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_IS_RUNNING, false)
            .apply()

        // Stop foreground
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun startLocationUpdates() {
        // Check permissions
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
            != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) 
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Location permission not granted")
            return
        }

        // Build location request
        val intervalMs = (intervalMinutes * 60 * 1000).toLong()
        
        // Use BALANCED_POWER_ACCURACY instead of HIGH_ACCURACY to avoid Samsung's
        // "excessive battery drain" detection, and disable batching to get immediate updates
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2) // Allow faster updates if available
            .setMaxUpdateDelayMillis(intervalMs)        // No batching - deliver immediately
            .setWaitForAccurateLocation(false)          // Don't wait for high accuracy
            .build()

        // Create PendingIntent for location updates
        // Samsung Android 11+ throttles LocationCallback but honors PendingIntent
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
        
        Log.d(TAG, "Location updates started (PendingIntent) with interval=${intervalMs}ms")
    }
    
    private fun restartLocationUpdates() {
        Log.d(TAG, "Restarting location updates")
        
        // Stop current updates
        locationPendingIntent?.let {
            fusedLocationClient.removeLocationUpdates(it)
        }
        
        // Start fresh
        startLocationUpdates()
    }

    private fun handleNewLocation(location: Location) {
        Log.d(TAG, "New location: lat=${location.latitude}, lng=${location.longitude}")
        
        // Track time of last location for health monitoring
        lastLocationTime = System.currentTimeMillis()
        
        serviceScope.launch {
            try {
                val recordedAtMs = if (location.time > 0) location.time else System.currentTimeMillis()
                val sampleJson = JSONObject().apply {
                    put("recorded_at", Instant.ofEpochMilli(recordedAtMs).toString())
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("accuracy_m", if (location.hasAccuracy()) location.accuracy.toDouble() else JSONObject.NULL)
                    put("altitude_m", if (location.hasAltitude()) location.altitude else JSONObject.NULL)
                    put("speed_mps", if (location.hasSpeed()) location.speed.toDouble() else JSONObject.NULL)
                    put("heading_deg", if (location.hasBearing()) location.bearing.toDouble() else JSONObject.NULL)
                    put("is_mocked", JSONObject.NULL)
                    put("source", "foreground_service")
                    put("raw", JSONObject.NULL)
                }

                // Try direct upload to Supabase
                if (SupabaseConfig.isConfigured(applicationContext)) {
                    val uploaded = SupabaseUploader.uploadSample(applicationContext, sampleJson)
                    if (uploaded) {
                        Log.d(TAG, "Successfully uploaded location to Supabase")
                        
                        // Also drain any pending samples
                        val pending = SupabaseUploader.drainAndUpload(applicationContext, userId, 50)
                        if (pending > 0) {
                            Log.d(TAG, "Also uploaded $pending pending samples")
                        }
                        
                        updateNotification("Last update: ${java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date())}")
                        return@launch
                    }
                }

                // Fallback: Queue locally
                PendingLocationStore.appendSample(applicationContext, userId, sampleJson)
                Log.d(TAG, "Queued location locally (pending: ${PendingLocationStore.getPendingCount(applicationContext, userId)})")
                updateNotification("Queued locally (offline)")
                
            } catch (e: Exception) {
                Log.e(TAG, "Error handling location", e)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW  // Changed from DEFAULT to LOW to be less intrusive
            ).apply {
                description = "TodayMatters background location tracking"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                // Prevent user from disabling the channel (more persistent)
                setBypassDnd(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String): Notification {
        // Create intent to open app when notification is tapped
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                this, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } else null

        // Create stop action
        val stopIntent = Intent(this, LocationForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TodayMatters Location")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation) // TODO: Use app icon
            .setOngoing(true)           // Cannot be swiped away
            .setAutoCancel(false)       // Don't dismiss on tap
            .setPriority(NotificationCompat.PRIORITY_LOW)  // Low priority = less intrusive
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .apply {
                pendingIntent?.let { setContentIntent(it) }
            }
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Stop Tracking",
                stopPendingIntent
            )
            .build()
    }

    private fun updateNotification(text: String) {
        val notification = createNotification(text)
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "TodayMatters:LocationWakeLock"
            ).apply {
                setReferenceCounted(false)
            }
        }
        wakeLock?.acquire(10 * 60 * 60 * 1000L) // 10 hours max
        Log.d(TAG, "Wake lock acquired")
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d(TAG, "Wake lock released")
            }
        }
        wakeLock = null
    }

    companion object {
        private const val TAG = "LocationForegroundSvc"
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "tm_location_tracking"
        
        const val ACTION_START = "expo.modules.backgroundlocation.ACTION_START"
        const val ACTION_STOP = "expo.modules.backgroundlocation.ACTION_STOP"
        const val ACTION_PROCESS_LOCATION = "expo.modules.backgroundlocation.ACTION_PROCESS_LOCATION"
        const val EXTRA_USER_ID = "user_id"
        const val EXTRA_INTERVAL_MINUTES = "interval_minutes"
        
        private const val PREFS_NAME = "tm_location_service"
        private const val KEY_IS_RUNNING = "is_running"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_INTERVAL = "interval"

        /**
         * Check if the service should be running (persisted state).
         */
        fun shouldBeRunning(context: Context): Boolean {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_IS_RUNNING, false)
        }

        /**
         * Get stored user ID.
         */
        fun getStoredUserId(context: Context): String? {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_USER_ID, null)
        }

        /**
         * Get stored interval.
         */
        fun getStoredInterval(context: Context): Int {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getInt(KEY_INTERVAL, 15)
        }

        /**
         * Start the foreground service.
         */
        fun start(context: Context, userId: String, intervalMinutes: Int) {
            val intent = Intent(context, LocationForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_USER_ID, userId)
                putExtra(EXTRA_INTERVAL_MINUTES, intervalMinutes)
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /**
         * Stop the foreground service.
         */
        fun stop(context: Context) {
            val intent = Intent(context, LocationForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
