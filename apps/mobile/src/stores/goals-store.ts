import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================================
// Types
// ============================================================================

export interface GoalTask {
  id: string;
  name: string;
  done: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  progress: number; // 0-1, calculated from tasks
  tasks: GoalTask[];
  color: string;
  createdAt: string;
  completedAt: string | null;
}

interface GoalsState {
  goals: Goal[];
  _hasHydrated: boolean;

  // CRUD Actions
  addGoal: (title: string) => void;
  updateGoal: (
    id: string,
    updates: Partial<Pick<Goal, "title" | "color">>,
  ) => void;
  deleteGoal: (id: string) => void;

  // Task Actions
  addTask: (goalId: string, taskName: string) => void;
  updateTask: (
    goalId: string,
    taskId: string,
    updates: Partial<Pick<GoalTask, "name" | "done">>,
  ) => void;
  toggleTask: (goalId: string, taskId: string) => void;
  deleteTask: (goalId: string, taskId: string) => void;

  // Bulk Actions
  importFromOnboarding: (goalTitles: string[]) => void;
  clearAll: () => void;

  // Computed
  getGoalProgress: (goalId: string) => number;
  getOverallProgress: () => number;
  getCompletedTasksCount: () => number;
  getPendingTasksCount: () => number;
}

// ============================================================================
// Helpers
// ============================================================================

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const GOAL_COLORS = [
  "#2563EB",
  "#16A34A",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#EF4444",
];

const calculateProgress = (tasks: GoalTask[]): number => {
  if (tasks.length === 0) return 0;
  const completedCount = tasks.filter((t) => t.done).length;
  return completedCount / tasks.length;
};

// ============================================================================
// Store
// ============================================================================

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      goals: [],
      _hasHydrated: false,

      // ========================================================================
      // CRUD Actions
      // ========================================================================

      addGoal: (title) => {
        const newGoal: Goal = {
          id: generateId(),
          title: title.trim(),
          progress: 0,
          tasks: [],
          color: GOAL_COLORS[get().goals.length % GOAL_COLORS.length],
          createdAt: new Date().toISOString(),
          completedAt: null,
        };
        set((state) => ({ goals: [...state.goals, newGoal] }));
      },

      updateGoal: (id, updates) => {
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === id ? { ...goal, ...updates } : goal,
          ),
        }));
      },

      deleteGoal: (id) => {
        set((state) => ({
          goals: state.goals.filter((goal) => goal.id !== id),
        }));
      },

      // ========================================================================
      // Task Actions
      // ========================================================================

      addTask: (goalId, taskName) => {
        const newTask: GoalTask = {
          id: generateId(),
          name: taskName.trim(),
          done: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          goals: state.goals.map((goal) => {
            if (goal.id !== goalId) return goal;
            const updatedTasks = [...goal.tasks, newTask];
            return {
              ...goal,
              tasks: updatedTasks,
              progress: calculateProgress(updatedTasks),
            };
          }),
        }));
      },

      updateTask: (goalId, taskId, updates) => {
        set((state) => ({
          goals: state.goals.map((goal) => {
            if (goal.id !== goalId) return goal;
            const updatedTasks = goal.tasks.map((task) =>
              task.id === taskId ? { ...task, ...updates } : task,
            );
            return {
              ...goal,
              tasks: updatedTasks,
              progress: calculateProgress(updatedTasks),
            };
          }),
        }));
      },

      toggleTask: (goalId, taskId) => {
        set((state) => ({
          goals: state.goals.map((goal) => {
            if (goal.id !== goalId) return goal;
            const updatedTasks = goal.tasks.map((task) =>
              task.id === taskId ? { ...task, done: !task.done } : task,
            );
            const progress = calculateProgress(updatedTasks);
            return {
              ...goal,
              tasks: updatedTasks,
              progress,
              completedAt: progress === 1 ? new Date().toISOString() : null,
            };
          }),
        }));
      },

      deleteTask: (goalId, taskId) => {
        set((state) => ({
          goals: state.goals.map((goal) => {
            if (goal.id !== goalId) return goal;
            const updatedTasks = goal.tasks.filter(
              (task) => task.id !== taskId,
            );
            return {
              ...goal,
              tasks: updatedTasks,
              progress: calculateProgress(updatedTasks),
            };
          }),
        }));
      },

      // ========================================================================
      // Bulk Actions
      // ========================================================================

      importFromOnboarding: (goalTitles) => {
        const existingTitles = new Set(
          get().goals.map((g) => g.title.toLowerCase()),
        );
        const newGoals: Goal[] = goalTitles
          .filter(
            (title) =>
              title.trim() && !existingTitles.has(title.toLowerCase().trim()),
          )
          .map((title, index) => ({
            id: generateId(),
            title: title.trim(),
            progress: 0,
            tasks: [],
            color:
              GOAL_COLORS[(get().goals.length + index) % GOAL_COLORS.length],
            createdAt: new Date().toISOString(),
            completedAt: null,
          }));

        if (newGoals.length > 0) {
          set((state) => ({ goals: [...state.goals, ...newGoals] }));
        }
      },

      clearAll: () => set({ goals: [] }),

      // ========================================================================
      // Computed
      // ========================================================================

      getGoalProgress: (goalId) => {
        const goal = get().goals.find((g) => g.id === goalId);
        return goal?.progress ?? 0;
      },

      getOverallProgress: () => {
        const { goals } = get();
        if (goals.length === 0) return 0;
        const totalProgress = goals.reduce(
          (sum, goal) => sum + goal.progress,
          0,
        );
        return totalProgress / goals.length;
      },

      getCompletedTasksCount: () => {
        return get().goals.reduce(
          (sum, goal) => sum + goal.tasks.filter((t) => t.done).length,
          0,
        );
      },

      getPendingTasksCount: () => {
        return get().goals.reduce(
          (sum, goal) => sum + goal.tasks.filter((t) => !t.done).length,
          0,
        );
      },
    }),
    {
      name: "goals-storage",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<GoalsState> | undefined;
        return {
          ...currentState,
          ...persisted,
          _hasHydrated: true,
        };
      },
      onRehydrateStorage: () => () => {
        console.log("✅ Goals Store - Hydration complete");
      },
    },
  ),
);

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const selectGoals = (state: GoalsState) => state.goals;
export const selectGoalById = (id: string) => (state: GoalsState) =>
  state.goals.find((g) => g.id === id);
export const selectHasHydrated = (state: GoalsState) => state._hasHydrated;
