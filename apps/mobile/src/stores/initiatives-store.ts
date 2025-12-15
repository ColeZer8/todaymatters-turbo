import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export interface Milestone {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  createdAt: string;
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-1, calculated from milestones
  dueDate: string | null;
  teamSize: number;
  milestones: Milestone[];
  color: string;
  createdAt: string;
  completedAt: string | null;
}

interface InitiativesState {
  initiatives: Initiative[];
  _hasHydrated: boolean;

  // CRUD Actions
  addInitiative: (title: string, description?: string) => void;
  updateInitiative: (id: string, updates: Partial<Pick<Initiative, 'title' | 'description' | 'dueDate' | 'teamSize' | 'color'>>) => void;
  deleteInitiative: (id: string) => void;

  // Milestone Actions
  addMilestone: (initiativeId: string, name: string, dueDate?: string) => void;
  updateMilestone: (initiativeId: string, milestoneId: string, updates: Partial<Pick<Milestone, 'name' | 'completed' | 'dueDate'>>) => void;
  toggleMilestone: (initiativeId: string, milestoneId: string) => void;
  deleteMilestone: (initiativeId: string, milestoneId: string) => void;

  // Progress Actions
  setManualProgress: (initiativeId: string, progress: number) => void;

  // Bulk Actions
  importFromOnboarding: (initiativeTitles: string[]) => void;
  clearAll: () => void;

  // Computed
  getInitiativeProgress: (initiativeId: string) => number;
  getOverallProgress: () => number;
  getCompletedMilestonesCount: () => number;
  getPendingMilestonesCount: () => number;
  getUpcomingDeadlines: (daysAhead?: number) => { initiative: Initiative; milestone: Milestone }[];
}

// ============================================================================
// Helpers
// ============================================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const INITIATIVE_COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'];

const calculateProgress = (milestones: Milestone[]): number => {
  if (milestones.length === 0) return 0;
  const completedCount = milestones.filter((m) => m.completed).length;
  return completedCount / milestones.length;
};

// Helper to generate default due date (30 days from now)
const getDefaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
};

// ============================================================================
// Store
// ============================================================================

