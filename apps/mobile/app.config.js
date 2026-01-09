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

// Environment-specific configuration
const ENV = {
  development: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL_DEV || process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_DEV || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    oauthApiBaseUrl: process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL_DEV || process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID_DEV || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
  staging: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL_STAGING || process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_STAGING || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    oauthApiBaseUrl: process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL_STAGING || process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID_STAGING || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
  production: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL_PROD || process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    oauthApiBaseUrl: process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL_PROD || process.env.EXPO_PUBLIC_OAUTH_API_BASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID_PROD || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
};

const getEnvVars = () => {
  const env = process.env.APP_ENV || 'development';
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
    ios: {
      bundleIdentifier: 'com.todaymatters.mobile',
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSMicrophoneUsageDescription: 'TodayMatters uses your microphone to have voice conversations with your AI coach.',
        UIBackgroundModes: ['audio'],
      },
    },
    android: {
      package: 'com.todaymatters.mobile',
      softwareKeyboardLayoutMode: 'resize',
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.INTERNET',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.WAKE_LOCK',
        'android.permission.BLUETOOTH',
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
      appEnv: process.env.APP_ENV || 'development',
    },
  },
};

