import type { EventCategory } from "@/stores";
import type { VerificationResult } from "./verification-engine";
import type { DataQualityMetrics } from "./data-quality";
import type { PatternSummaryResult } from "./pattern-recognition";

export interface EvidenceFusionSource {
  type: "location" | "screen_time" | "health" | "pattern" | "user_history";
  weight: number;
  detail: string;
}

export interface EvidenceFusionConflict {
  source1: "location" | "screen_time" | "health" | "pattern";
  source2: "plan" | "pattern";
  conflict: string;
  resolution: "source1_wins" | "source2_wins" | "compromise" | "unresolved";
}

export interface EvidenceFusionResult {
  confidence: number;
  sources: EvidenceFusionSource[];
  conflicts: EvidenceFusionConflict[];
}

const SOURCE_WEIGHTS: Record<EvidenceFusionSource["type"], number> = {
  location: 0.35,
  screen_time: 0.25,
  health: 0.2,
  pattern: 0.1,
  user_history: 0.1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveConflict(options: {
  source: EvidenceFusionConflict["source1"];
  verification: VerificationResult | null;
  patternSummary: PatternSummaryResult | null;
}): EvidenceFusionConflict["resolution"] {
  const { source, verification, patternSummary } = options;
  if (source === "location") {
    if (
      verification?.evidence.location &&
      !verification.evidence.location.matchesExpected
    ) {
      return "source1_wins";
    }
  }
  if (source === "screen_time") {
    const distraction =
      verification?.evidence.screenTime?.distractionMinutes ?? 0;
    if (distraction >= 20) return "source1_wins";
  }
  if (source === "health") {
    return "source1_wins";
  }
  if (
    source === "pattern" &&
    patternSummary?.confidence &&
    patternSummary.confidence >= 0.8
  ) {
    return "source1_wins";
  }
  return "unresolved";
}

export function buildEvidenceFusion(options: {
  verification: VerificationResult | null;
  dataQuality: DataQualityMetrics;
  patternSummary: PatternSummaryResult | null;
  conflicts: Array<{
    source: EvidenceFusionConflict["source1"];
    detail: string;
  }>;
  plannedCategory: EventCategory;
}): EvidenceFusionResult {
  const {
    verification,
    dataQuality,
    patternSummary,
    conflicts,
    plannedCategory,
  } = options;
  const sources: EvidenceFusionSource[] = [];

  if (verification?.evidence.location) {
    sources.push({
      type: "location",
      weight: SOURCE_WEIGHTS.location,
      detail: verification.evidence.location.placeLabel ?? "Location data",
    });
  }

  if (verification?.evidence.screenTime) {
    sources.push({
      type: "screen_time",
      weight: SOURCE_WEIGHTS.screen_time,
      detail: `${Math.round(verification.evidence.screenTime.totalMinutes)} min phone use`,
    });
  }

  if (verification?.evidence.health) {
    sources.push({
      type: "health",
      weight: SOURCE_WEIGHTS.health,
      detail: verification.evidence.health.workoutType ?? "Health data",
    });
  }

  if (patternSummary) {
    sources.push({
      type: "pattern",
      weight: SOURCE_WEIGHTS.pattern,
      detail: patternSummary.typicalCategory
        ? `Typical ${patternSummary.typicalCategory}`
        : "Pattern history",
    });
  }

  if (plannedCategory) {
    sources.push({
      type: "user_history",
      weight: SOURCE_WEIGHTS.user_history,
      detail: `Planned ${plannedCategory}`,
    });
  }

  const baseConfidence = verification?.confidence ?? 0.6;
  const reliability = dataQuality.reliability ?? 1;
  const patternPenalty = patternSummary?.deviation ? 0.85 : 1;
  const conflictPenalty =
    conflicts.length > 0 ? clamp(1 - conflicts.length * 0.08, 0.6, 1) : 1;
  const confidence = clamp(
    baseConfidence * reliability * patternPenalty * conflictPenalty,
    0,
    1,
  );

  const resolvedConflicts: EvidenceFusionConflict[] = conflicts.map(
    (conflict) => ({
      source1: conflict.source,
      source2: conflict.source === "pattern" ? "plan" : "plan",
      conflict: conflict.detail,
      resolution: resolveConflict({
        source: conflict.source,
        verification,
        patternSummary,
      }),
    }),
  );

  return {
    confidence,
    sources,
    conflicts: resolvedConflicts,
  };
}
