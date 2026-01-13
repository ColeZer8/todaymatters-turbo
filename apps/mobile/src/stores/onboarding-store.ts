import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Step 2: Permissions
export interface PermissionsData extends Record<string, boolean> {
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

// Step 4: Core Values
export interface CoreValue {
  id: string;
  label: string;
  icon: string;
  isSelected: boolean;
  isCustom: boolean;
}

// Step 5: Core Categories
export interface CoreCategory {
  id: string;
  valueId: string;
  label: string;
  color: string;
  isCustom: boolean;
}

// Step 6: Sub-Categories
export interface SubCategory {
  id: string;
  categoryId: string;
  label: string;
}

// Step 8: Goal Whys
export interface GoalWhy {
  goalIndex: number;
  why: string;
}

// Step 10: Value Scores
export interface ValueScore {
  valueId: string;
  score: number; // 1-10
}

// Step 13: VIP Contacts
export type VIPRelationship = 'spouse' | 'child' | 'parent' | 'friend' | 'colleague' | 'other';

export interface VIPContact {
  id: string;
  name: string;
  relationship: VIPRelationship;
  phone?: string;
  email?: string;
}

interface OnboardingState {
  // Step 1: Explainer Video
  hasWatchedExplainerVideo: boolean;

  // Step 2: Permissions
  permissions: PermissionsData;

  // Step 4: Core Values
  coreValues: CoreValue[];

  // Step 5: Core Categories
  coreCategories: CoreCategory[];

  // Step 6: Sub-Categories
  subCategories: SubCategory[];

  // Step 7: Goals
  goals: string[];
  initiatives: string[];

  // Step 8: Goal Whys
  goalWhys: GoalWhy[];

  // Step 10: Values Scores
  valuesScores: ValueScore[];

  // Step 12: Name
  fullName: string;

  // Step 13: VIP Contacts
  vipContacts: VIPContact[];

  // Step 14: My Church
  churchName: string;
  churchAddress: string;
  churchWebsite: string;

  // Step 15: Setup Questions
  role: string | null;

  // Step 16: Daily Rhythm
  wakeTime: string;
  sleepTime: string;

  // Step 17: Joy
  joySelections: string[];
  joyCustomOptions: string[];

  // Step 18: Drains
  drainSelections: string[];
  drainCustomOptions: string[];

  // Step 19: Your Why
  purpose: string | null;

  // Step 20: Focus Style
  focusStyle: string | null;

  // Step 21: Coach Persona
  coachPersona: string | null;

  // Step 22: Morning Mindset
  morningMindset: string | null;
  homeAddress: string | null;
  workAddress: string | null;

  // Completion state
  hasCompletedOnboarding: boolean;

  // Hydration state
  _hasHydrated: boolean;

  // Actions - Explainer Video
  setHasWatchedExplainerVideo: (value: boolean) => void;

  // Actions - Permissions
  setPermissions: (permissions: PermissionsData) => void;
  togglePermission: (key: PermissionKey) => void;
  setAllPermissions: (value: boolean) => void;

  // Actions - Core Values
  setCoreValues: (values: CoreValue[]) => void;
  toggleCoreValue: (id: string) => void;
  addCoreValue: (label: string) => void;
  removeCoreValue: (id: string) => void;

  // Actions - Core Categories
  setCoreCategories: (categories: CoreCategory[]) => void;
  addCoreCategory: (valueId: string, label: string, color: string) => void;
  removeCoreCategory: (id: string) => void;

  // Actions - Sub-Categories
  setSubCategories: (subCategories: SubCategory[]) => void;
  addSubCategory: (categoryId: string, label: string) => void;
  removeSubCategory: (id: string) => void;

  // Actions - Goals
  setGoals: (goals: string[]) => void;
  addGoal: () => void;
  removeGoal: (index: number) => void;
  changeGoal: (index: number, value: string) => void;
  setInitiatives: (initiatives: string[]) => void;
  addInitiative: () => void;
  removeInitiative: (index: number) => void;
  changeInitiative: (index: number, value: string) => void;

  // Actions - Goal Whys
  setGoalWhys: (whys: GoalWhy[]) => void;
  updateGoalWhy: (goalIndex: number, why: string) => void;

  // Actions - Values Scores
  setValuesScores: (scores: ValueScore[]) => void;
  updateValueScore: (valueId: string, score: number) => void;

  // Actions - Name
  setFullName: (fullName: string) => void;

  // Actions - VIP Contacts
  setVIPContacts: (contacts: VIPContact[]) => void;
  addVIPContact: (contact: Omit<VIPContact, 'id'>) => void;
  removeVIPContact: (id: string) => void;

  // Actions - My Church
  setChurchName: (name: string) => void;
  setChurchAddress: (address: string) => void;
  setChurchWebsite: (website: string) => void;

  // Actions - Setup Questions
  setRole: (role: string | null) => void;

