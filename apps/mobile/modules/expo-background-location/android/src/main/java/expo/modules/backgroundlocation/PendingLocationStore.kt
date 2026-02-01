package expo.modules.backgroundlocation

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object PendingLocationStore {
    private const val PREFS_NAME = "tm_background_location"
    private const val KEY_PREFIX = "pending:"
    private const val MAX_PENDING = 10000

    private fun getKey(userId: String): String = "$KEY_PREFIX$userId"

    @Synchronized
    fun appendSample(context: Context, userId: String, sample: JSONObject) {
        if (userId.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(getKey(userId), null)
        val array = if (raw.isNullOrBlank()) JSONArray() else JSONArray(raw)
        array.put(sample)
        val trimmed = if (array.length() > MAX_PENDING) {
            val start = array.length() - MAX_PENDING
            val out = JSONArray()
            for (i in start until array.length()) {
                out.put(array.getJSONObject(i))
            }
            out
        } else {
            array
        }
        prefs.edit().putString(getKey(userId), trimmed.toString()).apply()
    }

    @Synchronized
    fun drainSamples(context: Context, userId: String, limit: Int): JSONArray {
        if (userId.isBlank()) return JSONArray()
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(getKey(userId), null)
        if (raw.isNullOrBlank()) return JSONArray()
        val array = JSONArray(raw)
        val take = if (limit <= 0) array.length() else minOf(limit, array.length())
        val drained = JSONArray()
        for (i in 0 until take) {
            drained.put(array.getJSONObject(i))
        }
        if (take >= array.length()) {
            prefs.edit().remove(getKey(userId)).apply()
        } else {
            val remaining = JSONArray()
            for (i in take until array.length()) {
                remaining.put(array.getJSONObject(i))
            }
            prefs.edit().putString(getKey(userId), remaining.toString()).apply()
        }
        return drained
    }

    @Synchronized
    fun peekSamples(context: Context, userId: String, limit: Int): JSONArray {
        if (userId.isBlank()) return JSONArray()
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(getKey(userId), null)
        if (raw.isNullOrBlank()) return JSONArray()
        val array = JSONArray(raw)
        val take = if (limit <= 0) 0 else minOf(limit, array.length())
        val peeked = JSONArray()
        for (i in 0 until take) {
            peeked.put(array.getJSONObject(i))
        }
        return peeked
    }

    @Synchronized
    fun getPendingCount(context: Context, userId: String): Int {
        if (userId.isBlank()) return 0
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(getKey(userId), null)
        if (raw.isNullOrBlank()) return 0
        return try {
            JSONArray(raw).length()
        } catch (_: Exception) {
            0
        }
    }
}
