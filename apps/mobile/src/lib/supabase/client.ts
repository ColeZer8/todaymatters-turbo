import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { Database } from "./database.types";
import { SecureStorage } from "./secure-storage";
import { migrateSessionToSecureStorage } from "./migration";

// Use centralized config if available, fall back to direct env access for backward compatibility
// This allows the app to work with both the new config system and legacy .env files
let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;

const normalizeLocalhostUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return value;
    }

    if (Platform.OS === "android" && !Constants.isDevice) {
      parsed.hostname = "10.0.2.2";
      return parsed.toString();
    }

    const hostUri = Constants.expoConfig?.hostUri;
    if (!hostUri) return value;

    const hostUrl = hostUri.includes("://") ? hostUri : `http://${hostUri}`;
    const hostParsed = new URL(hostUrl);
    if (!hostParsed.hostname) return value;

    parsed.hostname = hostParsed.hostname;
    return parsed.toString();
  } catch {
    return value;
  }
};

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
    "Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.",
  );
}

const normalizedSupabaseUrl = normalizeLocalhostUrl(supabaseUrl);
if (__DEV__ && normalizedSupabaseUrl !== supabaseUrl) {
  // eslint-disable-next-line no-console
  console.log("🔌 Supabase URL normalized for device:", normalizedSupabaseUrl);
}

// Export the resolved values for modules that need to call Edge Functions via raw fetch
// (useful for richer error messages than `supabase.functions.invoke` provides).
export const SUPABASE_URL = normalizedSupabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

// Check if we're in a server-side rendering environment (Expo Router static rendering)
// In SSR, `window` and native modules aren't available
const isSSR = typeof window === "undefined" && Platform.OS === "web";
const isWeb = Platform.OS === "web";

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
      console.error("🔐 Failed to migrate session to secure storage:", error);
    }
    // Continue execution even if migration fails - fallback to AsyncStorage will handle it
  });
}

export const supabase = createClient<Database, "tm">(
  normalizedSupabaseUrl,
  supabaseAnonKey,
  {
    db: {
      schema: "tm", // Use tm schema instead of public
    },
    auth: {
      storage,
      autoRefreshToken: !isSSR,
      persistSession: !isSSR,
      detectSessionInUrl: false, // Important for React Native
    },
  },
);
