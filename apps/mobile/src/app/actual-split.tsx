import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState, useCallback } from "react";
import { ActualSplitTemplate } from "@/components/templates";
import { useCalendarEventsSync } from "@/lib/supabase/hooks/use-calendar-events-sync";
import {
  DERIVED_ACTUAL_PREFIX,
  DERIVED_EVIDENCE_PREFIX,
} from "@/lib/calendar/actual-display-events";
import {
  useEventsStore,
  type CalendarEventMeta,
  type EventCategory,
  type ScheduledEvent,
} from "@/stores";

const formatMinutesToTime = (totalMinutes: number): string => {
  const minutes = Math.max(0, totalMinutes);
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
};

const ymdMinutesToDate = (ymd: string, minutes: number): Date => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(
    year,
    (month ?? 1) - 1,
    day ?? 1,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
};

export default function ActualSplitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    description?: string;
    category?: EventCategory;
    startMinutes?: string;
    duration?: string;
    meta?: string;
    location?: string;
  }>();

  const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
  const actualEvents = useEventsStore((s) => s.actualEvents);
  const addActualEvent = useEventsStore((s) => s.addActualEvent);
  const removeActualEvent = useEventsStore((s) => s.removeActualEvent);
  const { createActual, deleteActual } = useCalendarEventsSync();
  const [isSaving, setIsSaving] = useState(false);

  const event = useMemo<ScheduledEvent>(() => {
    const existing = params.id
      ? actualEvents.find((item) => item.id === params.id)
      : undefined;
    if (existing) return existing;
    const startMinutes = params.startMinutes ? Number(params.startMinutes) : 0;
    const duration = params.duration ? Number(params.duration) : 0;
    let meta: CalendarEventMeta | undefined;
    if (params.meta) {
      try {
        meta = JSON.parse(params.meta) as CalendarEventMeta;
      } catch {
        meta = undefined;
      }
    }
    return {
      id: params.id ?? `temp_${startMinutes}_${duration}`,
      title: params.title ?? "Actual",
      description: params.description ?? "",
      startMinutes,
      duration,
      category: (params.category as EventCategory) ?? "unknown",
      location: params.location ?? undefined,
      meta,
    };
  }, [actualEvents, params]);

  const normalizedStartMinutes = useMemo(
    () => Math.max(0, Math.round(event.startMinutes)),
    [event.startMinutes],
  );
  const normalizedDuration = useMemo(
    () => Math.max(1, Math.round(event.duration)),
    [event.duration],
  );
  const startTime = useMemo(
    () => formatMinutesToTime(normalizedStartMinutes),
    [normalizedStartMinutes],
  );
  const endTime = useMemo(
    () => formatMinutesToTime(normalizedStartMinutes + normalizedDuration),
    [normalizedDuration, normalizedStartMinutes],
  );
  const timeLabel = `${startTime} – ${endTime}`;

  const handleSplitConfirm = useCallback(
    async (splitMinutes: number) => {
      if (splitMinutes <= 0 || splitMinutes >= normalizedDuration) return;
      setIsSaving(true);
      try {
        const start = ymdMinutesToDate(selectedDateYmd, normalizedStartMinutes);
        const split = new Date(start);
        split.setMinutes(split.getMinutes() + splitMinutes);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + normalizedDuration);

        const baseMeta: CalendarEventMeta = {
          ...event.meta,
          category: event.category,
          isBig3: event.isBig3 ?? false,
          source: "user",
          actual: true,
          tags: Array.isArray(event.meta?.tags) ? event.meta?.tags : ["actual"],
        };

        const isDerived =
          event.id.startsWith(DERIVED_ACTUAL_PREFIX) ||
          event.id.startsWith(DERIVED_EVIDENCE_PREFIX);

        const createdFirst = await createActual({
          title: event.title,
          description: event.description,
          location: event.location,
          scheduledStartIso: start.toISOString(),
          scheduledEndIso: split.toISOString(),
          meta: baseMeta,
        });
        addActualEvent(createdFirst, selectedDateYmd);

        const createdSecond = await createActual({
          title: event.title,
          description: event.description,
          location: event.location,
          scheduledStartIso: split.toISOString(),
          scheduledEndIso: end.toISOString(),
          meta: baseMeta,
        });
        addActualEvent(createdSecond, selectedDateYmd);

        // Remove any persisted event that corresponds to the original block.
        // If the user split a derived block, it may have been auto-saved with source_id.
        if (params.id) {
          const toRemove = actualEvents.filter((candidate) => {
            if (candidate.id === params.id) return true;
            const sourceId = candidate.meta?.source_id;
            return typeof sourceId === "string" && sourceId === params.id;
          });
          for (const candidate of toRemove) {
            await deleteActual(candidate.id);
            removeActualEvent(candidate.id, selectedDateYmd);
          }
        }

        router.replace("/comprehensive-calendar");
      } catch (error) {
        if (__DEV__) {
          console.warn("[ActualSplit] Split failed:", error);
        }
        setIsSaving(false);
      }
    },
    [
      addActualEvent,
      createActual,
      event,
      normalizedDuration,
      normalizedStartMinutes,
      params.id,
      router,
      selectedDateYmd,
      deleteActual,
      actualEvents,
      removeActualEvent,
    ],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ActualSplitTemplate
        title={event.title}
        timeLabel={timeLabel}
        duration={normalizedDuration}
        startTime={startTime}
        endTime={endTime}
        onCancel={() => router.back()}
        onConfirm={(splitMinutes) => {
          if (!isSaving) {
            void handleSplitConfirm(splitMinutes);
          }
        }}
      />
    </>
  );
}
