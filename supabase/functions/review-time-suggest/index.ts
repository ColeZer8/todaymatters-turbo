/**
 * Supabase Edge Function: review-time-suggest
 *
 * Classifies a Review Time block into a category and suggests a summary.
 *
 * Input:
 *  - date: YYYY-MM-DD
 *  - block: { id, title, description, source, startTime, endTime, durationMinutes, activityDetected, location, note }
 *
 * Output:
 *  - { category, confidence, reason, title?, description? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.168.0/path/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_DIR = dirname(fromFileUrl(import.meta.url));
const PROJECT_ROOT = join(FUNCTION_DIR, "..", "..", "..");

type ReviewCategoryId = "faith" | "family" | "work" | "health" | "other";

interface ReviewTimeBlockInput {
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
}

interface ReviewTimeSuggestRequest {
  date: string;
  block: ReviewTimeBlockInput;
}

interface ReviewTimeSuggestResponse {
  category: ReviewCategoryId;
  confidence: number;
  reason: string;
  title: string;
  description: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as ReviewTimeSuggestRequest;
    if (!body?.date || !body?.block?.id) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKeyResult = await getConfigValue("ANTHROPIC_API_KEY");
    const modelResult = await getConfigValue("ANTHROPIC_REVIEW_TIME_MODEL");
    const anthropicApiKey = anthropicKeyResult.value;
    const model = modelResult.value ?? "claude-3-5-sonnet-20240620";

    if (!anthropicApiKey) {
      console.error("ANTHROPIC_API_KEY lookup failed:", {
        source: anthropicKeyResult.source,
        path: anthropicKeyResult.path,
        denoEnvKeys: Object.keys(Deno.env.toObject()).filter((k) =>
          k.includes("ANTHROPIC"),
        ),
      });
      const fallback = buildFallbackSuggestion(
        body,
        "AI unavailable (missing API key). Using your note instead.",
      );
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { system, userMsg } = buildPrompt(body);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: JSON.stringify(userMsg) }],
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("Anthropic API error:", resp.status, errorText);
      const fallback = buildFallbackSuggestion(
        body,
        `AI unavailable (status ${resp.status}). Using your note instead.`,
      );
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data?.content?.[0]?.text;
    if (typeof content !== "string") {
      const fallback = buildFallbackSuggestion(
        body,
        "AI returned an invalid response. Using your note instead.",
      );
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Partial<ReviewTimeSuggestResponse> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const fallback = buildFallbackSuggestion(
        body,
        "AI returned malformed JSON. Using your note instead.",
      );
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const description =
      typeof parsed.description === "string" ? parsed.description.trim() : "";

    const hasRequired =
      parsed.category &&
      typeof parsed.confidence === "number" &&
      parsed.reason &&
      title &&
      description;
    const result: ReviewTimeSuggestResponse = hasRequired
      ? {
          category: normalizeCategory(parsed.category),
          confidence: clampConfidence(parsed.confidence),
          reason: parsed.reason,
          title,
          description,
        }
      : buildFallbackSuggestion(
          body,
          "AI response incomplete. Using your note instead.",
        );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("review-time-suggest error:", error);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildPrompt(payload: ReviewTimeSuggestRequest): {
  system: string;
  userMsg: Record<string, unknown>;
} {
  const system = `You are an assistant helping classify time blocks into one of: faith, family, work, health, other.

Rules:
- Always choose exactly one category from: faith, family, work, health, other.
- Use the user's block.note as the primary signal for both category and wording.
- If block.title is generic (e.g., "Unknown", "Screen Time", "Sleep"), do NOT reuse it.
- Do not include time ranges or exact timestamps in the title/description.
- Return JSON only with keys: category, confidence, reason, title, description.
- Confidence is a number between 0 and 1.
- Title must be 2–6 words.
- Description must be 1 short sentence (max ~140 chars).`;

  const userMsg = {
    date: payload.date,
    block: payload.block,
    categories: ["faith", "family", "work", "health", "other"],
    output: {
      category: "faith | family | work | health | other",
      confidence: "number (0-1)",
      reason: "string",
      title: "string (required)",
      description: "string (required)",
    },
  };

  return { system, userMsg };
}

function normalizeCategory(value: string): ReviewCategoryId {
  const lowered = value.trim().toLowerCase();
  if (lowered === "faith") return "faith";
  if (lowered === "family") return "family";
  if (lowered === "work") return "work";
  if (lowered === "health") return "health";
  return "other";
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function buildFallbackSuggestion(
  payload: ReviewTimeSuggestRequest,
  reason: string,
): ReviewTimeSuggestResponse {
  const note = payload.block?.note ?? "";
  const fallbackTitle = deriveTitleFromNote(note, payload.block?.title ?? "");
  const fallbackDescription = deriveDescriptionFromNote(note);
  return {
    category: guessCategoryFromNote(note),
    confidence: 0.35,
    reason,
    title: fallbackTitle,
    description: fallbackDescription,
  };
}

function isGenericTitle(title: string): boolean {
  const lowered = title.trim().toLowerCase();
  return (
    lowered === "unknown" ||
    lowered === "screen time" ||
    lowered === "sleep" ||
    lowered === "actual" ||
    lowered === "untitled"
  );
}

function deriveTitleFromNote(note: string, fallbackTitle: string): string {
  const cleaned = note
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length >= 2) {
    const slice = words.slice(
      0,
      Math.min(6, Math.max(2, words.length >= 4 ? 4 : words.length)),
    );
    return slice.join(" ");
  }
  const fallback = fallbackTitle?.trim() ?? "";
  if (fallback && !isGenericTitle(fallback)) return fallback;
  return "Actual activity";
}

function deriveDescriptionFromNote(note: string): string {
  const cleaned = note
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (!cleaned) return "User described this block in their own words.";
  const maxLen = 140;
  const clipped =
    cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
  return clipped.endsWith(".") || clipped.endsWith("!") || clipped.endsWith("?")
    ? clipped
    : `${clipped}.`;
}

function guessCategoryFromNote(note: string): ReviewCategoryId {
  const lower = note.toLowerCase();
  if (/(pray|church|bible|worship|faith)/.test(lower)) return "faith";
  if (/(family|kids|child|spouse|wife|husband|parents)/.test(lower))
    return "family";
  if (
    /(work|meeting|client|email|project|deadline|sales|coding|design)/.test(
      lower,
    )
  )
    return "work";
  if (/(gym|workout|run|walk|doctor|therapy|health|sleep|yoga)/.test(lower))
    return "health";
  return "other";
}

type ConfigSource = "denoEnv" | "dotenvFile" | "missing";

async function getConfigValue(
  key: string,
): Promise<{ value: string | null; source: ConfigSource; path?: string }> {
  // First, check Deno.env (this is how Supabase CLI loads .env files in local dev)
  const fromEnv = Deno.env.get(key);
  if (fromEnv != null && fromEnv.trim() !== "") {
    return { value: fromEnv, source: "denoEnv" };
  }

  // Fallback: try reading .env files directly (for local development edge cases)
  const candidates = [
    join(PROJECT_ROOT, ".env"),
    join(PROJECT_ROOT, "supabase", ".env"),
    join(PROJECT_ROOT, "apps", "mobile", ".env"),
  ];

  for (const path of candidates) {
    try {
      const env = await readDotenv(path);
      const val = env[key];
      if (val != null && val.trim() !== "") {
        return { value: val, source: "dotenvFile", path };
      }
    } catch (err) {
      // Log but don't fail - file might not exist
      // Only log in local development (when Deno.env has SUPABASE_URL pointing to localhost)
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      if (
        supabaseUrl.includes("localhost") ||
        supabaseUrl.includes("127.0.0.1")
      ) {
        console.debug(`Failed to read ${path}:`, err);
      }
    }
  }

  return { value: null, source: "missing" };
}

async function readDotenv(path: string): Promise<Record<string, string>> {
  const text = await Deno.readTextFile(path);
  return parseDotenv(text);
}

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx == -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}
