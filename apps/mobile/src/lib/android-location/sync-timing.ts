import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tm:location:lastSyncTime';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record the current time as the last successful sync.
 */
export async function recordLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // Fail silently – sync timing must never crash the app
  }
}

/**
 * Retrieve the last sync time as an ISO-8601 string, or null if none recorded.
 */
export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
