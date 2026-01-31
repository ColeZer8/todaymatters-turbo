import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "@/stores";
import { useActualIngestion } from "./use-actual-ingestion";

const HALF_HOUR_MS = 30 * 60 * 1000;

interface UseActualIngestionSchedulerOptions {
  enabled?: boolean;
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

export function useActualIngestionScheduler(
  options: UseActualIngestionSchedulerOptions = {},
): void {
  const { enabled = true } = options;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { processWindow, getPreviousWindow } = useActualIngestion({
    logStats: __DEV__,
  });

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

    const appStateListener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          scheduleAligned();
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
    scheduleAligned,
    userId,
  ]);
}
