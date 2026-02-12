import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { produce } from "immer";
export type ReviewCategoryId = "faith" | "family" | "work" | "health" | "other";

export type ReviewBlockSource =
  | "screen_time"
  | "location"
  | "commute"
  | "workout"
  | "unknown";

export interface AiSuggestion {
  category: ReviewCategoryId;
  confidence: number;
  reason?: string;
  title?: string;
  description?: string;
}

export interface TimeBlock {
  id: string;
  sourceId: string;
  source: ReviewBlockSource;
  eventId?: string | null;
  title: string;
  description: string;
  duration: number; // minutes
  startMinutes: number;
  startTime: string;
  endTime: string;
  activityDetected?: string;
  location?: string;
}

interface ReviewTimeState {
  timeBlocks: TimeBlock[];
  assignments: Record<string, ReviewCategoryId>;
  notes: Record<string, string>;
  aiSuggestions: Record<string, AiSuggestion>;
  completedByDate: Record<string, string>;
  autoAssignRequestedAt: string | null;
  highlightedBlockId: string | null; // Block to highlight/scroll to
  // Computed
  unassignedCount: number;
  // Actions
  setTimeBlocks: (blocks: TimeBlock[]) => void;
  assignCategory: (blockId: string, categoryId: ReviewCategoryId) => void;
  clearAssignment: (blockId: string) => void;
  setNote: (blockId: string, value: string) => void;
  setAiSuggestion: (blockId: string, suggestion: AiSuggestion) => void;
  clearAiSuggestion: (blockId: string) => void;
  markReviewComplete: (ymd: string) => void;
  clearReviewComplete: (ymd: string) => void;
  requestAutoAssignAll: () => void;
  clearAutoAssignRequest: () => void;
  setHighlightedBlockId: (id: string | null) => void;
  getUnassignedCount: () => number;
  splitTimeBlock: (blockId: string, splitMinutes: number) => void;
  clearAll: () => void;
}

const INITIAL_TIME_BLOCKS: TimeBlock[] = [];

const computeUnassignedCount = (
  timeBlocks: TimeBlock[],
  assignments: Record<string, ReviewCategoryId>,
): number => {
  return timeBlocks.filter((block) => !assignments[block.id]).length;
};

