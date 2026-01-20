import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { EventCategory } from '@/stores';
import {
  type AppCategoryOverride,
  type AppCategoryOverrides,
  normalizeAppKey,
} from '@/lib/calendar/app-classification';

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
  return supabase.schema('tm');
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

export async function fetchUserAppCategoryOverrides(userId: string): Promise<AppCategoryOverrides> {
  try {
    const { data, error } = await tmSchema()
      .from('user_app_categories')
      .select('app_key, app_name, category, confidence, sample_count')
      .eq('user_id', userId);

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
      console.warn('[UserAppCategories] Failed to fetch overrides:', error);
    }
    return {};
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
      .from('user_app_categories')
      .select('*')
      .eq('user_id', userId)
      .eq('app_key', appKey)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);

    if (!data) {
      const { data: inserted, error: insertError } = await tmSchema()
        .from('user_app_categories')
        .insert({
          user_id: userId,
          app_key: appKey,
          app_name: appName,
          category,
          confidence: CONFIDENCE_RESET,
          sample_count: 1,
          last_corrected_at: new Date().toISOString(),
        })
        .select('*')
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
      const reduced = Math.max(CONFIDENCE_MIN, currentConfidence - CONFIDENCE_STEP_DOWN);
      if (reduced <= 0.4) {
        nextCategory = category;
        nextConfidence = CONFIDENCE_RESET;
      } else {
        nextConfidence = reduced;
      }
    }

    const { data: updated, error: updateError } = await tmSchema()
      .from('user_app_categories')
      .update({
        app_name: current.app_name ?? appName,
        category: nextCategory,
        confidence: nextConfidence,
        sample_count: nextSampleCount,
        last_corrected_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('app_key', appKey)
      .select('*')
      .maybeSingle();

    if (updateError) throw handleSupabaseError(updateError);
    return updated ? rowToOverride(updated as UserAppCategoryRow) : null;
  } catch (error) {
    if (__DEV__) {
      console.warn('[UserAppCategories] Failed to apply feedback:', error);
    }
    return null;
  }
}
