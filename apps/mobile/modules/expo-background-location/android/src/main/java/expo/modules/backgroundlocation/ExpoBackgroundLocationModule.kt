package expo.modules.backgroundlocation

import android.content.Context
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

        AsyncFunction("startLocationTracking") { userId: String, intervalMinutes: Int, promise: Promise ->
            try {
                scheduleLocationWorker(userId, intervalMinutes)
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("START_FAILED", e.message, e)
            }
        }

        AsyncFunction("stopLocationTracking") { promise: Promise ->
            try {
                cancelLocationWorker()
                SupabaseConfig.clearConfig(context)
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("STOP_FAILED", e.message, e)
            }
        }

        AsyncFunction("runOneTimeLocationWorker") { userId: String, promise: Promise ->
            try {
                enqueueOneTimeLocationWorker(userId)
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.reject("ONE_TIME_FAILED", e.message, e)
            }
        }

        AsyncFunction("isTracking") { promise: Promise ->
            try {
                val isTracking = isWorkerScheduled()
                promise.resolve(mapOf("isTracking" to isTracking))
            } catch (e: Exception) {
                promise.reject("CHECK_FAILED", e.message, e)
            }
        }

        AsyncFunction("drainPendingSamples") { userId: String, limit: Int, promise: Promise ->
            try {
                val drained = PendingLocationStore.drainSamples(context, userId, limit)
                promise.resolve(mapOf("samples" to drained.toString()))
            } catch (e: Exception) {
                promise.reject("DRAIN_FAILED", e.message, e)
            }
        }

        AsyncFunction("peekPendingSamples") { userId: String, limit: Int, promise: Promise ->
            try {
                val peeked = PendingLocationStore.peekSamples(context, userId, limit)
                promise.resolve(mapOf("samples" to peeked.toString()))
            } catch (e: Exception) {
                promise.reject("PEEK_FAILED", e.message, e)
            }
        }

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
    }

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
                ExistingPeriodicWorkPolicy.KEEP, // Keep existing if already scheduled
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
