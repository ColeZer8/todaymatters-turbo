const { withInfoPlist } = require('@expo/config-plugins');

const IOS_LICENSE_ENV = 'EXPO_PUBLIC_TRANSISTOR_LICENSE_IOS';

function toLicenseString(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || normalized === 'UNDEFINED') return undefined;
  return normalized;
}

const withTransistorLicense = (config) => {
  const iosLicense = toLicenseString(process.env[IOS_LICENSE_ENV]);

  return withInfoPlist(config, (config) => {
    // Keep this key deterministic for every iOS prebuild.
    // If missing, we explicitly set UNDEFINED so the issue is obvious in generated native files/logs.
    config.modResults.TSLocationManagerLicense = iosLicense || 'UNDEFINED';
    return config;
  });
};

module.exports = withTransistorLicense;
