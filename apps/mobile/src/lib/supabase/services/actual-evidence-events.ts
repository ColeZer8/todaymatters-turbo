import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Json } from "../database.types";
import type { ActualBlock } from "@/lib/calendar/verification-engine";
import {
  formatLocalIso,
  ymdMinutesToLocalDate,
  ymdToLocalDayStart,
} from "@/lib/calendar/local-time";

interface ActualEvidenceEventRow {
  id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  meta: Json | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

function minutesToIso(ymd: string, minutes: number): string {
  const date = ymdMinutesToLocalDate(ymd, minutes);
  return formatLocalIso(date);
}

function buildSourceId(ymd: string, block: ActualBlock): string {
  return `evidence:${block.source}:${ymd}:${block.startMinutes}:${block.endMinutes}`;
}

function hasSourceId(meta: Json | null | undefined, sourceId: string): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const value = (meta as Record<string, Json>).source_id;
  return typeof value === "string" && value === sourceId;
}

export async function syncActualEvidenceBlocks({
  userId,
  ymd,
  blocks,
}: {
  userId: string;
  ymd: string;
  blocks: ActualBlock[];
}): Promise<void> {
  if (blocks.length === 0) return;
  const dayStart = ymdToLocalDayStart(ymd);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const startIso = formatLocalIso(dayStart);
  const endIso = formatLocalIso(dayEnd);

  try {
    const { data, error } = await tmSchema()
      .from("events")
      .select("id, scheduled_start, scheduled_end, meta")
      .eq("user_id", userId)
      .eq("type", "calendar_actual")
      .lt("scheduled_start", endIso)
      .gt("scheduled_end", startIso);

    if (error) throw handleSupabaseError(error);
    const existing = (data ?? []) as ActualEvidenceEventRow[];

    const inserts: Array<Record<string, unknown>> = [];
    for (const block of blocks) {
      const sourceId = buildSourceId(ymd, block);
      const alreadyExists = existing.some((row) =>
        hasSourceId(row.meta, sourceId),
      );
      if (alreadyExists) continue;

      const scheduledStartIso = minutesToIso(ymd, block.startMinutes);
      const scheduledEndIso = minutesToIso(ymd, block.endMinutes);

      const meta: Record<string, Json> = {
        category: "unknown",
        suggested_category: block.category,
        source: "evidence",
        source_id: sourceId,
        actual: true,
        tags: ["actual"],
        confidence: block.confidence ?? null,
        kind: "evidence_block",
        evidence: {
          locationLabel: block.evidence.location?.placeLabel ?? null,
          placeCategory: block.evidence.location?.placeCategory ?? null,
          locationSampleCount: block.evidence.location?.sampleCount ?? null,
          screenTimeMinutes: block.evidence.screenTime?.totalMinutes ?? null,
          topApp: block.evidence.screenTime?.topApps[0]?.app ?? null,
          topApps:
            block.evidence.screenTime?.topApps?.map((app) => ({
              app: app.app,
              minutes: app.minutes,
            })) ?? [],
        },
      };

      if (block.source === "location") {
        meta.location = block.title;
      }

      if (block.evidence.location?.placeLabel) {
        meta.location_label = block.evidence.location.placeLabel;
      }

      if (block.evidence.screenTime) {
        meta.screen_time_minutes = Math.round(
          block.evidence.screenTime.totalMinutes,
        );
        meta.top_app = block.evidence.screenTime.topApps[0]?.app ?? null;
      }

      if (block.evidence.health?.hasWorkout) {
        meta.workout_type = block.evidence.health.workoutType ?? null;
        meta.workout_minutes =
          block.evidence.health.workoutDurationMinutes ?? null;
      }

      inserts.push({
        user_id: userId,
        type: "calendar_actual",
        title: block.title || "Actual",
        description: block.description || "",
        scheduled_start: scheduledStartIso,
        scheduled_end: scheduledEndIso,
        meta: meta as unknown as Json,
      });
    }

    if (inserts.length === 0) return;

    const { data: inserted, error: insertError } = await tmSchema()
      .from("events")
      .insert(inserts)
      .select("*");

    if (insertError) throw handleSupabaseError(insertError);

    void inserted;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
