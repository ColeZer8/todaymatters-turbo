import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tm:location:movementState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MovementState = 'moving' | 'stationary' | 'unknown';

export type MovementReason = 'activity' | 'distance';

export interface MovementStateData {
  /** Current movement classification. */
  state: MovementState;
  /** ISO-8601 timestamp of when this state was last updated. */
  lastUpdated: string;
  /** What triggered the state change. */
  reason: MovementReason;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the persisted movement state from AsyncStorage.
 * Returns a default 'unknown' state if nothing is stored or on error.
 */
export async function getMovementState(): Promise<MovementStateData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (!isMovementStateData(parsed)) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

/**
 * Persist a new movement state to AsyncStorage.
 */
export async function setMovementState(
  state: MovementState,
  reason: MovementReason,
): Promise<void> {
  try {
    const data: MovementStateData = {
      state,
      lastUpdated: new Date().toISOString(),
      reason,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Fail silently – movement state tracking must never crash the app
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultState(): MovementStateData {
  return {
    state: 'unknown',
    lastUpdated: new Date().toISOString(),
    reason: 'distance',
  };
}

function isMovementStateData(value: unknown): value is MovementStateData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.state === 'moving' || obj.state === 'stationary' || obj.state === 'unknown') &&
    typeof obj.lastUpdated === 'string' &&
    (obj.reason === 'activity' || obj.reason === 'distance')
  );
}
