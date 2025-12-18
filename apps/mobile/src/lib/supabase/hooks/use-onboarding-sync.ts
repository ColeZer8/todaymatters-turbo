/**
 * React hook to sync onboarding data with Supabase
 * Handles all onboarding fields: profile, preferences, goals, initiatives
 */

import { useEffect, useCallback } from 'react';
import { useAuthStore, useOnboardingStore } from '@/stores';
import {
  fetchProfile,
  updateDailyRhythm,
  updateMission,
  updateRole,
  updateJoySelections,
  updateDrainSelections,
  updateFocusStyle,
  updateCoachPersona,
  updateMorningMindset,
  updateProfilePreferences,
  getProfilePreferences,
  dateToTimeString,
} from '../services/profiles';
import {
  fetchGoals,
  fetchInitiatives,
  bulkCreateGoals,
  bulkCreateInitiatives,
} from '../services/events';
import type { ProfileData } from '../services/profiles';

interface UseOnboardingSyncOptions {
  autoLoad?: boolean; // Automatically load on mount
  autoSave?: boolean; // Automatically save on changes
  onError?: (error: Error) => void;
}

export function useOnboardingSync(options: UseOnboardingSyncOptions = {}) {
  const { autoLoad = true, autoSave = false, onError } = options;
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Get all onboarding state
  const onboardingState = useOnboardingStore();

  // Load all onboarding data from Supabase
  const loadOnboardingData = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    try {
      console.log('📥 Loading onboarding data from Supabase...');

      // Load profile
      const profile = await fetchProfile(user.id);
      if (profile) {
        // Update store with profile data
        if (profile.full_name) {
          // Note: We don't have a setFullName in onboarding store, but we can set it
        }
        if (profile.ideal_work_day) {
          const wakeDate = new Date();
          const [hours, minutes] = profile.ideal_work_day.split(':').map(Number);
          wakeDate.setHours(hours, minutes, 0, 0);
          onboardingState.setWakeTime(wakeDate);
        }
        if (profile.ideal_sabbath) {
          const sleepDate = new Date();
          const [hours, minutes] = profile.ideal_sabbath.split(':').map(Number);
          sleepDate.setHours(hours, minutes, 0, 0);
          onboardingState.setSleepTime(sleepDate);
        }
        if (profile.mission) {
          onboardingState.setPurpose(profile.mission);
        }
        if (profile.role) {
          onboardingState.setRole(profile.role);
        }

        // Load preferences from meta
        const preferences = getProfilePreferences(profile);
        if (preferences.joy_selections) {
          onboardingState.setJoySelections(preferences.joy_selections);
        }
        if (preferences.drain_selections) {
          onboardingState.setDrainSelections(preferences.drain_selections);
        }
        if (preferences.focus_style) {
          onboardingState.setFocusStyle(preferences.focus_style);
        }
        if (preferences.coach_persona) {
          onboardingState.setCoachPersona(preferences.coach_persona);
        }
        if (preferences.morning_mindset) {
          onboardingState.setMorningMindset(preferences.morning_mindset);
        }
      }

      // Load goals and initiatives
      const [goals, initiatives] = await Promise.all([
        fetchGoals(user.id),
        fetchInitiatives(user.id),
      ]);

      // Update store with goals/initiatives
      if (goals.length > 0) {
        const goalTitles = goals.map((g) => g.title).filter(Boolean);
        onboardingState.setGoals(goalTitles);
      }
      if (initiatives.length > 0) {
        const initiativeTitles = initiatives.map((i) => i.title).filter(Boolean);
        onboardingState.setInitiatives(initiativeTitles);
      }

      console.log('✅ Onboarding data loaded successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load onboarding data');
      console.error('Failed to load onboarding data:', err);
      onError?.(err);
    }
  }, [isAuthenticated, user?.id, onboardingState, onError]);

  // Save all onboarding data to Supabase
  const saveOnboardingData = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('💾 Saving onboarding data to Supabase...');

      // Save profile data
      const wakeTime = new Date(onboardingState.wakeTime);
      const sleepTime = new Date(onboardingState.sleepTime);

      await Promise.all([
        updateDailyRhythm(user.id, dateToTimeString(wakeTime), dateToTimeString(sleepTime)),
        onboardingState.purpose && updateMission(user.id, onboardingState.purpose),
        onboardingState.role && updateRole(user.id, onboardingState.role),
      ]);

      // Save preferences
      await updateProfilePreferences(user.id, {
        joy_selections: onboardingState.joySelections,
        drain_selections: onboardingState.drainSelections,
        focus_style: onboardingState.focusStyle,
        coach_persona: onboardingState.coachPersona,
        morning_mindset: onboardingState.morningMindset,
      });

      // Save goals and initiatives
      if (onboardingState.goals.length > 0) {
        await bulkCreateGoals(user.id, onboardingState.goals.filter(Boolean));
      }
      if (onboardingState.initiatives.length > 0) {
        await bulkCreateInitiatives(user.id, onboardingState.initiatives.filter(Boolean));
      }

      console.log('✅ Onboarding data saved successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save onboarding data');
      console.error('Failed to save onboarding data:', err);
      onError?.(err);
      throw err;
    }
  }, [isAuthenticated, user?.id, onboardingState, onError]);

  // Individual save functions for auto-save
  const saveJoySelections = useCallback(
    async (selections: string[]) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateJoySelections(user.id, selections);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save joy selections'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveDrainSelections = useCallback(
    async (selections: string[]) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateDrainSelections(user.id, selections);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save drain selections'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveFocusStyle = useCallback(
    async (focusStyle: string | null) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateFocusStyle(user.id, focusStyle);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save focus style'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveCoachPersona = useCallback(
    async (coachPersona: string | null) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateCoachPersona(user.id, coachPersona);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save coach persona'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveMorningMindset = useCallback(
    async (morningMindset: string | null) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateMorningMindset(user.id, morningMindset);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save morning mindset'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveDailyRhythm = useCallback(
    async (wakeTime: Date, sleepTime: Date) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateDailyRhythm(user.id, dateToTimeString(wakeTime), dateToTimeString(sleepTime));
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save daily rhythm'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const savePurpose = useCallback(
    async (purpose: string | null) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateMission(user.id, purpose);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save purpose'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && isAuthenticated && user?.id) {
      loadOnboardingData();
    }
  }, [autoLoad, isAuthenticated, user?.id, loadOnboardingData]);

  return {
    loadOnboardingData,
    saveOnboardingData,
    // Individual save functions for auto-save
    saveJoySelections,
    saveDrainSelections,
    saveFocusStyle,
    saveCoachPersona,
    saveMorningMindset,
    saveDailyRhythm,
    savePurpose,
  };
}
