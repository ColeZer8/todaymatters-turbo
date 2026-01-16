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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dirname, fromFileUrl, join } from 'https://deno.land/std@0.168.0/path/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_DIR = dirname(fromFileUrl(import.meta.url));
const PROJECT_ROOT = join(FUNCTION_DIR, '..', '..', '..');

type ReviewCategoryId = 'faith' | 'family' | 'work' | 'health' | 'other';

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
  title?: string;
  description?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ReviewTimeSuggestRequest;
    if (!body?.date || !body?.block?.id) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiApiKeyResult = await getConfigValue('OPENAI_API_KEY');
    const modelResult = await getConfigValue('OPENAI_REVIEW_TIME_MODEL');
    const openaiApiKey = openaiApiKeyResult.value;
    const model = modelResult.value ?? 'gpt-4o-mini';

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing OPENAI_API_KEY',
          hint:
            'For local testing, add OPENAI_API_KEY to project .env or supabase/.env. For deployed, set Supabase secrets.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { system, userMsg } = buildPrompt(body);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userMsg) },
        ],
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('OpenAI API error:', resp.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to generate suggestion' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid model response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: Partial<ReviewTimeSuggestResponse> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid model JSON' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!parsed.category || typeof parsed.confidence !== 'number' || !parsed.reason) {
      return new Response(JSON.stringify({ error: 'Incomplete model response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: ReviewTimeSuggestResponse = {
      category: normalizeCategory(parsed.category),
      confidence: clampConfidence(parsed.confidence),
      reason: parsed.reason,
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('review-time-suggest error:', error);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildPrompt(payload: ReviewTimeSuggestRequest): { system: string; userMsg: Record<string, unknown> } {
  const system = `You are an assistant helping classify time blocks into one of: faith, family, work, health, other.

Rules:
- Always choose exactly one category from: faith, family, work, health, other.
- Return JSON only with keys: category, confidence, reason, title, description.
- Confidence is a number between 0 and 1.
- Title/description should be short and human-friendly.`;

  const userMsg = {
    date: payload.date,
    block: payload.block,
    categories: ['faith', 'family', 'work', 'health', 'other'],
    output: {
      category: 'faith | family | work | health | other',
      confidence: 'number (0-1)',
      reason: 'string',
      title: 'string (optional)',
      description: 'string (optional)',
    },
  };

  return { system, userMsg };
}

function normalizeCategory(value: string): ReviewCategoryId {
  const lowered = value.trim().toLowerCase();
  if (lowered === 'faith') return 'faith';
  if (lowered === 'family') return 'family';
  if (lowered === 'work') return 'work';
  if (lowered === 'health') return 'health';
  return 'other';
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

type ConfigSource = 'denoEnv' | 'dotenvFile' | 'missing';

async function getConfigValue(
  key: string
): Promise<{ value: string | null; source: ConfigSource; path?: string }> {
  const fromEnv = Deno.env.get(key);
  if (fromEnv != null && fromEnv.trim() !== '') {
    return { value: fromEnv, source: 'denoEnv' };
  }

  const candidates = [
    join(PROJECT_ROOT, '.env'),
    join(PROJECT_ROOT, 'supabase', '.env'),
    join(PROJECT_ROOT, 'apps', 'mobile', '.env'),
  ];

  for (const path of candidates) {
    try {
      const env = await readDotenv(path);
      const val = env[key];
      if (val != null && val.trim() !== '') {
        return { value: val, source: 'dotenvFile', path };
      }
    } catch {
      // ignore
    }
  }

  return { value: null, source: 'missing' };
}

async function readDotenv(path: string): Promise<Record<string, string>> {
  const text = await Deno.readTextFile(path);
  return parseDotenv(text);
}

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split('\\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx == -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('\"') && val.endsWith('\"')) || (val.startsWith(\"'\") && val.endsWith(\"'\"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}