  // Actions - Daily Rhythm
  setWakeTime: (time: Date) => void;
  setSleepTime: (time: Date) => void;

  // Actions - Joy
  setJoySelections: (selections: string[]) => void;
  setJoyCustomOptions: (options: string[]) => void;
  toggleJoySelection: (value: string) => void;
  addJoyCustomOption: (value: string) => void;

  // Actions - Drains
  setDrainSelections: (selections: string[]) => void;
  setDrainCustomOptions: (options: string[]) => void;
  toggleDrainSelection: (value: string) => void;
  addDrainCustomOption: (value: string) => void;

  // Actions - Your Why
  setPurpose: (purpose: string | null) => void;

  // Actions - Focus Style
  setFocusStyle: (style: string | null) => void;

  // Actions - Coach Persona
  setCoachPersona: (persona: string | null) => void;

  // Actions - Morning Mindset
  setMorningMindset: (mindset: string | null) => void;
  setHomeAddress: (address: string | null) => void;
  setWorkAddress: (address: string | null) => void;

  // Actions - Completion
  setHasCompletedOnboarding: (value: boolean) => void;
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

// Predefined Core Values
const DEFAULT_CORE_VALUES: CoreValue[] = [
  { id: 'faith', label: 'Faith', icon: 'cross', isSelected: true, isCustom: false },
  { id: 'family', label: 'Family', icon: 'users', isSelected: true, isCustom: false },
  { id: 'work', label: 'Work', icon: 'briefcase', isSelected: true, isCustom: false },
  { id: 'rest', label: 'Rest', icon: 'moon', isSelected: true, isCustom: false },
  { id: 'personal-growth', label: 'Personal Growth', icon: 'trending-up', isSelected: true, isCustom: false },
  { id: 'fitness', label: 'Fitness', icon: 'heart', isSelected: true, isCustom: false },
  { id: 'community', label: 'Community', icon: 'home', isSelected: false, isCustom: false },
  { id: 'creativity', label: 'Creativity', icon: 'palette', isSelected: false, isCustom: false },
];

// Predefined Core Categories mapped to values
const DEFAULT_CORE_CATEGORIES: CoreCategory[] = [
  { id: 'prayer', valueId: 'faith', label: 'Prayer', color: '#F33C83', isCustom: false },
  { id: 'bible-study', valueId: 'faith', label: 'Bible Study', color: '#F33C83', isCustom: false },
  { id: 'church', valueId: 'faith', label: 'Church', color: '#F33C83', isCustom: false },
  { id: 'quality-time', valueId: 'family', label: 'Quality Time', color: '#F59E0B', isCustom: false },
  { id: 'date-night', valueId: 'family', label: 'Date Night', color: '#F59E0B', isCustom: false },
  { id: 'kids-activities', valueId: 'family', label: 'Kids Activities', color: '#F59E0B', isCustom: false },
  { id: 'deep-work', valueId: 'work', label: 'Deep Work', color: '#1FA56E', isCustom: false },
  { id: 'meetings', valueId: 'work', label: 'Meetings', color: '#1FA56E', isCustom: false },
  { id: 'admin', valueId: 'work', label: 'Admin', color: '#1FA56E', isCustom: false },
  { id: 'sleep', valueId: 'rest', label: 'Sleep', color: '#4F8BFF', isCustom: false },
  { id: 'relaxation', valueId: 'rest', label: 'Relaxation', color: '#4F8BFF', isCustom: false },
  { id: 'reading', valueId: 'personal-growth', label: 'Reading', color: '#8B5CF6', isCustom: false },
  { id: 'studying', valueId: 'personal-growth', label: 'Studying', color: '#8B5CF6', isCustom: false },
  { id: 'courses', valueId: 'personal-growth', label: 'Courses', color: '#8B5CF6', isCustom: false },
  { id: 'exercise', valueId: 'fitness', label: 'Exercise', color: '#F95C2E', isCustom: false },
  { id: 'sports', valueId: 'fitness', label: 'Sports', color: '#F95C2E', isCustom: false },
  { id: 'outdoor', valueId: 'fitness', label: 'Outdoor Activities', color: '#F95C2E', isCustom: false },
];

// Helper to generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

function dedupeStringList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Initial state
      hasWatchedExplainerVideo: false,
      permissions: DEFAULT_PERMISSIONS,
      coreValues: DEFAULT_CORE_VALUES,
      coreCategories: DEFAULT_CORE_CATEGORIES,
      subCategories: [],
      goals: ['Launch MVP', 'Run 5k'],
      initiatives: ['Q4 Strategy', 'Team Hiring'],
      goalWhys: [],
      valuesScores: [],
      fullName: '',
      vipContacts: [],
      churchName: '',
      churchAddress: '',
      churchWebsite: '',
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
      homeAddress: null,
      workAddress: null,
      hasCompletedOnboarding: false,
      _hasHydrated: false,

