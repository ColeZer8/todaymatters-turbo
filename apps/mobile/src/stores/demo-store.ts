import { create } from 'zustand';

export type TimeOfDay = 'devotional' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

interface TimePreset {
  id: TimeOfDay;
  label: string;
  hour: number;
  minute: number;
  greeting: string;
}

export const TIME_PRESETS: Record<TimeOfDay, TimePreset> = {
  devotional: {
    id: 'devotional',
    label: 'Wake Up',
    hour: 6,
    minute: 0,
    greeting: 'Good morning',
  },
  morning: {
    id: 'morning',
    label: 'Morning',
    hour: 8,
    minute: 30,
    greeting: 'Good morning',
  },
  midday: {
    id: 'midday',
    label: 'Midday',
    hour: 12,
    minute: 0,
    greeting: 'Good afternoon',
  },
  afternoon: {
    id: 'afternoon',
    label: 'Afternoon',
    hour: 15,
    minute: 30,
    greeting: 'Good afternoon',
  },
  evening: {
    id: 'evening',
    label: 'Evening',
    hour: 18,
    minute: 30,
    greeting: 'Good evening',
  },
  night: {
    id: 'night',
    label: 'Night',
    hour: 21,
    minute: 0,
    greeting: 'Good evening',
  },
};

interface DemoState {
  // Whether demo mode is active
  isActive: boolean;
  // Selected time of day preset
  timeOfDay: TimeOfDay;
  // Computed values
  simulatedHour: number;
  simulatedMinute: number;
  greeting: string;
  // Actions
  setActive: (active: boolean) => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  getFormattedTime: () => string;
  getSimulatedDate: () => Date;
}

export const useDemoStore = create<DemoState>()((set, get) => ({
  isActive: false,
  timeOfDay: 'morning',
  simulatedHour: TIME_PRESETS.morning.hour,
  simulatedMinute: TIME_PRESETS.morning.minute,
  greeting: TIME_PRESETS.morning.greeting,

  setActive: (active) => set({ isActive: active }),

  setTimeOfDay: (time) => {
    const preset = TIME_PRESETS[time];
    set({
      timeOfDay: time,
      simulatedHour: preset.hour,
      simulatedMinute: preset.minute,
      greeting: preset.greeting,
    });
  },

  getFormattedTime: () => {
    const { simulatedHour, simulatedMinute } = get();
    const hour12 = simulatedHour % 12 || 12;
    const ampm = simulatedHour >= 12 ? 'PM' : 'AM';
    const minStr = simulatedMinute.toString().padStart(2, '0');
    return `${hour12}:${minStr} ${ampm}`;
  },

  getSimulatedDate: () => {
    const { simulatedHour, simulatedMinute } = get();
    const date = new Date();
    date.setHours(simulatedHour, simulatedMinute, 0, 0);
    return date;
  },
}));

/**
 * Hook to get the current greeting based on time
 * In demo mode, returns the simulated greeting
 * Otherwise, returns greeting based on actual time
 */
export const useGreeting = (): string => {
  const isActive = useDemoStore((state) => state.isActive);
  const demoGreeting = useDemoStore((state) => state.greeting);

  if (isActive) {
    return demoGreeting;
  }

  // Real time greeting
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Hook to get current hour (simulated in demo mode, real otherwise)
 */
export const useCurrentHour = (): number => {
  const isActive = useDemoStore((state) => state.isActive);
  const simulatedHour = useDemoStore((state) => state.simulatedHour);

  if (isActive) {
    return simulatedHour;
  }

  return new Date().getHours();
};

/**
 * Hook to get current minutes from midnight (simulated in demo mode, real otherwise)
 * This is used by ScheduleList to show time-appropriate events
 */
export const useCurrentMinutes = (): number => {
  const isActive = useDemoStore((state) => state.isActive);
  const simulatedHour = useDemoStore((state) => state.simulatedHour);
  const simulatedMinute = useDemoStore((state) => state.simulatedMinute);

  if (isActive) {
    return simulatedHour * 60 + simulatedMinute;
  }

  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};






