import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";

export interface HomeBriefLlmDraft {
  line1: string;
  line2: string;
  line3?: string;
  reason: string;
  momentKey: string;
}

export interface HomeBriefLlmResponse {
  line1: string;
  line2: string;
  line3?: string;
  expiresAt: string;
  reason: string;
}

export async function generateHomeBriefLlm(
  context: Record<string, unknown>,
  draft: HomeBriefLlmDraft,
): Promise<HomeBriefLlmResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("home-brief", {
      body: { context, draft },
    });

    if (error) {
      throw handleSupabaseError(error);
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response from home-brief function");
    }

    const d = data as Partial<HomeBriefLlmResponse>;
    if (!d.line1 || !d.line2 || !d.expiresAt || !d.reason) {
      throw new Error("Incomplete response from home-brief function");
    }

    return {
      line1: d.line1,
      line2: d.line2,
      line3: d.line3,
      expiresAt: d.expiresAt,
      reason: d.reason,
    };
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
