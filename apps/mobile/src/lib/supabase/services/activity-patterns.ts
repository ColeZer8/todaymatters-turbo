import type { PatternSlot } from "@/lib/calendar/pattern-recognition";
import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Database, Json } from "../database.types";

type ActivityPatternsRow = Database["tm"]["Tables"]["activity_patterns"]["Row"];

export interface ActivityPatternsRecord {
  slots: PatternSlot[];
  windowStartYmd: string | null;
  windowEndYmd: string | null;
  generatedAt: string | null;
}

interface PatternSlotPayload {
  dayOfWeek: number;
  slotStartMinutes: number;
  slotEndMinutes: number;
  category: string;
  title: string;
  confidence: number;
  sampleCount: number;
  avgDurationMinutes: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parsePatternSlots(
  value: Json | null | undefined,
): PatternSlot[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: PatternSlot[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const slot = raw as PatternSlotPayload;
    if (
      !isNumber(slot.dayOfWeek) ||
      !isNumber(slot.slotStartMinutes) ||
      !isNumber(slot.slotEndMinutes) ||
      !isString(slot.category) ||
      !isString(slot.title) ||
      !isNumber(slot.confidence) ||
      !isNumber(slot.sampleCount) ||
      !isNumber(slot.avgDurationMinutes)
    ) {
      continue;
    }
    parsed.push({
      dayOfWeek: slot.dayOfWeek,
      slotStartMinutes: slot.slotStartMinutes,
      slotEndMinutes: slot.slotEndMinutes,
      category: slot.category as PatternSlot["category"],
      title: slot.title,
      confidence: slot.confidence,
      sampleCount: slot.sampleCount,
      avgDurationMinutes: slot.avgDurationMinutes,
    });
  }
  return parsed;
}

export async function fetchActivityPatterns(
  userId: string,
): Promise<ActivityPatternsRecord | null> {
  try {
    const { data, error } = await tmSchema()
      .from("activity_patterns")
      .select("slots, window_start_ymd, window_end_ymd, generated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw handleSupabaseError(error);
    if (!data) return null;
    const row = data as ActivityPatternsRow;
    const slots = parsePatternSlots(row.slots ?? null);
    if (!slots) return null;
    return {
      slots,
      windowStartYmd: row.window_start_ymd ?? null,
      windowEndYmd: row.window_end_ymd ?? null,
      generatedAt: row.generated_at ?? null,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivityPatterns] Failed to fetch patterns:", error);
    }
    return null;
  }
}

export async function upsertActivityPatterns(options: {
  userId: string;
  slots: PatternSlot[];
  windowStartYmd: string;
  windowEndYmd: string;
}): Promise<void> {
  const { userId, slots, windowStartYmd, windowEndYmd } = options;
  try {
    const { error } = await tmSchema()
      .from("activity_patterns")
      .upsert(
        {
          user_id: userId,
          slots: slots as unknown as Json,
          window_start_ymd: windowStartYmd,
          window_end_ymd: windowEndYmd,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw handleSupabaseError(error);
  } catch (error) {
    if (__DEV__) {
      console.warn("[ActivityPatterns] Failed to save patterns:", error);
    }
  }
}
