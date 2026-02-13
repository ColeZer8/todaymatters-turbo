import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AiSetupResponses } from "@/lib/ai-setup";

// Step 2: Permissions
export interface PermissionsData extends Record<string, boolean> {
  calendar: boolean;
  notifications: boolean;
  email: boolean;
  location: boolean;
  contacts: boolean;
  browsing: boolean;
  appUsage: boolean;
  sms: boolean;
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
export type VIPRelationship =
  | "spouse"
  | "child"
  | "parent"
  | "friend"
  | "colleague"
  | "other";

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

  // AI Setup Questions
  aiSetupResponses: AiSetupResponses;

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

  // Big 3 opt-in
  big3Enabled: boolean;

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
  addVIPContact: (contact: Omit<VIPContact, "id">) => void;
  removeVIPContact: (id: string) => void;

  // Actions - My Church
  setChurchName: (name: string) => void;
  setChurchAddress: (address: string) => void;
  setChurchWebsite: (website: string) => void;

  // Actions - Setup Questions
  setRole: (role: string | null) => void;

  // Actions - AI Setup Questions
  setAiSetupResponses: (responses: AiSetupResponses) => void;
  setAiSetupResponse: (
    key: keyof AiSetupResponses,
    value: string | null,
  ) => void;

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

  // Actions - Big 3
  setBig3Enabled: (value: boolean) => void;

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
  location: true,
  contacts: true,
  browsing: true,
  appUsage: true,
  sms: true,
};

const normalizePermissions = (
  source?: Partial<PermissionsData> | null,
): PermissionsData => ({
  calendar: source?.calendar ?? DEFAULT_PERMISSIONS.calendar,
  notifications: source?.notifications ?? DEFAULT_PERMISSIONS.notifications,
  email: source?.email ?? DEFAULT_PERMISSIONS.email,
  location: source?.location ?? DEFAULT_PERMISSIONS.location,
  contacts: source?.contacts ?? DEFAULT_PERMISSIONS.contacts,
  browsing: source?.browsing ?? DEFAULT_PERMISSIONS.browsing,
  appUsage: source?.appUsage ?? DEFAULT_PERMISSIONS.appUsage,
  sms: source?.sms ?? DEFAULT_PERMISSIONS.sms,
});

// Predefined Core Values (curated starter list)
const DEFAULT_CORE_VALUES: CoreValue[] = [
  // Defaults selected (6-value taxonomy)
  {
    id: "faith",
    label: "Faith",
    icon: "cross",
    isSelected: true,
    isCustom: false,
  },
  {
    id: "family",
    label: "Family",
    icon: "users",
    isSelected: true,
    isCustom: false,
  },
  {
    id: "health",
    label: "Health",
    icon: "heart",
    isSelected: true,
    isCustom: false,
  },
  {
    id: "work",
    label: "Work",
    icon: "briefcase",
    isSelected: true,
    isCustom: false,
  },
  {
    id: "personal-growth",
    label: "Personal Growth",
    icon: "trending-up",
    isSelected: true,
    isCustom: false,
  },
  {
    id: "finances",
    label: "Finances",
    icon: "briefcase",
    isSelected: true,
    isCustom: false,
  },

  // Common additions
  {
    id: "rest",
    label: "Rest",
    icon: "moon",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "fitness",
    label: "Fitness",
    icon: "heart",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "friendship",
    label: "Friendship",
    icon: "users",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "marriage",
    label: "Marriage",
    icon: "users",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "parenting",
    label: "Parenting",
    icon: "users",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "community",
    label: "Community",
    icon: "home",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "service",
    label: "Service",
    icon: "home",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "generosity",
    label: "Generosity",
    icon: "heart",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "gratitude",
    label: "Gratitude",
    icon: "heart",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "learning",
    label: "Learning",
    icon: "trending-up",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "discipline",
    label: "Discipline",
    icon: "trending-up",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "leadership",
    label: "Leadership",
    icon: "star",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "integrity",
    label: "Integrity",
    icon: "star",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "humility",
    label: "Humility",
    icon: "star",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "simplicity",
    label: "Simplicity",
    icon: "moon",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "adventure",
    label: "Adventure",
    icon: "star",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "creativity",
    label: "Creativity",
    icon: "palette",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "spirituality",
    label: "Spirituality",
    icon: "cross",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "prayer",
    label: "Prayer",
    icon: "cross",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "purpose",
    label: "Purpose",
    icon: "star",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "stewardship",
    label: "Stewardship",
    icon: "briefcase",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "home",
    label: "Home",
    icon: "home",
    isSelected: false,
    isCustom: false,
  },
  {
    id: "nature",
    label: "Nature",
    icon: "home",
    isSelected: false,
    isCustom: false,
  },
];

