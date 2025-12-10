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
  splitTimeBlock: (blockId: string, splitMinutes: number) => void;
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

// Helper to parse time string "11:30 AM" -> minutes from midnight
const parseTimeToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Helper to format minutes from midnight -> "11:30 AM"
const formatMinutesToTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
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

      splitTimeBlock: (blockId, splitMinutes) => {
        const { timeBlocks, assignments } = get();
        const blockIndex = timeBlocks.findIndex((b) => b.id === blockId);
        if (blockIndex === -1) return;

        const block = timeBlocks[blockIndex];
        if (splitMinutes <= 0 || splitMinutes >= block.duration) return;

        const startMinutes = parseTimeToMinutes(block.startTime);
        const splitPoint = startMinutes + splitMinutes;

        // Create two new blocks
        const firstBlock: TimeBlock = {
          id: `${block.id}_split_a`,
          duration: splitMinutes,
          startTime: block.startTime,
          endTime: formatMinutesToTime(splitPoint),
          activityDetected: block.activityDetected,
          location: block.location,
        };

        const secondBlock: TimeBlock = {
          id: `${block.id}_split_b`,
          duration: block.duration - splitMinutes,
          startTime: formatMinutesToTime(splitPoint),
          endTime: block.endTime,
          activityDetected: block.activityDetected,
          location: block.location,
        };

        // Replace original block with two new blocks
        const newTimeBlocks = [
          ...timeBlocks.slice(0, blockIndex),
          firstBlock,
          secondBlock,
          ...timeBlocks.slice(blockIndex + 1),
        ];

        // Remove assignment for old block
        const newAssignments = { ...assignments };
        delete newAssignments[blockId];

        set({
          timeBlocks: newTimeBlocks,
          assignments: newAssignments,
          unassignedCount: computeUnassignedCount(newTimeBlocks, newAssignments),
        });
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