export const useInitiativesStore = create<InitiativesState>()(
  persist(
    (set, get) => ({
      initiatives: [],
      _hasHydrated: false,

      // ========================================================================
      // CRUD Actions
      // ========================================================================

      addInitiative: (title, description = '') => {
        const newInitiative: Initiative = {
          id: generateId(),
          title: title.trim(),
          description: description.trim(),
          progress: 0,
          dueDate: getDefaultDueDate(),
          teamSize: 1,
          milestones: [],
          color: INITIATIVE_COLORS[get().initiatives.length % INITIATIVE_COLORS.length],
          createdAt: new Date().toISOString(),
          completedAt: null,
        };
        set((state) => ({ initiatives: [...state.initiatives, newInitiative] }));
      },

      updateInitiative: (id, updates) => {
        set((state) => ({
          initiatives: state.initiatives.map((initiative) =>
            initiative.id === id ? { ...initiative, ...updates } : initiative
          ),
        }));
      },

      deleteInitiative: (id) => {
        set((state) => ({
          initiatives: state.initiatives.filter((initiative) => initiative.id !== id),
        }));
      },

      // ========================================================================
      // Milestone Actions
      // ========================================================================

      addMilestone: (initiativeId, name, dueDate) => {
        const newMilestone: Milestone = {
          id: generateId(),
          name: name.trim(),
          completed: false,
          dueDate: dueDate || null,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          initiatives: state.initiatives.map((initiative) => {
            if (initiative.id !== initiativeId) return initiative;
            const updatedMilestones = [...initiative.milestones, newMilestone];
            return {
              ...initiative,
              milestones: updatedMilestones,
              progress: calculateProgress(updatedMilestones),
            };
          }),
        }));
      },

      updateMilestone: (initiativeId, milestoneId, updates) => {
        set((state) => ({
          initiatives: state.initiatives.map((initiative) => {
            if (initiative.id !== initiativeId) return initiative;
            const updatedMilestones = initiative.milestones.map((milestone) =>
              milestone.id === milestoneId ? { ...milestone, ...updates } : milestone
            );
            return {
              ...initiative,
              milestones: updatedMilestones,
              progress: calculateProgress(updatedMilestones),
            };
          }),
        }));
      },

      toggleMilestone: (initiativeId, milestoneId) => {
        set((state) => ({
          initiatives: state.initiatives.map((initiative) => {
            if (initiative.id !== initiativeId) return initiative;
            const updatedMilestones = initiative.milestones.map((milestone) =>
              milestone.id === milestoneId
                ? { ...milestone, completed: !milestone.completed }
                : milestone
            );
            const progress = calculateProgress(updatedMilestones);
            return {
              ...initiative,
              milestones: updatedMilestones,
              progress,
              completedAt: progress === 1 ? new Date().toISOString() : null,
            };
          }),
        }));
      },

      deleteMilestone: (initiativeId, milestoneId) => {
        set((state) => ({
          initiatives: state.initiatives.map((initiative) => {
            if (initiative.id !== initiativeId) return initiative;
            const updatedMilestones = initiative.milestones.filter(
              (milestone) => milestone.id !== milestoneId
            );
            return {
              ...initiative,
              milestones: updatedMilestones,
              progress: calculateProgress(updatedMilestones),
            };
          }),
        }));
      },

      // ========================================================================
      // Progress Actions
      // ========================================================================

      setManualProgress: (initiativeId, progress) => {
        set((state) => ({
          initiatives: state.initiatives.map((initiative) =>
            initiative.id === initiativeId
              ? {
                  ...initiative,
                  progress: Math.max(0, Math.min(1, progress)),
                  completedAt: progress >= 1 ? new Date().toISOString() : null,
                }
              : initiative
          ),
        }));
      },

      // ========================================================================
      // Bulk Actions
      // ========================================================================

      importFromOnboarding: (initiativeTitles) => {
        const existingTitles = new Set(
          get().initiatives.map((i) => i.title.toLowerCase())
        );
        const newInitiatives: Initiative[] = initiativeTitles
          .filter(
            (title) => title.trim() && !existingTitles.has(title.toLowerCase().trim())
          )
          .map((title, index) => ({
            id: generateId(),
            title: title.trim(),
            description: '',
            progress: 0,
            dueDate: getDefaultDueDate(),
            teamSize: 1,
            milestones: [],
            color: INITIATIVE_COLORS[(get().initiatives.length + index) % INITIATIVE_COLORS.length],
            createdAt: new Date().toISOString(),
            completedAt: null,
          }));

        if (newInitiatives.length > 0) {
          set((state) => ({ initiatives: [...state.initiatives, ...newInitiatives] }));
        }
      },

      clearAll: () => set({ initiatives: [] }),

      // ========================================================================
      // Computed
      // ========================================================================

      getInitiativeProgress: (initiativeId) => {
        const initiative = get().initiatives.find((i) => i.id === initiativeId);
        return initiative?.progress ?? 0;
      },

      getOverallProgress: () => {
        const { initiatives } = get();
        if (initiatives.length === 0) return 0;
        const totalProgress = initiatives.reduce((sum, i) => sum + i.progress, 0);
        return totalProgress / initiatives.length;
      },

      getCompletedMilestonesCount: () => {
        return get().initiatives.reduce(
          (sum, initiative) =>
            sum + initiative.milestones.filter((m) => m.completed).length,
          0
        );
      },

      getPendingMilestonesCount: () => {
        return get().initiatives.reduce(
          (sum, initiative) =>
            sum + initiative.milestones.filter((m) => !m.completed).length,
          0
        );
      },

      getUpcomingDeadlines: (daysAhead = 14) => {
        const now = new Date();
        const cutoff = new Date();
        cutoff.setDate(now.getDate() + daysAhead);

        const deadlines: { initiative: Initiative; milestone: Milestone }[] = [];

        get().initiatives.forEach((initiative) => {
          initiative.milestones.forEach((milestone) => {
            if (milestone.dueDate && !milestone.completed) {
              const dueDate = new Date(milestone.dueDate);
              if (dueDate >= now && dueDate <= cutoff) {
                deadlines.push({ initiative, milestone });
              }
            }
          });
        });

        return deadlines.sort((a, b) => {
          const dateA = new Date(a.milestone.dueDate!);
          const dateB = new Date(b.milestone.dueDate!);
          return dateA.getTime() - dateB.getTime();
        });
      },
    }),
    {
      name: 'initiatives-storage',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<InitiativesState> | undefined;
        return {
          ...currentState,
          ...persisted,
          _hasHydrated: true,
        };
      },
      onRehydrateStorage: () => () => {
        console.log('✅ Initiatives Store - Hydration complete');
      },
    }
  )
);

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const selectInitiatives = (state: InitiativesState) => state.initiatives;
export const selectInitiativeById = (id: string) => (state: InitiativesState) =>
  state.initiatives.find((i) => i.id === id);
export const selectHasHydrated = (state: InitiativesState) => state._hasHydrated;


