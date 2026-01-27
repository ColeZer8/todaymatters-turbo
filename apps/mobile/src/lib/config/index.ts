/**
 * Centralized Application Configuration
 *
 * Provides type-safe access to environment-specific configuration values.
 * All config is loaded from Expo Constants (app.config.js extra field).
 *
 * Usage:
 *   import appConfig from '@/lib/config';
 *   const url = appConfig.supabase.url;
 *   if (appConfig.env.isDev) { ... }
 */

import Constants from "expo-constants";

function readPublicEnv(key: string): string | undefined {
  try {
    // eslint-disable-next-line no-undef
    return typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)[key]
      : undefined;
  } catch {
    return undefined;
  }
}

interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  oauth: {
    apiBaseUrl: string;
    googleWebClientId: string;
  };
  env: {
    name: "development" | "staging" | "production";
    isDev: boolean;
    isStaging: boolean;
    isProd: boolean;
  };
  features: {
    enableDebugLogs: boolean;
    enableCrashlytics: boolean;
    enableAnalytics: boolean;
    enableTestingMenu: boolean;
  };
}

const config = Constants.expoConfig?.extra;

if (!config) {
  throw new Error("Missing Expo config.extra - check app.config.js");
}

const appEnv = (config.appEnv || "development") as AppConfig["env"]["name"];

const appConfig: AppConfig = {
  supabase: {
    url: config.supabaseUrl || "",
    anonKey: config.supabaseAnonKey || "",
  },
  oauth: {
    // Prefer Expo `extra`, but fall back to EXPO_PUBLIC_* (useful when `.env` is loaded but `extra` is stale).
    apiBaseUrl:
      config.oauthApiBaseUrl ||
      readPublicEnv("EXPO_PUBLIC_OAUTH_API_BASE_URL") ||
      "",
    googleWebClientId: config.googleWebClientId || "",
  },
  env: {
    name: appEnv,
    isDev: appEnv === "development",
    isStaging: appEnv === "staging",
    isProd: appEnv === "production",
  },
  features: {
    enableDebugLogs: appEnv !== "production",
    enableCrashlytics: appEnv !== "development",
    enableAnalytics: appEnv === "production",
    enableTestingMenu:
      config.enableTestingMenu === true ||
      config.enableTestingMenu === "true" ||
      readPublicEnv("EXPO_PUBLIC_ENABLE_TEST_MENU") === "true",
  },
};

// Validate required config (only Supabase is required for now)
// OAuth variables are optional until they're needed
const requiredKeys = [
  { key: "supabaseUrl", name: "SUPABASE_URL" },
  { key: "supabaseAnonKey", name: "SUPABASE_ANON_KEY" },
];

const missing: string[] = [];
for (const { key, name } of requiredKeys) {
  if (!config[key]) {
    missing.push(name);
  }
}

if (missing.length > 0) {
  throw new Error(`Missing required config: ${missing.join(", ")}`);
}

export default appConfig;
