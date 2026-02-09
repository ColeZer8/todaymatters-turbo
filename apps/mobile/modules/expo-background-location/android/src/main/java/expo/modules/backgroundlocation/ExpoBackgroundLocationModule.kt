package expo.modules.backgroundlocation

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class ExpoBackgroundLocationModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw Exception("React context is null")

    override fun definition() = ModuleDefinition {
        Name("ExpoBackgroundLocation")

        /**
         * Configure Supabase credentials for direct native uploads.
         * Must be called before startLocationTracking.
         */
        AsyncFunction("configureSupabase") { 
            supabaseUrl: String, 
            anonKey: String, 
            jwtToken: String, 
            userId: String,
            promise: Promise ->
            try {
                SupabaseConfig.setConfig(context, supabaseUrl, anonKey, jwtToken, userId)
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("CONFIG_FAILED", e.message, e)
            }
        }

        /**
         * Update the JWT token (e.g., after refresh).
         */
        AsyncFunction("updateJwtToken") { jwtToken: String, promise: Promise ->
            try {
                SupabaseConfig.updateJwtToken(context, jwtToken)
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("UPDATE_TOKEN_FAILED", e.message, e)
            }
        }

        /**
         * Start persistent foreground location tracking.
         * This starts a foreground service that runs continuously until stopped.
         */
        AsyncFunction("startLocationTracking") { userId: String, intervalMinutes: Int, promise: Promise ->
            try {
                // Start the persistent foreground service
                LocationForegroundService.start(context, userId, intervalMinutes)
                
                // Also schedule WorkManager as a backup (in case service is killed without restart)
                scheduleLocationWorker(userId, intervalMinutes)
                
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("START_FAILED", e.message, e)
            }
        }

        /**
         * Stop location tracking and clear all configs.
         */
        AsyncFunction("stopLocationTracking") { promise: Promise ->
            try {
                // Stop the foreground service
                LocationForegroundService.stop(context)
                
                // Cancel WorkManager backup
                cancelLocationWorker()
                
                // Clear Supabase config
                SupabaseConfig.clearConfig(context)
                
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("STOP_FAILED", e.message, e)
            }
        }

        /**
         * Trigger a one-time location collection.
         */
        AsyncFunction("runOneTimeLocationWorker") { userId: String, promise: Promise ->
            try {
                enqueueOneTimeLocationWorker(userId)
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("ONE_TIME_FAILED", e.message, e)
            }
        }

        /**
         * Check if tracking is currently active.
         */
        AsyncFunction("isTracking") { promise: Promise ->
            try {
                // Check if foreground service is running (primary check)
                val serviceRunning = LocationForegroundService.shouldBeRunning(context)
                // Also check WorkManager (backup check)
                val workerScheduled = isWorkerScheduled()
                
                promise.resolve(mapOf("isTracking" to (serviceRunning || workerScheduled)))
            } catch (e: Exception) {
                promise.reject("CHECK_FAILED", e.message, e)
            }
        }

        /**
         * Check if the app is exempt from battery optimization.
         */
        AsyncFunction("isBatteryOptimizationDisabled") { promise: Promise ->
            try {
                val isDisabled = isBatteryOptimizationDisabled()
                promise.resolve(mapOf("isDisabled" to isDisabled))
            } catch (e: Exception) {
                promise.reject("CHECK_BATTERY_FAILED", e.message, e)
            }
        }

        /**
         * Open battery optimization settings for this app.
         * User must manually disable battery optimization for persistent tracking.
         */
        AsyncFunction("requestBatteryOptimizationExemption") { promise: Promise ->
            try {
                openBatteryOptimizationSettings()
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("BATTERY_SETTINGS_FAILED", e.message, e)
            }
        }

        /**
         * Drain pending location samples from local storage.
         */
        AsyncFunction("drainPendingSamples") { userId: String, limit: Int, promise: Promise ->
            try {
                val drained = PendingLocationStore.drainSamples(context, userId, limit)
                promise.resolve(mapOf("samples" to drained.toString()))
            } catch (e: Exception) {
                promise.reject("DRAIN_FAILED", e.message, e)
            }
        }

        /**
         * Peek pending location samples without draining.
         */
        AsyncFunction("peekPendingSamples") { userId: String, limit: Int, promise: Promise ->
            try {
                val peeked = PendingLocationStore.peekSamples(context, userId, limit)
                promise.resolve(mapOf("samples" to peeked.toString()))
            } catch (e: Exception) {
                promise.reject("PEEK_FAILED", e.message, e)
            }
        }

        /**
         * Get count of pending location samples.
         */
        AsyncFunction("getPendingCount") { userId: String, promise: Promise ->
            try {
                val count = PendingLocationStore.getPendingCount(context, userId)
                promise.resolve(mapOf("count" to count))
            } catch (e: Exception) {
                promise.reject("COUNT_FAILED", e.message, e)
            }
        }

        /**
         * Check if Supabase is configured for native uploads.
         */
        AsyncFunction("isSupabaseConfigured") { promise: Promise ->
            try {
                val configured = SupabaseConfig.isConfigured(context)
                promise.resolve(mapOf("configured" to configured))
            } catch (e: Exception) {
                promise.reject("CHECK_CONFIG_FAILED", e.message, e)
            }
        }

        /**
         * Get Samsung device setup information.
         * Samsung Android 11+ requires special handling for background location.
         */
        AsyncFunction("getSamsungSetupInfo") { promise: Promise ->
            try {
                val manufacturer = Build.MANUFACTURER
                val model = Build.MODEL
                val androidVersion = Build.VERSION.SDK_INT
                val isSamsung = manufacturer.equals("samsung", ignoreCase = true)
                
                // Samsung devices running Android 11+ need PendingIntent-based updates
                // and battery optimization exemption
                val setupRequired = isSamsung && androidVersion >= Build.VERSION_CODES.R
                
                promise.resolve(mapOf(
                    "isSamsung" to isSamsung,
                    "manufacturer" to manufacturer,
                    "model" to model,
                    "androidVersion" to androidVersion,
                    "setupRequired" to setupRequired
                ))
            } catch (e: Exception) {
                promise.reject("SAMSUNG_INFO_FAILED", e.message, e)
            }
        }

        /**
         * Get comprehensive diagnostics for troubleshooting location issues.
         */
        AsyncFunction("getDiagnostics") { promise: Promise ->
            try {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                val isIgnoringBatteryOptimizations = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    powerManager.isIgnoringBatteryOptimizations(context.packageName)
                } else {
                    true
                }
                
                val isPowerSaveMode = powerManager.isPowerSaveMode
                
                val appStandbyBucket = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
                    usageStatsManager.appStandbyBucket
                } else {
                    -1
                }
                
                promise.resolve(mapOf(
                    "batteryOptimization" to mapOf(
                        "isIgnoringBatteryOptimizations" to isIgnoringBatteryOptimizations,
                        "isPowerSaveMode" to isPowerSaveMode,
                        "appStandbyBucket" to appStandbyBucket
                    ),
                    "device" to mapOf(
                        "manufacturer" to Build.MANUFACTURER,
                        "model" to Build.MODEL,
                        "androidVersion" to Build.VERSION.SDK_INT,
                        "androidRelease" to Build.VERSION.RELEASE
                    ),
                    "service" to mapOf(
                        "isRunning" to LocationForegroundService.shouldBeRunning(context),
                        "storedUserId" to (LocationForegroundService.getStoredUserId(context) ?: ""),
                        "storedInterval" to LocationForegroundService.getStoredInterval(context)
                    )
                ))
            } catch (e: Exception) {
                promise.reject("DIAGNOSTICS_FAILED", e.message, e)
            }
        }

        /**
         * Open Samsung battery settings to add app to "Never sleeping apps" list.
         * On Samsung devices, this deep links to the specific battery optimization page.
         * On other devices, falls back to standard app details.
         */
        AsyncFunction("openSamsungBatterySettings") { promise: Promise ->
            try {
                val isSamsung = Build.MANUFACTURER.equals("samsung", ignoreCase = true)
                
                val intent = if (isSamsung) {
                    // Samsung-specific deep link to "Never sleeping apps"
                    Intent().apply {
                        action = "com.samsung.android.sm.ACTION_OPEN_CHECKABLE_LISTACTIVITY"
                        putExtra("activity_type", "never_sleeping_apps")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    // Standard battery optimization settings
                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                } else {
                    // Fallback to app details
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                
                try {
                    context.startActivity(intent)
                    promise.resolve(mapOf("success" to true))
                } catch (activityError: Exception) {
                    // If Samsung intent fails, fall back to standard settings
                    val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(fallbackIntent)
                    promise.resolve(mapOf("success" to true, "usedFallback" to true))
                }
            } catch (e: Exception) {
                promise.reject("OPEN_SETTINGS_FAILED", e.message, e)
            }
        }
    }

    /**
     * Check if battery optimization is disabled for this app.
     */
    private fun isBatteryOptimizationDisabled(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            return powerManager.isIgnoringBatteryOptimizations(context.packageName)
        }
        return true // Pre-M devices don't have this restriction
    }

    /**
     * Open battery optimization settings.
     * On API 23+, this opens directly to the app's battery settings.
     */
    private fun openBatteryOptimizationSettings() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        } else {
            Intent(Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
        context.startActivity(intent)
    }

    /**
     * Schedule WorkManager as a backup mechanism.
     * This ensures location collection happens even if the service is killed.
     */
    private fun scheduleLocationWorker(userId: String, intervalMinutes: Int) {
        // Ensure minimum interval of 15 minutes (WorkManager constraint)
        val interval = maxOf(intervalMinutes, 15).toLong()

        val workRequest = PeriodicWorkRequestBuilder<LocationWorker>(
            interval, TimeUnit.MINUTES
        )
            .setInputData(workDataOf("userId" to userId))
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE, // Update to pick up new interval
                workRequest
            )
    }

    private fun cancelLocationWorker() {
        WorkManager.getInstance(context)
            .cancelUniqueWork(WORK_NAME)
    }

    private fun enqueueOneTimeLocationWorker(userId: String) {
        val workRequest = OneTimeWorkRequestBuilder<LocationWorker>()
            .setInputData(workDataOf("userId" to userId))
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                ONE_TIME_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                workRequest
            )
    }

    private fun isWorkerScheduled(): Boolean {
        val workInfos = WorkManager.getInstance(context)
            .getWorkInfosForUniqueWork(WORK_NAME)
            .get()

        return workInfos.any { it.state == WorkInfo.State.ENQUEUED || it.state == WorkInfo.State.RUNNING }
    }

    companion object {
        private const val WORK_NAME = "tm_background_location"
        private const val ONE_TIME_WORK_NAME = "tm_background_location_one_time"
    }
}
