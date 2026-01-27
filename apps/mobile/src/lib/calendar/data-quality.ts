import type { EvidenceBundle } from "@/lib/supabase/services/evidence-data";
import type { UsageSummary } from "@/lib/android-insights";

export interface DataQualityMetrics {
  freshnessMinutes?: number | null;
  completeness: number;
  reliability: number;
  sources: string[];
}

function minutesSince(date: Date | null): number | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  return diff >= 0 ? Math.round(diff / 60_000) : null;
}

export function buildDataQualityMetrics(options: {
  evidence?: EvidenceBundle | null;
  usageSummary?: UsageSummary | null;
}): DataQualityMetrics {
  const { evidence, usageSummary } = options;
  const sources: string[] = [];
  const freshnessSamples: number[] = [];

  if (evidence?.locationHourly && evidence.locationHourly.length > 0) {
    sources.push("location_hourly");
    const latest = new Date(
      evidence.locationHourly[evidence.locationHourly.length - 1].hour_start,
    );
    const freshness = minutesSince(latest);
    if (freshness !== null) freshnessSamples.push(freshness);
  }

  if (evidence?.screenTimeSessions && evidence.screenTimeSessions.length > 0) {
    sources.push("screen_time_sessions");
    const latest = new Date(
      evidence.screenTimeSessions[
        evidence.screenTimeSessions.length - 1
      ].ended_at,
    );
    const freshness = minutesSince(latest);
    if (freshness !== null) freshnessSamples.push(freshness);
  }

  if (evidence?.healthDaily) {
    sources.push("health_daily_metrics");
  }

  if (usageSummary?.generatedAtIso) {
    sources.push("usage_summary");
    const freshness = minutesSince(new Date(usageSummary.generatedAtIso));
    if (freshness !== null) freshnessSamples.push(freshness);
  }

  const completeness = Math.min(1, sources.length / 4);
  const reliability = Math.min(1, 0.4 + completeness * 0.6);
  const freshnessMinutes =
    freshnessSamples.length > 0 ? Math.min(...freshnessSamples) : null;

  return {
    freshnessMinutes,
    completeness,
    reliability,
    sources,
  };
}
