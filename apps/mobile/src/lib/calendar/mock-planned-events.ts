import type { ScheduledEvent } from '@/stores';

/**
 * Mock planned events for demo/dev usage.
 * These are intentionally deterministic and do NOT touch Supabase.
 */
const BASE_MOCK_PLANNED_EVENTS: Array<Omit<ScheduledEvent, 'id'>> = [
  {
    title: 'Morning Routine',
    description: 'Prayer & Exercise',
    startMinutes: 7 * 60,
    duration: 60,
    category: 'routine',
  },
  {
    title: 'Deep Work',
    description: 'Q4 Strategy Deck',
    startMinutes: 9 * 60,
    duration: 180,
    category: 'work',
    isBig3: true,
  },
  {
    title: 'Lunch',
    description: 'Take a real break',
    startMinutes: 12 * 60,
    duration: 60,
    category: 'meal',
  },
  {
    title: 'Team Sync',
    description: 'Weekly Standup',
    startMinutes: 13 * 60,
    duration: 60,
    category: 'meeting',
  },
  {
    title: 'Shutdown Ritual',
    description: 'Clear inbox',
    startMinutes: 17 * 60,
    duration: 30,
    category: 'routine',
  },
  {
    title: 'Family Dinner',
    description: 'No phones',
    startMinutes: 18 * 60 + 30,
    duration: 90,
    category: 'family',
  },
];

export function getMockPlannedEventsForDay(ymd: string): ScheduledEvent[] {
  return BASE_MOCK_PLANNED_EVENTS.map((e, index) => ({
    ...e,
    id: `mock_${ymd}_${index}`,
  }));
}