      // Actions - Explainer Video
      setHasWatchedExplainerVideo: (value) => set({ hasWatchedExplainerVideo: value }),

      // Actions - Permissions
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

      // Actions - Core Values
      setCoreValues: (values) => set({ coreValues: values }),
      toggleCoreValue: (id) =>
        set((state) => ({
          coreValues: state.coreValues.map((v) =>
            v.id === id ? { ...v, isSelected: !v.isSelected } : v
          ),
        })),
      addCoreValue: (label) =>
        set((state) => ({
          coreValues: [
            ...state.coreValues,
            {
              id: generateId(),
              label,
              icon: 'star',
              isSelected: true,
              isCustom: true,
            },
          ],
        })),
      removeCoreValue: (id) =>
        set((state) => ({
          coreValues: state.coreValues.filter((v) => v.id !== id),
        })),

      // Actions - Core Categories
      setCoreCategories: (categories) => set({ coreCategories: categories }),
      addCoreCategory: (valueId, label, color) =>
        set((state) => ({
          coreCategories: [
            ...state.coreCategories,
            { id: generateId(), valueId, label, color, isCustom: true },
          ],
        })),
      removeCoreCategory: (id) =>
        set((state) => ({
          coreCategories: state.coreCategories.filter((c) => c.id !== id),
        })),

      // Actions - Sub-Categories
      setSubCategories: (subCategories) => set({ subCategories }),
      addSubCategory: (categoryId, label) =>
        set((state) => ({
          subCategories: [
            ...state.subCategories,
            { id: generateId(), categoryId, label },
          ],
        })),
      removeSubCategory: (id) =>
        set((state) => ({
          subCategories: state.subCategories.filter((s) => s.id !== id),
        })),

      // Actions - Goals
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

      // Actions - Goal Whys
      setGoalWhys: (whys) => set({ goalWhys: whys }),
      updateGoalWhy: (goalIndex, why) =>
        set((state) => {
          const existing = state.goalWhys.find((w) => w.goalIndex === goalIndex);
          if (existing) {
            return {
              goalWhys: state.goalWhys.map((w) =>
                w.goalIndex === goalIndex ? { ...w, why } : w
              ),
            };
          }
          return { goalWhys: [...state.goalWhys, { goalIndex, why }] };
        }),

      // Actions - Values Scores
      setValuesScores: (scores) => set({ valuesScores: scores }),
      updateValueScore: (valueId, score) =>
        set((state) => {
          const existing = state.valuesScores.find((s) => s.valueId === valueId);
          if (existing) {
            return {
              valuesScores: state.valuesScores.map((s) =>
                s.valueId === valueId ? { ...s, score } : s
              ),
            };
          }
          return { valuesScores: [...state.valuesScores, { valueId, score }] };
        }),

      // Actions - Name
      setFullName: (fullName) => set({ fullName }),

      // Actions - VIP Contacts
      setVIPContacts: (contacts) => set({ vipContacts: contacts }),
      addVIPContact: (contact) =>
        set((state) => ({
          vipContacts: [...state.vipContacts, { ...contact, id: generateId() }],
        })),
      removeVIPContact: (id) =>
        set((state) => ({
          vipContacts: state.vipContacts.filter((c) => c.id !== id),
        })),

      // Actions - My Church
      setChurchName: (name) => set({ churchName: name }),
      setChurchAddress: (address) => set({ churchAddress: address }),
      setChurchWebsite: (website) => set({ churchWebsite: website }),

      // Actions - Setup Questions
      setRole: (role) => set({ role }),

      // Actions - Daily Rhythm
      setWakeTime: (time) => set({ wakeTime: time.toISOString() }),
      setSleepTime: (time) => set({ sleepTime: time.toISOString() }),

      // Actions - Joy
      setJoySelections: (selections) => set({ joySelections: selections }),
      setJoyCustomOptions: (options) => set({ joyCustomOptions: options }),
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

      // Actions - Drains
      setDrainSelections: (selections) => set({ drainSelections: selections }),
      setDrainCustomOptions: (options) => set({ drainCustomOptions: options }),
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

      // Actions - Your Why
      setPurpose: (purpose) => set({ purpose }),

      // Actions - Focus Style
      setFocusStyle: (style) => set({ focusStyle: style }),

      // Actions - Coach Persona
      setCoachPersona: (persona) => set({ coachPersona: persona }),

      // Actions - Morning Mindset
      setMorningMindset: (mindset) => set({ morningMindset: mindset }),
      setHomeAddress: (address) => set({ homeAddress: address }),
      setWorkAddress: (address) => set({ workAddress: address }),

      // Actions - Completion
      setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<OnboardingState> | undefined;
        console.log('🔀 Onboarding - Loading saved data');
        const merged = {
          ...currentState,
          ...persisted,
          _hasHydrated: true,
        };
        return {
          ...merged,
          goals: dedupeStringList(merged.goals ?? []),
          initiatives: dedupeStringList(merged.initiatives ?? []),
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







