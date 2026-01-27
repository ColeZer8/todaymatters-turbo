import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Error categories
// ---------------------------------------------------------------------------

export enum ErrorCategory {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TASK_START_FAILED = 'TASK_START_FAILED',
  TASK_EXECUTION_FAILED = 'TASK_EXECUTION_FAILED',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  SYNC_FAILED = 'SYNC_FAILED',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorLogEntry {
  timestamp: string; // ISO-8601
  category: ErrorCategory;
  message: string;
  context: Record<string, unknown> | null;
  count: number; // incremented when duplicates are throttled
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tm:location:errors';
const MAX_ENTRIES = 50;
const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readErrors(): Promise<ErrorLogEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ErrorLogEntry[];
  } catch {
    return [];
  }
}

async function writeErrors(entries: ErrorLogEntry[]): Promise<void> {
  const trimmed =
    entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an error to the persistent circular buffer in AsyncStorage.
 *
 * Duplicate errors (same category + message) within a 5-minute window are
 * throttled: the existing entry's `count` is incremented instead of appending
 * a new row.
 */
export async function logError(
  category: ErrorCategory,
  message: string,
  context: Record<string, unknown> | null = null,
): Promise<void> {
  try {
    const entries = await readErrors();
    const now = new Date();

    // Check for duplicate within throttle window
    const lastMatch = findLastMatch(entries, category, message);

    if (lastMatch && isWithinThrottleWindow(lastMatch.timestamp, now)) {
      lastMatch.count += 1;
      lastMatch.timestamp = now.toISOString(); // bump timestamp
      if (context) lastMatch.context = context; // update context
    } else {
      entries.push({
        timestamp: now.toISOString(),
        category,
        message,
        context,
        count: 1,
      });
    }

    await writeErrors(entries);
  } catch {
    // Fail silently – logging should never crash the app
  }
}

/**
 * Retrieve the most recent errors (up to 50).
 * Newest entries are at the end of the returned array.
 */
export async function getRecentErrors(): Promise<ErrorLogEntry[]> {
  try {
    return await readErrors();
  } catch {
    return [];
  }
}

/**
 * Clear all stored errors. Useful for diagnostics reset.
 */
export async function clearErrors(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLastMatch(
  entries: ErrorLogEntry[],
  category: ErrorCategory,
  message: string,
): ErrorLogEntry | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.category === category && e.message === message) return e;
  }
  return undefined;
}

function isWithinThrottleWindow(isoTimestamp: string, now: Date): boolean {
  const ts = new Date(isoTimestamp).getTime();
  return now.getTime() - ts < THROTTLE_WINDOW_MS;
}
