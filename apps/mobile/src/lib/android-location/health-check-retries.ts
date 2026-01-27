import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tm:location:healthCheckRetries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCheckRetryData {
  /** Number of consecutive failed restart attempts. */
  retryCount: number;
  /** ISO-8601 timestamp of the last retry attempt. */
  lastRetryAt: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the current health check retry state, or default (0 retries) if none stored.
 */
export async function getHealthCheckRetries(): Promise<HealthCheckRetryData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRetryData();
    const parsed: unknown = JSON.parse(raw);
    if (!isHealthCheckRetryData(parsed)) return defaultRetryData();
    return parsed;
  } catch {
    return defaultRetryData();
  }
}

/**
 * Increment the retry count and persist to AsyncStorage.
 * Returns the updated retry data.
 */
export async function incrementHealthCheckRetries(): Promise<HealthCheckRetryData> {
  try {
    const current = await getHealthCheckRetries();
    const updated: HealthCheckRetryData = {
      retryCount: current.retryCount + 1,
      lastRetryAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    // Fail silently – return a best-effort value
    return { retryCount: 1, lastRetryAt: new Date().toISOString() };
  }
}

/**
 * Reset retry count to 0. Called when task successfully restarts or app comes to foreground.
 */
export async function resetHealthCheckRetries(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultRetryData(): HealthCheckRetryData {
  return { retryCount: 0, lastRetryAt: '' };
}

function isHealthCheckRetryData(value: unknown): value is HealthCheckRetryData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.retryCount === 'number' && typeof obj.lastRetryAt === 'string';
}
