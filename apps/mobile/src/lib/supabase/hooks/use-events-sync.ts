/**
 * React hook to sync goals and initiatives with Supabase
 * Handles loading, saving, and syncing events (goals/initiatives)
 */

import { useCallback } from "react";
import { useAuthStore } from "@/stores";
import {
  fetchGoals,
  fetchInitiatives,
  createGoal,
  createInitiative,
  updateEvent,
  deleteEvent,
  bulkCreateGoals,
  bulkCreateInitiatives,
  type EventData,
  type GoalMeta,
} from "../services/events";

interface UseEventsSyncOptions {
  onError?: (error: Error) => void;
}

export function useEventsSync(options: UseEventsSyncOptions = {}) {
  const { onError } = options;
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Load goals from Supabase
  const loadGoals = useCallback(async (): Promise<EventData[]> => {
    if (!isAuthenticated || !user?.id) {
      return [];
    }

    try {
      const goals = await fetchGoals(user.id);
      return goals;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to load goals");
      console.error("Failed to load goals:", err);
      onError?.(err);
      return [];
    }
  }, [isAuthenticated, user?.id, onError]);

  // Load initiatives from Supabase
  const loadInitiatives = useCallback(async (): Promise<EventData[]> => {
    if (!isAuthenticated || !user?.id) {
      return [];
    }

    try {
      const initiatives = await fetchInitiatives(user.id);
      return initiatives;
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error("Failed to load initiatives");
      console.error("Failed to load initiatives:", err);
      onError?.(err);
      return [];
    }
  }, [isAuthenticated, user?.id, onError]);

  // Create a goal
  const saveGoal = useCallback(
    async (
      title: string,
      meta?: Partial<GoalMeta>,
    ): Promise<EventData | null> => {
      if (!isAuthenticated || !user?.id) {
        throw new Error("User not authenticated");
      }

      try {
        const goal = await createGoal(user.id, title, meta);
        return goal;
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Failed to create goal");
        console.error("Failed to create goal:", err);
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, user?.id, onError],
  );

  // Create an initiative
  const saveInitiative = useCallback(
    async (
      title: string,
      description?: string,
      meta?: Partial<GoalMeta>,
    ): Promise<EventData | null> => {
      if (!isAuthenticated || !user?.id) {
        throw new Error("User not authenticated");
      }

      try {
        const initiative = await createInitiative(
          user.id,
          title,
          description,
          meta,
        );
        return initiative;
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error("Failed to create initiative");
        console.error("Failed to create initiative:", err);
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, user?.id, onError],
  );

  // Update an event
  const updateEventData = useCallback(
    async (
      eventId: string,
      updates: Partial<Pick<EventData, "title" | "meta">>,
    ): Promise<EventData> => {
      if (!isAuthenticated || !user?.id) {
        throw new Error("User not authenticated");
      }

      try {
        const updated = await updateEvent(eventId, updates);
        return updated;
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Failed to update event");
        console.error("Failed to update event:", err);
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, user?.id, onError],
  );

  // Delete an event
  const removeEvent = useCallback(
    async (eventId: string): Promise<void> => {
      if (!isAuthenticated || !user?.id) {
        throw new Error("User not authenticated");
      }

      try {
        await deleteEvent(eventId);
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Failed to delete event");
        console.error("Failed to delete event:", err);
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, user?.id, onError],
  );

  // Bulk create goals (from onboarding)
  const bulkSaveGoals = useCallback(
    async (goalTitles: string[]): Promise<EventData[]> => {
      if (!isAuthenticated || !user?.id) {
        return [];
      }

      try {
        const goals = await bulkCreateGoals(user.id, goalTitles);
        return goals;
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error("Failed to bulk create goals");
        console.error("Failed to bulk create goals:", err);
        onError?.(err);
        return [];
      }
    },
    [isAuthenticated, user?.id, onError],
  );

  // Bulk create initiatives (from onboarding)
  const bulkSaveInitiatives = useCallback(
    async (initiativeTitles: string[]): Promise<EventData[]> => {
      if (!isAuthenticated || !user?.id) {
        return [];
      }

      try {
        const initiatives = await bulkCreateInitiatives(
          user.id,
          initiativeTitles,
        );
        return initiatives;
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error("Failed to bulk create initiatives");
        console.error("Failed to bulk create initiatives:", err);
        onError?.(err);
        return [];
      }
    },
    [isAuthenticated, user?.id, onError],
  );

  return {
    loadGoals,
    loadInitiatives,
    saveGoal,
    saveInitiative,
    updateEvent: updateEventData,
    deleteEvent: removeEvent,
    bulkSaveGoals,
    bulkSaveInitiatives,
  };
}
