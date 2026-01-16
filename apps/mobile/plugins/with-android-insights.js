const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds required Android permissions + manifest tweaks for:
 * - UsageStatsManager ("screen time-ish")
 *
 * Official refs:
 * - UsageStatsManager: https://developer.android.com/reference/kotlin/android/app/usage/UsageStatsManager
 * - Usage access settings intent: https://developer.android.com/reference/android/provider/Settings#ACTION_USAGE_ACCESS_SETTINGS
 */
const withAndroidInsights = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const ensureUsesPermission = (name) => {
      const uses = manifest.manifest['uses-permission'] ?? [];
      const already = uses.some((p) => p?.$?.['android:name'] === name);
      if (already) return;
      uses.push({ $: { 'android:name': name } });
      manifest.manifest['uses-permission'] = uses;
    };
    const ensureQueriesPackage = (name) => {
      const queries = Array.isArray(manifest.manifest.queries) ? manifest.manifest.queries : [];
      const already = queries.some((q) => Array.isArray(q?.package) && q.package.some((p) => p?.$?.['android:name'] === name));
      if (already) return;
      queries.push({ package: [{ $: { 'android:name': name } }] });
      manifest.manifest.queries = queries;
    };

    // This is a protected permission. The user still needs to grant "Usage access" in Settings.
    ensureUsesPermission('android.permission.PACKAGE_USAGE_STATS');

    // Health Connect (steps only for now; expand as we add more record types).
    // Docs: https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started
    ensureUsesPermission('android.permission.health.READ_STEPS');
    ensureUsesPermission('android.permission.health.READ_SLEEP');
    ensureUsesPermission('android.permission.health.READ_HEART_RATE');
    ensureUsesPermission('android.permission.health.READ_EXERCISE');
    ensureUsesPermission('android.permission.health.READ_ACTIVE_CALORIES_BURNED');
    ensureUsesPermission('android.permission.health.READ_TOTAL_CALORIES_BURNED');
    // Package visibility for Health Connect on API 30+ (Android 11+).
    ensureQueriesPackage('com.google.android.apps.healthdata');

    return config;
  });
};

module.exports = withAndroidInsights;


