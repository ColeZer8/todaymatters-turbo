import { create } from 'zustand';
import { Moon, Briefcase, Users, HeartPulse, Dumbbell, Sparkles } from 'lucide-react-native';
import type { ComponentType } from 'react';

export interface IdealDayCategory {
  id: string;
  name: string;
  hours: number;
  color: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  maxHours: number;
}

interface IdealDayState {
  dayType: 'weekdays' | 'weekends' | 'custom';
  categories: IdealDayCategory[];
  setDayType: (type: IdealDayState['dayType']) => void;
  setHours: (id: string, hours: number) => void;
  addCategory: (name: string, color: string) => void;
  deleteCategory: (id: string) => void;
}

const DEFAULT_CATEGORIES: IdealDayCategory[] = [
  { id: 'sleep', name: 'Sleep', hours: 8, maxHours: 12, color: '#4F8BFF', icon: Moon },
  { id: 'work', name: 'Work', hours: 6.5, maxHours: 12, color: '#22A776', icon: Briefcase },
  { id: 'family', name: 'Family', hours: 3, maxHours: 6, color: '#F59E0B', icon: Users },
  { id: 'prayer', name: 'Prayer', hours: 1, maxHours: 3, color: '#EC4899', icon: HeartPulse },
  { id: 'fitness', name: 'Fitness', hours: 1, maxHours: 3, color: '#F97316', icon: Dumbbell },
];

const clampHours = (
  value: number,
  maxTotal: number,
  currentTotal: number,
  currentValue: number,
  maxCategory: number,
) => {
  const available = maxTotal - (currentTotal - currentValue);
  return Math.max(0, Math.min(value, Math.min(available, maxCategory)));
};

export const useIdealDayStore = create<IdealDayState>((set, get) => ({
  dayType: 'weekdays',
  categories: DEFAULT_CATEGORIES,
  setDayType: (type) => set({ dayType: type }),
  setHours: (id, hours) =>
    set((state) => {
      const total = state.categories.reduce((sum, cat) => sum + cat.hours, 0);
      return {
        categories: state.categories.map((cat) =>
          cat.id === id
            ? { ...cat, hours: clampHours(hours, 24, total, cat.hours, cat.maxHours) }
            : cat
        ),
      };
    }),
  addCategory: (name, color) =>
    set((state) => ({
      categories: [
        ...state.categories,
        {
          id: `${Date.now()}`,
          name,
          hours: 1,
          maxHours: 6,
          color,
          icon: Sparkles,
        },
      ],
    })),
  deleteCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((cat) => cat.id !== id),
    })),
}));
