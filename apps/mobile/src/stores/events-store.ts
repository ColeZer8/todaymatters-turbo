import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Category types matching ComprehensiveCalendarTemplate
export type EventCategory =
  | 'routine'
  | 'work'
  | 'meal'
  | 'meeting'
  | 'health'
  | 'family'
  | 'social'
  | 'travel'
  | 'finance'
  | 'comm'
  | 'digital'
  | 'sleep'
  | 'unknown'
  | 'free';

export interface CalendarEventMeta {
  category: EventCategory;
  isBig3?: boolean;
  location?: string | null;
  value_label?: string | null;
  goal_title?: string | null;
  initiative_title?: string | null;
  goal_contribution?: number | null;
  note?: string | null;
  source_provider?: string | null;
  external_id?: string | null;
  source?: 'user' | 'system' | 'evidence' | 'derived' | 'user_input' | 'actual_adjust';
  plannedEventId?: string;
  kind?:
    | 'sleep_schedule'
    | 'sleep_interrupted'
    | 'sleep_late'
    | 'screen_time'
    | 'unknown_gap'
    | 'pattern_gap'
    | 'planned_actual'
    | 'evidence_block'
    | 'transition_commute'
    | 'transition_prep'
    | 'transition_wind_down'
    | 'location_inferred'
    | 'late_arrival'
    | 'different_activity'
    | 'distraction';
  startYmd?: string;
  actual?: boolean;
  tags?: string[];
  source_id?: string;
  suggested_category?: EventCategory;
  confidence?: number;
  evidence?: {
    locationLabel?: string | null;
    screenTimeMinutes?: number;
    topApp?: string | null;
    /** Whether this screen time occurred during a sleep event (US-012) */
    duringSleep?: boolean;
    sleep?: {
      interruptions?: number;
      interruptionMinutes?: number;
      asleepMinutes?: number | null;
      deepMinutes?: number | null;
      remMinutes?: number | null;
      awakeMinutes?: number | null;
      inBedMinutes?: number | null;
      wakeTimeMinutes?: number | null;
      hrvMs?: number | null;
      restingHeartRateBpm?: number | null;
      heartRateAvgBpm?: number | null;
      qualityScore?: number | null;
    };
    conflicts?: Array<{ source: 'location' | 'screen_time' | 'health' | 'pattern'; detail: string }>;
    /** Late arrival information when user arrived late to a planned event */
    lateArrival?: {
      /** How many minutes late the user arrived */
      lateMinutes: number;
      /** The planned start time (in minutes from midnight) */
      plannedStartMinutes: number;
      /** The actual start time (in minutes from midnight) */
      actualStartMinutes: number;
      /** Evidence source that detected the late arrival */
      evidenceSource: 'location' | 'screen_time';
    };
    /** Different activity information when user did something different than planned */
    differentActivity?: {
      /** The title of the planned event */
      plannedTitle: string;
      /** The planned event category */
      plannedCategory: EventCategory;
      /** The actual activity label (e.g., place name) */
      actualLabel: string;
      /** The actual activity category inferred from location */
      actualCategory: EventCategory;
      /** Evidence source that detected the different activity */
      evidenceSource: 'location' | 'screen_time';
      /** The place label from location evidence */
      placeLabel: string;
      /** The place category from location evidence (e.g., "fast_food", "cafe") */
      placeCategory: string | null;
    };
    /** Distraction information when user was distracted during a planned activity (US-013) */
    distraction?: {
      /** Total minutes of distraction app usage */
      totalMinutes: number;
      /** The planned event title */
      plannedTitle: string;
      /** The planned event category */
      plannedCategory: EventCategory;
      /** The top distraction app used */
      topApp: string | null;
      /** All distraction apps and their usage minutes */
      apps: Array<{ appName: string; minutes: number }>;
    };
    /** Suggestions for unknown gap based on planned events (US-014) */
    unknownGapSuggestions?: Array<{
      /** The suggested event title */
      title: string;
      /** The suggested event category */
      category: EventCategory;
      /** The planned event ID this suggestion is based on */
      plannedEventId: string;
      /** How much of the unknown gap overlaps with this planned event (0-1) */
      overlapRatio: number;
      /** Optional location from the planned event */
      location?: string | null;
    }>;
    /** Whether this event was created as a fallback due to sparse location data (US-025) */
    sparseLocationFallback?: boolean;
  };
  evidenceFusion?: {
    confidence: number;
    sources: Array<{ type: 'location' | 'screen_time' | 'health' | 'pattern' | 'user_history'; weight: number; detail: string }>;
    conflicts: Array<{
      source1: 'location' | 'screen_time' | 'health' | 'pattern';
      source2: 'plan' | 'pattern';
      conflict: string;
      resolution: 'source1_wins' | 'source2_wins' | 'compromise' | 'unresolved';
    }>;
    /** US-024: Unified pipeline metadata */
    sourceType?: 'user_actual' | 'supabase_derived' | 'evidence_block' | 'screen_time' | 'planned_crossref' | 'location' | 'sleep' | 'pattern' | 'unknown';
    fusionId?: string;
    fusedAt?: number;
    evidenceDescription?: string;
    isDerived?: boolean;
    contributingSources?: Array<'user_actual' | 'supabase_derived' | 'evidence_block' | 'screen_time' | 'planned_crossref' | 'location' | 'sleep' | 'pattern' | 'unknown'>;
  };
  dataQuality?: {
    freshnessMinutes?: number | null;
    completeness: number;
    reliability: number;
    sources: string[];
  };
  patternSummary?: {
    confidence: number;
    sampleCount: number;
    typicalCategory?: EventCategory;
    deviation?: boolean;
  };
  learnedFrom?: {
    originalId?: string;
    kind?: CalendarEventMeta['kind'];
    source?: CalendarEventMeta['source'];
    title?: string;
    category?: EventCategory;
    confidence?: number | null;
    topApp?: string | null;
  };
  verificationReport?: {
    status: string;
    confidence: number;
    discrepancies?: Array<{ type: string; expected: string; actual: string; severity: string }>;
    suggestions?: string[];
  };
  ai?: {
    confidence?: number;
    reason?: string;
  };
}

