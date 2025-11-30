import { create } from 'zustand';
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

type RoutineState = {
  wakeTime: string;
  items: Array<RoutineItem & { iconKey: IconKey }>;
  setItems: (items: RoutineState['items']) => void;
  updateMinutes: (id: string, minutes: number) => void;
  addItem: (title: string) => void;
  deleteItem: (id: string) => void;
};

const DEFAULT_ITEMS: RoutineState['items'] = [
  { id: 'hydrate', title: 'Hydrate', minutes: 2, icon: Droplet, iconKey: 'droplet' },
  { id: 'prayer', title: 'Prayer Time', minutes: 15, icon: BookOpenCheck, iconKey: 'book' },
];

export const useRoutineBuilderStore = create<RoutineState>((set) => ({
  wakeTime: '06:30',
  items: DEFAULT_ITEMS,
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
}));

export const getIconByKey = (key: IconKey) => iconMap[key];
