import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { ReviewCategoryId } from '@/stores/review-time-store';

export interface ReviewTimeSuggestionInput {
  date: string;
  block: {
    id: string;
    title: string;
    description: string;
    source: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    activityDetected: string | null;
    location: string | null;
    note: string;
  };
}

export interface ReviewTimeSuggestionResponse {
  category: ReviewCategoryId;
  confidence: number;
  reason?: string;
  title?: string;
  description?: string;
}

export async function requestReviewTimeSuggestion(
  payload: ReviewTimeSuggestionInput
): Promise<ReviewTimeSuggestionResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('review-time-suggest', {
      body: payload,
    });

    if (error) {
      const contextualMessage = extractFunctionErrorMessage(error);
      throw new Error(contextualMessage ?? handleSupabaseError(error).message);
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from review-time-suggest function');
    }

    const d = data as Partial<ReviewTimeSuggestionResponse>;
    if (!d.category || typeof d.confidence !== 'number') {
      throw new Error('Incomplete response from review-time-suggest function');
    }

    return {
      category: d.category,
      confidence: d.confidence,
      reason: d.reason,
      title: d.title,
      description: d.description,
    };
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

function extractFunctionErrorMessage(error: unknown): string | null {
  const err = error as { message?: string; context?: { body?: string } };
  const body = err?.context?.body;
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { error?: string; hint?: string };
    const message = parsed.error ?? err?.message ?? 'Edge function error';
    if (parsed.hint) {
      return `${message}\n${parsed.hint}`;
    }
    return message;
  } catch {
    return err?.message ?? null;
  }
}
