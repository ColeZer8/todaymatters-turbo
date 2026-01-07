import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ComprehensiveCalendarTemplate } from '../components/templates/ComprehensiveCalendarTemplate';
import { USE_MOCK_CALENDAR } from '@/lib/config';
import { getMockPlannedEventsForDay } from '@/lib/calendar/mock-planned-events';
import { useEventsStore } from '@/stores';
import {
  getIosInsightsSupportStatus,
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  presentScreenTimeReportSafeAsync,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeSummary,
} from '@/lib/ios-insights';
import { deriveActualEventsFromScreenTime } from '@/lib/calendar/derive-screen-time-actual-events';
import { useCalendarEventsSync } from '@/lib/supabase/hooks/use-calendar-events-sync';
import { useAuthStore } from '@/stores';
import { ensurePlannedSleepScheduleForDay } from '@/lib/supabase/services/calendar-events';
import { useOnboardingStore } from '@/stores';

export default function ComprehensiveCalendarScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenTimeAuthorizationStatus>('unsupported');
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);

  const supportStatus = useMemo(() => getIosInsightsSupportStatus(), []);
  const setDerivedActualEvents = useEventsStore((state) => state.setDerivedActualEvents);

  const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
  const setSelectedDateYmd = useEventsStore((s) => s.setSelectedDateYmd);
  const plannedEvents = useEventsStore((s) => s.scheduledEvents);
  const plannedCount = useEventsStore((s) => (s.plannedEventsByDate[s.selectedDateYmd] ?? []).length);
  const setPlannedEventsForDate = useEventsStore((s) => s.setPlannedEventsForDate);

  const userId = useAuthStore((s) => s.user?.id ?? null);
  const wakeTimeIso = useOnboardingStore((s) => s.wakeTime);
  const sleepTimeIso = useOnboardingStore((s) => s.sleepTime);
  const updateScheduledEvent = useEventsStore((s) => s.updateScheduledEvent);
  const removeScheduledEvent = useEventsStore((s) => s.removeScheduledEvent);
  const setActualDateYmd = useEventsStore((s) => s.setActualDateYmd);
  const actualDateYmd = useEventsStore((s) => s.actualDateYmd);
  const actualEvents = useEventsStore((s) => s.actualEvents);
  const setActualEventsForDate = useEventsStore((s) => s.setActualEventsForDate);
  const updateActualEvent = useEventsStore((s) => s.updateActualEvent);
  const removeActualEvent = useEventsStore((s) => s.removeActualEvent);

  const handleCalendarSyncError = useCallback((error: Error) => {
    if (__DEV__) {
      console.error('[Calendar] Failed to load planned events:', error.message);
    }
  }, []);

  const { loadPlannedForDay, loadActualForDay, updatePlanned, updateActual, deletePlanned, deleteActual } =
    useCalendarEventsSync({
      onError: handleCalendarSyncError,
    });

  const selectedDate = useMemo(() => ymdToDate(selectedDateYmd), [selectedDateYmd]);

  const isStale = useCallback((generatedAtIso: string | undefined, maxAgeMinutes: number): boolean => {
    if (!generatedAtIso) return true;
    const parsed = new Date(generatedAtIso);
    if (Number.isNaN(parsed.getTime())) return true;
    return Date.now() - parsed.getTime() > maxAgeMinutes * 60_000;
  }, []);

  useEffect(() => {
    if (USE_MOCK_CALENDAR) {
      if (plannedCount > 0) return;
      setPlannedEventsForDate(selectedDateYmd, getMockPlannedEventsForDay(selectedDateYmd));
      return;
    }

    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Ensure sleep schedule exists (for today + previous day so morning sleep appears).
      try {
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 1);
        const prevYmd = dateToYmd(prev);
        await ensurePlannedSleepScheduleForDay({ userId, startYmd: prevYmd, wakeTimeIso, sleepTimeIso });
        await ensurePlannedSleepScheduleForDay({ userId, startYmd: selectedDateYmd, wakeTimeIso, sleepTimeIso });
      } catch (error) {
        if (__DEV__) {
          console.warn('[Calendar] Failed to ensure sleep schedule:', error);
        }
      }

      const events = await loadPlannedForDay(selectedDateYmd);
      if (cancelled) return;
      setPlannedEventsForDate(selectedDateYmd, events);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPlannedForDay, plannedCount, selectedDate, selectedDateYmd, setPlannedEventsForDate, sleepTimeIso, userId, wakeTimeIso]);

  useEffect(() => {
    if (actualDateYmd !== selectedDateYmd) {
      setActualDateYmd(selectedDateYmd);
    }
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const events = await loadActualForDay(selectedDateYmd);
      if (cancelled) return;
      setActualEventsForDate(selectedDateYmd, events);
    })();
    return () => {
      cancelled = true;
    };
  }, [actualDateYmd, loadActualForDay, selectedDateYmd, setActualDateYmd, setActualEventsForDate, userId]);

  const maybeAutoSync = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'ios') return;
    if (supportStatus !== 'available') return;

    const nextStatus = await getScreenTimeAuthorizationStatusSafeAsync();
    setStatus(nextStatus);
    if (nextStatus !== 'approved') {
      setSummary(null);
      return;
    }

    const cached = await getCachedScreenTimeSummarySafeAsync('today');
    const shouldSync = !cached || isStale(cached.generatedAtIso, 15);
    if (!shouldSync) {
      setSummary(cached);
      return;
    }

    // Sync via the report extension, then re-read cache with small retries.
    await presentScreenTimeReportSafeAsync('today');
    for (let attempt = 0; attempt < 5; attempt++) {
      const refreshed = await getCachedScreenTimeSummarySafeAsync('today');
      if (refreshed) {
        setSummary(refreshed);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // If we couldn't read a refreshed cache, keep whatever we had.
    setSummary(cached ?? null);
  }, [isStale, supportStatus]);

  useEffect(() => {
    void maybeAutoSync();
  }, [maybeAutoSync]);

  useEffect(() => {
    // Derive “display actual” events when Screen Time is present; otherwise clear derivation.
    if (!(supportStatus === 'available' && status === 'approved' && summary)) {
      setDerivedActualEvents(null);
      return;
    }

    // Remove the hardcoded demo Screen Time block when we have real Screen Time data.
    const baseActualEvents = actualEvents.filter((e) => e.id !== 'a_screen_time');

    const derived = deriveActualEventsFromScreenTime({
      existingActualEvents: baseActualEvents,
      screenTimeSummary: summary,
    });

    setDerivedActualEvents(derived);
  }, [actualEvents, setDerivedActualEvents, status, summary, supportStatus]);

  // Actual events are Supabase-backed (no mock defaults). Screen Time derivation remains separate.
  const displayActualEvents = actualEvents;

  const openAddEventPicker = useCallback((column?: 'planned' | 'actual', startMinutes?: number) => {
    router.push({
      pathname: '/add-event',
      params: {
        date: selectedDateYmd,
        column: column ?? 'planned',
        startMinutes: startMinutes !== undefined ? String(startMinutes) : undefined,
      }
    });
  }, [router, selectedDateYmd]);

  return (
    <ComprehensiveCalendarTemplate
      selectedDate={selectedDate}
      plannedEvents={plannedEvents}
      actualEvents={displayActualEvents}
      onPrevDay={() => {
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 1);
        setSelectedDateYmd(dateToYmd(prev));
      }}
      onNextDay={() => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 1);
        setSelectedDateYmd(dateToYmd(next));
      }}
      onAddEvent={openAddEventPicker}
      onUpdatePlannedEvent={async (eventId, updates) => {
        const existing = plannedEvents.find((e) => e.id === eventId);
        if (!existing) return;

        const startMinutes = updates.startMinutes ?? existing.startMinutes;
        const duration = updates.duration ?? existing.duration;
        const location = updates.location ?? existing.location;

        if (USE_MOCK_CALENDAR) {
          updateScheduledEvent(
            {
              ...existing,
              title: typeof updates.title === 'string' && updates.title.trim() ? updates.title.trim() : existing.title,
              location,
              category: updates.category ?? existing.category,
              isBig3: updates.isBig3 ?? existing.isBig3,
              startMinutes,
              duration,
            },
            selectedDateYmd
          );
          return;
        }

        const newStart = new Date(selectedDate);
        newStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        const newEnd = new Date(newStart);
        newEnd.setMinutes(newEnd.getMinutes() + duration);

        const updated = await updatePlanned(eventId, {
          title: typeof updates.title === 'string' && updates.title.trim() ? updates.title.trim() : undefined,
          description: existing.description,
          location,
          scheduledStartIso: newStart.toISOString(),
          scheduledEndIso: newEnd.toISOString(),
          meta: {
            category: updates.category ?? existing.category,
            isBig3: updates.isBig3 ?? existing.isBig3,
            source: 'user',
          },
        });

        updateScheduledEvent(updated, selectedDateYmd);
      }}
      onDeletePlannedEvent={async (eventId) => {
        if (USE_MOCK_CALENDAR) {
          removeScheduledEvent(eventId, selectedDateYmd);
          return;
        }
        await deletePlanned(eventId);
        removeScheduledEvent(eventId, selectedDateYmd);
      }}
      onUpdateActualEvent={async (eventId, updates) => {
        const existing = displayActualEvents.find((e) => e.id === eventId);
        if (!existing) return;

        const startMinutes = updates.startMinutes ?? existing.startMinutes;
        const duration = updates.duration ?? existing.duration;
        const location = updates.location ?? existing.location;

        if (USE_MOCK_CALENDAR) {
          updateActualEvent(
            {
              ...existing,
              title: typeof updates.title === 'string' && updates.title.trim() ? updates.title.trim() : existing.title,
              location,
              category: updates.category ?? existing.category,
              isBig3: updates.isBig3 ?? existing.isBig3,
              startMinutes,
              duration,
            },
            selectedDateYmd
          );
          return;
        }

        const newStart = new Date(selectedDate);
        newStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        const newEnd = new Date(newStart);
        newEnd.setMinutes(newEnd.getMinutes() + duration);

        const updated = await updateActual(eventId, {
          title: typeof updates.title === 'string' && updates.title.trim() ? updates.title.trim() : undefined,
          description: existing.description,
          location,
          scheduledStartIso: newStart.toISOString(),
          scheduledEndIso: newEnd.toISOString(),
          meta: {
            category: updates.category ?? existing.category,
            isBig3: updates.isBig3 ?? existing.isBig3,
            source: 'user',
          },
        });
        updateActualEvent(updated, selectedDateYmd);
      }}
      onDeleteActualEvent={async (eventId) => {
        await deleteActual(eventId);
        removeActualEvent(eventId, selectedDateYmd);
      }}
    />
  );
}

function ymdToDate(ymd: string): Date {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

function dateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
