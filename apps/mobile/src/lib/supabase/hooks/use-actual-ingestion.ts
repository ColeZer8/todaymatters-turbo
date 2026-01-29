import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useAuthStore } from "@/stores";
import {
  fetchIngestionCheckpoint,
  shouldRunIngestion,
  runFullIngestion,
  upsertIngestionCheckpoint,
  type IngestionConfig,
} from "@/lib/supabase/services/actual-ingestion";

/**
 * Default ingestion interval: 30 minutes.
 * This matches the window size in the ingestion algorithm.
 */
const DEFAULT_INGESTION_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Get the device timezone.
 * Falls back to UTC if detection fails.
 */
function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}

export interface UseActualIngestionOptions {
  /** Minimum interval between ingestion runs in milliseconds (default: 30 minutes) */
  intervalMs?: number;
  /** Custom ingestion config (default: uses service defaults) */
  config?: Partial<IngestionConfig>;
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
}

/**
 * React hook that triggers the actual ingestion service on app foreground/resume.
 *
 * This hook:
 * - Triggers ingestion when the app becomes active (foreground/resume)
 * - Respects the 30-minute interval (doesn't run more frequently than once per window)
 * - Updates the checkpoint after successful processing
 * - Handles errors gracefully without crashing the app
 * - Only runs on Android (iOS screen time ingestion is not yet implemented)
 *
 * Based on the useInsightsSync pattern.
 */
export function useActualIngestion(
  options: UseActualIngestionOptions = {},
): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const intervalMs = options.intervalMs ?? DEFAULT_INGESTION_INTERVAL_MS;
  const enabled = options.enabled ?? true;
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Only enable on Android for now (as per PRD non-goals)
    if (!enabled || !isAuthenticated || !userId) return;
    if (Platform.OS !== "android") return;

    let isCancelled = false;
    const timezone = getDeviceTimezone();

    const runIngestion = async () => {
      if (isCancelled || isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        // Step 1: Fetch the checkpoint to see when we last processed
        const checkpoint = await fetchIngestionCheckpoint(userId);

        // Step 2: Check if we should run ingestion
        const now = new Date();
        const windowToProcess = shouldRunIngestion(checkpoint, now);

        if (!windowToProcess) {
          if (__DEV__) {
            console.log(
              "[useActualIngestion] Skipping - already processed this window",
            );
          }
          return;
        }

        const { windowStart, windowEnd } = windowToProcess;

        if (__DEV__) {
          console.log(
            `[useActualIngestion] Processing window: ${windowStart.toISOString()} - ${windowEnd.toISOString()}`,
          );
        }

        // Step 3: Run the full ingestion pipeline
        const result = await runFullIngestion(
          userId,
          windowStart,
          windowEnd,
          options.config
            ? { ...getDefaultConfig(), ...options.config }
            : undefined,
        );

        if (!result.success) {
          if (__DEV__) {
            console.error("[useActualIngestion] Ingestion failed:", result.error);
          }
          // Don't update checkpoint on failure - we'll retry next time
          return;
        }

        // Step 4: Update the checkpoint
        await upsertIngestionCheckpoint(userId, timezone, windowStart, windowEnd, {
          sessionsProcessed: result.sessionsProcessed,
          segmentsCreated: result.segmentsCreated,
          processingTimeMs: Date.now() - now.getTime(),
        });

        if (__DEV__) {
          console.log("[useActualIngestion] Ingestion complete:", {
            sessionsProcessed: result.sessionsProcessed,
            segmentsCreated: result.segmentsCreated,
            eventsInserted: result.eventsInserted,
            eventsDeleted: result.eventsDeleted,
            gapsFilled: result.gapsFilled,
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[useActualIngestion] Error during ingestion:", error);
        }
        // Gracefully handle errors - don't crash the app
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Run immediately on mount
    runIngestion();

    // Set up interval for periodic runs
    const intervalId = setInterval(runIngestion, intervalMs);

    // Set up app state listener for foreground/resume
    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state !== "active") return;
        runIngestion();
      },
    );

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
      appStateListener.remove();
    };
  }, [enabled, intervalMs, isAuthenticated, userId, options.config]);
}

/**
 * Get the default ingestion config.
 * This is a helper to avoid importing the config from the service.
 */
function getDefaultConfig(): IngestionConfig {
  return {
    windowMinutes: 30,
    bufferMinutes: 10,
    mutableCutoffMinutes: 120,
    minSessionDurationSeconds: 60,
  };
}