// Helper to format minutes from midnight -> "11:30 AM"
const formatMinutesToTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export const useReviewTimeStore = create<ReviewTimeState>()(
  persist(
    (set, get) => ({
      timeBlocks: INITIAL_TIME_BLOCKS,
      assignments: {},
      notes: {},
      aiSuggestions: {},
      completedByDate: {},
      autoAssignRequestedAt: null,
      highlightedBlockId: null,
      unassignedCount: INITIAL_TIME_BLOCKS.length,

      setTimeBlocks: (blocks) => {
        const ids = new Set(blocks.map((b) => b.id));
        const filteredAssignments: Record<string, ReviewCategoryId> = {};
        const filteredNotes: Record<string, string> = {};
        const filteredSuggestions: Record<string, AiSuggestion> = {};

        for (const [blockId, value] of Object.entries(get().assignments)) {
          if (ids.has(blockId))
            filteredAssignments[blockId] = value as ReviewCategoryId;
        }
        for (const [blockId, value] of Object.entries(get().notes)) {
          if (ids.has(blockId)) filteredNotes[blockId] = value;
        }
        for (const [blockId, value] of Object.entries(get().aiSuggestions)) {
          if (ids.has(blockId))
            filteredSuggestions[blockId] = value as AiSuggestion;
        }

        set({
          timeBlocks: blocks,
          assignments: filteredAssignments,
          notes: filteredNotes,
          aiSuggestions: filteredSuggestions,
          unassignedCount: computeUnassignedCount(blocks, filteredAssignments),
        });
      },

      assignCategory: (blockId, categoryId) => {
        const newAssignments = {
          ...get().assignments,
          [blockId]: categoryId,
        };
        set({
          assignments: newAssignments,
          unassignedCount: computeUnassignedCount(
            get().timeBlocks,
            newAssignments,
          ),
        });
      },

      clearAssignment: (blockId) => {
        const newAssignments = { ...get().assignments };
        delete newAssignments[blockId];
        set({
          assignments: newAssignments,
          unassignedCount: computeUnassignedCount(
            get().timeBlocks,
            newAssignments,
          ),
        });
      },

      setNote: (blockId, value) => {
        set((state) => ({
          notes: { ...state.notes, [blockId]: value },
        }));
      },

      setAiSuggestion: (blockId, suggestion) => {
        set((state) => ({
          aiSuggestions: { ...state.aiSuggestions, [blockId]: suggestion },
        }));
      },

      clearAiSuggestion: (blockId) => {
        set((state) => {
          const next = { ...state.aiSuggestions };
          delete next[blockId];
          return { aiSuggestions: next };
        });
      },

      setHighlightedBlockId: (id) => {
        set({ highlightedBlockId: id });
      },

      getUnassignedCount: () => {
        return computeUnassignedCount(get().timeBlocks, get().assignments);
      },

      splitTimeBlock: (blockId, splitMinutes) => {
        const state = get();
        const blockIndex = state.timeBlocks.findIndex((b) => b.id === blockId);
        if (blockIndex == -1) return;

        const block = state.timeBlocks[blockIndex];
        if (splitMinutes <= 0 || splitMinutes >= block.duration) return;

        const startMinutes = block.startMinutes;
        const splitPoint = startMinutes + splitMinutes;

        const firstBlock: TimeBlock = {
          ...block,
          id: `${block.id}_split_a`,
          duration: splitMinutes,
          startMinutes,
          startTime: block.startTime,
          endTime: formatMinutesToTime(splitPoint),
        };

        const secondBlock: TimeBlock = {
          ...block,
          id: `${block.id}_split_b`,
          duration: block.duration - splitMinutes,
          startMinutes: splitPoint,
          startTime: formatMinutesToTime(splitPoint),
          endTime: block.endTime,
        };

        // Use Immer to safely update all related state in one go
        set((state) =>
          produce(state, (draft) => {
            // Update timeBlocks array
            draft.timeBlocks.splice(blockIndex, 1, firstBlock, secondBlock);

            // Move assignment from old block to new blocks
            const assignment = draft.assignments[blockId];
            delete draft.assignments[blockId];
            if (assignment) {
              draft.assignments[firstBlock.id] = assignment;
              draft.assignments[secondBlock.id] = assignment;
            }

            // Move note from old block to new blocks
            const noteValue = draft.notes[blockId];
            delete draft.notes[blockId];
            if (noteValue) {
              draft.notes[firstBlock.id] = noteValue;
              draft.notes[secondBlock.id] = noteValue;
            }

            // Move AI suggestion from old block to new blocks
            const suggestionValue = draft.aiSuggestions[blockId];
            delete draft.aiSuggestions[blockId];
            if (suggestionValue) {
              draft.aiSuggestions[firstBlock.id] = suggestionValue;
              draft.aiSuggestions[secondBlock.id] = suggestionValue;
            }

            // Update unassignedCount
            draft.unassignedCount = computeUnassignedCount(
              draft.timeBlocks,
              draft.assignments,
            );
          })
        );
      },

      clearAll: () => {
        set({
          timeBlocks: [],
          assignments: {},
          notes: {},
          aiSuggestions: {},
          completedByDate: {},
          autoAssignRequestedAt: null,
          highlightedBlockId: null,
          unassignedCount: 0,
        });
      },
    }),
    {
      name: "review-time-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        assignments: state.assignments,
        notes: state.notes,
        completedByDate: state.completedByDate,
        autoAssignRequestedAt: state.autoAssignRequestedAt,
      }),
    },
  ),
);
