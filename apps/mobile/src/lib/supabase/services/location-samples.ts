import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Database } from "../database.types";

type LocationSamplesInsert =
  Database["tm"]["Tables"]["location_samples"]["Insert"];

interface LocationSampleLike {
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  is_mocked: boolean | null;
  source: string;
  dedupe_key: string;
  raw: LocationSamplesInsert["raw"];
}

export interface LocationSampleRow {
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  is_mocked: boolean | null;
  source: string;
  dedupe_key: string;
  raw: LocationSamplesInsert["raw"];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeNonNegative(value: number | null): number | null {
  if (!isFiniteNumber(value)) return null;
  return value >= 0 ? value : null;
}

function normalizeHeadingDeg(value: number | null): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value < 0) return null;
  const normalized = value % 360;
  return normalized >= 360 ? 0 : normalized;
}

function hasValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function sanitizeLocationSamplesForUpload(
  samples: LocationSampleLike[],
): {
  validSamples: LocationSampleLike[];
  droppedKeys: string[];
} {
  const validSamples: LocationSampleLike[] = [];
  const droppedKeys: string[] = [];

  for (const sample of samples) {
    if (!hasValidTimestamp(sample.recorded_at)) {
      droppedKeys.push(sample.dedupe_key);
      continue;
    }

    if (
      !isFiniteNumber(sample.latitude) ||
      sample.latitude < -90 ||
      sample.latitude > 90
    ) {
      droppedKeys.push(sample.dedupe_key);
      continue;
    }

    if (
      !isFiniteNumber(sample.longitude) ||
      sample.longitude < -180 ||
      sample.longitude > 180
    ) {
      droppedKeys.push(sample.dedupe_key);
      continue;
    }

    // Supabase constraint currently allows only 'background'.
    if (sample.source !== "background") {
      droppedKeys.push(sample.dedupe_key);
      continue;
    }

    validSamples.push({
      ...sample,
      accuracy_m: normalizeNonNegative(sample.accuracy_m),
      altitude_m: isFiniteNumber(sample.altitude_m) ? sample.altitude_m : null,
      speed_mps: normalizeNonNegative(sample.speed_mps),
      heading_deg: normalizeHeadingDeg(sample.heading_deg),
    });
  }

  return { validSamples, droppedKeys };
}

export async function upsertLocationSamples(
  userId: string,
  samples: LocationSampleLike[],
): Promise<void> {
  if (samples.length === 0) return;

  const rows: LocationSamplesInsert[] = samples.map((s) => ({
    user_id: userId,
    recorded_at: s.recorded_at,
    latitude: s.latitude,
    longitude: s.longitude,
    accuracy_m: s.accuracy_m,
    altitude_m: s.altitude_m,
    speed_mps: s.speed_mps,
    heading_deg: s.heading_deg,
    is_mocked: s.is_mocked,
    source: s.source,
    dedupe_key: s.dedupe_key,
    raw: s.raw,
  }));

  const { error } = await supabase
    .schema("tm")
    .from("location_samples")
    .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

  if (error) {
    throw handleSupabaseError(error);
  }
}

export async function fetchRecentLocationSamples(
  userId: string,
  options: { limit?: number; sinceIso?: string } = {},
): Promise<LocationSampleRow[]> {
  const limit = options.limit ?? 200;
  let query = supabase
    .schema("tm")
    .from("location_samples")
    .select(
      "recorded_at, latitude, longitude, accuracy_m, altitude_m, speed_mps, heading_deg, is_mocked, source, dedupe_key, raw",
    )
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (options.sinceIso) {
    query = query.gte("recorded_at", options.sinceIso);
  }

  const { data, error } = await query;
  if (error) throw handleSupabaseError(error);
  return (data ?? []) as LocationSampleRow[];
}
