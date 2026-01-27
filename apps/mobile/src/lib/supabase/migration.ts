/**
 * Migration Utility for Secure Storage
 *
 * Migrates existing sessions from AsyncStorage to secure storage.
 * This ensures backward compatibility when upgrading to secure storage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { SecureStorage } from "./secure-storage";

// Supabase storage keys pattern
const SUPABASE_KEY_PATTERN = /^sb-.*-auth-token$/;

/**
 * Migrates session from AsyncStorage to secure storage
 * @returns true if migration was successful or not needed, false if failed
 */
export async function migrateSessionToSecureStorage(): Promise<boolean> {
  try {
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();

    // Find Supabase auth token keys
    const supabaseKeys = allKeys.filter((key) =>
      SUPABASE_KEY_PATTERN.test(key),
    );

    if (supabaseKeys.length === 0) {
      // No session to migrate
      if (__DEV__) {
        console.log("🔐 No session found in AsyncStorage, skipping migration");
      }
      return true;
    }

    if (__DEV__) {
      console.log("🔐 Migrating session to secure storage...", {
        keys: supabaseKeys,
      });
    }

    // Migrate each key
    let migratedCount = 0;
    for (const key of supabaseKeys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          // Write to secure storage
          await SecureStorage.setItem(key, value);
          migratedCount++;

          if (__DEV__) {
            console.log(`🔐 Migrated key: ${key}`);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error(`🔐 Failed to migrate key ${key}:`, error);
        }
        // Continue with other keys even if one fails
      }
    }

    if (migratedCount > 0) {
      // Clear old AsyncStorage keys after successful migration
      try {
        await Promise.all(
          supabaseKeys.map((key) => AsyncStorage.removeItem(key)),
        );
        if (__DEV__) {
          console.log(
            "✅ Session migrated successfully, cleared AsyncStorage keys",
          );
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "⚠️ Failed to clear AsyncStorage keys after migration:",
            error,
          );
        }
        // Migration succeeded even if cleanup failed
      }
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      console.error("🔐 Migration failed:", error);
    }
    // Return false to indicate migration failure
    // App will continue using AsyncStorage as fallback
    return false;
  }
}

/**
 * Checks if migration is needed
 * @returns true if AsyncStorage has Supabase session keys
 */
export async function needsMigration(): Promise<boolean> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const supabaseKeys = allKeys.filter((key) =>
      SUPABASE_KEY_PATTERN.test(key),
    );
    return supabaseKeys.length > 0;
  } catch {
    return false;
  }
}
