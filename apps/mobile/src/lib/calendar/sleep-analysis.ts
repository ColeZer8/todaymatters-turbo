import type { HealthDailyRow } from "@/lib/supabase/services/evidence-data";

export interface SleepQualityMetrics {
  asleepMinutes?: number;
  hrvMs?: number | null;
  restingHeartRateBpm?: number | null;
  heartRateAvgBpm?: number | null;
  qualityScore?: number | null;
  deepMinutes?: number | null;
  remMinutes?: number | null;
  awakeMinutes?: number | null;
  inBedMinutes?: number | null;
  wakeTimeMinutes?: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildSleepQualityMetrics(
  healthDaily: HealthDailyRow | null,
): SleepQualityMetrics | null {
  if (!healthDaily) return null;

  const asleepMinutes = healthDaily.sleep_asleep_seconds
    ? Math.round(healthDaily.sleep_asleep_seconds / 60)
    : undefined;
  const deepMinutes = healthDaily.sleep_deep_seconds
    ? Math.round(healthDaily.sleep_deep_seconds / 60)
    : null;
  const remMinutes = healthDaily.sleep_rem_seconds
    ? Math.round(healthDaily.sleep_rem_seconds / 60)
    : null;
  const awakeMinutes = healthDaily.sleep_awake_seconds
    ? Math.round(healthDaily.sleep_awake_seconds / 60)
    : null;
  const inBedMinutes = healthDaily.sleep_in_bed_seconds
    ? Math.round(healthDaily.sleep_in_bed_seconds / 60)
    : null;
  const hrvMs = healthDaily.hrv_sdnn_seconds
    ? Math.round(healthDaily.hrv_sdnn_seconds * 1000)
    : null;
  const restingHeartRateBpm = healthDaily.resting_heart_rate_avg_bpm ?? null;
  const heartRateAvgBpm = healthDaily.heart_rate_avg_bpm ?? null;
  const wakeTime = healthDaily.window_end
    ? new Date(healthDaily.window_end)
    : null;
  const wakeTimeMinutes = wakeTime
    ? wakeTime.getHours() * 60 + wakeTime.getMinutes()
    : null;

  if (
    asleepMinutes === undefined &&
    hrvMs === null &&
    restingHeartRateBpm === null &&
    heartRateAvgBpm === null &&
    deepMinutes === null &&
    remMinutes === null &&
    awakeMinutes === null &&
    inBedMinutes === null &&
    wakeTimeMinutes === null
  ) {
    return null;
  }

  let score =
    asleepMinutes !== undefined
      ? clamp((asleepMinutes / 480) * 60 + 40, 0, 100)
      : 50;

  if (hrvMs !== null) {
    score += clamp(((hrvMs - 20) / 40) * 15, 0, 15);
  }

  if (restingHeartRateBpm !== null) {
    score += clamp(((70 - restingHeartRateBpm) / 20) * 10, -10, 10);
  }

  const qualityScore = clamp(Math.round(score), 0, 100);

  return {
    asleepMinutes,
    hrvMs,
    restingHeartRateBpm,
    heartRateAvgBpm,
    qualityScore,
    deepMinutes,
    remMinutes,
    awakeMinutes,
    inBedMinutes,
    wakeTimeMinutes,
  };
}
