/**
 * React hook to sync profile data with Supabase
 * Handles loading, saving, and syncing profile information
 */

import { useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores";
import {
  fetchProfile,
  updateProfile,
  updateFullName,
  updateDailyRhythm,
  updateMission,
  dateToTimeString,
} from "../services/profiles";
import type { ProfileData } from "../services/profiles";

interface UseProfileSyncOptions {
  autoLoad?: boolean; // Automatically load profile on mount
  onError?: (error: Error) => void;
}

export function useProfileSync(options: UseProfileSyncOptions = {}) {
  const { autoLoad = true, onError } = options;
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Load profile from Supabase
  const loadProfile = useCallback(async (): Promise<ProfileData | null> => {
    if (!isAuthenticated || !user?.id) {
      return null;
    }

    try {
      const profile = await fetchProfile(user.id);
      return profile;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to load profile");
      console.error("Failed to load profile:", err);
      onError?.(err);
      return null;
    }
  }, [isAuthenticated, user?.id, onError]);

  // Save profile to Supabase
  const saveProfile = useCallback(
    async (updates: Partial<ProfileData>): Promise<void> => {
      if (!isAuthenticated || !user?.id) {
        throw new Error("User not authenticated");
      }

      try {
        await updateProfile(user.id, updates);
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Failed to save profile");
        console.error("Failed to save profile:", err);
        onError?.(err);
        throw err;
      }
    },
    [isAuthenticated, user?.id, onError],
  );

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && isAuthenticated && user?.id) {
      loadProfile();
    }
  }, [autoLoad, isAuthenticated, user?.id, loadProfile]);

  return {
    loadProfile,
    saveProfile,
    updateFullName: useCallback(
      async (name: string) => {
        if (!isAuthenticated || !user?.id) return;
        try {
          await updateFullName(user.id, name);
        } catch (error) {
          onError?.(
            error instanceof Error ? error : new Error("Failed to update name"),
          );
        }
      },
      [isAuthenticated, user?.id, onError],
    ),
    updateDailyRhythm: useCallback(
      async (wakeTime: Date, sleepTime: Date) => {
        if (!isAuthenticated || !user?.id) return;
        try {
          await updateDailyRhythm(
            user.id,
            dateToTimeString(wakeTime),
            dateToTimeString(sleepTime),
          );
        } catch (error) {
          onError?.(
            error instanceof Error
              ? error
              : new Error("Failed to update daily rhythm"),
          );
        }
      },
      [isAuthenticated, user?.id, onError],
    ),
    updateMission: useCallback(
      async (mission: string | null) => {
        if (!isAuthenticated || !user?.id) return;
        try {
          await updateMission(user.id, mission);
        } catch (error) {
          onError?.(
            error instanceof Error
              ? error
              : new Error("Failed to update mission"),
          );
        }
      },
      [isAuthenticated, user?.id, onError],
    ),
  };
}
