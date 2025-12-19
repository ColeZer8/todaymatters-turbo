import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { getIconByKey, useRoutineBuilderStore, type IconKey } from '@/stores/routine-builder-store';
import { fetchRoutine, saveRoutine } from '../services/routines';

interface UseRoutineSyncOptions {
  autoLoad?: boolean;
  onError?: (error: Error) => void;
}

export function useRoutineSync(options: UseRoutineSyncOptions = {}) {
  const { autoLoad = true, onError } = options;
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const wakeTime = useRoutineBuilderStore((s) => s.wakeTime);
  const items = useRoutineBuilderStore((s) => s.items);
  const setItems = useRoutineBuilderStore((s) => s.setItems);
  const setWakeTime = useRoutineBuilderStore((s) => s.setWakeTime);

  const toIconKey = useCallback((value: string | null): IconKey => {
    if (value === 'droplet' || value === 'book' || value === 'utensils' || value === 'moon' || value === 'sun') {
      return value;
    }
    return 'droplet';
  }, []);

  const loadRoutine = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const snapshot = await fetchRoutine(user.id, 'morning');
      if (!snapshot) return;

      if (snapshot.wakeTime) {
        // "HH:MM:SS" or "HH:MM"
        setWakeTime(snapshot.wakeTime.slice(0, 5));
      }

      if (snapshot.items.length > 0) {
        const now = Date.now();
        setItems(
          snapshot.items.map((it, idx) => {
            const iconKey = toIconKey(it.iconKey);
            return {
              id: `${now}-${idx}`,
              title: it.title,
              minutes: it.minutes,
              iconKey,
              icon: getIconByKey(iconKey),
            };
          })
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load routine');
      onError?.(err);
    }
  }, [isAuthenticated, user?.id, setItems, setWakeTime, onError, toIconKey]);

  const saveRoutineSnapshot = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      await saveRoutine(
        user.id,
        {
          wakeTime: wakeTime,
          items: items.map((it) => ({
            title: it.title,
            minutes: it.minutes,
            iconKey: it.iconKey ?? null,
          })),
        },
        'morning'
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save routine');
      onError?.(err);
    }
  }, [isAuthenticated, user?.id, wakeTime, items, onError]);

  useEffect(() => {
    if (autoLoad && isAuthenticated && user?.id) {
      void loadRoutine();
    }
  }, [autoLoad, isAuthenticated, user?.id, loadRoutine]);

  return { loadRoutine, saveRoutine: saveRoutineSnapshot };
}


