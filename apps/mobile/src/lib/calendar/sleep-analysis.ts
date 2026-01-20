import type { HealthDailyRow } from '@/lib/supabase/services/evidence-data';

export interface SleepQualityMetrics {
  asleepMinutes?: number;
  hrvMs?: number | null;
  restingHeartRateBpm?: number | null;
  heartRateAvgBpm?: number | null;
  qualityScore?: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildSleepQualityMetrics(healthDaily: HealthDailyRow | null): SleepQualityMetrics | null {
  if (!healthDaily) return null;

  const asleepMinutes = healthDaily.sleep_asleep_seconds
    ? Math.round(healthDaily.sleep_asleep_seconds / 60)
    : undefined;
  const hrvMs = healthDaily.hrv_sdnn_seconds ? Math.round(healthDaily.hrv_sdnn_seconds * 1000) : null;
  const restingHeartRateBpm = healthDaily.resting_heart_rate_avg_bpm ?? null;
  const heartRateAvgBpm = healthDaily.heart_rate_avg_bpm ?? null;

  if (asleepMinutes === undefined && hrvMs === null && restingHeartRateBpm === null && heartRateAvgBpm === null) {
    return null;
  }

  let score = asleepMinutes !== undefined ? clamp((asleepMinutes / 480) * 60 + 40, 0, 100) : 50;

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
  };
}
