import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Database } from './database.types';
import { SecureStorage } from './secure-storage';
import { migrateSessionToSecureStorage } from './migration';

// Use centralized config if available, fall back to direct env access for backward compatibility
// This allows the app to work with both the new config system and legacy .env files
let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;

// Check if centralized config is available (from app.config.js extra field)
const extra = Constants.expoConfig?.extra;
if (extra?.supabaseUrl && extra?.supabaseAnonKey) {
  // Use centralized config (preferred)
  supabaseUrl = extra.supabaseUrl;
  supabaseAnonKey = extra.supabaseAnonKey;
} else {
  // Fall back to direct env access (backward compatibility with existing .env setup)
  supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Export the resolved values for modules that need to call Edge Functions via raw fetch
// (useful for richer error messages than `supabase.functions.invoke` provides).
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

// Check if we're in a server-side rendering environment (Expo Router static rendering)
// In SSR, `window` and native modules aren't available
const isSSR = typeof window === 'undefined' && Platform.OS === 'web';
const isWeb = Platform.OS === 'web';

// Create a no-op storage for SSR that doesn't crash
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

// Use secure storage on native platforms, fallback to AsyncStorage for web/SSR
// Secure storage provides encrypted storage using iOS Keychain / Android Keystore
const storage = isSSR || isWeb ? noopStorage : SecureStorage;

// Migrate existing sessions from AsyncStorage to secure storage on app start
// This runs once and is non-blocking
if (!isSSR && !isWeb) {
  migrateSessionToSecureStorage().catch((error) => {
    if (__DEV__) {
      console.error('🔐 Failed to migrate session to secure storage:', error);
    }
    // Continue execution even if migration fails - fallback to AsyncStorage will handle it
  });
}

export const supabase = createClient<Database, 'tm'>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'tm', // Use tm schema instead of public
  },
  auth: {
    storage,
    autoRefreshToken: !isSSR,
    persistSession: !isSSR,
    detectSessionInUrl: false, // Important for React Native
  },
});