export interface ScheduledEvent {
  id: string;
  title: string;
  description: string;
  location?: string;
  /** Minutes from midnight, e.g., 9 * 60 = 540 for 9:00 AM */
  startMinutes: number;
  /** Duration in minutes */
  duration: number;
  category: EventCategory;
  /** Whether this is a Big 3 priority item */
  isBig3?: boolean;
  meta?: CalendarEventMeta;
}

interface EventsState {
  /** Selected day (YYYY-MM-DD) for calendar views */
  selectedDateYmd: string;
  /** Planned events keyed by day (YYYY-MM-DD) */
  plannedEventsByDate: Record<string, ScheduledEvent[]>;
  /**
   * Backward-compatible view of planned events for the selected date.
   * Prefer `plannedEventsByDate[selectedDateYmd]` when writing new code.
   */
  scheduledEvents: ScheduledEvent[];
  /** Actual events (what really happened) */
  actualDateYmd: string;
  actualEventsByDate: Record<string, ScheduledEvent[]>;
  /**
   * Backward-compatible view of actual events for the selected actual date.
   * Prefer `actualEventsByDate[actualDateYmd]` when writing new code.
   */
  actualEvents: ScheduledEvent[];
  /**
   * Derived Actual events (e.g., inferred from Screen Time) used for display only.
   * IMPORTANT: This should not be persisted; it is regenerated on-demand.
   */
  derivedActualEvents: ScheduledEvent[] | null;
  _hasHydrated: boolean;
  setSelectedDateYmd: (ymd: string) => void;
  setPlannedEventsForDate: (ymd: string, events: ScheduledEvent[]) => void;
  setScheduledEvents: (events: ScheduledEvent[]) => void;
  setActualEvents: (events: ScheduledEvent[]) => void;
  setActualDateYmd: (ymd: string) => void;
  setActualEventsForDate: (ymd: string, events: ScheduledEvent[]) => void;
  setDerivedActualEvents: (events: ScheduledEvent[] | null) => void;
  addScheduledEvent: (event: ScheduledEvent, ymd?: string) => void;
  updateScheduledEvent: (event: ScheduledEvent, ymd?: string) => void;
  removeScheduledEvent: (id: string, ymd?: string) => void;
  addActualEvent: (event: ScheduledEvent, ymd?: string) => void;
  updateActualEvent: (event: ScheduledEvent, ymd?: string) => void;
  removeActualEvent: (id: string, ymd?: string) => void;
  toggleBig3: (id: string) => void;
}

