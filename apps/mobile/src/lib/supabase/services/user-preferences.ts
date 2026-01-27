import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import {
  DEFAULT_USER_PREFERENCES,
  type GapFillingPreference,
  type VerificationStrictness,
  type UserDataPreferences,
} from "@/stores/user-preferences-store";

interface UserPreferencesRow {
  user_id: string;
  gap_filling_preferences: unknown | null;
  big3_enabled: boolean | null;
}

interface GapFillingPreferencesPayload {
  mode?: GapFillingPreference;
  confidenceThreshold?: number;
  autoSuggestEvents?: boolean;
  verificationAlerts?: boolean;
  realTimeUpdates?: boolean;
  verificationStrictness?: VerificationStrictness;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

function parseGapFillingPreferences(
  value: unknown,
): GapFillingPreferencesPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as GapFillingPreferencesPayload;
}

function coerceGapFillingPreference(value: unknown): GapFillingPreference {
  if (value === "aggressive" || value === "manual") return value;
  return "conservative";
}

function coerceVerificationStrictness(value: unknown): VerificationStrictness {
  if (value === "lenient" || value === "strict") return value;
  return "balanced";
}

function mergePreferences(
  payload: GapFillingPreferencesPayload | null,
  big3Enabled?: boolean | null,
): UserDataPreferences {
  const defaults = DEFAULT_USER_PREFERENCES;
  if (!payload) {
    return {
      ...defaults,
      big3Enabled:
        typeof big3Enabled === "boolean" ? big3Enabled : defaults.big3Enabled,
    };
  }
  return {
    gapFillingPreference: coerceGapFillingPreference(payload.mode),
    confidenceThreshold:
      typeof payload.confidenceThreshold === "number"
        ? payload.confidenceThreshold
        : defaults.confidenceThreshold,
    autoSuggestEvents:
      typeof payload.autoSuggestEvents === "boolean"
        ? payload.autoSuggestEvents
        : defaults.autoSuggestEvents,
    verificationAlerts:
      typeof payload.verificationAlerts === "boolean"
        ? payload.verificationAlerts
        : defaults.verificationAlerts,
    realTimeUpdates:
      typeof payload.realTimeUpdates === "boolean"
        ? payload.realTimeUpdates
        : defaults.realTimeUpdates,
    verificationStrictness: coerceVerificationStrictness(
      payload.verificationStrictness,
    ),
    big3Enabled:
      typeof big3Enabled === "boolean" ? big3Enabled : defaults.big3Enabled,
  };
}

export async function fetchUserDataPreferences(
  userId: string,
): Promise<UserDataPreferences> {
  try {
    const { data, error } = await tmSchema()
      .from("user_data_preferences")
      .select("user_id, gap_filling_preferences, big3_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    if (!data) return DEFAULT_USER_PREFERENCES;

    const row = data as UserPreferencesRow;
    const payload = parseGapFillingPreferences(row.gap_filling_preferences);
    return mergePreferences(payload, row.big3_enabled);
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserPreferences] Failed to fetch preferences:", error);
    }
    return DEFAULT_USER_PREFERENCES;
  }
}

export async function upsertUserDataPreferences(options: {
  userId: string;
  preferences: UserDataPreferences;
}): Promise<UserDataPreferences> {
  const { userId, preferences } = options;
  const payload: GapFillingPreferencesPayload = {
    mode: preferences.gapFillingPreference,
    confidenceThreshold: preferences.confidenceThreshold,
    autoSuggestEvents: preferences.autoSuggestEvents,
    verificationAlerts: preferences.verificationAlerts,
    realTimeUpdates: preferences.realTimeUpdates,
    verificationStrictness: preferences.verificationStrictness,
  };

  try {
    const { data, error } = await tmSchema()
      .from("user_data_preferences")
      .upsert(
        {
          user_id: userId,
          gap_filling_preferences: payload,
          big3_enabled: preferences.big3Enabled,
        },
        { onConflict: "user_id" },
      )
      .select("user_id, gap_filling_preferences, big3_enabled")
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    const row = data as UserPreferencesRow | null;
    const payloadValue = parseGapFillingPreferences(
      row?.gap_filling_preferences,
    );
    return mergePreferences(payloadValue, row?.big3_enabled);
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserPreferences] Failed to save preferences:", error);
    }
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
