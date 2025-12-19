import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { getIdealDayIconByName, useIdealDayStore, type DayType, type IdealDayCategory } from '@/stores/ideal-day-store';
import { fetchProfile, getProfilePreferences, updateIdealDayUiState } from '../services/profiles';
import { fetchIdealDay, saveIdealDay, type IdealDayCategoryRow } from '../services/ideal-day';

interface UseIdealDaySyncOptions {
  autoLoad?: boolean;
  onError?: (error: Error) => void;
}

export function useIdealDaySync(options: UseIdealDaySyncOptions = {}) {
  const { autoLoad = true, onError } = options;
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const dayType = useIdealDayStore((s) => s.dayType);
  const categoriesByType = useIdealDayStore((s) => s.categoriesByType);
  const customDayConfigs = useIdealDayStore((s) => s.customDayConfigs);
  const setFromSupabase = useIdealDayStore((s) => s.setFromSupabase);

  const loadIdealDay = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const [profile, idealDay] = await Promise.all([fetchProfile(user.id), fetchIdealDay(user.id)]);
      const prefs = getProfilePreferences(profile);
      const desiredDayType = ((prefs.ideal_day_day_type ?? 'weekdays') as DayType) ?? 'weekdays';

      if (!idealDay) return;

      // Convert db rows -> store categories
      const toStoreCategory = (row: IdealDayCategoryRow): IdealDayCategory => {
        // IdealDay store uses hours, db uses minutes.
        const hours = row.minutes / 60;
        const maxHours = row.maxMinutes > 0 ? row.maxMinutes / 60 : 12;
        const iconName = row.iconName ?? 'Sparkles';
        // The store's restoreIcon uses ICON_MAP + fallback Sparkles; we reuse iconName to keep it consistent.
        // We'll let the store's persisted merge handle icon mapping; for now use a best-effort fallback.
        // (If you want perfect icon mapping, we can export a helper from the store next.)
        return {
          id: row.categoryKey,
          name: row.name,
          hours,
          maxHours,
          color: row.color ?? '#4F8BFF',
          icon: getIdealDayIconByName(iconName),
          iconName,
        };
      };

      const nextCategoriesByType = {
        ...categoriesByType,
        weekdays: idealDay.templates.weekdays.map(toStoreCategory),
        saturday: idealDay.templates.saturday.map(toStoreCategory),
        sunday: idealDay.templates.sunday.map(toStoreCategory),
        // Keep current editing buffer for custom; it will be set when user selects a day.
        custom: categoriesByType.custom,
      };

      const nextCustomDayConfigs: Record<number, IdealDayCategory[]> = {};
      for (const [dayKey, rows] of Object.entries(idealDay.overrides)) {
        nextCustomDayConfigs[Number(dayKey)] = rows.map(toStoreCategory);
      }

      setFromSupabase({
        dayType: desiredDayType,
        categoriesByType: nextCategoriesByType,
        customDayConfigs: nextCustomDayConfigs,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load ideal day');
      onError?.(err);
    }
  }, [isAuthenticated, user?.id, onError, categoriesByType, setFromSupabase]);

  const saveIdealDaySnapshot = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const toDbCategory = (cat: IdealDayCategory, index: number): IdealDayCategoryRow => ({
        categoryKey: cat.id,
        name: cat.name,
        minutes: Math.round(cat.hours * 60),
        maxMinutes: Math.round(cat.maxHours * 60),
        color: cat.color,
        iconName: cat.iconName,
        position: index,
      });

      await Promise.all([
        saveIdealDay(user.id, {
          dayType,
          templates: {
            weekdays: categoriesByType.weekdays.map(toDbCategory),
            saturday: categoriesByType.saturday.map(toDbCategory),
            sunday: categoriesByType.sunday.map(toDbCategory),
          },
          overrides: Object.fromEntries(
            Object.entries(customDayConfigs).map(([dayKey, cats]) => [
              Number(dayKey),
              cats.map(toDbCategory),
            ])
          ),
        }),
        updateIdealDayUiState(user.id, dayType),
      ]);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save ideal day');
      onError?.(err);
    }
  }, [isAuthenticated, user?.id, dayType, categoriesByType, customDayConfigs, onError]);

  useEffect(() => {
    if (autoLoad && isAuthenticated && user?.id) {
      void loadIdealDay();
    }
  }, [autoLoad, isAuthenticated, user?.id, loadIdealDay]);

  return { loadIdealDay, saveIdealDay: saveIdealDaySnapshot };
}