// Predefined Core Categories mapped to values
const DEFAULT_CORE_CATEGORIES: CoreCategory[] = [
  {
    id: "prayer",
    valueId: "faith",
    label: "Prayer",
    color: "#F33C83",
    isCustom: false,
  },
  {
    id: "scripture-study",
    valueId: "faith",
    label: "Scripture / Study",
    color: "#F33C83",
    isCustom: false,
  },
  {
    id: "worship",
    valueId: "faith",
    label: "Worship",
    color: "#F33C83",
    isCustom: false,
  },
  {
    id: "marriage",
    valueId: "family",
    label: "Marriage / Spouse",
    color: "#F59E0B",
    isCustom: false,
  },
  {
    id: "parenting",
    valueId: "family",
    label: "Parenting",
    color: "#F59E0B",
    isCustom: false,
  },
  {
    id: "quality-time",
    valueId: "family",
    label: "Quality Time",
    color: "#F59E0B",
    isCustom: false,
  },
  {
    id: "exercise",
    valueId: "health",
    label: "Exercise",
    color: "#F95C2E",
    isCustom: false,
  },
  {
    id: "nutrition",
    valueId: "health",
    label: "Nutrition",
    color: "#F95C2E",
    isCustom: false,
  },
  {
    id: "sleep-recovery",
    valueId: "health",
    label: "Sleep / Recovery",
    color: "#F95C2E",
    isCustom: false,
  },
  {
    id: "deep-work",
    valueId: "work",
    label: "Deep Work",
    color: "#1FA56E",
    isCustom: false,
  },
  {
    id: "meetings",
    valueId: "work",
    label: "Meetings",
    color: "#1FA56E",
    isCustom: false,
  },
  {
    id: "admin",
    valueId: "work",
    label: "Admin",
    color: "#1FA56E",
    isCustom: false,
  },
  {
    id: "learning",
    valueId: "personal-growth",
    label: "Learning / Education",
    color: "#8B5CF6",
    isCustom: false,
  },
  {
    id: "habits-discipline",
    valueId: "personal-growth",
    label: "Habits & Discipline",
    color: "#8B5CF6",
    isCustom: false,
  },
  {
    id: "self-reflection",
    valueId: "personal-growth",
    label: "Self-Reflection",
    color: "#8B5CF6",
    isCustom: false,
  },
  {
    id: "budgeting",
    valueId: "finances",
    label: "Budgeting",
    color: "#10B981",
    isCustom: false,
  },
  {
    id: "saving",
    valueId: "finances",
    label: "Saving",
    color: "#10B981",
    isCustom: false,
  },
  {
    id: "investing",
    valueId: "finances",
    label: "Investing",
    color: "#10B981",
    isCustom: false,
  },
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
      goals: [],
      initiatives: [],
      goalWhys: [],
      valuesScores: [],
      fullName: "",
      vipContacts: [],
      churchName: "",
      churchAddress: "",
      churchWebsite: "",
      role: null,
      aiSetupResponses: {},
      wakeTime: createTimeString(6, 30),
      sleepTime: createTimeString(22, 30),
      joySelections: [],
      joyCustomOptions: [],
      drainSelections: [],
      drainCustomOptions: [],
      purpose: "balance",
      focusStyle: "flow",
      coachPersona: "strategist",
      morningMindset: "slow",
      homeAddress: null,
      workAddress: null,
      big3Enabled: false,
      hasCompletedOnboarding: false,
      _hasHydrated: false,

      // Actions - Explainer Video
      setHasWatchedExplainerVideo: (value) =>
        set({ hasWatchedExplainerVideo: value }),

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
            location: value,
            contacts: value,
            browsing: value,
            appUsage: value,
            sms: value,
          },
        }),

      // Actions - Core Values
      setCoreValues: (values) => set({ coreValues: values }),
      toggleCoreValue: (id) =>
        set((state) => ({
          coreValues: state.coreValues.map((v) =>
            v.id === id ? { ...v, isSelected: !v.isSelected } : v,
          ),
        })),
      addCoreValue: (label) =>
        set((state) => ({
          coreValues: [
            ...state.coreValues,
            {
              id: generateId(),
              label,
              icon: "star",
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
        set((state) => {
          const normalized = label.trim();
          if (!normalized) return state;
          const exists = state.coreCategories.some(
            (c) =>
              c.valueId === valueId &&
              c.label.trim().toLowerCase() === normalized.toLowerCase(),
          );
          if (exists) return state;
          return {
            coreCategories: [
              ...state.coreCategories,
              {
                id: generateId(),
                valueId,
                label: normalized,
                color,
                isCustom: true,
              },
            ],
          };
        }),
      removeCoreCategory: (id) =>
        set((state) => ({
          coreCategories: state.coreCategories.filter((c) => c.id !== id),
          subCategories: state.subCategories.filter((s) => s.categoryId !== id),
        })),

      // Actions - Sub-Categories
      setSubCategories: (subCategories) => set({ subCategories }),
      addSubCategory: (categoryId, label) =>
        set((state) => {
          const normalized = label.trim();
          if (!normalized) return state;
          const exists = state.subCategories.some(
            (s) =>
              s.categoryId === categoryId &&
              s.label.trim().toLowerCase() === normalized.toLowerCase(),
          );
          if (exists) return state;
          return {
            subCategories: [
              ...state.subCategories,
              { id: generateId(), categoryId, label: normalized },
            ],
          };
        }),
      removeSubCategory: (id) =>
        set((state) => ({
          subCategories: state.subCategories.filter((s) => s.id !== id),
        })),

      // Actions - Goals
      setGoals: (goals) => set({ goals }),
      addGoal: () => set((state) => ({ goals: [...state.goals, ""] })),
      removeGoal: (index) =>
        set((state) => ({ goals: state.goals.filter((_, i) => i !== index) })),
      changeGoal: (index, value) =>
        set((state) => ({
          goals: state.goals.map((g, i) => (i === index ? value : g)),
        })),
      setInitiatives: (initiatives) => set({ initiatives }),
      addInitiative: () =>
        set((state) => ({ initiatives: [...state.initiatives, ""] })),
      removeInitiative: (index) =>
        set((state) => ({
          initiatives: state.initiatives.filter((_, i) => i !== index),
        })),
      changeInitiative: (index, value) =>
        set((state) => ({
          initiatives: state.initiatives.map((i, idx) =>
            idx === index ? value : i,
          ),
        })),

      // Actions - Goal Whys
      setGoalWhys: (whys) => set({ goalWhys: whys }),
      updateGoalWhy: (goalIndex, why) =>
        set((state) => {
          const existing = state.goalWhys.find(
            (w) => w.goalIndex === goalIndex,
          );
          if (existing) {
            return {
              goalWhys: state.goalWhys.map((w) =>
                w.goalIndex === goalIndex ? { ...w, why } : w,
              ),
            };
          }
          return { goalWhys: [...state.goalWhys, { goalIndex, why }] };
        }),

      // Actions - Values Scores
      setValuesScores: (scores) => set({ valuesScores: scores }),
      updateValueScore: (valueId, score) =>
        set((state) => {
          const existing = state.valuesScores.find(
            (s) => s.valueId === valueId,
          );
          if (existing) {
            return {
              valuesScores: state.valuesScores.map((s) =>
                s.valueId === valueId ? { ...s, score } : s,
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

      // Actions - AI Setup Questions
      setAiSetupResponses: (responses) => set({ aiSetupResponses: responses }),
      setAiSetupResponse: (key, value) =>
        set((state) => ({
          aiSetupResponses: { ...state.aiSetupResponses, [key]: value },
        })),

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

      // Actions - Big 3
      setBig3Enabled: (value) => set({ big3Enabled: value }),

      // Actions - Completion
      setHasCompletedOnboarding: (value) =>
        set({ hasCompletedOnboarding: value }),
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | Partial<OnboardingState>
          | undefined;
        console.log("🔀 Onboarding - Loading saved data");
        const merged = {
          ...currentState,
          ...persisted,
          _hasHydrated: true,
        };
        return {
          ...merged,
          permissions: normalizePermissions(merged.permissions),
          goals: dedupeStringList(merged.goals ?? []),
          initiatives: dedupeStringList(merged.initiatives ?? []),
        };
      },
      onRehydrateStorage: () => () => {
        console.log("✅ Onboarding - Hydration complete");
      },
    },
  ),
);

// Helper to get Date from stored ISO string
export const getWakeTimeAsDate = (state: OnboardingState) =>
  new Date(state.wakeTime);
export const getSleepTimeAsDate = (state: OnboardingState) =>
  new Date(state.sleepTime);
