import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ComprehensiveCalendarTemplate } from '../components/templates/ComprehensiveCalendarTemplate';
import { USE_MOCK_CALENDAR } from '@/lib/config';
import { getMockPlannedEventsForDay } from '@/lib/calendar/mock-planned-events';
import {
  getTodayYmd,
  useAppCategoryOverridesStore,
  useEventsStore,
  useAuthStore,
  useOnboardingStore,
  useUserPreferencesStore,
} from '@/stores';
import {
  getIosInsightsSupportStatus,
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeSummary,
} from '@/lib/ios-insights';
import {
  getUsageAccessAuthorizationStatusSafeAsync,
  getUsageSummarySafeAsync,
  type UsageSummary,
} from '@/lib/android-insights';
import { deriveActualEventsFromScreenTime } from '@/lib/calendar/derive-screen-time-actual-events';
import { buildActualDisplayEvents } from '@/lib/calendar/actual-display-events';
import {
  buildPatternIndex,
  buildPatternIndexFromSlots,
  serializePatternIndex,
  type PatternIndex,
} from '@/lib/calendar/pattern-recognition';
import { useCalendarEventsSync } from '@/lib/supabase/hooks/use-calendar-events-sync';
import {
  ensurePlannedSleepScheduleForDay,
  syncDerivedActualEvents,
  cleanupDuplicateDerivedEvents,
} from '@/lib/supabase/services/calendar-events';
import { useVerification } from '@/lib/calendar/use-verification';
import { syncActualEvidenceBlocks } from '@/lib/supabase/services/actual-evidence-events';
import { DERIVED_ACTUAL_PREFIX, DERIVED_EVIDENCE_PREFIX } from '@/lib/calendar/actual-display-events';
import { fetchActivityPatterns, upsertActivityPatterns } from '@/lib/supabase/services/activity-patterns';
import { fetchUserAppCategoryOverrides } from '@/lib/supabase/services/user-app-categories';
import { fetchUserDataPreferences } from '@/lib/supabase/services/user-preferences';
import { fetchLocationMappings, type LocationMapping } from '@/lib/supabase/services/location-mappings';
import { fetchAppMappings, type AppMapping } from '@/lib/supabase/services/app-mappings';
import { DEFAULT_USER_PREFERENCES } from '@/stores/user-preferences-store';
import { supabase } from '@/lib/supabase/client';

