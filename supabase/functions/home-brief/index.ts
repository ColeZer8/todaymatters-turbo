/**
 * Supabase Edge Function: home-brief
 *
 * Generates a 2-line, context-aware home brief using OpenAI.
 *
 * Input: { context: object, draft: { line1, line2, reason, momentKey } }
 * Output: { line1, line2, expiresAt, reason }
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
// /supabase/functions/home-brief -> /supabase/functions -> /supabase -> project root
const PROJECT_ROOT = join(FUNCTION_DIR, "..", "..", "..");

interface HomeBriefRequest {
  context: Record<string, unknown>;
  draft: {
    line1: string;
    line2: string;
    line3?: string;
    reason: string;
    momentKey: string;
  };
}

interface HomeBriefResponse {
  line1: string;
  line2: string;
  line3?: string;
  expiresAt: string;
  reason: string;
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
    const allowAnon = Deno.env.get("ALLOW_ANON_HOME_BRIEF") === "true";
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

    const body = (await req.json()) as HomeBriefRequest;
    if (!body?.context || !body?.draft?.line1 || !body?.draft?.line2) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiApiKeyResult = await getConfigValue("OPENAI_API_KEY");
    const modelResult = await getConfigValue("OPENAI_HOME_BRIEF_MODEL");
    const openaiApiKey = openaiApiKeyResult.value;
    const model = modelResult.value ?? "gpt-4o-mini";

    console.log(
      JSON.stringify({
        msg: "home-brief: config",
        userId,
        hasOpenAiKey: Boolean(openaiApiKey),
        openAiKeySource: openaiApiKeyResult.source,
        model,
        modelSource: modelResult.source,
        draftReason: body.draft.reason,
        draftMomentKey: body.draft.momentKey,
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

    const system =
      "You write a short, personal home-screen brief for a productivity app." +
      " Return JSON only. No markdown, no emojis." +
      " Use 2 or 3 lines: line1, line2, optional line3." +
      " Each line must be <= 56 characters." +
      " Sound human and specific; avoid generic assistant phrasing." +
      " Ground it in the current event first (if present)." +
      " Never mention being an AI or model.";

    const userMsg = {
      userId,
      constraints: {
        lines: 3,
        maxCharsPerLine: 56,
      },
      draft: body.draft,
      context: body.context,
      outputSchema: {
        line1: "string",
        line2: "string",
        line3: "string (optional)",
        expiresAt: "ISO string",
        reason: "string",
      },
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
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
        JSON.stringify({ error: "Failed to generate brief" }),
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

    let parsed: Partial<HomeBriefResponse> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid model JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const line1 =
      normalizeLine(parsed.line1) ??
      normalizeLine(body.draft.line1) ??
      "This is your day.";
    const line2 =
      normalizeLine(parsed.line2) ??
      normalizeLine(body.draft.line2) ??
      "What matters most right now?";
    const line3 =
      normalizeLine(parsed.line3) ?? normalizeLine(body.draft.line3) ?? null;
    const expiresAt =
      typeof parsed.expiresAt === "string"
        ? parsed.expiresAt
        : new Date(Date.now() + 20 * 60_000).toISOString();
    const reason =
      typeof parsed.reason === "string" ? parsed.reason : body.draft.reason;

    const result: HomeBriefResponse = {
      line1: clamp56(line1),
      line2: clamp56(line2),
      line3: line3 ? clamp56(line3) : undefined,
      expiresAt,
      reason,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

type ConfigSource = "denoEnv" | "dotenvFile" | "missing";

async function getConfigValue(
  key: string,
): Promise<{ value: string | null; source: ConfigSource; path?: string }> {
  const fromEnv = Deno.env.get(key);
  if (fromEnv != null && fromEnv.trim() !== "") {
    return { value: fromEnv, source: "denoEnv" };
  }

  // Local-testing fallback: read from .env files in repo (ignored in git).
  // In deployed edge runtime, this will typically fail and we fall back to missing.
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
    // Strip surrounding quotes
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

function normalizeLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

function clamp56(value: string): string {
  if (value.length <= 56) return value;
  return value.slice(0, 55).trimEnd() + "…";
}
