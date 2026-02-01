import ExpoBackgroundLocationModule from './ExpoBackgroundLocationModule';

/**
 * Configure Supabase for direct native uploads.
 * Must be called before startLocationTracking for direct uploads to work.
 * 
 * @param supabaseUrl - The Supabase project URL (e.g., https://xxx.supabase.co)
 * @param anonKey - The Supabase anon/public key
 * @param jwtToken - The user's JWT token for authenticated uploads
 * @param userId - The user's ID
 */
export async function configureSupabase(
  supabaseUrl: string,
  anonKey: string,
  jwtToken: string,
  userId: string
): Promise<void> {
  if (
    typeof (ExpoBackgroundLocationModule as { configureSupabase?: unknown })
      .configureSupabase !== "function"
  ) {
    if (__DEV__) {
      console.warn(
        "📍 [native] configureSupabase unavailable — rebuild the app to load native changes.",
      );
    }
    return;
  }
  const result = await ExpoBackgroundLocationModule.configureSupabase(
    supabaseUrl,
    anonKey,
    jwtToken,
    userId
  );
  if (!result.success) {
    throw new Error('Failed to configure Supabase');
  }
}

/**
 * Update the JWT token (e.g., after token refresh).
 * 
 * @param jwtToken - The new JWT token
 */
export async function updateJwtToken(jwtToken: string): Promise<void> {
  if (
    typeof (ExpoBackgroundLocationModule as { updateJwtToken?: unknown })
      .updateJwtToken !== "function"
  ) {
    if (__DEV__) {
      console.warn(
        "📍 [native] updateJwtToken unavailable — rebuild the app to load native changes.",
      );
    }
    return;
  }
  const result = await ExpoBackgroundLocationModule.updateJwtToken(jwtToken);
  if (!result.success) {
    throw new Error('Failed to update JWT token');
  }
}

/**
 * Check if Supabase is configured for native uploads.
 */
export async function isSupabaseConfigured(): Promise<boolean> {
  if (
    typeof (ExpoBackgroundLocationModule as { isSupabaseConfigured?: unknown })
      .isSupabaseConfigured !== "function"
  ) {
    return false;
  }
  const result = await ExpoBackgroundLocationModule.isSupabaseConfigured();
  return result?.configured === true;
}

/**
 * Start background location tracking using native WorkManager.
 * 
 * @param userId - User ID for storing location samples
 * @param intervalMinutes - Interval in minutes (minimum 15 due to WorkManager constraints)
 * @returns Promise that resolves when tracking starts
 */
export async function startLocationTracking(
  userId: string,
  intervalMinutes: number = 15
): Promise<void> {
  const result = await ExpoBackgroundLocationModule.startLocationTracking(
    userId,
    intervalMinutes
  );
  if (!result.success) {
    throw new Error('Failed to start location tracking');
  }
}

/**
 * Stop background location tracking.
 * Also clears Supabase configuration.
 * 
 * @returns Promise that resolves when tracking stops
 */
export async function stopLocationTracking(): Promise<void> {
  const result = await ExpoBackgroundLocationModule.stopLocationTracking();
  if (!result.success) {
    throw new Error('Failed to stop location tracking');
  }
}

/**
 * Trigger a one-time background location worker run immediately.
 *
 * @param userId - User ID for storing location samples
 */
export async function runOneTimeLocationWorker(
  userId: string
): Promise<void> {
  if (
    typeof (ExpoBackgroundLocationModule as { runOneTimeLocationWorker?: unknown })
      .runOneTimeLocationWorker !== "function"
  ) {
    if (__DEV__) {
      console.warn(
        "📍 [native] runOneTimeLocationWorker unavailable — rebuild the app to load native changes.",
      );
    }
    return;
  }
  const result = await ExpoBackgroundLocationModule.runOneTimeLocationWorker(
    userId,
  );
  if (!result.success) {
    throw new Error("Failed to run one-time location worker");
  }
}

/**
 * Check if background location tracking is currently active.
 * 
 * @returns Promise that resolves with tracking status
 */
export async function isTracking(): Promise<boolean> {
  const result = await ExpoBackgroundLocationModule.isTracking();
  return result.isTracking;
}

export interface PendingLocationSample {
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  is_mocked: boolean | null;
  source: "background";
  raw: unknown | null;
}

/**
 * Drain pending background samples stored by the native worker.
 */
export async function drainPendingSamples(
  userId: string,
  limit: number = 500
): Promise<PendingLocationSample[]> {
  if (
    typeof (ExpoBackgroundLocationModule as { drainPendingSamples?: unknown })
      .drainPendingSamples !== "function"
  ) {
    if (__DEV__) {
      console.warn(
        "📍 [native] drainPendingSamples unavailable — rebuild the app to load native changes.",
      );
    }
    return [];
  }
  const result = await ExpoBackgroundLocationModule.drainPendingSamples(
    userId,
    limit
  );
  if (!result?.samples) return [];
  try {
    const parsed = JSON.parse(result.samples) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingLocationSample[]) : [];
  } catch {
    return [];
  }
}

/**
 * Peek pending background samples without draining.
 */
export async function peekPendingSamples(
  userId: string,
  limit: number = 50
): Promise<PendingLocationSample[]> {
  if (
    typeof (ExpoBackgroundLocationModule as { peekPendingSamples?: unknown })
      .peekPendingSamples !== "function"
  ) {
    return [];
  }
  const result = await ExpoBackgroundLocationModule.peekPendingSamples(
    userId,
    limit
  );
  if (!result?.samples) return [];
  try {
    const parsed = JSON.parse(result.samples) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingLocationSample[]) : [];
  } catch {
    return [];
  }
}

/**
 * Get the count of pending background samples.
 */
export async function getPendingCount(userId: string): Promise<number> {
  if (
    typeof (ExpoBackgroundLocationModule as { getPendingCount?: unknown })
      .getPendingCount !== "function"
  ) {
    return 0;
  }
  const result = await ExpoBackgroundLocationModule.getPendingCount(userId);
  return typeof result?.count === "number" ? result.count : 0;
}
