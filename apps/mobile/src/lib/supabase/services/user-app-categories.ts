import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { EventCategory } from "@/stores";
import {
  type AppCategoryOverride,
  type AppCategoryOverrides,
  normalizeAppKey,
} from "@/lib/calendar/app-classification";
import {
  type AppCategory,
  type UserAppCategoryOverrides as IntentAppCategoryOverrides,
  getAppCategory,
} from "./app-categories";

const CONFIDENCE_STEP_UP = 0.15;
const CONFIDENCE_STEP_DOWN = 0.2;
const CONFIDENCE_MIN = 0.2;
const CONFIDENCE_RESET = 0.6;

interface UserAppCategoryRow {
  user_id: string;
  app_key: string;
  app_name: string | null;
  category: string;
  confidence: number | null;
  sample_count: number | null;
  last_corrected_at: string | null;
}

export interface UserAppCategoryFeedbackResult extends AppCategoryOverride {
  appKey: string;
  appName: string | null;
  sampleCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

function toEventCategory(value: string): EventCategory {
  return value as EventCategory;
}

function rowToOverride(row: UserAppCategoryRow): UserAppCategoryFeedbackResult {
  return {
    appKey: row.app_key,
    appName: row.app_name ?? null,
    category: toEventCategory(row.category),
    confidence: row.confidence ?? CONFIDENCE_RESET,
    sampleCount: row.sample_count ?? 0,
  };
}

export async function fetchUserAppCategoryOverrides(
  userId: string,
): Promise<AppCategoryOverrides> {
  try {
    const { data, error } = await tmSchema()
      .from("user_app_categories")
      .select("app_key, app_name, category, confidence, sample_count")
      .eq("user_id", userId);

    if (error) throw handleSupabaseError(error);

    const overrides: AppCategoryOverrides = {};
    for (const row of (data ?? []) as UserAppCategoryRow[]) {
      const override = rowToOverride(row);
      overrides[override.appKey] = {
        category: override.category,
        confidence: override.confidence,
      };
    }
    return overrides;
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to fetch overrides:", error);
    }
    return {};
  }
}

export async function fetchUserAppCategoryDetails(
  userId: string,
): Promise<UserAppCategoryFeedbackResult[]> {
  try {
    const { data, error } = await tmSchema()
      .from("user_app_categories")
      .select("app_key, app_name, category, confidence, sample_count")
      .eq("user_id", userId)
      .order("app_name", { ascending: true });

    if (error) throw handleSupabaseError(error);
    return (data ?? []).map((row) => rowToOverride(row as UserAppCategoryRow));
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to fetch details:", error);
    }
    return [];
  }
}

export async function upsertUserAppCategoryOverride(options: {
  userId: string;
  appKey: string;
  appName: string | null;
  category: EventCategory;
  confidence?: number;
  sampleCount?: number;
}): Promise<UserAppCategoryFeedbackResult | null> {
  const {
    userId,
    appKey,
    appName,
    category,
    confidence = CONFIDENCE_RESET,
    sampleCount,
  } = options;
  if (!appKey) return null;
  try {
    const { data, error } = await tmSchema()
      .from("user_app_categories")
      .upsert(
        {
          user_id: userId,
          app_key: appKey,
          app_name: appName,
          category,
          confidence,
          sample_count: sampleCount ?? 1,
          last_corrected_at: new Date().toISOString(),
        },
        { onConflict: "user_id, app_key" },
      )
      .select("*")
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    return data ? rowToOverride(data as UserAppCategoryRow) : null;
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to upsert override:", error);
    }
    return null;
  }
}

export async function removeUserAppCategoryOverride(options: {
  userId: string;
  appKey: string;
}): Promise<boolean> {
  const { userId, appKey } = options;
  try {
    const { error } = await tmSchema()
      .from("user_app_categories")
      .delete()
      .eq("user_id", userId)
      .eq("app_key", appKey);
    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to remove override:", error);
    }
    return false;
  }
}

