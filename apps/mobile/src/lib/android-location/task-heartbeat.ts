import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tm:location:lastTaskExecution';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskHeartbeat {
  /** ISO-8601 timestamp of the last task callback execution. */
  timestamp: string;
  /** Number of location samples received in that execution (0 if error/empty). */
  sampleCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a task execution heartbeat to AsyncStorage.
 * Called on every location-task.ts callback to track when the task last fired.
 */
export async function recordTaskHeartbeat(sampleCount: number): Promise<void> {
  try {
    const heartbeat: TaskHeartbeat = {
      timestamp: new Date().toISOString(),
      sampleCount,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(heartbeat));
  } catch {
    // Fail silently – heartbeat tracking must never crash the app
  }
}

/**
 * Retrieve the last task execution heartbeat, or null if none recorded.
 */
export async function getLastTaskHeartbeat(): Promise<TaskHeartbeat | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TaskHeartbeat;
  } catch {
    return null;
  }
}
