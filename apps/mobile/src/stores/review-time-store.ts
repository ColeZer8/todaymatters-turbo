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
  highlightedBlockId: string | null; // Block to highlight/scroll to
  // Computed
  unassignedCount: number;
  // Actions
  setTimeBlocks: (blocks: TimeBlock[]) => void;
  assignCategory: (blockId: string, categoryId: string) => void;
  clearAssignment: (blockId: string) => void;
  setHighlightedBlockId: (id: string | null) => void;
  getUnassignedCount: () => number;
}

// Mock data - matches the Unknown blocks from the calendar view
// These represent gaps in the day where we don't know what happened
const INITIAL_TIME_BLOCKS: TimeBlock[] = [
  {
    id: 'a_unknown_1',
    duration: 30,
    startTime: '11:30 AM',
    endTime: '12:00 PM',
    activityDetected: 'Phone unlocked 12 times',
  },
  {
    id: 'a_unknown_2',
    duration: 45,
    startTime: '2:15 PM',
    endTime: '3:00 PM',
    location: 'Office - Break Room',
    aiSuggestion: 'other',
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
      highlightedBlockId: null,
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

      setHighlightedBlockId: (id) => {
        set({ highlightedBlockId: id });
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

