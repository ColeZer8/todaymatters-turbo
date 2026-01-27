import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Json } from "../database.types";
import type {
  HealthSummary,
  WorkoutSummary,
  ActivityRingsSummary,
} from "@/lib/ios-insights";
import type {
  HealthSummary as AndroidHealthSummary,
  WorkoutSummary as AndroidWorkoutSummary,
} from "@/lib/android-insights";
import { upsertDataSyncState } from "./data-sync-state";

type HealthPlatform = "ios" | "android";

interface HealthDailyInsert {
  user_id: string;
  local_date: string;
  timezone: string;
  platform: HealthPlatform;
  provider: string;
  source_device_id?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  steps?: number | null;
  active_energy_kcal?: number | null;
  distance_meters?: number | null;
  sleep_asleep_seconds?: number | null;
  heart_rate_avg_bpm?: number | null;
  resting_heart_rate_avg_bpm?: number | null;
  hrv_sdnn_seconds?: number | null;
  workouts_count?: number | null;
  workouts_duration_seconds?: number | null;
  exercise_minutes?: number | null;
  stand_hours?: number | null;
  move_goal_kcal?: number | null;
  exercise_goal_minutes?: number | null;
  stand_goal_hours?: number | null;
  raw_payload?: Json | null;
  meta?: Json;
}

interface HealthWorkoutInsert {
  user_id: string;
  platform: HealthPlatform;
  provider: string;
  provider_workout_id?: string | null;
  source_device_id?: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  activity_type?: string | null;
  total_energy_kcal?: number | null;
  distance_meters?: number | null;
  avg_heart_rate_bpm?: number | null;
  max_heart_rate_bpm?: number | null;
  raw_payload?: Json | null;
  meta?: Json;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema("tm");
}

function toLocalDateIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return new Date().toISOString().slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function upsertHealthDaily(row: HealthDailyInsert): Promise<void> {
  const { error } = await tmSchema()
    .from("health_daily_metrics")
    .upsert(row, { onConflict: "user_id,local_date,platform,provider" });

  if (error) throw handleSupabaseError(error);
}

async function upsertWorkout(row: HealthWorkoutInsert): Promise<void> {
  const { error } = await tmSchema()
    .from("health_workouts")
    .upsert(row, {
      onConflict: "user_id,provider,platform,provider_workout_id",
    });

  if (error) throw handleSupabaseError(error);
}

function activityRingsToFields(
  rings: ActivityRingsSummary | null,
): Pick<
  HealthDailyInsert,
  | "exercise_minutes"
  | "stand_hours"
  | "move_goal_kcal"
  | "exercise_goal_minutes"
  | "stand_goal_hours"
> {
  if (!rings) {
    return {
      exercise_minutes: null,
      stand_hours: null,
      move_goal_kcal: null,
      exercise_goal_minutes: null,
      stand_goal_hours: null,
    };
  }

  return {
    exercise_minutes: rings.exerciseMinutes,
    stand_hours: rings.standHours,
    move_goal_kcal: rings.moveGoalKcal,
    exercise_goal_minutes: rings.exerciseGoalMinutes,
    stand_goal_hours: rings.standGoalHours,
  };
}

