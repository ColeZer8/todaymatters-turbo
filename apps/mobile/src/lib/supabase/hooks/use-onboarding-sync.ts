/**
 * React hook to sync onboarding data with Supabase
 * Handles all onboarding fields: profile, preferences, goals, initiatives
 */

import { useEffect, useCallback } from 'react';
import { useAuthStore, useOnboardingStore } from '@/stores';
import type { PermissionsData } from '@/stores/onboarding-store';
import {
  fetchProfile,
  updateDailyRhythm,
  updateFullName,
  updateMission,
  updateRole,
  updateJoySelections,
  updateJoyCustomOptions,
  updateDrainSelections,
  updateDrainCustomOptions,
  updateFocusStyle,
  updateCoachPersona,
  updateMorningMindset,
  updatePermissions,
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

  // Select state slices + actions explicitly so callbacks stay stable.
  const permissions = useOnboardingStore((s) => s.permissions);
  const role = useOnboardingStore((s) => s.role);
  const fullName = useOnboardingStore((s) => s.fullName);
  const wakeTime = useOnboardingStore((s) => s.wakeTime);
  const sleepTime = useOnboardingStore((s) => s.sleepTime);
  const purpose = useOnboardingStore((s) => s.purpose);
  const joySelections = useOnboardingStore((s) => s.joySelections);
  const joyCustomOptions = useOnboardingStore((s) => s.joyCustomOptions);
  const drainSelections = useOnboardingStore((s) => s.drainSelections);
  const drainCustomOptions = useOnboardingStore((s) => s.drainCustomOptions);
  const focusStyle = useOnboardingStore((s) => s.focusStyle);
  const coachPersona = useOnboardingStore((s) => s.coachPersona);
  const morningMindset = useOnboardingStore((s) => s.morningMindset);
  const homeAddress = useOnboardingStore((s) => s.homeAddress);
  const workAddress = useOnboardingStore((s) => s.workAddress);
  const goals = useOnboardingStore((s) => s.goals);
  const initiatives = useOnboardingStore((s) => s.initiatives);

  const setWakeTime = useOnboardingStore((s) => s.setWakeTime);
  const setSleepTime = useOnboardingStore((s) => s.setSleepTime);
  const setPurpose = useOnboardingStore((s) => s.setPurpose);
  const setRole = useOnboardingStore((s) => s.setRole);
  const setFullName = useOnboardingStore((s) => s.setFullName);
  const setPermissions = useOnboardingStore((s) => s.setPermissions);
  const setJoySelections = useOnboardingStore((s) => s.setJoySelections);
  const setJoyCustomOptions = useOnboardingStore((s) => s.setJoyCustomOptions);
  const setDrainSelections = useOnboardingStore((s) => s.setDrainSelections);
  const setDrainCustomOptions = useOnboardingStore((s) => s.setDrainCustomOptions);
  const setFocusStyle = useOnboardingStore((s) => s.setFocusStyle);
  const setCoachPersona = useOnboardingStore((s) => s.setCoachPersona);
  const setMorningMindset = useOnboardingStore((s) => s.setMorningMindset);
  const setHomeAddress = useOnboardingStore((s) => s.setHomeAddress);
  const setWorkAddress = useOnboardingStore((s) => s.setWorkAddress);
  const setGoals = useOnboardingStore((s) => s.setGoals);
  const setInitiatives = useOnboardingStore((s) => s.setInitiatives);

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
          setFullName(profile.full_name);
        }
        if (profile.ideal_work_day) {
          const wakeDate = new Date();
          const [hours, minutes] = profile.ideal_work_day.split(':').map(Number);
          wakeDate.setHours(hours, minutes, 0, 0);
          setWakeTime(wakeDate);
        }
        if (profile.ideal_sabbath) {
          const sleepDate = new Date();
          const [hours, minutes] = profile.ideal_sabbath.split(':').map(Number);
          sleepDate.setHours(hours, minutes, 0, 0);
          setSleepTime(sleepDate);
        }
        if (profile.mission) {
          setPurpose(profile.mission);
        }
        if (profile.role) {
          setRole(profile.role);
        }

        // Load preferences from meta
        const preferences = getProfilePreferences(profile);
        if (preferences.permissions) {
          setPermissions({
            calendar: !!preferences.permissions.calendar,
            notifications: !!preferences.permissions.notifications,
            email: !!preferences.permissions.email,
            health: !!preferences.permissions.health,
            location: !!preferences.permissions.location,
            contacts: !!preferences.permissions.contacts,
            browsing: !!preferences.permissions.browsing,
            appUsage: !!preferences.permissions.appUsage,
          });
        }
        if (preferences.joy_selections) {
          setJoySelections(preferences.joy_selections);
        }
        if (preferences.joy_custom_options) {
          setJoyCustomOptions(preferences.joy_custom_options);
        }
        if (preferences.drain_selections) {
          setDrainSelections(preferences.drain_selections);
        }
        if (preferences.drain_custom_options) {
          setDrainCustomOptions(preferences.drain_custom_options);
        }
        if (preferences.focus_style) {
          setFocusStyle(preferences.focus_style);
        }
        if (preferences.coach_persona) {
          setCoachPersona(preferences.coach_persona);
        }
        if (preferences.morning_mindset) {
          setMorningMindset(preferences.morning_mindset);
        }
        if (preferences.home_address) {
          setHomeAddress(preferences.home_address);
        }
        if (preferences.work_address) {
          setWorkAddress(preferences.work_address);
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
        setGoals(goalTitles);
      }
      if (initiatives.length > 0) {
        const initiativeTitles = initiatives.map((i) => i.title).filter(Boolean);
        setInitiatives(initiativeTitles);
      }

      console.log('✅ Onboarding data loaded successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load onboarding data');
      console.error('Failed to load onboarding data:', err);
      onError?.(err);
    }
  }, [
    isAuthenticated,
    user?.id,
    onError,
    setFullName,
    setWakeTime,
    setSleepTime,
    setPurpose,
    setRole,
    setPermissions,
    setJoySelections,
    setJoyCustomOptions,
    setDrainSelections,
    setDrainCustomOptions,
    setFocusStyle,
    setCoachPersona,
    setMorningMindset,
    setGoals,
    setInitiatives,
  ]);

  // Save all onboarding data to Supabase
  const saveOnboardingData = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('💾 Saving onboarding data to Supabase...');

      // Save profile data
      const wake = new Date(wakeTime);
      const sleep = new Date(sleepTime);

      await Promise.all([
        updateDailyRhythm(user.id, dateToTimeString(wake), dateToTimeString(sleep)),
        purpose && updateMission(user.id, purpose),
        role && updateRole(user.id, role),
      ]);

      // Save preferences
      await updateProfilePreferences(user.id, {
        permissions,
        joy_selections: joySelections,
        joy_custom_options: joyCustomOptions,
        drain_selections: drainSelections,
        drain_custom_options: drainCustomOptions,
        focus_style: focusStyle,
        coach_persona: coachPersona,
        morning_mindset: morningMindset,
        home_address: homeAddress,
        work_address: workAddress,
      });

      // Save goals and initiatives
      if (goals.length > 0) {
        await bulkCreateGoals(user.id, goals.filter(Boolean));
      }
      if (initiatives.length > 0) {
        await bulkCreateInitiatives(user.id, initiatives.filter(Boolean));
      }

      console.log('✅ Onboarding data saved successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save onboarding data');
      console.error('Failed to save onboarding data:', err);
      onError?.(err);
      throw err;
    }
  }, [
    isAuthenticated,
    user?.id,
    onError,
    wakeTime,
    sleepTime,
    purpose,
    role,
    permissions,
    joySelections,
    joyCustomOptions,
    drainSelections,
    drainCustomOptions,
    focusStyle,
    coachPersona,
    morningMindset,
    goals,
    initiatives,
  ]);

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

  const saveJoyCustomOptions = useCallback(
    async (options: string[]) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateJoyCustomOptions(user.id, options);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save joy custom options'));
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

  const saveDrainCustomOptions = useCallback(
    async (options: string[]) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateDrainCustomOptions(user.id, options);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save drain custom options'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const savePermissions = useCallback(
    async (permissions: PermissionsData) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updatePermissions(user.id, permissions);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save permissions'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveRole = useCallback(
    async (role: string | null) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateRole(user.id, role);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save role'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveFullName = useCallback(
    async (fullName: string) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateFullName(user.id, fullName);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save name'));
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

  const saveHomeAddress = useCallback(
    async (address: string | null) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateProfilePreferences(user.id, { home_address: address });
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save home address'));
      }
    },
    [isAuthenticated, user?.id, onError]
  );

  const saveWorkAddress = useCallback(
    async (address: string | null) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        await updateProfilePreferences(user.id, { work_address: address });
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save work address'));
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
    savePermissions,
    saveFullName,
    saveRole,
    saveJoySelections,
    saveJoyCustomOptions,
    saveDrainSelections,
    saveDrainCustomOptions,
    saveFocusStyle,
    saveCoachPersona,
    saveMorningMindset,
    saveDailyRhythm,
    savePurpose,
    saveHomeAddress,
    saveWorkAddress,
  };
}





