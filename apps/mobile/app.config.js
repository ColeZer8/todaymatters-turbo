/**
 * Expo Configuration with Environment-Specific Support
 * 
 * This file replaces app.json and adds support for dev/staging/prod environments.
 * Environment variables are loaded from process.env based on APP_ENV.
 * 
 * For local development: Use .env file with EXPO_PUBLIC_* variables
 * For EAS builds: Use EAS Secrets or environment-specific variables
 */

import withIosInsights from './plugins/with-ios-insights';
import withAndroidInsights from './plugins/with-android-insights';
import path from 'node:path';
import dotenv from 'dotenv';

// Ensure env vars are loaded for app.config evaluation in monorepo setups.
// Expo often loads env automatically, but in Turborepos it’s easy to put `.env` at the workspace root.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

dotenv.config({ path: path.resolve(workspaceRoot, '.env') });
dotenv.config({ path: path.resolve(projectRoot, '.env') });
dotenv.config({ path: path.resolve(projectRoot, '.env.local') });

// Environment-specific configuration
const ENV = {
  development: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL_DEV || process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_DEV || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    oauthApiBaseUrl: process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL_DEV || process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID_DEV || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_DEV || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
  },
  staging: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL_STAGING || process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_STAGING || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    oauthApiBaseUrl: process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL_STAGING || process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID_STAGING || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_STAGING || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
  },
  production: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL_PROD || process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    oauthApiBaseUrl: process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL_PROD || process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID_PROD || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_PROD || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
  },
};

function resolveAppEnvName() {
  const allowed = new Set(['development', 'staging', 'production']);

  // Explicit override always wins (works for local `APP_ENV=... expo run:*` too).
  const explicit = process.env.APP_ENV;
  if (explicit && allowed.has(explicit)) return explicit;

  // If not explicitly set, infer based on EAS build profile so preview/dev builds
  // behave like local development by default (unless you override via APP_ENV).
  const easProfile = process.env.EAS_BUILD_PROFILE;
  if (easProfile === 'production') return 'production';
  if (easProfile === 'preview') return 'development';
  if (easProfile === 'development-device' || easProfile === 'development-simulator') return 'development';

  return 'development';
}

const getEnvVars = () => {
  const env = resolveAppEnvName();
  return ENV[env] || ENV.development;
};

export default {
  expo: {
    // Preserve all existing app.json configuration
    scheme: 'todaymatters',
    userInterfaceStyle: 'automatic',
    orientation: 'default',
    name: 'mobile',
    slug: 'mobile',
    version: '1.0.6',
    ios: {
      bundleIdentifier: 'com.todaymatters.mobile',
      buildNumber: '13',
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSMicrophoneUsageDescription: 'TodayMatters uses your microphone to have voice conversations with your AI coach.',
        // Location tracking (iOS only) for “planned day vs actual day” analysis.
        // Requires explicit user consent; we request When In Use first, then Always (background) if enabled.
        NSLocationWhenInUseUsageDescription:
          'TodayMatters uses your location to compare your planned day to your actual day (e.g., meeting vs lunch vs commute).',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'TodayMatters uses your location in the background to build an hour-by-hour view of your day for schedule comparison.',
        // Background modes must include location for background updates.
        UIBackgroundModes: ['audio', 'location', 'fetch'],
      },
    },
    android: {
      package: 'com.todaymatters.mobile',
      versionCode: 13,
      softwareKeyboardLayoutMode: 'resize',
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.INTERNET',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.WAKE_LOCK',
        'android.permission.BLUETOOTH',
        'android.permission.POST_NOTIFICATIONS',
        // Location tracking (Android) for “planned day vs actual day” analysis.
        // Foreground + background location + foreground service (required for background reliability).
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        // For restarting location service after device reboot
        'android.permission.RECEIVE_BOOT_COMPLETED',
        // For requesting battery optimization exemption
        'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      output: 'static',
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26, // Required for Health Connect
          },
        },
      ],
      [
        'expo-router',
        {
          origin: false,
        },
      ],
      'expo-secure-store',
      '@livekit/react-native-expo-plugin',
      '@config-plugins/react-native-webrtc',
      [
        '@react-native-community/datetimepicker',
        {
          android: {
            timePicker: {
              background: {
                light: '#ffffff',
                dark: '#1e293b',
              },
              headerBackground: {
                light: '#f8fafc',
                dark: '#0f172a',
              },
              numbersBackgroundColor: {
                light: '#f1f5f9',
                dark: '#334155',
              },
              numbersSelectorColor: {
                light: '#2563EB',
                dark: '#3b82f6',
              },
              numbersTextColor: {
                light: '#0f172a',
                dark: '#f1f5f9',
              },
            },
          },
        },
      ],
      withIosInsights,
      withAndroidInsights,
    ],
    extra: {
      // Preserve existing extra config
      router: {
        origin: false,
      },
      eas: {
        projectId: '4e1c4706-73fc-4230-bc8d-a876941dbf1b',
      },
      // Add environment-specific variables
      ...getEnvVars(),
      enableTestingMenu: process.env.EXPO_PUBLIC_ENABLE_TEST_MENU === 'true',
      appEnv: resolveAppEnvName(),
    },
    // EAS Update configuration - updates are enabled via channels in eas.json
    updates: {
      url: 'https://u.expo.dev/4e1c4706-73fc-4230-bc8d-a876941dbf1b',
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: '1.0.6',
  },
};