export async function applyUserAppCategoryFeedback(options: {
  userId: string;
  appName: string;
  category: EventCategory;
}): Promise<UserAppCategoryFeedbackResult | null> {
  const { userId, appName, category } = options;
  const appKey = normalizeAppKey(appName);
  if (!appKey) return null;

  try {
    const { data, error } = await tmSchema()
      .from("user_app_categories")
      .select("*")
      .eq("user_id", userId)
      .eq("app_key", appKey)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);

    if (!data) {
      const { data: inserted, error: insertError } = await tmSchema()
        .from("user_app_categories")
        .insert({
          user_id: userId,
          app_key: appKey,
          app_name: appName,
          category,
          confidence: CONFIDENCE_RESET,
          sample_count: 1,
          last_corrected_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();

      if (insertError) throw handleSupabaseError(insertError);
      return inserted ? rowToOverride(inserted as UserAppCategoryRow) : null;
    }

    const current = data as UserAppCategoryRow;
    const currentConfidence = current.confidence ?? CONFIDENCE_RESET;
    const currentCategory = toEventCategory(current.category);
    const nextSampleCount = (current.sample_count ?? 0) + 1;
    let nextCategory = currentCategory;
    let nextConfidence = currentConfidence;

    if (currentCategory === category) {
      nextConfidence = Math.min(1, currentConfidence + CONFIDENCE_STEP_UP);
    } else {
      const reduced = Math.max(
        CONFIDENCE_MIN,
        currentConfidence - CONFIDENCE_STEP_DOWN,
      );
      if (reduced <= 0.4) {
        nextCategory = category;
        nextConfidence = CONFIDENCE_RESET;
      } else {
        nextConfidence = reduced;
      }
    }

    const { data: updated, error: updateError } = await tmSchema()
      .from("user_app_categories")
      .update({
        app_name: current.app_name ?? appName,
        category: nextCategory,
        confidence: nextConfidence,
        sample_count: nextSampleCount,
        last_corrected_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("app_key", appKey)
      .select("*")
      .maybeSingle();

    if (updateError) throw handleSupabaseError(updateError);
    return updated ? rowToOverride(updated as UserAppCategoryRow) : null;
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to apply feedback:", error);
    }
    return null;
  }
}

// ============================================================================
// App Category Settings (for US-026)
// ============================================================================

/**
 * Recently used app with aggregated duration and current category.
 */
export interface RecentlyUsedApp {
  /** Normalized app key */
  appKey: string;
  /** Display name of the app */
  displayName: string;
  /** Total duration in seconds over the last 30 days */
  totalSeconds: number;
  /** Current category (from user override or default) */
  category: AppCategory;
  /** Whether this category is from a user override */
  isOverride: boolean;
}

/**
 * Fetch apps used in the last 30 days with aggregated duration.
 * Returns apps sorted by total usage time (descending).
 */
export async function fetchRecentlyUsedApps(
  userId: string,
): Promise<RecentlyUsedApp[]> {
  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10);

    // Fetch app usage data from screen_time_app_daily
    const { data: usageData, error: usageError } = await tmSchema()
      .from("screen_time_app_daily")
      .select("app_id, display_name, duration_seconds")
      .eq("user_id", userId)
      .gte("created_at", startDate);

    if (usageError) throw handleSupabaseError(usageError);

    // Fetch user overrides
    const { data: overrideData, error: overrideError } = await tmSchema()
      .from("user_app_categories")
      .select("app_key, app_name, category")
      .eq("user_id", userId);

    if (overrideError) throw handleSupabaseError(overrideError);

    // Build override map
    const overrideMap = new Map<string, { category: string; appName: string | null }>();
    for (const row of (overrideData ?? []) as { app_key: string; app_name: string | null; category: string }[]) {
      overrideMap.set(row.app_key, { category: row.category, appName: row.app_name });
    }

    // Aggregate usage by app
    const usageByApp = new Map<string, { displayName: string; totalSeconds: number }>();
    for (const row of (usageData ?? []) as { app_id: string; display_name: string | null; duration_seconds: number }[]) {
      const appKey = normalizeAppKey(row.app_id);
      if (!appKey) continue;

      const existing = usageByApp.get(appKey);
      if (existing) {
        existing.totalSeconds += row.duration_seconds;
        // Keep the first non-null display name
        if (!existing.displayName && row.display_name) {
          existing.displayName = row.display_name;
        }
      } else {
        usageByApp.set(appKey, {
          displayName: row.display_name || row.app_id,
          totalSeconds: row.duration_seconds,
        });
      }
    }

    // Convert user overrides to IntentAppCategoryOverrides format for getAppCategory
    const userOverrides: IntentAppCategoryOverrides = {};
    for (const [key, value] of overrideMap) {
      userOverrides[key] = { category: value.category as AppCategory };
    }

    // Build result array
    const results: RecentlyUsedApp[] = [];
    for (const [appKey, usage] of usageByApp) {
      const override = overrideMap.get(appKey);
      const category = getAppCategory(appKey, userOverrides);

      results.push({
        appKey,
        displayName: override?.appName || usage.displayName,
        totalSeconds: usage.totalSeconds,
        category,
        isOverride: !!override,
      });
    }

    // Sort by total usage time (descending)
    results.sort((a, b) => b.totalSeconds - a.totalSeconds);

    return results;
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to fetch recently used apps:", error);
    }
    return [];
  }
}

/**
 * Save or update an app category override using AppCategory type.
 * This is used by the App Categories settings screen.
 */
export async function upsertAppCategoryOverride(options: {
  userId: string;
  appKey: string;
  appName: string | null;
  category: AppCategory;
}): Promise<boolean> {
  const { userId, appKey, appName, category } = options;
  if (!appKey) return false;

  try {
    const { error } = await tmSchema()
      .from("user_app_categories")
      .upsert(
        {
          user_id: userId,
          app_key: appKey,
          app_name: appName,
          category,
          confidence: CONFIDENCE_RESET,
          sample_count: 1,
          last_corrected_at: new Date().toISOString(),
        },
        { onConflict: "user_id, app_key" },
      );

    if (error) throw handleSupabaseError(error);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to upsert app category override:", error);
    }
    return false;
  }
}

/**
 * Fetch user app category overrides as IntentAppCategoryOverrides.
 * This is used by the intent classification system.
 */
export async function fetchUserAppCategoryOverridesForIntent(
  userId: string,
): Promise<IntentAppCategoryOverrides> {
  try {
    const { data, error } = await tmSchema()
      .from("user_app_categories")
      .select("app_key, category")
      .eq("user_id", userId);

    if (error) throw handleSupabaseError(error);

    const overrides: IntentAppCategoryOverrides = {};
    for (const row of (data ?? []) as { app_key: string; category: string }[]) {
      overrides[row.app_key] = { category: row.category as AppCategory };
    }
    return overrides;
  } catch (error) {
    if (__DEV__) {
      console.warn("[UserAppCategories] Failed to fetch overrides for intent:", error);
    }
    return {};
  }
}
