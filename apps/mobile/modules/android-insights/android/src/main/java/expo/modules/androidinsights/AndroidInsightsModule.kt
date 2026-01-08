package expo.modules.androidinsights

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class AndroidInsightsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AndroidInsights")

    // MARK: - Health Connect

    AsyncFunction("isHealthConnectAvailable") {
      isHealthConnectAvailable()
    }

    AsyncFunction("openHealthConnectSettings") {
      openHealthConnectSettings()
    }

    AsyncFunction("requestHealthAuthorization") {
      runBlocking {
        requestHealthAuthorization()
      }
    }

    AsyncFunction("getHealthSummaryJson") { options: Map<String, Any?> ->
      // Keep a consistent contract shape (mirrors iOS HealthSummary).
      // For now, implement only steps aggregation. Everything else remains null.
      runBlocking {
        getHealthSummaryJson(options)
      }
    }

    AsyncFunction("getStepCountSum") { options: Map<String, Any?> ->
      runBlocking {
        getStepCountSum(options)
      }
    }

    // MARK: - Usage stats ("Screen Time"-ish)

    AsyncFunction("getUsageAccessAuthorizationStatus") {
      getUsageAccessAuthorizationStatus()
    }

    AsyncFunction("openUsageAccessSettings") {
      openUsageAccessSettings()
    }

    AsyncFunction("getUsageSummaryJson") { range: String ->
      getUsageSummaryJson(range)
    }
  }

  private fun getUsageAccessAuthorizationStatus(): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return "unsupported"
    val reactContext = appContext.reactContext ?: return "unknown"

    return try {
      val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), reactContext.packageName)
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), reactContext.packageName)
      }
      if (mode == AppOpsManager.MODE_ALLOWED) "authorized" else "denied"
    } catch (_: Throwable) {
      "unknown"
    }
  }

  private fun openUsageAccessSettings() {
    val reactContext = appContext.reactContext ?: return
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.startActivity(intent)
  }

  private fun getUsageSummaryJson(range: String): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return null
    val reactContext = appContext.reactContext ?: return null

    // If we don't have permission, return null (caller can show CTA).
    if (getUsageAccessAuthorizationStatus() != "authorized") return null

    val (startMs, endMs) = getRangeMillis(range)

    val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val stats: List<UsageStats> = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMs, endMs) ?: emptyList()

    val pm = reactContext.packageManager
    val appArray = JSONArray()

    var totalSeconds = 0L
    val byPackage = stats
      .filter { it.totalTimeInForeground > 0 }
      .associateBy { it.packageName }

    // Sort by foreground time desc, take top 10
    val top = byPackage.values
      .sortedByDescending { it.totalTimeInForeground }
      .take(10)

    for (u in top) {
      val seconds = (u.totalTimeInForeground / 1000L).coerceAtLeast(0L)
      totalSeconds += seconds
      val label = try {
        val appInfo = pm.getApplicationInfo(u.packageName, 0)
        pm.getApplicationLabel(appInfo)?.toString() ?: u.packageName
      } catch (_: Throwable) {
        u.packageName
      }

      val obj = JSONObject()
      obj.put("packageName", u.packageName)
      obj.put("displayName", label)
      obj.put("durationSeconds", seconds)
      appArray.put(obj)
    }

    val out = JSONObject()
    out.put("generatedAtIso", isoNow())
    out.put("startIso", isoFromMillis(startMs))
    out.put("endIso", isoFromMillis(endMs))
    out.put("totalSeconds", totalSeconds)
    out.put("topApps", appArray)
    return out.toString()
  }

  private fun getRangeMillis(range: String): Pair<Long, Long> {
    val now = System.currentTimeMillis()
    val cal = Calendar.getInstance()
    cal.timeInMillis = now

    when (range) {
      "today" -> {
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return Pair(cal.timeInMillis, now)
      }
      "week" -> {
        cal.add(Calendar.DAY_OF_YEAR, -6)
      }
      "month" -> {
        cal.add(Calendar.DAY_OF_YEAR, -29)
      }
      "year" -> {
        cal.add(Calendar.DAY_OF_YEAR, -364)
      }
      else -> {
        // Default to "today" semantics for unknown input.
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return Pair(cal.timeInMillis, now)
      }
    }

    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return Pair(cal.timeInMillis, now)
  }

  private fun isoNow(): String = isoFromMillis(System.currentTimeMillis())

  private fun isoFromMillis(ms: Long): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    fmt.timeZone = TimeZone.getTimeZone("UTC")
    return fmt.format(Date(ms))
  }

  // MARK: - Health Connect

  private fun isHealthConnectAvailable(): Boolean {
    val reactContext = appContext.reactContext ?: return false
    val status = HealthConnectClient.getSdkStatus(reactContext)
    return status == HealthConnectClient.SDK_AVAILABLE
  }

  private fun openHealthConnectSettings() {
    val reactContext = appContext.reactContext ?: return
    val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.startActivity(intent)
  }

  /**
   * Pragmatic permission flow for Expo modules:
   * - We cannot reliably wire ActivityResult contracts from a module without additional plumbing.
   * - Instead, we deep-link into Health Connect settings and return whether permissions are already granted.
   *
   * The JS dev screen can guide the user: open settings → come back → re-check and fetch data.
   */
  private suspend fun requestHealthAuthorization(): Boolean {
    val reactContext = appContext.reactContext ?: return false
    if (!isHealthConnectAvailable()) return false

    val permissions = requiredHealthPermissions()
    val client = HealthConnectClient.getOrCreate(reactContext)
    val granted = client.permissionController.getGrantedPermissions()
    if (granted.containsAll(permissions)) return true

    // Open settings so the user can grant permissions, then return false for now.
    // Caller should re-check via a subsequent call.
    openHealthConnectSettings()
    return false
  }

  private fun requiredHealthPermissions(): Set<String> {
    return setOf(
      HealthPermission.getReadPermission(StepsRecord::class)
    )
  }

  private suspend fun getStepCountSum(options: Map<String, Any?>): Long {
    val reactContext = appContext.reactContext ?: return 0L
    if (!isHealthConnectAvailable()) return 0L

    val startMs = (options["startDateMs"] as? Number)?.toLong()
    val endMs = (options["endDateMs"] as? Number)?.toLong()
    if (startMs == null || endMs == null || endMs <= startMs) return 0L

    val client = HealthConnectClient.getOrCreate(reactContext)
    val required = requiredHealthPermissions()
    val granted = client.permissionController.getGrantedPermissions()
    if (!granted.containsAll(required)) return 0L

    val response = client.aggregate(
      AggregateRequest(
        metrics = setOf(StepsRecord.COUNT_TOTAL),
        timeRangeFilter = TimeRangeFilter.between(
          Instant.ofEpochMilli(startMs),
          Instant.ofEpochMilli(endMs)
        )
      )
    )

    // The result may be null if no data exists in the requested range.
    return (response[StepsRecord.COUNT_TOTAL] ?: 0L)
  }

  private suspend fun getHealthSummaryJson(options: Map<String, Any?>): String? {
    val startMs = (options["startDateMs"] as? Number)?.toLong()
    val endMs = (options["endDateMs"] as? Number)?.toLong()
    if (startMs == null || endMs == null || endMs <= startMs) return null

    val errors = mutableListOf<String>()
    val steps: Long? = try {
      getStepCountSum(options)
    } catch (t: Throwable) {
      errors.add("steps: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val out = JSONObject()
    out.put("generatedAtIso", isoNow())
    out.put("startIso", isoFromMillis(startMs))
    out.put("endIso", isoFromMillis(endMs))

    out.put("steps", steps)
    out.put("activeEnergyKcal", JSONObject.NULL)
    out.put("distanceWalkingRunningMeters", JSONObject.NULL)
    out.put("heartRateAvgBpm", JSONObject.NULL)
    out.put("restingHeartRateAvgBpm", JSONObject.NULL)
    out.put("hrvSdnnAvgSeconds", JSONObject.NULL)
    out.put("sleepAsleepSeconds", JSONObject.NULL)
    out.put("workoutsCount", JSONObject.NULL)
    out.put("workoutsDurationSeconds", JSONObject.NULL)

    if (errors.isNotEmpty()) {
      val arr = JSONArray()
      errors.forEach { arr.put(it) }
      out.put("errors", arr)
    } else {
      out.put("errors", JSONObject.NULL)
    }

    return out.toString()
  }
}


