import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Moon, Briefcase, Users, HeartPulse, Dumbbell, Sparkles } from 'lucide-react-native';
import type { ComponentType } from 'react';

// Icon name to component mapping for serialization
const ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  Moon,
  Briefcase,
  Users,
  HeartPulse,
  Dumbbell,
  Sparkles,
};

export interface IdealDayCategory {
  id: string;
  name: string;
  hours: number;
  color: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  iconName: string; // For persistence
  maxHours: number;
}

type DayType = 'weekdays' | 'saturday' | 'sunday' | 'custom';

interface IdealDayState {
  dayType: DayType;
  categoriesByType: Record<DayType, IdealDayCategory[]>;
  selectedDaysByType: Record<DayType, number[]>;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setDayType: (type: DayType) => void;
  setHours: (id: string, hours: number) => void;
  addCategory: (name: string, color: string) => void;
  deleteCategory: (id: string) => void;
  toggleDay: (dayIndex: number) => void;
}

const DEFAULT_CATEGORIES: IdealDayCategory[] = [
  { id: 'sleep', name: 'Sleep', hours: 8, maxHours: 12, color: '#4F8BFF', icon: Moon, iconName: 'Moon' },
  { id: 'work', name: 'Work', hours: 6.5, maxHours: 12, color: '#1FA56E', icon: Briefcase, iconName: 'Briefcase' },
  { id: 'family', name: 'Family', hours: 3, maxHours: 6, color: '#F59E0B', icon: Users, iconName: 'Users' },
  { id: 'prayer', name: 'Prayer', hours: 1, maxHours: 3, color: '#F33C83', icon: HeartPulse, iconName: 'HeartPulse' },
  { id: 'fitness', name: 'Fitness', hours: 1, maxHours: 3, color: '#F95C2E', icon: Dumbbell, iconName: 'Dumbbell' },
];

// Serializable category (without icon function)
interface SerializableCategory {
  id: string;
  name: string;
  hours: number;
  color: string;
  iconName: string;
  maxHours: number;
}

// Strip icon from category for serialization
const stripIcon = (cat: IdealDayCategory): SerializableCategory => ({
  id: cat.id,
  name: cat.name,
  hours: cat.hours,
  color: cat.color,
  iconName: cat.iconName,
  maxHours: cat.maxHours,
});

// Restore icon from iconName after hydration
const restoreIcon = (cat: SerializableCategory): IdealDayCategory => ({
  ...cat,
  icon: ICON_MAP[cat.iconName] || Sparkles,
});

// Strip icons from all categories for storage
const serializeCategoriesByType = (
  categoriesByType: Record<DayType, IdealDayCategory[]>
): Record<DayType, SerializableCategory[]> => ({
  weekdays: categoriesByType.weekdays.map(stripIcon),
  saturday: categoriesByType.saturday.map(stripIcon),
  sunday: categoriesByType.sunday.map(stripIcon),
  custom: categoriesByType.custom.map(stripIcon),
});

// Restore icons to all categories after hydration
const hydrateCategoriesByType = (
  categoriesByType: Record<DayType, SerializableCategory[]>
): Record<DayType, IdealDayCategory[]> => ({
  weekdays: (categoriesByType.weekdays || []).map(restoreIcon),
  saturday: (categoriesByType.saturday || []).map(restoreIcon),
  sunday: (categoriesByType.sunday || []).map(restoreIcon),
  custom: (categoriesByType.custom || []).map(restoreIcon),
});

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

export const useIdealDayStore = create<IdealDayState>()(
  persist(
    (set, get) => ({
      dayType: 'weekdays',
      categoriesByType: {
        weekdays: [...DEFAULT_CATEGORIES],
        saturday: [...DEFAULT_CATEGORIES],
        sunday: [...DEFAULT_CATEGORIES],
        custom: [...DEFAULT_CATEGORIES],
      },
      selectedDaysByType: {
        weekdays: [0, 1, 2, 3, 4],
        saturday: [5],
        sunday: [6],
        custom: [],
      },
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      setDayType: (type) =>
        set((state) => ({
          dayType: type,
          selectedDaysByType: {
            ...state.selectedDaysByType,
            [type]:
              type === 'weekdays'
                ? [0, 1, 2, 3, 4]
                : type === 'saturday'
                  ? [5]
                  : type === 'sunday'
                    ? [6]
                    : [],
          },
        })),
      setHours: (id, hours) =>
        set((state) => {
          const current = state.categoriesByType[state.dayType] || [];
          const total = current.reduce((sum, cat) => sum + cat.hours, 0);
          const newHours = clampHours(hours, 24, total, current.find(c => c.id === id)?.hours || 0, current.find(c => c.id === id)?.maxHours || 12);
          console.log(`⏱️ setHours: ${id} -> ${newHours} (dayType: ${state.dayType})`);
          return {
            categoriesByType: {
              ...state.categoriesByType,
              [state.dayType]: current.map((cat) =>
                cat.id === id
                  ? { ...cat, hours: newHours }
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
                iconName: 'Sparkles',
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
    }),
    {
      name: 'ideal-day-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const serialized = {
          dayType: state.dayType,
          // Strip non-serializable icon functions before saving
          categoriesByType: serializeCategoriesByType(state.categoriesByType),
          selectedDaysByType: state.selectedDaysByType,
        };
        // Log what we're saving
        const weekdayHours = serialized.categoriesByType.weekdays.map(c => `${c.name}:${c.hours}`).join(', ');
        console.log(`💾 Saving: ${serialized.dayType} | weekdays: ${weekdayHours}`);
        return serialized;
      },
      // Custom merge to restore icons from persisted data
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          dayType?: DayType;
          categoriesByType?: Record<DayType, SerializableCategory[]>;
          selectedDaysByType?: Record<DayType, number[]>;
        } | undefined;

        console.log('🔀 Ideal Day - Merging persisted state:', persisted ? 'has data' : 'no data');

        if (!persisted) {
          return { ...currentState, _hasHydrated: true };
        }

        // Log what we're restoring
        if (persisted.categoriesByType?.weekdays) {
          console.log('🔀 Ideal Day - Persisted weekday hours:', 
            persisted.categoriesByType.weekdays.map(c => `${c.name}:${c.hours}`).join(', ')
          );
        }

        // Restore icons from iconName for persisted categories
        const hydratedCategories = persisted.categoriesByType
          ? hydrateCategoriesByType(persisted.categoriesByType)
          : currentState.categoriesByType;

        console.log('🔀 Ideal Day - Restored dayType:', persisted.dayType);

        return {
          ...currentState,
          dayType: persisted.dayType ?? currentState.dayType,
          categoriesByType: hydratedCategories,
          selectedDaysByType: persisted.selectedDaysByType ?? currentState.selectedDaysByType,
          _hasHydrated: true,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('❌ Ideal Day - Rehydration error:', error);
        }
        console.log('✅ Ideal Day - Hydration complete');
      },
    }
  )
);
