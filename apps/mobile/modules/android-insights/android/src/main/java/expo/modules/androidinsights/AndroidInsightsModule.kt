package expo.modules.androidinsights

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private const val TAG = "AndroidInsights"

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

    AsyncFunction("getHealthAuthorizationStatus") {
      runBlocking {
        getHealthAuthorizationStatus()
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

    AsyncFunction("getLatestWorkoutSummaryJson") { options: Map<String, Any?> ->
      runBlocking {
        getLatestWorkoutSummaryJson(options)
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

    // Diagnostic function for production debugging
    AsyncFunction("getUsageStatsDiagnostics") {
      getUsageStatsDiagnostics()
    }
  }

  private fun getUsageAccessAuthorizationStatus(): String {
    Log.d(TAG, "getUsageAccessAuthorizationStatus called")
    Log.d(TAG, "  Build.VERSION.SDK_INT=${Build.VERSION.SDK_INT}")

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
      Log.w(TAG, "  Returning 'unsupported' - SDK version too low")
      return "unsupported"
    }

    val reactContext = appContext.reactContext
    if (reactContext == null) {
      Log.e(TAG, "  Returning 'unknown' - reactContext is null")
      return "unknown"
    }

    Log.d(TAG, "  packageName=${reactContext.packageName}")
    Log.d(TAG, "  uid=${android.os.Process.myUid()}")

    return try {
      val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        Log.d(TAG, "  Using unsafeCheckOpNoThrow (SDK >= Q)")
        appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), reactContext.packageName)
      } else {
        Log.d(TAG, "  Using deprecated checkOpNoThrow (SDK < Q)")
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), reactContext.packageName)
      }

      val modeStr = when (mode) {
        AppOpsManager.MODE_ALLOWED -> "MODE_ALLOWED"
        AppOpsManager.MODE_IGNORED -> "MODE_IGNORED"
        AppOpsManager.MODE_ERRORED -> "MODE_ERRORED"
        AppOpsManager.MODE_DEFAULT -> "MODE_DEFAULT"
        else -> "MODE_UNKNOWN($mode)"
      }
      Log.d(TAG, "  AppOps mode=$modeStr ($mode)")

      val result = if (mode == AppOpsManager.MODE_ALLOWED) "authorized" else "denied"
      Log.d(TAG, "  Returning '$result'")
      result
    } catch (e: Throwable) {
      Log.e(TAG, "  Exception checking usage access: ${e.javaClass.simpleName}: ${e.message}", e)
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
    Log.d(TAG, "getUsageSummaryJson called with range='$range'")

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
      Log.w(TAG, "  Returning null - SDK version too low")
      return null
    }

    val reactContext = appContext.reactContext
    if (reactContext == null) {
      Log.e(TAG, "  Returning null - reactContext is null")
      return null
    }

    // If we don't have permission, return null (caller can show CTA).
    val authStatus = getUsageAccessAuthorizationStatus()
    if (authStatus != "authorized") {
      Log.w(TAG, "  Returning null - usage access not authorized (status=$authStatus)")
      return null
    }

    val (startMs, endMs) = getRangeMillis(range)
    Log.d(TAG, "  Range: startMs=$startMs (${isoFromMillis(startMs)}), endMs=$endMs (${isoFromMillis(endMs)})")

    val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    Log.d(TAG, "  UsageStatsManager obtained")

    val stats: List<UsageStats> = try {
      val result = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMs, endMs) ?: emptyList()
      Log.d(TAG, "  queryUsageStats returned ${result.size} records")
      result
    } catch (e: Throwable) {
      Log.e(TAG, "  queryUsageStats EXCEPTION: ${e.javaClass.simpleName}: ${e.message}", e)
      emptyList()
    }

    val pm = reactContext.packageManager
    val appArray = JSONArray()

    val byPackage = stats
      .filter { it.totalTimeInForeground > 0 }
      .associateBy { it.packageName }

    Log.d(TAG, "  Filtered to ${byPackage.size} packages with foreground time")

    var totalSeconds = 0L
    for (u in byPackage.values) {
      totalSeconds += (u.totalTimeInForeground / 1000L).coerceAtLeast(0L)
    }

    Log.d(TAG, "  Total foreground time: ${totalSeconds}s (${totalSeconds / 60}m)")

    // Sort by foreground time desc, take top 10
    val top = byPackage.values
      .sortedByDescending { it.totalTimeInForeground }
      .take(10)

    for (u in top) {
      val seconds = (u.totalTimeInForeground / 1000L).coerceAtLeast(0L)
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

    val hourlyByApp = mutableMapOf<String, LongArray>()
    val sessions = JSONArray()
    var hourlyBuckets = buildUsageHourlyBucketsSeconds(usageStatsManager, startMs, endMs, hourlyByApp, sessions)
    if (hourlyBuckets.sum() == 0L && totalSeconds > 0L) {
      hourlyBuckets = buildUsageHourlyBucketsFromStats(byPackage.values.toList())
      if (hourlyByApp.isEmpty()) {
        buildUsageHourlyByAppFromStats(byPackage.values.toList(), hourlyByApp)
      }
    }
    val hourlyArray = JSONArray()
    for (i in 0 until hourlyBuckets.size) {
      hourlyArray.put(hourlyBuckets[i])
    }

    val hourlyByAppJson = JSONObject()
    for ((packageName, hourData) in hourlyByApp) {
      val hourJson = JSONObject()
      for (hour in 0 until hourData.size) {
        val seconds = hourData[hour]
        if (seconds > 0L) {
          hourJson.put(hour.toString(), seconds)
        }
      }
      if (hourJson.length() > 0) {
        hourlyByAppJson.put(packageName, hourJson)
      }
    }

    val out = JSONObject()
    out.put("generatedAtIso", isoNow())
    out.put("startIso", isoFromMillis(startMs))
    out.put("endIso", isoFromMillis(endMs))
    out.put("totalSeconds", totalSeconds)
    out.put("topApps", appArray)
    out.put("hourlyBucketsSeconds", hourlyArray)
    out.put("hourlyByApp", hourlyByAppJson)
    out.put("sessions", sessions)

    Log.d(TAG, "  Returning JSON with totalSeconds=$totalSeconds, topApps=${appArray.length()}, sessions=${sessions.length()}")
    if (totalSeconds == 0L) {
      Log.w(TAG, "  WARNING: Total seconds is 0 - no usage data found!")
    }
    return out.toString()
  }

  private fun buildUsageHourlyBucketsSeconds(
    usageStatsManager: UsageStatsManager,
    startMs: Long,
    endMs: Long,
    hourlyByApp: MutableMap<String, LongArray>,
    sessions: JSONArray
  ): LongArray {
    val buckets = LongArray(24) { 0L }
    val events = usageStatsManager.queryEvents(startMs, endMs)
    val event = UsageEvents.Event()

    var currentStart: Long? = null
    var currentPackage: String? = null

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val ts = event.timeStamp
      when (event.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND,
        UsageEvents.Event.ACTIVITY_RESUMED -> {
          if (currentStart != null) {
            addIntervalToBuckets(currentStart!!, ts, buckets)
            if (currentPackage != null) {
              addIntervalToHourlyByApp(currentStart!!, ts, currentPackage!!, hourlyByApp)
              val durationSeconds = ((ts - currentStart!!) / 1000L).coerceAtLeast(0L)
              if (durationSeconds > 0) {
                val session = JSONObject()
                session.put("packageName", currentPackage!!)
                session.put("startIso", isoFromMillis(currentStart!!))
                session.put("endIso", isoFromMillis(ts))
                session.put("durationSeconds", durationSeconds)
                sessions.put(session)
              }
            }
          }
          currentStart = ts
          currentPackage = event.packageName
        }
        UsageEvents.Event.MOVE_TO_BACKGROUND,
        UsageEvents.Event.ACTIVITY_PAUSED -> {
          if (currentStart != null) {
            addIntervalToBuckets(currentStart!!, ts, buckets)
            if (currentPackage != null) {
              addIntervalToHourlyByApp(currentStart!!, ts, currentPackage!!, hourlyByApp)
              val durationSeconds = ((ts - currentStart!!) / 1000L).coerceAtLeast(0L)
              if (durationSeconds > 0) {
                val session = JSONObject()
                session.put("packageName", currentPackage!!)
                session.put("startIso", isoFromMillis(currentStart!!))
                session.put("endIso", isoFromMillis(ts))
                session.put("durationSeconds", durationSeconds)
                sessions.put(session)
              }
            }
            currentStart = null
            currentPackage = null
          }
        }
      }
    }

    if (currentStart != null) {
      addIntervalToBuckets(currentStart!!, endMs, buckets)
      if (currentPackage != null) {
        addIntervalToHourlyByApp(currentStart!!, endMs, currentPackage!!, hourlyByApp)
        val durationSeconds = ((endMs - currentStart!!) / 1000L).coerceAtLeast(0L)
        if (durationSeconds > 0) {
          val session = JSONObject()
          session.put("packageName", currentPackage!!)
          session.put("startIso", isoFromMillis(currentStart!!))
          session.put("endIso", isoFromMillis(endMs))
          session.put("durationSeconds", durationSeconds)
          sessions.put(session)
        }
      }
    }

    return buckets
  }

  private fun buildUsageHourlyBucketsFromStats(stats: List<UsageStats>): LongArray {
    val buckets = LongArray(24) { 0L }
    val cal = Calendar.getInstance()

    for (u in stats) {
      val seconds = (u.totalTimeInForeground / 1000L).coerceAtLeast(0L)
      if (seconds <= 0L) continue
      cal.timeInMillis = u.lastTimeUsed
      val hour = cal.get(Calendar.HOUR_OF_DAY)
      if (hour in 0..23) {
        buckets[hour] += seconds
      }
    }

    return buckets
  }

  private fun buildUsageHourlyByAppFromStats(stats: List<UsageStats>, hourlyByApp: MutableMap<String, LongArray>) {
    val cal = Calendar.getInstance()
    for (u in stats) {
      val seconds = (u.totalTimeInForeground / 1000L).coerceAtLeast(0L)
      if (seconds <= 0L) continue
      cal.timeInMillis = u.lastTimeUsed
      val hour = cal.get(Calendar.HOUR_OF_DAY)
      if (hour !in 0..23) continue
      val buckets = hourlyByApp.getOrPut(u.packageName) { LongArray(24) { 0L } }
      buckets[hour] += seconds
    }
  }

  private fun addIntervalToBuckets(startMs: Long, endMs: Long, buckets: LongArray) {
    if (endMs <= startMs) return
    var current = startMs
    val cal = Calendar.getInstance()

    while (current < endMs) {
      cal.timeInMillis = current
      val hour = cal.get(Calendar.HOUR_OF_DAY)
      cal.set(Calendar.MINUTE, 0)
      cal.set(Calendar.SECOND, 0)
      cal.set(Calendar.MILLISECOND, 0)
      cal.add(Calendar.HOUR_OF_DAY, 1)

      val nextBoundary = cal.timeInMillis
      val segmentEnd = if (nextBoundary < endMs) nextBoundary else endMs
      val seconds = ((segmentEnd - current) / 1000L).coerceAtLeast(0L)
      if (hour in 0..23) {
        buckets[hour] += seconds
      }
      current = segmentEnd
    }
  }

  private fun addIntervalToHourlyByApp(
    startMs: Long,
    endMs: Long,
    packageName: String,
    hourlyByApp: MutableMap<String, LongArray>
  ) {
    if (endMs <= startMs) return
    val buckets = hourlyByApp.getOrPut(packageName) { LongArray(24) { 0L } }
    var current = startMs
    val cal = Calendar.getInstance()

    while (current < endMs) {
      cal.timeInMillis = current
      val hour = cal.get(Calendar.HOUR_OF_DAY)
      cal.set(Calendar.MINUTE, 0)
      cal.set(Calendar.SECOND, 0)
      cal.set(Calendar.MILLISECOND, 0)
      cal.add(Calendar.HOUR_OF_DAY, 1)

      val nextBoundary = cal.timeInMillis
      val segmentEnd = if (nextBoundary < endMs) nextBoundary else endMs
      val seconds = ((segmentEnd - current) / 1000L).coerceAtLeast(0L)
      if (hour in 0..23) {
        buckets[hour] += seconds
      }
      current = segmentEnd
    }
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

  private suspend fun getHealthAuthorizationStatus(): String {
    val reactContext = appContext.reactContext ?: return "denied"
    if (!isHealthConnectAvailable()) return "denied"

    val permissions = requiredHealthPermissions()
    val client = HealthConnectClient.getOrCreate(reactContext)
    val granted = client.permissionController.getGrantedPermissions()

    if (granted.containsAll(permissions)) return "authorized"
    if (granted.intersect(permissions).isEmpty()) return "notDetermined"
    return "denied"
  }

  private fun requiredHealthPermissions(): Set<String> {
    return setOf(
      HealthPermission.getReadPermission(StepsRecord::class),
      HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
      HealthPermission.getReadPermission(HeartRateRecord::class),
      HealthPermission.getReadPermission(SleepSessionRecord::class),
      HealthPermission.getReadPermission(ExerciseSessionRecord::class),
      HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
    )
  }

  private fun overlapSeconds(aStart: Instant, aEnd: Instant, bStart: Instant, bEnd: Instant): Long {
    val start = if (aStart.isAfter(bStart)) aStart else bStart
    val end = if (aEnd.isBefore(bEnd)) aEnd else bEnd
    if (!end.isAfter(start)) return 0L
    return Duration.between(start, end).seconds.coerceAtLeast(0L)
  }

  private fun energyToKilocalories(value: Any?): Double? {
    if (value == null) return null
    return try {
      val method = value.javaClass.getMethod("getKilocalories")
      val result = method.invoke(value)
      (result as? Number)?.toDouble()
    } catch (_: Throwable) {
      null
    }
  }

  private suspend fun getHeartRateAvgBpm(startMs: Long, endMs: Long): Double? {
    val reactContext = appContext.reactContext ?: return null
    if (!isHealthConnectAvailable()) return null
    val client = HealthConnectClient.getOrCreate(reactContext)

    val required = requiredHealthPermissions()
    val granted = client.permissionController.getGrantedPermissions()
    if (!granted.containsAll(required)) return null

    val response = client.aggregate(
      AggregateRequest(
        metrics = setOf(HeartRateRecord.BPM_AVG),
        timeRangeFilter = TimeRangeFilter.between(
          Instant.ofEpochMilli(startMs),
          Instant.ofEpochMilli(endMs)
        )
      )
    )

    val avg = response[HeartRateRecord.BPM_AVG]
    return avg?.toDouble()
  }

  private suspend fun getSleepAsleepSeconds(startMs: Long, endMs: Long): Long? {
    val reactContext = appContext.reactContext ?: return null
    if (!isHealthConnectAvailable()) return null
    val client = HealthConnectClient.getOrCreate(reactContext)

    val required = requiredHealthPermissions()
    val granted = client.permissionController.getGrantedPermissions()
    if (!granted.containsAll(required)) return null

    val rangeStart = Instant.ofEpochMilli(startMs)
    val rangeEnd = Instant.ofEpochMilli(endMs)

    val records = client.readRecords(
      ReadRecordsRequest(
        recordType = SleepSessionRecord::class,
        timeRangeFilter = TimeRangeFilter.between(rangeStart, rangeEnd)
      )
    ).records

    var total = 0L
    for (r in records) {
      total += overlapSeconds(r.startTime, r.endTime, rangeStart, rangeEnd)
    }
    return total
  }

  private suspend fun getActiveEnergyKcal(startMs: Long, endMs: Long): Double? {
    val reactContext = appContext.reactContext ?: return null
    if (!isHealthConnectAvailable()) return null
    val client = HealthConnectClient.getOrCreate(reactContext)

    val required = requiredHealthPermissions()
    val granted = client.permissionController.getGrantedPermissions()
    if (!granted.containsAll(required)) return null

    val response = client.aggregate(
      AggregateRequest(
        metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
        timeRangeFilter = TimeRangeFilter.between(
          Instant.ofEpochMilli(startMs),
          Instant.ofEpochMilli(endMs)
        )
      )
    )

    val energy = response[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]
    return energyToKilocalories(energy)
  }

  private suspend fun getWorkoutsSummary(startMs: Long, endMs: Long): Pair<Int, Long>? {
    val reactContext = appContext.reactContext ?: return null
    if (!isHealthConnectAvailable()) return null
    val client = HealthConnectClient.getOrCreate(reactContext)

    val required = requiredHealthPermissions()
    val granted = client.permissionController.getGrantedPermissions()
    if (!granted.containsAll(required)) return null

    val rangeStart = Instant.ofEpochMilli(startMs)
    val rangeEnd = Instant.ofEpochMilli(endMs)

    val records = client.readRecords(
      ReadRecordsRequest(
        recordType = ExerciseSessionRecord::class,
        timeRangeFilter = TimeRangeFilter.between(rangeStart, rangeEnd)
      )
    ).records

    var count = 0
    var seconds = 0L
    for (r in records) {
      count += 1
      seconds += overlapSeconds(r.startTime, r.endTime, rangeStart, rangeEnd)
    }
    return Pair(count, seconds)
  }

  private suspend fun getLatestWorkoutSummaryJson(options: Map<String, Any?>): String? {
    val startMs = (options["startDateMs"] as? Number)?.toLong()
    val endMs = (options["endDateMs"] as? Number)?.toLong()
    if (startMs == null || endMs == null || endMs <= startMs) return null

    val reactContext = appContext.reactContext ?: return null
    if (!isHealthConnectAvailable()) return null

    val client = HealthConnectClient.getOrCreate(reactContext)
    val required = requiredHealthPermissions()
    val granted = client.permissionController.getGrantedPermissions()
    if (!granted.containsAll(required)) return null

    val rangeStart = Instant.ofEpochMilli(startMs)
    val rangeEnd = Instant.ofEpochMilli(endMs)

    val sessions = client.readRecords(
      ReadRecordsRequest(
        recordType = ExerciseSessionRecord::class,
        timeRangeFilter = TimeRangeFilter.between(rangeStart, rangeEnd)
      )
    ).records

    if (sessions.isEmpty()) return null

    val latest = sessions.maxByOrNull { it.endTime } ?: return null

    val workoutStart = latest.startTime
    val workoutEnd = latest.endTime
    val durationSeconds = overlapSeconds(workoutStart, workoutEnd, workoutStart, workoutEnd)

    val errors = mutableListOf<String>()

    val aggregate = try {
      client.aggregate(
        AggregateRequest(
          metrics = setOf(
            TotalCaloriesBurnedRecord.ENERGY_TOTAL,
            HeartRateRecord.BPM_AVG,
            HeartRateRecord.BPM_MAX,
          ),
          timeRangeFilter = TimeRangeFilter.between(workoutStart, workoutEnd),
        )
      )
    } catch (t: Throwable) {
      errors.add("aggregate: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val totalEnergyKcal: Double? = try {
      val energy = if (aggregate == null) null else aggregate[TotalCaloriesBurnedRecord.ENERGY_TOTAL]
      energyToKilocalories(energy)
    } catch (t: Throwable) {
      errors.add("totalEnergyBurnedKcal: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val avgHr: Double? = try {
      val avg = aggregate?.get(HeartRateRecord.BPM_AVG)
      avg?.toDouble()
    } catch (t: Throwable) {
      errors.add("avgHeartRateBpm: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val maxHr: Double? = try {
      val max = aggregate?.get(HeartRateRecord.BPM_MAX)
      max?.toDouble()
    } catch (t: Throwable) {
      errors.add("maxHeartRateBpm: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val out = JSONObject()
    out.put("workoutStartIso", workoutStart.toString())
    out.put("workoutEndIso", workoutEnd.toString())
    out.put("durationSeconds", durationSeconds)

    if (totalEnergyKcal == null) out.put("totalEnergyBurnedKcal", JSONObject.NULL) else out.put("totalEnergyBurnedKcal", totalEnergyKcal)
    if (avgHr == null) out.put("avgHeartRateBpm", JSONObject.NULL) else out.put("avgHeartRateBpm", avgHr)
    if (maxHr == null) out.put("maxHeartRateBpm", JSONObject.NULL) else out.put("maxHeartRateBpm", maxHr)

    if (errors.isNotEmpty()) {
      val arr = JSONArray()
      errors.forEach { arr.put(it) }
      out.put("errors", arr)
    } else {
      out.put("errors", JSONObject.NULL)
    }

    return out.toString()
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

    val activeEnergyKcal: Double? = try {
      getActiveEnergyKcal(startMs, endMs)
    } catch (t: Throwable) {
      errors.add("activeEnergyKcal: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val heartRateAvgBpm: Double? = try {
      getHeartRateAvgBpm(startMs, endMs)
    } catch (t: Throwable) {
      errors.add("heartRateAvgBpm: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val sleepAsleepSeconds: Long? = try {
      getSleepAsleepSeconds(startMs, endMs)
    } catch (t: Throwable) {
      errors.add("sleepAsleepSeconds: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val workouts: Pair<Int, Long>? = try {
      getWorkoutsSummary(startMs, endMs)
    } catch (t: Throwable) {
      errors.add("workouts: ${t.message ?: t.javaClass.simpleName}")
      null
    }

    val out = JSONObject()
    out.put("generatedAtIso", isoNow())
    out.put("startIso", isoFromMillis(startMs))
    out.put("endIso", isoFromMillis(endMs))

    out.put("steps", steps)

    if (activeEnergyKcal == null) {
      out.put("activeEnergyKcal", JSONObject.NULL)
    } else {
      out.put("activeEnergyKcal", activeEnergyKcal)
    }

    out.put("distanceWalkingRunningMeters", JSONObject.NULL)

    if (heartRateAvgBpm == null) {
      out.put("heartRateAvgBpm", JSONObject.NULL)
    } else {
      out.put("heartRateAvgBpm", heartRateAvgBpm)
    }

    out.put("restingHeartRateAvgBpm", JSONObject.NULL)
    out.put("hrvSdnnAvgSeconds", JSONObject.NULL)

    if (sleepAsleepSeconds == null) {
      out.put("sleepAsleepSeconds", JSONObject.NULL)
    } else {
      out.put("sleepAsleepSeconds", sleepAsleepSeconds)
    }

    if (workouts == null) {
      out.put("workoutsCount", JSONObject.NULL)
      out.put("workoutsDurationSeconds", JSONObject.NULL)
    } else {
      out.put("workoutsCount", workouts.first)
      out.put("workoutsDurationSeconds", workouts.second)
    }

    if (errors.isNotEmpty()) {
      val arr = JSONArray()
      errors.forEach { arr.put(it) }
      out.put("errors", arr)
    } else {
      out.put("errors", JSONObject.NULL)
    }

    return out.toString()
  }

  /**
   * Comprehensive diagnostics function for debugging production issues.
   * Returns detailed information about permission states, API responses, and potential issues.
   */
  private fun getUsageStatsDiagnostics(): String {
    Log.d(TAG, "=== USAGE STATS DIAGNOSTICS START ===")

    val out = JSONObject()
    val errors = mutableListOf<String>()

    // Basic device info
    out.put("diagnosticsVersion", 1)
    out.put("timestamp", isoNow())
    out.put("buildSdkInt", Build.VERSION.SDK_INT)
    out.put("buildRelease", Build.VERSION.RELEASE)
    out.put("buildManufacturer", Build.MANUFACTURER)
    out.put("buildModel", Build.MODEL)
    out.put("minSdkRequired", Build.VERSION_CODES.LOLLIPOP)
    out.put("sdkSupported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP)

    Log.d(TAG, "Device: ${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})")

    val reactContext = appContext.reactContext
    if (reactContext == null) {
      out.put("reactContextAvailable", false)
      errors.add("reactContext is null - native module initialization issue")
      Log.e(TAG, "reactContext is NULL")
    } else {
      out.put("reactContextAvailable", true)
      out.put("packageName", reactContext.packageName)
      out.put("processUid", android.os.Process.myUid())

      Log.d(TAG, "Package: ${reactContext.packageName}, UID: ${android.os.Process.myUid()}")

      // Check AppOps permission
      try {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), reactContext.packageName)
        } else {
          @Suppress("DEPRECATION")
          appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), reactContext.packageName)
        }

        val modeStr = when (mode) {
          AppOpsManager.MODE_ALLOWED -> "MODE_ALLOWED"
          AppOpsManager.MODE_IGNORED -> "MODE_IGNORED"
          AppOpsManager.MODE_ERRORED -> "MODE_ERRORED"
          AppOpsManager.MODE_DEFAULT -> "MODE_DEFAULT"
          else -> "MODE_UNKNOWN($mode)"
        }

        out.put("appOpsMode", mode)
        out.put("appOpsModeString", modeStr)
        out.put("usageAccessGranted", mode == AppOpsManager.MODE_ALLOWED)

        Log.d(TAG, "AppOps USAGE_STATS mode: $modeStr ($mode), granted=${mode == AppOpsManager.MODE_ALLOWED}")

        if (mode != AppOpsManager.MODE_ALLOWED) {
          errors.add("Usage Access permission not granted (mode=$modeStr). User must enable in Settings > Apps > Special access > Usage access")
        }
      } catch (e: Throwable) {
        out.put("appOpsError", e.message ?: e.javaClass.simpleName)
        errors.add("Failed to check AppOps: ${e.javaClass.simpleName}: ${e.message}")
        Log.e(TAG, "AppOps check EXCEPTION", e)
      }

      // Try to query usage stats
      try {
        val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        out.put("usageStatsManagerAvailable", true)

        val now = System.currentTimeMillis()
        val oneDayAgo = now - (24 * 60 * 60 * 1000)

        Log.d(TAG, "Querying usage stats for last 24h: ${isoFromMillis(oneDayAgo)} to ${isoFromMillis(now)}")

        // Try INTERVAL_DAILY
        val dailyStats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, oneDayAgo, now) ?: emptyList()
        out.put("dailyStatsCount", dailyStats.size)
        Log.d(TAG, "INTERVAL_DAILY returned ${dailyStats.size} records")

        // Try INTERVAL_BEST
        val bestStats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_BEST, oneDayAgo, now) ?: emptyList()
        out.put("bestStatsCount", bestStats.size)
        Log.d(TAG, "INTERVAL_BEST returned ${bestStats.size} records")

        // Try INTERVAL_WEEKLY (might have more historical data)
        val weeklyStats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_WEEKLY, oneDayAgo, now) ?: emptyList()
        out.put("weeklyStatsCount", weeklyStats.size)
        Log.d(TAG, "INTERVAL_WEEKLY returned ${weeklyStats.size} records")

        // Try queryEvents
        try {
          val events = usageStatsManager.queryEvents(oneDayAgo, now)
          var eventCount = 0
          var foregroundCount = 0
          var backgroundCount = 0
          val event = UsageEvents.Event()

          while (events.hasNextEvent()) {
            events.getNextEvent(event)
            eventCount++
            when (event.eventType) {
              UsageEvents.Event.MOVE_TO_FOREGROUND, UsageEvents.Event.ACTIVITY_RESUMED -> foregroundCount++
              UsageEvents.Event.MOVE_TO_BACKGROUND, UsageEvents.Event.ACTIVITY_PAUSED -> backgroundCount++
            }
          }

          out.put("usageEventsCount", eventCount)
          out.put("foregroundEventsCount", foregroundCount)
          out.put("backgroundEventsCount", backgroundCount)

          Log.d(TAG, "queryEvents: total=$eventCount, foreground=$foregroundCount, background=$backgroundCount")

          if (eventCount == 0 && dailyStats.isEmpty()) {
            errors.add("Both queryEvents and queryUsageStats returned empty data. This could mean: (1) Permission just granted and no data collected yet, (2) No app usage in time range, (3) System-level issue with usage stats service")
          }
        } catch (e: Throwable) {
          out.put("queryEventsError", e.message ?: e.javaClass.simpleName)
          errors.add("queryEvents failed: ${e.javaClass.simpleName}: ${e.message}")
          Log.e(TAG, "queryEvents EXCEPTION", e)
        }

        // Check for any usage at all in the daily stats
        val nonZeroApps = dailyStats.filter { it.totalTimeInForeground > 0 }
        out.put("appsWithForegroundTime", nonZeroApps.size)

        if (nonZeroApps.isNotEmpty()) {
          val topApp = nonZeroApps.maxByOrNull { it.totalTimeInForeground }
          if (topApp != null) {
            out.put("topAppPackage", topApp.packageName)
            out.put("topAppForegroundMs", topApp.totalTimeInForeground)
            out.put("topAppLastTimeUsed", topApp.lastTimeUsed)
            Log.d(TAG, "Top app: ${topApp.packageName} with ${topApp.totalTimeInForeground}ms foreground")
          }
        } else if (dailyStats.isNotEmpty()) {
          Log.w(TAG, "Got ${dailyStats.size} stats but none have foreground time!")
        }

      } catch (e: Throwable) {
        out.put("usageStatsManagerAvailable", false)
        out.put("usageStatsError", e.message ?: e.javaClass.simpleName)
        errors.add("UsageStatsManager failed: ${e.javaClass.simpleName}: ${e.message}")
        Log.e(TAG, "UsageStatsManager EXCEPTION", e)
      }
    }

    if (errors.isNotEmpty()) {
      val arr = JSONArray()
      errors.forEach { arr.put(it) }
      out.put("errors", arr)
      Log.w(TAG, "Diagnostics found ${errors.size} issues: $errors")
    } else {
      out.put("errors", JSONArray())
      Log.d(TAG, "Diagnostics completed with no issues")
    }

    Log.d(TAG, "=== USAGE STATS DIAGNOSTICS END ===")
    return out.toString()
  }
}


