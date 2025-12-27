const { withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Adds required iOS entitlements and usage strings for:
 * - HealthKit (HealthKit framework)
 * - Screen Time APIs (FamilyControls / DeviceActivity / ManagedSettings)
 *
 * Official refs:
 * - HealthKit: https://developer.apple.com/documentation/healthkit
 * - FamilyControls: https://developer.apple.com/documentation/familycontrols
 * - DeviceActivity: https://developer.apple.com/documentation/deviceactivity
 */
const withIosInsights = (config) => {
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.healthkit'] = true;
    config.modResults['com.apple.developer.family-controls'] = true;
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

    // Required by FamilyControls authorization prompt.
    config.modResults.NSFamilyControlsUsageDescription =
      config.modResults.NSFamilyControlsUsageDescription ??
      'TodayMatters uses Screen Time data to help you understand and improve your digital wellbeing.';

    return config;
  });

  return config;
};

module.exports = withIosInsights;