export async function syncIosHealthSummary(
  userId: string,
  summary: HealthSummary,
  timezone: string,
  rings: ActivityRingsSummary | null,
  latestWorkout: WorkoutSummary | null,
): Promise<void> {
  const localDate = toLocalDateIso(summary.startIso);
  const provider = "apple_health";

  const ringsFields = activityRingsToFields(rings);

  const dailyRow: HealthDailyInsert = {
    user_id: userId,
    local_date: localDate,
    timezone,
    platform: "ios",
    provider,
    window_start: summary.startIso,
    window_end: summary.endIso,
    steps: summary.steps,
    active_energy_kcal: summary.activeEnergyKcal,
    distance_meters: summary.distanceWalkingRunningMeters,
    sleep_asleep_seconds: summary.sleepAsleepSeconds,
    heart_rate_avg_bpm: summary.heartRateAvgBpm,
    resting_heart_rate_avg_bpm: summary.restingHeartRateAvgBpm,
    hrv_sdnn_seconds: summary.hrvSdnnAvgSeconds,
    workouts_count: summary.workoutsCount,
    workouts_duration_seconds: summary.workoutsDurationSeconds,
    ...ringsFields,
    raw_payload: summary as unknown as Json,
    meta: {
      generatedAtIso: summary.generatedAtIso,
      ringSource: rings ? "activity_rings" : null,
      errors: summary.errors ?? null,
    } as Json,
  };

  await upsertHealthDaily(dailyRow);

  if (latestWorkout) {
    const workoutRow: HealthWorkoutInsert = {
      user_id: userId,
      platform: "ios",
      provider,
      provider_workout_id: latestWorkout.workoutStartIso,
      started_at: latestWorkout.workoutStartIso,
      ended_at: latestWorkout.workoutEndIso,
      duration_seconds: latestWorkout.durationSeconds,
      activity_type: null,
      total_energy_kcal: latestWorkout.totalEnergyBurnedKcal,
      distance_meters: null,
      avg_heart_rate_bpm: latestWorkout.avgHeartRateBpm,
      max_heart_rate_bpm: latestWorkout.maxHeartRateBpm,
      raw_payload: latestWorkout as unknown as Json,
      meta: { generatedAtIso: summary.generatedAtIso } as Json,
    };
    await upsertWorkout(workoutRow);
  }

  await upsertDataSyncState({
    userId,
    dataset: "health",
    platform: "ios",
    provider,
    newestSyncedLocalDate: localDate,
    lastSyncFinishedAt: new Date().toISOString(),
    lastSyncStatus: "ok",
    lastSyncError: null,
  });
}

export async function syncAndroidHealthSummary(
  userId: string,
  summary: AndroidHealthSummary,
  timezone: string,
  latestWorkout: AndroidWorkoutSummary | null,
): Promise<void> {
  const localDate = toLocalDateIso(summary.startIso);
  const provider = "health_connect";

  const dailyRow: HealthDailyInsert = {
    user_id: userId,
    local_date: localDate,
    timezone,
    platform: "android",
    provider,
    window_start: summary.startIso,
    window_end: summary.endIso,
    steps: summary.steps,
    active_energy_kcal: summary.activeEnergyKcal,
    distance_meters: summary.distanceWalkingRunningMeters,
    sleep_asleep_seconds: summary.sleepAsleepSeconds,
    heart_rate_avg_bpm: summary.heartRateAvgBpm,
    resting_heart_rate_avg_bpm: summary.restingHeartRateAvgBpm,
    hrv_sdnn_seconds: summary.hrvSdnnAvgSeconds,
    workouts_count: summary.workoutsCount,
    workouts_duration_seconds: summary.workoutsDurationSeconds,
    raw_payload: summary as unknown as Json,
    meta: {
      generatedAtIso: summary.generatedAtIso,
      errors: summary.errors ?? null,
    } as Json,
  };

  await upsertHealthDaily(dailyRow);

  if (latestWorkout) {
    const workoutRow: HealthWorkoutInsert = {
      user_id: userId,
      platform: "android",
      provider,
      provider_workout_id: latestWorkout.workoutStartIso,
      started_at: latestWorkout.workoutStartIso,
      ended_at: latestWorkout.workoutEndIso,
      duration_seconds: latestWorkout.durationSeconds,
      activity_type: null,
      total_energy_kcal: latestWorkout.totalEnergyBurnedKcal,
      distance_meters: null,
      avg_heart_rate_bpm: latestWorkout.avgHeartRateBpm,
      max_heart_rate_bpm: latestWorkout.maxHeartRateBpm,
      raw_payload: latestWorkout as unknown as Json,
      meta: { generatedAtIso: summary.generatedAtIso } as Json,
    };
    await upsertWorkout(workoutRow);
  }

  await upsertDataSyncState({
    userId,
    dataset: "health",
    platform: "android",
    provider,
    newestSyncedLocalDate: localDate,
    lastSyncFinishedAt: new Date().toISOString(),
    lastSyncStatus: "ok",
    lastSyncError: null,
  });
}
