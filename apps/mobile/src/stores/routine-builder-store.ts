import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ComponentType } from 'react';
import { BookOpenCheck, Droplet, Moon, Sun, UtensilsCrossed } from 'lucide-react-native';
import type { RoutineItem } from '@/components/templates/RoutineBuilderTemplate';

type IconKey = 'droplet' | 'book' | 'utensils' | 'moon' | 'sun';

const iconMap: Record<IconKey, ComponentType<{ size?: number; color?: string }>> = {
  droplet: Droplet,
  book: BookOpenCheck,
  utensils: UtensilsCrossed,
  moon: Moon,
  sun: Sun,
};

// Serializable version without icon component
interface SerializableRoutineItem {
  id: string;
  title: string;
  minutes: number;
  iconKey: IconKey;
}

type RoutineState = {
  wakeTime: string;
  items: Array<RoutineItem & { iconKey: IconKey }>;
  _hasHydrated: boolean;
  setItems: (items: RoutineState['items']) => void;
  updateMinutes: (id: string, minutes: number) => void;
  addItem: (title: string) => void;
  deleteItem: (id: string) => void;
};

const DEFAULT_ITEMS: RoutineState['items'] = [
  { id: 'hydrate', title: 'Hydrate', minutes: 2, icon: Droplet, iconKey: 'droplet' },
  { id: 'prayer', title: 'Prayer Time', minutes: 15, icon: BookOpenCheck, iconKey: 'book' },
];

// Restore icon from iconKey
const restoreIcon = (item: SerializableRoutineItem): RoutineState['items'][0] => ({
  ...item,
  icon: iconMap[item.iconKey] || Droplet,
});

export const useRoutineBuilderStore = create<RoutineState>()(
  persist(
    (set) => ({
      wakeTime: '06:30',
      items: DEFAULT_ITEMS,
      _hasHydrated: false,
      setItems: (items) => set({ items }),
      updateMinutes: (id, minutes) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, minutes: Math.max(1, minutes) } : item
          ),
        })),
      addItem: (title) =>
        set((state) => {
          const icons: IconKey[] = ['droplet', 'book', 'utensils', 'moon', 'sun'];
          const iconKey = icons[state.items.length % icons.length];
          const Icon = iconMap[iconKey];
          const id = `${Date.now()}`;
          return {
            items: [...state.items, { id, title, minutes: 5, icon: Icon, iconKey }],
          };
        }),
      deleteItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
    }),
    {
      name: 'routine-builder-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        wakeTime: state.wakeTime,
        // Strip icon function before saving
        items: state.items.map(({ icon, ...rest }) => rest),
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          wakeTime?: string;
          items?: SerializableRoutineItem[];
        } | undefined;

        console.log('🔀 Routine Builder - Loading saved data');

        if (!persisted) {
          return { ...currentState, _hasHydrated: true };
        }

        return {
          ...currentState,
          wakeTime: persisted.wakeTime ?? currentState.wakeTime,
          items: persisted.items ? persisted.items.map(restoreIcon) : currentState.items,
          _hasHydrated: true,
        };
      },
      onRehydrateStorage: () => () => {
        console.log('✅ Routine Builder - Hydration complete');
      },
    }
  )
);

export const getIconByKey = (key: IconKey) => iconMap[key];
