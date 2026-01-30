import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "@/stores";
import { useActualIngestion } from "./use-actual-ingestion";

const HALF_HOUR_MS = 30 * 60 * 1000;

interface UseActualIngestionSchedulerOptions {
  enabled?: boolean;
  /** Number of previous windows to process on foreground/mount. */
  catchUpWindows?: number;
}

function getNextHalfHourBoundary(now: Date): Date {
  const next = new Date(now);
  const minutes = next.getMinutes();
  if (minutes < 30) {
    next.setMinutes(30, 0, 0);
    return next;
  }
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
}

function buildRecentWindows(
  latest: { start: Date; end: Date },
  count: number,
): Array<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [];
  const clampedCount = Math.max(1, count);
  for (let i = clampedCount - 1; i >= 0; i -= 1) {
    const start = new Date(latest.start);
    start.setMinutes(start.getMinutes() - 30 * i);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    windows.push({ start, end });
  }
  return windows;
}

export function useActualIngestionScheduler(
  options: UseActualIngestionSchedulerOptions = {},
): void {
  const { enabled = true, catchUpWindows = 3 } = options;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { processWindow, processWindows, getPreviousWindow } =
    useActualIngestion({ logStats: __DEV__ });

  const isRunningRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const runWindow = useCallback(async () => {
    if (!enabled || !isAuthenticated || !userId) return;
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    try {
      const window = getPreviousWindow();
      await processWindow(window.start, window.end);
    } finally {
      isRunningRef.current = false;
    }
  }, [enabled, getPreviousWindow, isAuthenticated, processWindow, userId]);

  const runCatchUp = useCallback(async () => {
    if (!enabled || !isAuthenticated || !userId) return;
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    try {
      const latest = getPreviousWindow();
      const windows = buildRecentWindows(latest, catchUpWindows);
      await processWindows(windows);
    } finally {
      isRunningRef.current = false;
    }
  }, [
    catchUpWindows,
    enabled,
    getPreviousWindow,
    isAuthenticated,
    processWindows,
    userId,
  ]);

  const scheduleAligned = useCallback(() => {
    clearTimers();
    const nextBoundary = getNextHalfHourBoundary(new Date());
    const delay = Math.max(0, nextBoundary.getTime() - Date.now());
    timeoutRef.current = setTimeout(() => {
      void runWindow();
      intervalRef.current = setInterval(() => {
        void runWindow();
      }, HALF_HOUR_MS);
    }, delay);
  }, [clearTimers, runWindow]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !userId) {
      clearTimers();
      return;
    }

    scheduleAligned();
    void runCatchUp();

    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          scheduleAligned();
          void runCatchUp();
          return;
        }
        clearTimers();
      },
    );

    return () => {
      appStateListener.remove();
      clearTimers();
    };
  }, [
    clearTimers,
    enabled,
    isAuthenticated,
    runCatchUp,
    scheduleAligned,
    userId,
  ]);
}
