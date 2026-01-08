import { useCallback } from 'react';
import { useAuthStore } from '@/stores';
import {
  createActualCalendarEvent,
  createPlannedCalendarEvent,
  deleteActualCalendarEvent,
  deletePlannedCalendarEvent,
  fetchActualCalendarEventsForDay,
  fetchPlannedCalendarEventsForDay,
  updateActualCalendarEvent,
  updatePlannedCalendarEvent,
  type CreatePlannedCalendarEventInput,
  type PlannedCalendarMeta,
} from '../services/calendar-events';
import type { ScheduledEvent } from '@/stores';

interface UseCalendarEventsSyncOptions {
  onError?: (error: Error) => void;
}

export function useCalendarEventsSync(options: UseCalendarEventsSyncOptions = {}) {
  const { onError } = options;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const loadPlannedForDay = useCallback(
    async (ymd: string): Promise<ScheduledEvent[]> => {
      if (!isAuthenticated || !userId) return [];
      try {
        return await fetchPlannedCalendarEventsForDay(userId, ymd);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to load planned events');
        onError?.(err);
        return [];
      }
    },
    [isAuthenticated, onError, userId]
  );

  const loadActualForDay = useCallback(
    async (ymd: string): Promise<ScheduledEvent[]> => {
      if (!isAuthenticated || !userId) return [];
      try {
        return await fetchActualCalendarEventsForDay(userId, ymd);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to load actual events');
        onError?.(err);
        return [];
      }
    },
    [isAuthenticated, onError, userId]
  );

  const createPlanned = useCallback(
    async (input: Omit<CreatePlannedCalendarEventInput, 'userId'>): Promise<ScheduledEvent> => {
      if (!isAuthenticated || !userId) {
        throw new Error('User not authenticated');
      }
      try {
        return await createPlannedCalendarEvent({ ...input, userId });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to create planned event');
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, onError, userId]
  );

  const createActual = useCallback(
    async (input: Omit<CreatePlannedCalendarEventInput, 'userId'>): Promise<ScheduledEvent> => {
      if (!isAuthenticated || !userId) {
        throw new Error('User not authenticated');
      }
      try {
        return await createActualCalendarEvent({ ...input, userId });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to create actual event');
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, onError, userId]
  );

  const updatePlanned = useCallback(
    async (
      eventId: string,
      updates: {
        title?: string;
        description?: string;
        location?: string;
        scheduledStartIso?: string;
        scheduledEndIso?: string;
        meta?: PlannedCalendarMeta;
      }
    ): Promise<ScheduledEvent> => {
      if (!isAuthenticated || !userId) {
        throw new Error('User not authenticated');
      }
      try {
        return await updatePlannedCalendarEvent({ eventId, ...updates });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to update planned event');
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, onError, userId]
  );

  const updateActual = useCallback(
    async (
      eventId: string,
      updates: {
        title?: string;
        description?: string;
        location?: string;
        scheduledStartIso?: string;
        scheduledEndIso?: string;
        meta?: PlannedCalendarMeta;
      }
    ): Promise<ScheduledEvent> => {
      if (!isAuthenticated || !userId) {
        throw new Error('User not authenticated');
      }
      try {
        return await updateActualCalendarEvent({ eventId, ...updates });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to update actual event');
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, onError, userId]
  );

  const deletePlanned = useCallback(
    async (eventId: string): Promise<void> => {
      if (!isAuthenticated || !userId) {
        throw new Error('User not authenticated');
      }
      try {
        await deletePlannedCalendarEvent(eventId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to delete planned event');
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, onError, userId]
  );

  const deleteActual = useCallback(
    async (eventId: string): Promise<void> => {
      if (!isAuthenticated || !userId) {
        throw new Error('User not authenticated');
      }
      try {
        await deleteActualCalendarEvent(eventId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to delete actual event');
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, onError, userId]
  );

  return { loadPlannedForDay, loadActualForDay, createPlanned, createActual, updatePlanned, updateActual, deletePlanned, deleteActual };
}


