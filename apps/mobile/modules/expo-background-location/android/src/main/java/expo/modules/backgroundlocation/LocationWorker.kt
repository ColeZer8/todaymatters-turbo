package expo.modules.backgroundlocation

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.Tasks
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

class LocationWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    override suspend fun doWork(): Result {
        Log.d(TAG, "Worker: Starting location collection")
        
        // Set foreground to keep service alive
        setForeground(createForegroundInfo())

        try {
            // Get userId from input data or stored config
            val userId = inputData.getString("userId") 
                ?: SupabaseConfig.getUserId(applicationContext) 
                ?: ""
            
            if (userId.isBlank()) {
                Log.w(TAG, "Worker: No userId available, skipping")
                return Result.failure()
            }

            // Get current location
            val location = getCurrentLocation()

            if (location != null) {
                Log.d(TAG, "Worker: Location collected - lat=${location.latitude}, lng=${location.longitude}")
                
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
                    put("source", "background")
                    put("raw", JSONObject.NULL)
                }

                // Try direct upload to Supabase first
                if (SupabaseConfig.isConfigured(applicationContext)) {
                    val uploaded = SupabaseUploader.uploadSample(applicationContext, sampleJson)
                    if (uploaded) {
                        Log.d(TAG, "Worker: Successfully uploaded to Supabase directly")
                        
                        // Also try to drain and upload any pending samples
                        val pending = SupabaseUploader.drainAndUpload(applicationContext, userId, 50)
                        if (pending > 0) {
                            Log.d(TAG, "Worker: Also uploaded $pending pending samples")
                        }
                        
                        return Result.success(buildOutputData(location))
                    } else {
                        Log.w(TAG, "Worker: Direct upload failed, queueing locally")
                    }
                }

                // Fallback: Queue locally for JS to pick up later
                PendingLocationStore.appendSample(applicationContext, userId, sampleJson)
                Log.d(TAG, "Worker: Queued sample locally (pending count: ${PendingLocationStore.getPendingCount(applicationContext, userId)})")
                
                return Result.success(buildOutputData(location))
            } else {
                Log.w(TAG, "Worker: Failed to get location, will retry")
                return Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Worker: Exception during location collection", e)
            return Result.failure()
        }
    }

    private fun buildOutputData(location: Location) = workDataOf(
        "latitude" to location.latitude,
        "longitude" to location.longitude,
        "accuracy" to if (location.hasAccuracy()) location.accuracy.toDouble() else null,
        "altitude" to if (location.hasAltitude()) location.altitude else null,
        "speed" to if (location.hasSpeed()) location.speed.toDouble() else null,
        "heading" to if (location.hasBearing()) location.bearing.toDouble() else null,
        "timestamp" to System.currentTimeMillis()
    )

    private suspend fun getCurrentLocation(): Location? = withContext(Dispatchers.IO) {
        // Check permissions
        if (ActivityCompat.checkSelfPermission(
                applicationContext,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Worker: Missing location permission")
            return@withContext null
        }

        try {
            // Request current location with high accuracy
            val locationTask = fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                null
            )

            // Wait for location (with timeout)
            Tasks.await(locationTask, 30, TimeUnit.SECONDS)
        } catch (e: Exception) {
            Log.e(TAG, "Worker: Failed to get location from FusedLocationProvider", e)
            null
        }
    }

    private fun createForegroundInfo(): ForegroundInfo {
        val notificationId = NOTIFICATION_ID
        val channelId = CHANNEL_ID
        val title = "TodayMatters Location Tracking"
        val text = "Tracking your location to build your daily schedule"

        // Create notification channel for Android O+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background location tracking for TodayMatters"
            }

            val notificationManager =
                applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }

        // Build notification
        val notification = NotificationCompat.Builder(applicationContext, channelId)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()

        // Specify location foreground service type for Android 14+ (API 34+)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                notificationId, 
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            ForegroundInfo(notificationId, notification)
        }
    }

    companion object {
        private const val TAG = "LocationWorker"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "location_tracking"
    }
}
