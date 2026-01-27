import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

export interface OnboardingSuggestionValueInput {
  id: string;
  label: string;
}

export interface OnboardingSuggestionCategoryInput {
  id: string;
  valueId: string;
  label: string;
}

export interface OnboardingSuggestionSubCategoryInput {
  id: string;
  categoryId: string;
  label: string;
}

interface OnboardingSuggestionsResponse {
  suggestions: Record<string, string[]>;
}

function coerceSuggestions(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const out: Record<string, string[]> = {};

  for (const [key, rawList] of Object.entries(obj)) {
    if (!key.trim() || !Array.isArray(rawList)) continue;
    const cleaned = rawList
      .map((v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""))
      .filter((v) => v.length > 0);
    if (cleaned.length > 0) out[key] = cleaned;
  }

  return out;
}

export async function generateOnboardingCategorySuggestionsLlm(params: {
  values: OnboardingSuggestionValueInput[];
  categories: OnboardingSuggestionCategoryInput[];
}): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "onboarding-suggestions",
      {
        body: {
          kind: "categories",
          values: params.values,
          categories: params.categories,
        },
      },
    );

    if (error) throw handleSupabaseError(error);
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response from onboarding-suggestions function");
    }

    const d = data as Partial<OnboardingSuggestionsResponse>;
    return coerceSuggestions(d.suggestions);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function generateOnboardingSubCategorySuggestionsLlm(params: {
  categories: OnboardingSuggestionCategoryInput[];
  subCategories: OnboardingSuggestionSubCategoryInput[];
}): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "onboarding-suggestions",
      {
        body: {
          kind: "subcategories",
          categories: params.categories,
          subCategories: params.subCategories,
        },
      },
    );

    if (error) throw handleSupabaseError(error);
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response from onboarding-suggestions function");
    }

    const d = data as Partial<OnboardingSuggestionsResponse>;
    return coerceSuggestions(d.suggestions);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