export default function ComprehensiveCalendarScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenTimeAuthorizationStatus>('unsupported');
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const isMountedRef = useRef(true);

  const supportStatus = useMemo(() => getIosInsightsSupportStatus(), []);
  const setDerivedActualEvents = useEventsStore((state) => state.setDerivedActualEvents);
  const appCategoryOverrides = useAppCategoryOverridesStore((state) => state.overrides);
  const setAppCategoryOverrides = useAppCategoryOverridesStore((state) => state.setOverrides);
  const userPreferences = useUserPreferencesStore((state) => state.preferences);
  const setUserPreferences = useUserPreferencesStore((state) => state.setPreferences);

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
  const derivedActualEvents = useEventsStore((s) => s.derivedActualEvents);
  const [patternIndex, setPatternIndex] = useState<PatternIndex | null>(null);
  // US-022: User's custom location-to-activity mappings
  const [locationMappings, setLocationMappings] = useState<LocationMapping[]>([]);
  // US-023: User's custom app-to-activity mappings
  const [appMappings, setAppMappings] = useState<AppMapping[]>([]);

  const handleCalendarSyncError = useCallback((error: Error) => {
    if (__DEV__) {
      console.error('[Calendar] Failed to load planned events:', error.message);
    }
  }, []);

  const { loadPlannedForDay, loadActualForDay, loadActualForRange, updatePlanned, updateActual, deletePlanned, deleteActual } =
    useCalendarEventsSync({
      onError: handleCalendarSyncError,
    });

  // Verification: cross-reference planned events with evidence (location, screen time, health)
  const { actualBlocks, evidence, verificationResults, refresh: refreshVerification } = useVerification(
    plannedEvents,
    selectedDateYmd,
    {
    autoFetch: true,
    appCategoryOverrides,
    verificationStrictness: userPreferences.verificationStrictness,
    onError: (err) => {
      if (__DEV__) {
        console.warn('[Calendar] Verification error:', err.message);
      }
    },
    },
  );

  const selectedDate = useMemo(() => ymdToDate(selectedDateYmd), [selectedDateYmd]);

  useEffect(() => {
    setSelectedDateYmd(getTodayYmd());
  }, [setSelectedDateYmd]);

  const evidenceSyncRef = useRef<{ ymd: string; fingerprint: string } | null>(null);
  const derivedEventsSyncRef = useRef<{ ymd: string; fingerprint: string } | null>(null);
  const cleanupRef = useRef<Set<string>>(new Set());

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
      console.log(`[Calendar] Loading actual events for ${selectedDateYmd}`);
      const events = await loadActualForDay(selectedDateYmd);
      if (cancelled) return;
      console.log(`[Calendar] Loaded ${events.length} actual events for ${selectedDateYmd}`);
      setActualEventsForDate(selectedDateYmd, events);

      // Clean up duplicate derived events using the new function that preserves the oldest
      if (cleanupRef.current.has(selectedDateYmd)) return;
      cleanupRef.current.add(selectedDateYmd);

      try {
        const removedIds = await cleanupDuplicateDerivedEvents(userId, selectedDateYmd);
        if (cancelled) return;
        if (removedIds.length > 0) {
          console.log(`[Calendar] Cleaned up ${removedIds.length} duplicate derived events for ${selectedDateYmd}`);
          // Refresh the events after cleanup
          const refreshedEvents = await loadActualForDay(selectedDateYmd);
          if (cancelled) return;
          setActualEventsForDate(selectedDateYmd, refreshedEvents);
        }
      } catch (error) {
        console.warn('[Calendar] Failed cleanup of derived duplicates:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actualDateYmd, loadActualForDay, selectedDateYmd, setActualDateYmd, setActualEventsForDate, userId]);

  useEffect(() => {
    if (!userId) {
      setAppCategoryOverrides({});
      return;
    }
    let cancelled = false;
    (async () => {
      const overrides = await fetchUserAppCategoryOverrides(userId);
      if (cancelled) return;
      setAppCategoryOverrides(overrides);
    })();
    return () => {
      cancelled = true;
    };
  }, [setAppCategoryOverrides, userId]);

  useEffect(() => {
    if (!userId) {
      setUserPreferences(DEFAULT_USER_PREFERENCES);
      return;
    }
    let cancelled = false;
    (async () => {
      const preferences = await fetchUserDataPreferences(userId);
      if (cancelled) return;
      setUserPreferences(preferences);
    })();
    return () => {
      cancelled = true;
    };
  }, [setUserPreferences, userId]);

  // US-022: Load user's location mappings for activity inference
  useEffect(() => {
    if (!userId) {
      setLocationMappings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mappings = await fetchLocationMappings(userId);
        if (cancelled) return;
        setLocationMappings(mappings);
      } catch (error) {
        if (__DEV__) {
          console.warn('[Calendar] Failed to load location mappings:', error);
        }
        if (!cancelled) {
          setLocationMappings([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // US-023: Load user's app mappings for activity inference and distraction detection
  useEffect(() => {
    if (!userId) {
      setAppMappings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mappings = await fetchAppMappings(userId);
        if (cancelled) return;
        setAppMappings(mappings);
      } catch (error) {
        if (__DEV__) {
          console.warn('[Calendar] Failed to load app mappings:', error);
        }
        if (!cancelled) {
          setAppMappings([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || USE_MOCK_CALENDAR) {
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
    // Important UX choice: Do NOT automatically present the iOS Screen Time report UI when the user
    // opens the calendar. The system report view is intrusive and feels like a modal “pop up”.
    //
    // Instead:
    // - Read cached data if present (non-intrusive).
    // - A future explicit “Sync Screen Time” action can call `presentScreenTimeReportSafeAsync`.
    //
    // Keep the same staleness logic for future explicit sync; for now, just display cached if available.
    if (cached && !isStale(cached.generatedAtIso, 60)) {
      setSummary(cached);
      return;
    }

    setSummary(cached ?? null);
  }, [isStale, supportStatus]);

  useEffect(() => {
    void maybeAutoSync();
  }, [maybeAutoSync]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (selectedDateYmd !== getTodayYmd()) {
      setUsageSummary(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const status = await getUsageAccessAuthorizationStatusSafeAsync();
      if (cancelled) return;
      if (status !== 'authorized') {
        setUsageSummary(null);
        return;
      }
      const usage = await getUsageSummarySafeAsync('today');
      if (cancelled) return;
      setUsageSummary(usage);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedDateYmd]);

  const refreshActualEventsForSelectedDay = useCallback(async (): Promise<void> => {
    if (!userId) return;
    const events = await loadActualForDay(selectedDateYmd);
    if (!isMountedRef.current) return;
    setActualEventsForDate(selectedDateYmd, events);
  }, [loadActualForDay, selectedDateYmd, setActualEventsForDate, userId]);

  useEffect(() => {
    if (!userId || !userPreferences.realTimeUpdates) return;
    const channel = supabase.channel(`tm-events-${userId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'tm',
        table: 'events',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void loadPlannedForDay(selectedDateYmd).then((events) => {
          setPlannedEventsForDate(selectedDateYmd, events);
        });
        void refreshActualEventsForSelectedDay();
      },
    );
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'tm',
        table: 'screen_time_app_sessions',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void refreshVerification();
      },
    );
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'tm',
        table: 'health_workouts',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void refreshVerification();
      },
    );
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'tm',
        table: 'location_hourly',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void refreshVerification();
      },
    );
    channel.subscribe();
    return () => {
      void channel.unsubscribe();
    };
  }, [
    loadPlannedForDay,
    refreshActualEventsForSelectedDay,
    refreshVerification,
    selectedDateYmd,
    setPlannedEventsForDate,
    userId,
    userPreferences.realTimeUpdates,
  ]);

  const lastAlertRef = useRef<string>('');
  useEffect(() => {
    if (!userPreferences.verificationAlerts) return;
    if (!verificationResults || verificationResults.size === 0) return;
    const flagged = plannedEvents.filter((event) => {
      const result = verificationResults.get(event.id);
      return result?.status === 'contradicted' || result?.status === 'distracted';
    });
    const actionable = flagged.filter((event) => event.category !== 'sleep');
    if (actionable.length === 0) return;
    const alertKey = actionable.map((event) => event.id).join('|');
    if (alertKey === lastAlertRef.current) return;
    lastAlertRef.current = alertKey;
    const preview = actionable.slice(0, 3).map((event) => event.title).join(', ');
    const suffix = actionable.length > 3 ? '…' : '';
    Alert.alert('Verification alert', `We found conflicts for: ${preview}${suffix}`);
  }, [plannedEvents, userPreferences.verificationAlerts, verificationResults]);

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
      appCategoryOverrides,
    });

    setDerivedActualEvents(derived);
  }, [actualEvents, appCategoryOverrides, setDerivedActualEvents, status, summary, supportStatus]);

  // Actual events are Supabase-backed (no mock defaults). Screen Time derivation remains separate.
  const displayActualEvents = actualEvents;

  // Refresh actual events when the app returns to foreground while this screen is mounted.
  useEffect(() => {
    isMountedRef.current = true;
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') return;
      void refreshActualEventsForSelectedDay();
    });
    return () => {
      isMountedRef.current = false;
      subscription.remove();
    };
  }, [refreshActualEventsForSelectedDay]);

  // While the calendar screen is visible, periodically refresh actual events.
  // This allows backend ingested Google events (e.g. every ~4h) to appear without requiring navigation.
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      void refreshActualEventsForSelectedDay();
    }, 5 * 60_000); // 5 minutes
    return () => clearInterval(interval);
  }, [refreshActualEventsForSelectedDay, userId]);

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

  // Combine Supabase actual events with verified/derived actual blocks
  const combinedActualEvents = useMemo(() => {
    return buildActualDisplayEvents({
      ymd: selectedDateYmd,
      plannedEvents,
      actualEvents: displayActualEvents,
      derivedActualEvents,
      actualBlocks,
      evidence,
      verificationResults,
      usageSummary,
      patternIndex,
      appCategoryOverrides,
      gapFillingPreference: userPreferences.gapFillingPreference,
      confidenceThreshold: userPreferences.confidenceThreshold,
      allowAutoSuggestions: userPreferences.autoSuggestEvents,
      locationMappings, // US-022: User's custom location-to-activity mappings
      appMappings, // US-023: User's custom app-to-activity mappings
    });
  }, [
    actualBlocks,
    appCategoryOverrides,
    appMappings, // US-023
    derivedActualEvents,
    displayActualEvents,
    evidence,
    locationMappings, // US-022
    plannedEvents,
    patternIndex,
    selectedDateYmd,
    userPreferences,
    usageSummary,
    verificationResults,
  ]);

  useEffect(() => {
    if (!userId) return;
    if (!actualBlocks || actualBlocks.length === 0) return;
    const fingerprint = actualBlocks
      .map((block) => `${block.source}:${block.startMinutes}:${block.endMinutes}`)
      .join('|');
    if (evidenceSyncRef.current?.ymd === selectedDateYmd && evidenceSyncRef.current?.fingerprint === fingerprint) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await syncActualEvidenceBlocks({ userId, ymd: selectedDateYmd, blocks: actualBlocks });
        if (cancelled) return;
        evidenceSyncRef.current = { ymd: selectedDateYmd, fingerprint };
        await refreshActualEventsForSelectedDay();
      } catch (error) {
        if (__DEV__) {
          console.warn('[Calendar] Failed to sync actual evidence blocks:', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actualBlocks, refreshActualEventsForSelectedDay, selectedDateYmd, userId]);

  // Automatically sync derived actual events to Supabase
  useEffect(() => {
    if (!userId || USE_MOCK_CALENDAR) return;
    if (!combinedActualEvents || combinedActualEvents.length === 0) return;

    // Filter for derived events that need to be saved
    const derivedEvents = combinedActualEvents.filter(
      (event) => event.id.startsWith(DERIVED_ACTUAL_PREFIX) || event.id.startsWith(DERIVED_EVIDENCE_PREFIX)
    );

    if (derivedEvents.length === 0) return;

    // Create fingerprint to avoid duplicate syncs
    const fingerprint = derivedEvents
      .map((event) => `${event.id}:${event.startMinutes}:${event.duration}`)
      .sort()
      .join('|');

    if (
      derivedEventsSyncRef.current?.ymd === selectedDateYmd &&
      derivedEventsSyncRef.current?.fingerprint === fingerprint
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const saved = await syncDerivedActualEvents({
          userId,
          ymd: selectedDateYmd,
          derivedEvents,
        });
        if (cancelled) return;
        if (saved.length > 0) {
          // Refresh actual events to include the newly saved ones
          await refreshActualEventsForSelectedDay();
        }
        derivedEventsSyncRef.current = { ymd: selectedDateYmd, fingerprint };
      } catch (error) {
        if (__DEV__) {
          console.warn('[Calendar] Failed to sync derived actual events:', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [combinedActualEvents, refreshActualEventsForSelectedDay, selectedDateYmd, userId]);

  return (
    <ComprehensiveCalendarTemplate
      selectedDate={selectedDate}
      plannedEvents={plannedEvents}
      actualEvents={combinedActualEvents}
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
