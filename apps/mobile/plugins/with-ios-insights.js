const { withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Adds required iOS entitlements and usage strings for:
 * - HealthKit (HealthKit framework)
 * - Screen Time APIs (FamilyControls / DeviceActivity / ManagedSettings)
 *
 * Family Controls requires Apple approval (~3–4 weeks). Until approved, keep it disabled.
 * Set ENABLE_FAMILY_CONTROLS=1 only after Apple grants the entitlement.
 *
 * Without Family Controls: builds succeed; Location + Health work; Screen Time is unavailable.
 * With Family Controls: Screen Time works; requires approval + ENABLE_FAMILY_CONTROLS=1.
 *
 * Official refs:
 * - HealthKit: https://developer.apple.com/documentation/healthkit
 * - FamilyControls: https://developer.apple.com/documentation/familycontrols
 * - DeviceActivity: https://developer.apple.com/documentation/deviceactivity
 */
const withIosInsights = (config) => {
  const familyControlsEnabled =
    process.env.ENABLE_FAMILY_CONTROLS === '1' ||
    process.env.ENABLE_FAMILY_CONTROLS === 'true';

  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.healthkit'] = true;
    if (familyControlsEnabled) {
      config.modResults['com.apple.developer.family-controls'] = true;
      config.modResults['com.apple.developer.family-controls.development'] = true;
    } else {
      // Explicitly remove so EAS cloud builds succeed without Apple approval
      delete config.modResults['com.apple.developer.family-controls'];
      delete config.modResults['com.apple.developer.family-controls.development'];
    }
    return config;
  });

  config = withInfoPlist(config, (config) => {
    // Required by HealthKit permissions prompts.
    config.modResults.NSHealthShareUsageDescription =
      config.modResults.NSHealthShareUsageDescription ??
      'TodayMatters uses Apple Health data to help you understand and improve your wellbeing.';
    config.modResults.NSHealthUpdateUsageDescription =
      config.modResults.NSHealthUpdateUsageDescription ??
      'TodayMatters may write limited health data to Apple Health when you choose to sync.';

    if (familyControlsEnabled) {
      config.modResults.NSFamilyControlsUsageDescription =
        config.modResults.NSFamilyControlsUsageDescription ??
        'TodayMatters uses Screen Time data to help you understand and improve your digital wellbeing.';
    }

    return config;
  });

  return config;
};

module.exports = withIosInsights;


