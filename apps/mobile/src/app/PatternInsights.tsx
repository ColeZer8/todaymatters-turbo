import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { PatternInsightsTemplate } from "@/components/templates/PatternInsightsTemplate";
import { useCalendarEventsSync } from "@/lib/supabase/hooks/use-calendar-events-sync";
import {
  buildPatternIndex,
  buildPatternIndexFromSlots,
  serializePatternIndex,
} from "@/lib/calendar/pattern-recognition";
import {
  buildDailyPatternAnomalies,
  buildPatternPredictions,
} from "@/lib/calendar/pattern-recognition";
import {
  useAuthStore,
  useEventsStore,
  useUserPreferencesStore,
} from "@/stores";
import type { ScheduledEvent } from "@/stores";
import {
  fetchActivityPatterns,
  upsertActivityPatterns,
} from "@/lib/supabase/services/activity-patterns";

const formatMinutesToTime = (totalMinutes: number): string => {
  const minutes = Math.max(0, totalMinutes);
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
};

const ymdToDate = (ymd: string): Date => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
};

const dateToYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateLabel = (ymd: string): string => {
  const date = ymdToDate(ymd);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

export default function PatternInsightsScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
  const preferences = useUserPreferencesStore((s) => s.preferences);
  const { loadActualForDay, loadActualForRange } = useCalendarEventsSync();

  const [actualEvents, setActualEvents] = useState<ScheduledEvent[]>([]);
  const [patternIndex, setPatternIndex] = useState<ReturnType<
    typeof buildPatternIndex
  > | null>(null);

  useEffect(() => {
    if (!userId) {
      setActualEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const events = await loadActualForDay(selectedDateYmd);
      if (cancelled) return;
      setActualEvents(events);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadActualForDay, selectedDateYmd, userId]);

  useEffect(() => {
    if (!userId) {
      setPatternIndex(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const baseDate = ymdToDate(selectedDateYmd);
      const start = new Date(baseDate);
      start.setDate(start.getDate() - 14);
      const startYmd = dateToYmd(start);
      const endYmd = dateToYmd(baseDate);
      const stored = await fetchActivityPatterns(userId);
      if (cancelled) return;
      if (stored?.slots?.length) {
        setPatternIndex(buildPatternIndexFromSlots(stored.slots));
      }
      const history = await loadActualForRange(startYmd, endYmd);
      if (cancelled) return;
      const filtered = history.filter((entry) => entry.ymd !== selectedDateYmd);
      const nextIndex = buildPatternIndex(filtered);
      setPatternIndex(nextIndex);
      await upsertActivityPatterns({
        userId,
        slots: serializePatternIndex(nextIndex),
        windowStartYmd: startYmd,
        windowEndYmd: endYmd,
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadActualForRange, selectedDateYmd, userId]);

  const anomalyReport = useMemo(() => {
    return buildDailyPatternAnomalies({
      actualEvents,
      index: patternIndex,
      ymd: selectedDateYmd,
      minConfidence: preferences.confidenceThreshold,
    });
  }, [
    actualEvents,
    patternIndex,
    preferences.confidenceThreshold,
    selectedDateYmd,
  ]);

  const predictions = useMemo(() => {
    const tomorrow = new Date(ymdToDate(selectedDateYmd));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetYmd = dateToYmd(tomorrow);
    return buildPatternPredictions({
      index: patternIndex,
      ymd: targetYmd,
      minConfidence: preferences.confidenceThreshold,
    });
  }, [patternIndex, preferences.confidenceThreshold, selectedDateYmd]);

  const anomalyRows = (anomalyReport?.anomalies ?? []).map(
    (anomaly, index) => ({
      id: `${anomaly.startMinutes}-${index}`,
      timeLabel: formatMinutesToTime(anomaly.startMinutes),
      title: `Expected ${anomaly.expectedCategory}`,
      detail: `Actual ${anomaly.actualCategory} • ${Math.round(anomaly.confidence * 100)}%`,
      confidence: anomaly.confidence,
    }),
  );

  const predictionRows = predictions.map((prediction, index) => ({
    id: `${prediction.startMinutes}-${index}`,
    timeLabel: formatMinutesToTime(prediction.startMinutes),
    title: prediction.title,
    detail: `${prediction.category} • ${Math.round(prediction.confidence * 100)}%`,
    confidence: prediction.confidence,
  }));

  return (
    <>
      <Stack.Screen options={{ title: "Pattern Insights" }} />
      <PatternInsightsTemplate
        dateLabel={formatDateLabel(selectedDateYmd)}
        anomalyScore={anomalyReport?.anomalyScore ?? 0}
        anomalies={anomalyRows}
        predictions={predictionRows}
      />
    </>
  );
}
