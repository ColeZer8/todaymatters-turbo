import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TimeBlock {
  id: string;
  duration: number; // minutes
  startTime: string;
  endTime: string;
  activityDetected?: string;
  location?: string;
  aiSuggestion?: string;
}

interface ReviewTimeState {
  timeBlocks: TimeBlock[];
  assignments: Record<string, string>; // blockId -> categoryId
  // Computed
  unassignedCount: number;
  // Actions
  setTimeBlocks: (blocks: TimeBlock[]) => void;
  assignCategory: (blockId: string, categoryId: string) => void;
  clearAssignment: (blockId: string) => void;
  getUnassignedCount: () => number;
}

// Initial mock data - in production this would come from an API
const INITIAL_TIME_BLOCKS: TimeBlock[] = [
  {
    id: '1',
    duration: 45,
    startTime: '10:30 PM',
    endTime: '11:15 PM',
    activityDetected: 'Instagram detected',
  },
  {
    id: '2',
    duration: 60,
    startTime: '5:30 PM',
    endTime: '6:30 PM',
    location: "Gold's Gym",
    aiSuggestion: 'health',
  },
  {
    id: '3',
    duration: 45,
    startTime: '12:15 PM',
    endTime: '1:00 PM',
  },
];

const computeUnassignedCount = (
  timeBlocks: TimeBlock[],
  assignments: Record<string, string>
): number => {
  return timeBlocks.filter((block) => !assignments[block.id]).length;
};

export const useReviewTimeStore = create<ReviewTimeState>()(
  persist(
    (set, get) => ({
      timeBlocks: INITIAL_TIME_BLOCKS,
      assignments: {},
      unassignedCount: INITIAL_TIME_BLOCKS.length,

      setTimeBlocks: (blocks) => {
        set({
          timeBlocks: blocks,
          unassignedCount: computeUnassignedCount(blocks, get().assignments),
        });
      },

      assignCategory: (blockId, categoryId) => {
        const newAssignments = {
          ...get().assignments,
          [blockId]: categoryId,
        };
        set({
          assignments: newAssignments,
          unassignedCount: computeUnassignedCount(get().timeBlocks, newAssignments),
        });
      },

      clearAssignment: (blockId) => {
        const newAssignments = { ...get().assignments };
        delete newAssignments[blockId];
        set({
          assignments: newAssignments,
          unassignedCount: computeUnassignedCount(get().timeBlocks, newAssignments),
        });
      },

      getUnassignedCount: () => {
        return computeUnassignedCount(get().timeBlocks, get().assignments);
      },
    }),
    {
      name: 'review-time-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        assignments: state.assignments,
      }),
    }
  )
);

