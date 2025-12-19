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

export interface ScheduledEvent {
  id: string;
  title: string;
  description: string;
  /** Minutes from midnight, e.g., 9 * 60 = 540 for 9:00 AM */
  startMinutes: number;
  /** Duration in minutes */
  duration: number;
  category: EventCategory;
  /** Whether this is a Big 3 priority item */
  isBig3?: boolean;
}

interface EventsState {
  /** Planned events (source of truth) */
  scheduledEvents: ScheduledEvent[];
  /** Actual events (what really happened) */
  actualEvents: ScheduledEvent[];
  _hasHydrated: boolean;
  setScheduledEvents: (events: ScheduledEvent[]) => void;
  setActualEvents: (events: ScheduledEvent[]) => void;
  addScheduledEvent: (event: ScheduledEvent) => void;
  removeScheduledEvent: (id: string) => void;
  toggleBig3: (id: string) => void;
}

// Default PLANNED events - matching ComprehensiveCalendarTemplate
const DEFAULT_SCHEDULED_EVENTS: ScheduledEvent[] = [
  {
    id: 'p_sleep_start',
    title: 'Sleep',
    description: 'Target: 7 hours',
    startMinutes: 0,
    duration: 7 * 60,
    category: 'sleep',
  },
  {
    id: 'p_morning',
    title: 'Morning Routine',
    description: 'Prayer & Exercise',
    startMinutes: 7 * 60,
    duration: 60,
    category: 'routine',
  },
  {
    id: 'p_deep_work',
    title: 'Deep Work',
    description: 'Q4 Strategy Deck',
    startMinutes: 9 * 60,
    duration: 180,
    category: 'work',
    isBig3: true,
  },
  {
    id: 'p_lunch',
    title: 'Lunch',
    description: 'Take a real break',
    startMinutes: 12 * 60,
    duration: 60,
    category: 'meal',
  },
  {
    id: 'p_team_sync',
    title: 'Team Sync',
    description: 'Weekly Standup',
    startMinutes: 13 * 60,
    duration: 60,
    category: 'meeting',
  },
  {
    id: 'p_cole_meeting',
    title: 'Meeting w/ Cole',
    description: 'Strategy Sync',
    startMinutes: 15 * 60,
    duration: 45,
    category: 'meeting',
  },
  {
    id: 'p_shutdown',
    title: 'Shutdown Ritual',
    description: 'Clear inbox',
    startMinutes: 17 * 60,
    duration: 30,
    category: 'routine',
  },
  {
    id: 'p_family',
    title: 'Family Dinner',
    description: 'No phones',
    startMinutes: 18 * 60 + 30,
    duration: 90,
    category: 'family',
  },
  {
    id: 'p_sleep',
    title: 'Sleep',
    description: 'Target: 10 PM',
    startMinutes: 22 * 60,
    duration: 2 * 60,
    category: 'sleep',
  },
];

