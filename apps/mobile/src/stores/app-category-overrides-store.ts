import { create } from "zustand";
import type {
  AppCategoryOverride,
  AppCategoryOverrides,
} from "@/lib/calendar/app-classification";

interface AppCategoryOverridesState {
  overrides: AppCategoryOverrides;
  setOverrides: (overrides: AppCategoryOverrides) => void;
  upsertOverride: (appKey: string, override: AppCategoryOverride) => void;
  removeOverride: (appKey: string) => void;
}

export const useAppCategoryOverridesStore = create<AppCategoryOverridesState>(
  (set) => ({
    overrides: {},
    setOverrides: (overrides) => set({ overrides }),
    upsertOverride: (appKey, override) =>
      set((state) => ({
        overrides: {
          ...state.overrides,
          [appKey]: override,
        },
      })),
    removeOverride: (appKey) =>
      set((state) => {
        if (!state.overrides[appKey]) return {};
        const next = { ...state.overrides };
        delete next[appKey];
        return { overrides: next };
      }),
  }),
);