// Default ACTUAL events - source of truth is Supabase. No mock defaults.
const DEFAULT_ACTUAL_EVENTS: ScheduledEvent[] = [];

export function getTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizePlanned(events: ScheduledEvent[]): ScheduledEvent[] {
  return [...events].sort((a, b) => a.startMinutes - b.startMinutes);
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set) => ({
      selectedDateYmd: getTodayYmd(),
      plannedEventsByDate: {},
      scheduledEvents: [],
      actualDateYmd: getTodayYmd(),
      actualEventsByDate: {},
      actualEvents: DEFAULT_ACTUAL_EVENTS,
      derivedActualEvents: null,
      _hasHydrated: false,

      setSelectedDateYmd: (ymd) =>
        set((state) => {
          if (state.selectedDateYmd === ymd) return {};
          return {
            selectedDateYmd: ymd,
            scheduledEvents: state.plannedEventsByDate[ymd] ?? [],
          };
        }),

      setPlannedEventsForDate: (ymd, events) =>
        set((state) => {
          const normalized = normalizePlanned(events);
          const nextByDate = { ...state.plannedEventsByDate, [ymd]: normalized };
          const isSelected = ymd === state.selectedDateYmd;
          return {
            plannedEventsByDate: nextByDate,
            scheduledEvents: isSelected ? normalized : state.scheduledEvents,
          };
        }),

      setScheduledEvents: (events) => set({ scheduledEvents: events }),
      setActualEvents: (events) => set({ actualEvents: events }),
      setActualDateYmd: (ymd) =>
        set((state) => {
          if (state.actualDateYmd === ymd) return {};
          return {
            actualDateYmd: ymd,
            actualEvents: state.actualEventsByDate[ymd] ?? [],
          };
        }),
      setActualEventsForDate: (ymd, events) =>
        set((state) => {
          const normalized = normalizePlanned(events);
          const nextByDate = { ...state.actualEventsByDate, [ymd]: normalized };
          const isSelected = ymd === state.actualDateYmd;
          return {
            actualEventsByDate: nextByDate,
            actualEvents: isSelected ? normalized : state.actualEvents,
          };
        }),
      setDerivedActualEvents: (events) => set({ derivedActualEvents: events }),

      addScheduledEvent: (event, ymd) =>
        set((state) => {
          const targetYmd = ymd ?? state.selectedDateYmd;
          const prev = state.plannedEventsByDate[targetYmd] ?? [];
          const nextList = normalizePlanned([...prev, event]);
          const nextByDate = { ...state.plannedEventsByDate, [targetYmd]: nextList };
          const isSelected = targetYmd === state.selectedDateYmd;
          return {
            plannedEventsByDate: nextByDate,
            scheduledEvents: isSelected ? nextList : state.scheduledEvents,
          };
        }),

      updateScheduledEvent: (event, ymd) =>
        set((state) => {
          const targetYmd = ymd ?? state.selectedDateYmd;
          const prev = state.plannedEventsByDate[targetYmd] ?? [];
          const nextList = normalizePlanned(prev.map((e) => (e.id === event.id ? event : e)));
          const nextByDate = { ...state.plannedEventsByDate, [targetYmd]: nextList };
          const isSelected = targetYmd === state.selectedDateYmd;
          return {
            plannedEventsByDate: nextByDate,
            scheduledEvents: isSelected ? nextList : state.scheduledEvents,
          };
        }),

      removeScheduledEvent: (id, ymd) =>
        set((state) => {
          const targetYmd = ymd ?? state.selectedDateYmd;
          const prev = state.plannedEventsByDate[targetYmd] ?? [];
          const nextList = prev.filter((e) => e.id !== id);
          const nextByDate = { ...state.plannedEventsByDate, [targetYmd]: nextList };
          const isSelected = targetYmd === state.selectedDateYmd;
          return {
            plannedEventsByDate: nextByDate,
            scheduledEvents: isSelected ? nextList : state.scheduledEvents,
          };
        }),

      addActualEvent: (event, ymd) =>
        set((state) => {
          const targetYmd = ymd ?? state.actualDateYmd;
          const prev = state.actualEventsByDate[targetYmd] ?? [];
          const nextList = normalizePlanned([...prev, event]);
          const nextByDate = { ...state.actualEventsByDate, [targetYmd]: nextList };
          const isSelected = targetYmd === state.actualDateYmd;
          return {
            actualEventsByDate: nextByDate,
            actualEvents: isSelected ? nextList : state.actualEvents,
          };
        }),

      updateActualEvent: (event, ymd) =>
        set((state) => {
          const targetYmd = ymd ?? state.actualDateYmd;
          const prev = state.actualEventsByDate[targetYmd] ?? [];
          const nextList = normalizePlanned(prev.map((e) => (e.id === event.id ? event : e)));
          const nextByDate = { ...state.actualEventsByDate, [targetYmd]: nextList };
          const isSelected = targetYmd === state.actualDateYmd;
          return {
            actualEventsByDate: nextByDate,
            actualEvents: isSelected ? nextList : state.actualEvents,
          };
        }),

      removeActualEvent: (id, ymd) =>
        set((state) => {
          const targetYmd = ymd ?? state.actualDateYmd;
          const prev = state.actualEventsByDate[targetYmd] ?? [];
          const nextList = prev.filter((e) => e.id !== id);
          const nextByDate = { ...state.actualEventsByDate, [targetYmd]: nextList };
          const isSelected = targetYmd === state.actualDateYmd;
          return {
            actualEventsByDate: nextByDate,
            actualEvents: isSelected ? nextList : state.actualEvents,
          };
        }),

      toggleBig3: (id) =>
        set((state) => ({
          plannedEventsByDate: {
            ...state.plannedEventsByDate,
            [state.selectedDateYmd]: (state.plannedEventsByDate[state.selectedDateYmd] ?? []).map((e) =>
              e.id === id ? { ...e, isBig3: !e.isBig3 } : e
            ),
          },
          scheduledEvents: state.scheduledEvents.map((e) => (e.id === id ? { ...e, isBig3: !e.isBig3 } : e)),
        })),
    }),
    {
      name: 'events-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedDateYmd: state.selectedDateYmd,
        plannedEventsByDate: state.plannedEventsByDate,
        actualDateYmd: state.actualDateYmd,
        actualEventsByDate: state.actualEventsByDate,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          selectedDateYmd?: string;
          plannedEventsByDate?: Record<string, ScheduledEvent[]>;
          actualDateYmd?: string;
          actualEventsByDate?: Record<string, ScheduledEvent[]>;
        } | undefined;

        if (!persisted) {
          return { ...currentState, _hasHydrated: true };
        }

        const selectedDateYmd = persisted.selectedDateYmd ?? currentState.selectedDateYmd;
        const plannedEventsByDate = persisted.plannedEventsByDate ?? currentState.plannedEventsByDate;
        const actualDateYmd = persisted.actualDateYmd ?? currentState.actualDateYmd;
        const actualEventsByDate = persisted.actualEventsByDate ?? currentState.actualEventsByDate;

        return {
          ...currentState,
          selectedDateYmd,
          plannedEventsByDate,
          scheduledEvents: plannedEventsByDate[selectedDateYmd] ?? [],
          actualDateYmd,
          actualEventsByDate,
          actualEvents: actualEventsByDate[actualDateYmd] ?? [],
          _hasHydrated: true,
        };
      },
      onRehydrateStorage: () => () => {
        console.log('✅ Events Store - Hydration complete');
      },
    }
  )
);

// Helper to get current minutes from midnight
export const getCurrentMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

// Helper to format minutes to display time like "9:30 AM"
export const formatMinutesToDisplay = (minutes: number): string => {
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return mins === 0 ? `${hours12}:00 ${period}` : `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
};




