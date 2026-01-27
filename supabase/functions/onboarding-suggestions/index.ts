/**
 * Supabase Edge Function: onboarding-suggestions
 *
 * Generates onboarding category/sub-category suggestions using OpenAI.
 *
 * Input:
 *  - kind: "categories" | "subcategories"
 *  - values?: Array<{ id: string; label: string }>
 *  - categories?: Array<{ id: string; valueId: string; label: string }>
 *  - subCategories?: Array<{ id: string; categoryId: string; label: string }>
 *
 * Output:
 *  - { suggestions: Record<string, string[]> }
 *    - If kind==="categories": key is valueId
 *    - If kind==="subcategories": key is categoryId
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
// /supabase/functions/onboarding-suggestions -> /supabase/functions -> /supabase -> project root
const PROJECT_ROOT = join(FUNCTION_DIR, "..", "..", "..");

type SuggestionKind = "categories" | "subcategories";

interface ValueInput {
  id: string;
  label: string;
}

interface CategoryInput {
  id: string;
  valueId: string;
  label: string;
}

interface SubCategoryInput {
  id: string;
  categoryId: string;
  label: string;
}

interface OnboardingSuggestionsRequest {
  kind: SuggestionKind;
  values?: ValueInput[];
  categories?: CategoryInput[];
  subCategories?: SubCategoryInput[];
}

interface OnboardingSuggestionsResponse {
  suggestions: Record<string, string[]>;
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
    const allowAnon =
      Deno.env.get("ALLOW_ANON_ONBOARDING_SUGGESTIONS") === "true";
    if (!authHeader && !allowAnon) {
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
        global: authHeader
          ? { headers: { Authorization: authHeader } }
          : undefined,
      },
    );

    let userId = "anon";
    if (authHeader) {
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

      userId = user.id;
    }

    const body = (await req.json()) as OnboardingSuggestionsRequest;
    if (
      !body?.kind ||
      (body.kind !== "categories" && body.kind !== "subcategories")
    ) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiApiKeyResult = await getConfigValue("OPENAI_API_KEY");
    const modelResult = await getConfigValue(
      "OPENAI_ONBOARDING_SUGGESTIONS_MODEL",
    );
    const openaiApiKey = openaiApiKeyResult.value;
    const model = modelResult.value ?? "gpt-4o-mini";

    console.log(
      JSON.stringify({
        msg: "onboarding-suggestions: config",
        userId,
        kind: body.kind,
        hasOpenAiKey: Boolean(openaiApiKey),
        openAiKeySource: openaiApiKeyResult.source,
        model,
        modelSource: modelResult.source,
        valuesCount: body.values?.length ?? 0,
        categoriesCount: body.categories?.length ?? 0,
        subCategoriesCount: body.subCategories?.length ?? 0,
      }),
    );

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY",
          hint: "For local testing, add OPENAI_API_KEY to project .env or supabase/.env. For deployed, set Supabase secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { system, userMsg } = buildPrompt(body, userId);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userMsg) },
        ],
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("OpenAI API error:", resp.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate suggestions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return new Response(JSON.stringify({ error: "Invalid model response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Partial<OnboardingSuggestionsResponse> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid model JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const suggestions = coerceSuggestionMap(parsed.suggestions);

    return new Response(
      JSON.stringify({ suggestions } satisfies OnboardingSuggestionsResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildPrompt(
  body: OnboardingSuggestionsRequest,
  userId: string,
): { system: string; userMsg: unknown } {
  const system =
    "You help users set up categories in a time-tracking app." +
    " Return JSON only. No markdown, no emojis." +
    " Suggestions should be short (1-4 words), concrete, and broadly applicable." +
    " Avoid duplicates and avoid repeating existing items.";

  if (body.kind === "categories") {
    const values = Array.isArray(body.values) ? body.values : [];
    const categories = Array.isArray(body.categories) ? body.categories : [];

    const userMsg = {
      userId,
      kind: body.kind,
      values,
      existingCategories: categories,
      instructions: [
        "Generate 5-8 suggested time categories for EACH value.",
        'Output JSON shape: { "suggestions": { "<valueId>": ["Idea 1", "Idea 2", ...] } }',
        "Keys must be the provided valueId strings.",
      ],
    };

    return { system, userMsg };
  }

  const categories = Array.isArray(body.categories) ? body.categories : [];
  const subCategories = Array.isArray(body.subCategories)
    ? body.subCategories
    : [];

  const userMsg = {
    userId,
    kind: body.kind,
    categories,
    existingSubCategories: subCategories,
    instructions: [
      "Generate 5-8 suggested sub-categories for EACH category.",
      'Output JSON shape: { "suggestions": { "<categoryId>": ["Idea 1", "Idea 2", ...] } }',
      "Keys must be the provided categoryId strings.",
    ],
  };

  return { system, userMsg };
}

function coerceSuggestionMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const out: Record<string, string[]> = {};

  for (const [key, rawList] of Object.entries(obj)) {
    if (typeof key !== "string" || !key.trim()) continue;
    if (!Array.isArray(rawList)) continue;
    const cleaned = rawList
      .map((v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""))
      .filter((v) => v.length > 0);
    if (cleaned.length > 0) out[key] = dedupeStrings(cleaned);
  }

  return out;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(raw);
  }
  return result;
}

type ConfigSource = "denoEnv" | "dotenvFile" | "missing";

async function getConfigValue(
  key: string,
): Promise<{ value: string | null; source: ConfigSource; path?: string }> {
  const fromEnv = Deno.env.get(key);
  if (fromEnv != null && fromEnv.trim() !== "") {
    return { value: fromEnv, source: "denoEnv" };
  }

  // Local-testing fallback: read from .env files in repo (ignored in git).
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
    } catch {
      // ignore
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
    if (idx === -1) continue;
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
