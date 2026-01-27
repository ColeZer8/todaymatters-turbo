import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HomeBriefResult } from "@/lib/home-brief";

interface HomeBriefState {
  brief: HomeBriefResult | null;
  lastEvaluatedAt: string | null;
  lastLlmAt: string | null;

  setBrief: (brief: HomeBriefResult) => void;
  setLastEvaluatedAt: (iso: string) => void;
  setLastLlmAt: (iso: string) => void;
  clear: () => void;
}

export const useHomeBriefStore = create<HomeBriefState>()(
  persist(
    (set) => ({
      brief: null,
      lastEvaluatedAt: null,
      lastLlmAt: null,

      setBrief: (brief) => set({ brief }),
      setLastEvaluatedAt: (iso) => set({ lastEvaluatedAt: iso }),
      setLastLlmAt: (iso) => set({ lastLlmAt: iso }),

      clear: () => set({ brief: null, lastEvaluatedAt: null, lastLlmAt: null }),
    }),
    {
      name: "home-brief-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
