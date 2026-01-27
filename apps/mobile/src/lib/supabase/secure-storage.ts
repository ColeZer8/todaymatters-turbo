/**
 * Secure Storage Adapter for Supabase
 *
 * Provides secure storage for JWT tokens using platform-native secure storage:
 * - iOS: Keychain Services (encrypted at rest, protected by device passcode)
 * - Android: Keystore (hardware-backed encryption on supported devices)
 * - Web/SSR: Falls back to no-op storage (secure storage not available)
 * - Expo Go: Falls back to AsyncStorage (native module not available)
 *
 * This adapter implements the Supabase storage interface:
 * - getItem(key: string): Promise<string | null>
 * - setItem(key: string, value: string): Promise<void>
 * - removeItem(key: string): Promise<void>
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Check if we're in a server-side rendering environment or web
const isSSR = typeof window === "undefined" && Platform.OS === "web";
const isWeb = Platform.OS === "web";

// Lazy load SecureStore to avoid errors when native module isn't available (Expo Go)
let SecureStore: typeof import("expo-secure-store") | null = null;
let secureStoreAvailable = false;

// Try to load SecureStore, but don't fail if it's not available
try {
  // Only try to import if we're on a native platform
  if (!isSSR && !isWeb && Platform.OS !== "web") {
    SecureStore = require("expo-secure-store");
    secureStoreAvailable = true;
  }
} catch (error) {
  // Native module not available (e.g., Expo Go, or not built yet)
  if (__DEV__) {
    console.log(
      "🔐 SecureStore not available, using AsyncStorage fallback:",
      error instanceof Error ? error.message : String(error),
    );
  }
  secureStoreAvailable = false;
}

// Check if secure storage is available
const isSecureStorageAvailable = secureStoreAvailable && !isSSR && !isWeb;

/**
 * Secure storage adapter that uses expo-secure-store on native platforms
 * and falls back to AsyncStorage if secure storage is unavailable
 */
export const SecureStorage = {
  async getItem(key: string): Promise<string | null> {
    // Use no-op storage for SSR/web
    if (isSSR || isWeb) {
      return null;
    }

    // Try secure storage first
    if (isSecureStorageAvailable && SecureStore) {
      try {
        const value = await SecureStore.getItemAsync(key);
        return value;
      } catch (error) {
        if (__DEV__) {
          console.error("🔐 SecureStorage getItem error:", error);
        }
        // Fall back to AsyncStorage if secure storage fails
        try {
          return await AsyncStorage.getItem(key);
        } catch (fallbackError) {
          if (__DEV__) {
            console.error("🔐 AsyncStorage fallback error:", fallbackError);
          }
          return null;
        }
      }
    }

    // Fallback to AsyncStorage for unsupported platforms
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      if (__DEV__) {
        console.error("🔐 AsyncStorage getItem error:", error);
      }
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    // Use no-op storage for SSR/web
    if (isSSR || isWeb) {
      return;
    }

    // Try secure storage first
    if (isSecureStorageAvailable && SecureStore) {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch (error) {
        if (__DEV__) {
          console.error("🔐 SecureStorage setItem error:", error);
        }
        // Fall back to AsyncStorage if secure storage fails
        try {
          await AsyncStorage.setItem(key, value);
          return;
        } catch (fallbackError) {
          if (__DEV__) {
            console.error("🔐 AsyncStorage fallback error:", fallbackError);
          }
          throw fallbackError;
        }
      }
    }

    // Fallback to AsyncStorage for unsupported platforms
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      if (__DEV__) {
        console.error("🔐 AsyncStorage setItem error:", error);
      }
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    // Use no-op storage for SSR/web
    if (isSSR || isWeb) {
      return;
    }

    // Try secure storage first
    if (isSecureStorageAvailable && SecureStore) {
      try {
        await SecureStore.deleteItemAsync(key);
        // Also remove from AsyncStorage if it exists (migration cleanup)
        try {
          await AsyncStorage.removeItem(key);
        } catch {
          // Ignore AsyncStorage errors during cleanup
        }
        return;
      } catch (error) {
        if (__DEV__) {
          console.error("🔐 SecureStorage removeItem error:", error);
        }
        // Fall back to AsyncStorage if secure storage fails
        try {
          await AsyncStorage.removeItem(key);
          return;
        } catch (fallbackError) {
          if (__DEV__) {
            console.error("🔐 AsyncStorage fallback error:", fallbackError);
          }
          // Don't throw - removal is best effort
        }
      }
    }

    // Fallback to AsyncStorage for unsupported platforms
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      if (__DEV__) {
        console.error("🔐 AsyncStorage removeItem error:", error);
      }
      // Don't throw - removal is best effort
    }
  },
};