// Default ACTUAL events - what really happened
const DEFAULT_ACTUAL_EVENTS: ScheduledEvent[] = [
  {
    id: 'a_sleep',
    title: 'Sleep',
    description: 'Overslept 30 min',
    startMinutes: 0,
    duration: 7 * 60 + 30,
    category: 'sleep',
  },
  {
    id: 'a_morning',
    title: 'Rushed Morning',
    description: 'Quick routine',
    startMinutes: 7 * 60 + 30,
    duration: 30,
    category: 'routine',
  },
  {
    id: 'a_commute_in',
    title: 'Commute',
    description: 'Left late, traffic',
    startMinutes: 8 * 60,
    duration: 45,
    category: 'travel',
  },
  {
    id: 'a_coffee',
    title: 'Coffee Stop',
    description: 'Quick Starbucks',
    startMinutes: 8 * 60 + 45,
    duration: 15,
    category: 'meal',
  },
  {
    id: 'a_deep_work_1',
    title: 'Deep Work',
    description: 'Q4 Strategy Deck',
    startMinutes: 9 * 60,
    duration: 150,
    category: 'work',
  },
  {
    id: 'a_unknown_1',
    title: 'Unknown',
    description: 'Tap to assign',
    startMinutes: 11 * 60 + 30,
    duration: 30,
    category: 'unknown',
  },
  {
    id: 'a_lunch',
    title: 'Lunch',
    description: 'With coworkers',
    startMinutes: 12 * 60,
    duration: 50,
    category: 'meal',
  },
  {
    id: 'a_team_sync',
    title: 'Team Sync',
    description: 'Ran 15 min over',
    startMinutes: 13 * 60,
    duration: 75,
    category: 'meeting',
  },
  {
    id: 'a_unknown_2',
    title: 'Unknown',
    description: 'Tap to assign',
    startMinutes: 14 * 60 + 15,
    duration: 45,
    category: 'unknown',
  },
  {
    id: 'a_cole_meeting',
    title: 'Meeting w/ Cole',
    description: 'Ran 30 min over!',
    startMinutes: 15 * 60,
    duration: 75,
    category: 'meeting',
  },
  {
    id: 'a_wrap_up',
    title: 'Wrap Up',
    description: 'Emails only',
    startMinutes: 16 * 60 + 15,
    duration: 45,
    category: 'work',
  },
  {
    id: 'a_commute_home',
    title: 'Commute Home',
    description: 'Rush hour traffic',
    startMinutes: 17 * 60,
    duration: 50,
    category: 'travel',
  },
  {
    id: 'a_errands',
    title: 'Quick Errands',
    description: 'Grocery stop',
    startMinutes: 17 * 60 + 50,
    duration: 25,
    category: 'routine',
  },
  {
    id: 'a_family',
    title: 'Family Dinner',
    description: 'Made it!',
    startMinutes: 18 * 60 + 15,
    duration: 105,
    category: 'family',
  },
  {
    id: 'a_screen_time',
    title: 'Screen Time',
    description: 'YouTube rabbit hole',
    startMinutes: 20 * 60,
    duration: 90,
    category: 'digital',
  },
  {
    id: 'a_wind_down',
    title: 'Wind Down',
    description: 'Finally relaxed',
    startMinutes: 21 * 60 + 30,
    duration: 60,
    category: 'routine',
  },
  {
    id: 'a_sleep_end',
    title: 'Sleep',
    description: '30 min late',
    startMinutes: 22 * 60 + 30,
    duration: 90,
    category: 'sleep',
  },
];

export const useEventsStore = create<EventsState>()(
  persist(
    (set) => ({
      scheduledEvents: DEFAULT_SCHEDULED_EVENTS,
      actualEvents: DEFAULT_ACTUAL_EVENTS,
      _hasHydrated: false,

      setScheduledEvents: (events) => set({ scheduledEvents: events }),
      setActualEvents: (events) => set({ actualEvents: events }),

      addScheduledEvent: (event) =>
        set((state) => ({
          scheduledEvents: [...state.scheduledEvents, event].sort(
            (a, b) => a.startMinutes - b.startMinutes
          ),
        })),

      removeScheduledEvent: (id) =>
        set((state) => ({
          scheduledEvents: state.scheduledEvents.filter((e) => e.id !== id),
        })),

      toggleBig3: (id) =>
        set((state) => ({
          scheduledEvents: state.scheduledEvents.map((e) =>
            e.id === id ? { ...e, isBig3: !e.isBig3 } : e
          ),
        })),
    }),
    {
      name: 'events-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scheduledEvents: state.scheduledEvents,
        actualEvents: state.actualEvents,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          scheduledEvents?: ScheduledEvent[];
          actualEvents?: ScheduledEvent[];
        } | undefined;

        if (!persisted) {
          return { ...currentState, _hasHydrated: true };
        }

        return {
          ...currentState,
          scheduledEvents: persisted.scheduledEvents ?? currentState.scheduledEvents,
          actualEvents: persisted.actualEvents ?? currentState.actualEvents,
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



