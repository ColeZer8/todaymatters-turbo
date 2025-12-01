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
  categoriesByType: Record<'weekdays' | 'weekends' | 'custom', IdealDayCategory[]>;
  selectedDaysByType: Record<'weekdays' | 'weekends' | 'custom', number[]>;
  setDayType: (type: IdealDayState['dayType']) => void;
  setHours: (id: string, hours: number) => void;
  addCategory: (name: string, color: string) => void;
  deleteCategory: (id: string) => void;
  toggleDay: (dayIndex: number) => void;
}

const DEFAULT_CATEGORIES: IdealDayCategory[] = [
  { id: 'sleep', name: 'Sleep', hours: 8, maxHours: 12, color: '#4F8BFF', icon: Moon },
  { id: 'work', name: 'Work', hours: 6.5, maxHours: 12, color: '#1FA56E', icon: Briefcase },
  { id: 'family', name: 'Family', hours: 3, maxHours: 6, color: '#F59E0B', icon: Users },
  { id: 'prayer', name: 'Prayer', hours: 1, maxHours: 3, color: '#F33C83', icon: HeartPulse },
  { id: 'fitness', name: 'Fitness', hours: 1, maxHours: 3, color: '#F95C2E', icon: Dumbbell },
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
  categoriesByType: {
    weekdays: [...DEFAULT_CATEGORIES],
    weekends: [...DEFAULT_CATEGORIES],
    custom: [...DEFAULT_CATEGORIES],
  },
  selectedDaysByType: {
    weekdays: [0, 1, 2, 3, 4],
    weekends: [5, 6],
    custom: [],
  },
  setDayType: (type) =>
    set((state) => ({
      dayType: type,
      selectedDaysByType: {
        ...state.selectedDaysByType,
        [type]: type === 'weekdays' ? [0, 1, 2, 3, 4] : type === 'weekends' ? [5, 6] : [],
      },
    })),
  setHours: (id, hours) =>
    set((state) => {
      const current = state.categoriesByType[state.dayType] || [];
      const total = current.reduce((sum, cat) => sum + cat.hours, 0);
      return {
        categoriesByType: {
          ...state.categoriesByType,
          [state.dayType]: current.map((cat) =>
            cat.id === id
              ? { ...cat, hours: clampHours(hours, 24, total, cat.hours, cat.maxHours) }
              : cat
          ),
        },
      };
    }),
  addCategory: (name, color) =>
    set((state) => ({
      categoriesByType: {
        ...state.categoriesByType,
        [state.dayType]: [
          ...state.categoriesByType[state.dayType],
          {
            id: `${Date.now()}`,
            name,
            hours: 1,
            maxHours: 6,
            color,
            icon: Sparkles,
          },
        ],
      },
    })),
  deleteCategory: (id) =>
    set((state) => ({
      categoriesByType: {
        ...state.categoriesByType,
        [state.dayType]: state.categoriesByType[state.dayType].filter((cat) => cat.id !== id),
      },
    })),
  toggleDay: (dayIndex) =>
    set((state) => {
      const current = state.selectedDaysByType[state.dayType] || [];
      const exists = current.includes(dayIndex);
      const next = exists ? current.filter((d) => d !== dayIndex) : [...current, dayIndex];
      return {
        selectedDaysByType: {
          ...state.selectedDaysByType,
          [state.dayType]: next,
        },
      };
    }),
}));
