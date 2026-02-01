package expo.modules.backgroundlocation

import android.content.Context

/**
 * Stores Supabase configuration and auth token for background uploads.
 * Uses SharedPreferences to persist across worker executions.
 */
object SupabaseConfig {
    private const val PREFS_NAME = "tm_supabase_config"
    private const val KEY_URL = "supabase_url"
    private const val KEY_ANON_KEY = "supabase_anon_key"
    private const val KEY_JWT_TOKEN = "jwt_token"
    private const val KEY_USER_ID = "user_id"

    fun setConfig(
        context: Context,
        supabaseUrl: String,
        anonKey: String,
        jwtToken: String,
        userId: String
    ) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_URL, supabaseUrl)
            .putString(KEY_ANON_KEY, anonKey)
            .putString(KEY_JWT_TOKEN, jwtToken)
            .putString(KEY_USER_ID, userId)
            .apply()
    }

    fun updateJwtToken(context: Context, jwtToken: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_JWT_TOKEN, jwtToken)
            .apply()
    }

    fun getSupabaseUrl(context: Context): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_URL, null)
    }

    fun getAnonKey(context: Context): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_ANON_KEY, null)
    }

    fun getJwtToken(context: Context): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_JWT_TOKEN, null)
    }

    fun getUserId(context: Context): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_USER_ID, null)
    }

    fun clearConfig(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply()
    }

    fun isConfigured(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return !prefs.getString(KEY_URL, null).isNullOrBlank() &&
               !prefs.getString(KEY_ANON_KEY, null).isNullOrBlank() &&
               !prefs.getString(KEY_JWT_TOKEN, null).isNullOrBlank()
    }
}
