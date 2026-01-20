import { create } from 'zustand';
import type { AppCategoryOverride, AppCategoryOverrides } from '@/lib/calendar/app-classification';

interface AppCategoryOverridesState {
  overrides: AppCategoryOverrides;
  setOverrides: (overrides: AppCategoryOverrides) => void;
  upsertOverride: (appKey: string, override: AppCategoryOverride) => void;
}

export const useAppCategoryOverridesStore = create<AppCategoryOverridesState>((set) => ({
  overrides: {},
  setOverrides: (overrides) => set({ overrides }),
  upsertOverride: (appKey, override) =>
    set((state) => ({
      overrides: {
        ...state.overrides,
        [appKey]: override,
      },
    })),
}));
