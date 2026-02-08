/**
 * Dev Flags Store
 *
 * Zustand store for development/debug feature flags.
 * Only used in __DEV__ mode for toggling experimental pipelines.
 */

import { create } from "zustand";

interface DevFlagsState {
  /** When true, use BRAVO/CHARLIE location blocks for the Actual column.
   *  When false, fall back to legacy buildActualDisplayEvents() pipeline. */
  useNewLocationPipeline: boolean;
  toggleNewLocationPipeline: () => void;
}

export const useDevFlagsStore = create<DevFlagsState>((set) => ({
  useNewLocationPipeline: true, // default: new pipeline ON
  toggleNewLocationPipeline: () =>
    set((state) => ({
      useNewLocationPipeline: !state.useNewLocationPipeline,
    })),
}));
