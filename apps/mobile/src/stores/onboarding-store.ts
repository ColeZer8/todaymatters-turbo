import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Step 1: Permissions
export interface PermissionsData {
  calendar: boolean;
  notifications: boolean;
  email: boolean;
  health: boolean;
  location: boolean;
  contacts: boolean;
  browsing: boolean;
  appUsage: boolean;
}

export type PermissionKey = keyof PermissionsData;

interface OnboardingState {
  // Step 1: Permissions
  permissions: PermissionsData;

  // Step 2: Setup Questions
  role: string | null;

  // Step 3: Daily Rhythm
  wakeTime: string; // Store as ISO string for serialization
  sleepTime: string;

  // Step 4: Joy
  joySelections: string[];
  joyCustomOptions: string[];

  // Step 5: Drains
  drainSelections: string[];
  drainCustomOptions: string[];

  // Step 6: Your Why
  purpose: string | null;

  // Step 7: Focus Style
  focusStyle: string | null;

  // Step 8: Coach Persona
  coachPersona: string | null;

  // Step 9: Morning Mindset
  morningMindset: string | null;

  // Step 10: Goals
  goals: string[];
  initiatives: string[];

  // Hydration state
  _hasHydrated: boolean;

  // Actions
  setPermissions: (permissions: PermissionsData) => void;
  togglePermission: (key: PermissionKey) => void;
  setAllPermissions: (value: boolean) => void;
  setRole: (role: string | null) => void;
  setWakeTime: (time: Date) => void;
  setSleepTime: (time: Date) => void;
  setJoySelections: (selections: string[]) => void;
  toggleJoySelection: (value: string) => void;
  addJoyCustomOption: (value: string) => void;
  setDrainSelections: (selections: string[]) => void;
  toggleDrainSelection: (value: string) => void;
  addDrainCustomOption: (value: string) => void;
  setPurpose: (purpose: string | null) => void;
  setFocusStyle: (style: string | null) => void;
  setCoachPersona: (persona: string | null) => void;
  setMorningMindset: (mindset: string | null) => void;
  setGoals: (goals: string[]) => void;
  addGoal: () => void;
  removeGoal: (index: number) => void;
  changeGoal: (index: number, value: string) => void;
  setInitiatives: (initiatives: string[]) => void;
  addInitiative: () => void;
  removeInitiative: (index: number) => void;
  changeInitiative: (index: number, value: string) => void;
}

// Helper to create time string from hours and minutes
const createTimeString = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const DEFAULT_PERMISSIONS: PermissionsData = {
  calendar: true,
  notifications: true,
  email: true,
  health: true,
  location: true,
  contacts: true,
  browsing: true,
  appUsage: true,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Initial state
      permissions: DEFAULT_PERMISSIONS,
      role: null,
      wakeTime: createTimeString(6, 30),
      sleepTime: createTimeString(22, 30),
      joySelections: [],
      joyCustomOptions: [],
      drainSelections: [],
      drainCustomOptions: [],
      purpose: 'balance',
      focusStyle: 'flow',
      coachPersona: 'strategist',
      morningMindset: 'slow',
      goals: ['Launch MVP', 'Run 5k'],
      initiatives: ['Q4 Strategy', 'Team Hiring'],
      _hasHydrated: false,

      // Actions
      setPermissions: (permissions) => set({ permissions }),
      togglePermission: (key) =>
        set((state) => ({
          permissions: { ...state.permissions, [key]: !state.permissions[key] },
        })),
      setAllPermissions: (value) =>
        set({
          permissions: {
            calendar: value,
            notifications: value,
            email: value,
            health: value,
            location: value,
            contacts: value,
            browsing: value,
            appUsage: value,
          },
        }),
      setRole: (role) => set({ role }),

      setWakeTime: (time) => set({ wakeTime: time.toISOString() }),
      setSleepTime: (time) => set({ sleepTime: time.toISOString() }),

      setJoySelections: (selections) => set({ joySelections: selections }),
      toggleJoySelection: (value) =>
        set((state) => ({
          joySelections: state.joySelections.includes(value)
            ? state.joySelections.filter((v) => v !== value)
            : [...state.joySelections, value],
        })),
      addJoyCustomOption: (value) =>
        set((state) => ({
          joyCustomOptions: [...state.joyCustomOptions, value],
          joySelections: [...state.joySelections, value],
        })),

      setDrainSelections: (selections) => set({ drainSelections: selections }),
      toggleDrainSelection: (value) =>
        set((state) => ({
          drainSelections: state.drainSelections.includes(value)
            ? state.drainSelections.filter((v) => v !== value)
            : [...state.drainSelections, value],
        })),
      addDrainCustomOption: (value) =>
        set((state) => ({
          drainCustomOptions: [...state.drainCustomOptions, value],
          drainSelections: [...state.drainSelections, value],
        })),

      setPurpose: (purpose) => set({ purpose }),
      setFocusStyle: (style) => set({ focusStyle: style }),
      setCoachPersona: (persona) => set({ coachPersona: persona }),
      setMorningMindset: (mindset) => set({ morningMindset: mindset }),

      setGoals: (goals) => set({ goals }),
      addGoal: () => set((state) => ({ goals: [...state.goals, ''] })),
      removeGoal: (index) =>
        set((state) => ({ goals: state.goals.filter((_, i) => i !== index) })),
      changeGoal: (index, value) =>
        set((state) => ({
          goals: state.goals.map((g, i) => (i === index ? value : g)),
        })),

      setInitiatives: (initiatives) => set({ initiatives }),
      addInitiative: () =>
        set((state) => ({ initiatives: [...state.initiatives, ''] })),
      removeInitiative: (index) =>
        set((state) => ({
          initiatives: state.initiatives.filter((_, i) => i !== index),
        })),
      changeInitiative: (index, value) =>
        set((state) => ({
          initiatives: state.initiatives.map((i, idx) =>
            idx === index ? value : i
          ),
        })),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<OnboardingState> | undefined;
        console.log('🔀 Onboarding - Loading saved data');
        return {
          ...currentState,
          ...persisted,
          _hasHydrated: true,
        };
      },
      onRehydrateStorage: () => () => {
        console.log('✅ Onboarding - Hydration complete');
      },
    }
  )
);

// Helper to get Date from stored ISO string
export const getWakeTimeAsDate = (state: OnboardingState) =>
  new Date(state.wakeTime);
export const getSleepTimeAsDate = (state: OnboardingState) =>
  new Date(state.sleepTime);
