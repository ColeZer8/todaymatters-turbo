import { create } from 'zustand';

export type GapFillingPreference = 'conservative' | 'aggressive' | 'manual';
export type VerificationStrictness = 'lenient' | 'balanced' | 'strict';

export interface UserDataPreferences {
  gapFillingPreference: GapFillingPreference;
  confidenceThreshold: number;
  autoSuggestEvents: boolean;
  verificationAlerts: boolean;
  realTimeUpdates: boolean;
  verificationStrictness: VerificationStrictness;
}

export const DEFAULT_USER_PREFERENCES: UserDataPreferences = {
  gapFillingPreference: 'conservative',
  confidenceThreshold: 0.6,
  autoSuggestEvents: true,
  verificationAlerts: true,
  realTimeUpdates: false,
  verificationStrictness: 'balanced',
};

interface UserPreferencesState {
  preferences: UserDataPreferences;
  setPreferences: (preferences: UserDataPreferences) => void;
  updatePreferences: (updates: Partial<UserDataPreferences>) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>((set) => ({
  preferences: DEFAULT_USER_PREFERENCES,
  setPreferences: (preferences) => set({ preferences }),
  updatePreferences: (updates) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        ...updates,
      },
    })),
}));
