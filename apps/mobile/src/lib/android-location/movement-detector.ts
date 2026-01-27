import { calculateDistance } from './distance';
import type { MovementState } from './movement-state';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum acceptable accuracy in meters. Samples above this are filtered. */
const MAX_ACCURACY_METERS = 50;

/** Distances below this threshold (meters) are treated as GPS drift (zero). */
const GPS_DRIFT_THRESHOLD_METERS = 10;

/** Total distance (meters) above which samples indicate moving. */
const MOVING_DISTANCE_THRESHOLD = 200;

/** Total distance (meters) below which samples indicate stationary. */
const STATIONARY_DISTANCE_THRESHOLD = 50;

/** Minimum time span (ms) for a "moving" classification. */
const MOVING_MIN_SPAN_MS = 15 * 60 * 1000; // 15 minutes

/** Minimum time span (ms) for a "stationary" classification. */
const STATIONARY_MIN_SPAN_MS = 30 * 60 * 1000; // 30 minutes

/** Minimum number of samples required for classification (after filtering). */
const MIN_SAMPLES = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationSampleInput {
  latitude: number;
  longitude: number;
  /** Accuracy in meters. `null` means unknown – sample will be filtered out. */
  accuracy_m: number | null;
  /** ISO-8601 timestamp or epoch ms. */
  recorded_at: string | number;
}

export interface MovementClassification {
  /** Detected movement state, or `null` if insufficient data. */
  state: MovementState | null;
  /** Confidence score from 0 to 1. 0 when state is null. */
  confidence: number;
  /** Total distance (meters) across consecutive pairs after filtering. */
  totalDistance: number;
  /** Time span (ms) from first to last sample after filtering. */
  timeSpan: number;
  /** Number of samples that passed the accuracy filter. */
  usableSamples: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify whether the user is moving or stationary based on a sequence
 * of recent location samples.
 *
 * Filtering:
 * - Samples with `accuracy_m > 50` or `accuracy_m === null` are discarded.
 * - Consecutive-pair distances < 10 m are treated as 0 (GPS drift).
 *
 * Classification:
 * - `moving`:      total distance > 200 m AND time span ≥ 15 min
 * - `stationary`:  total distance < 50 m  AND time span ≥ 30 min
 * - `null`:        insufficient data (< 3 usable samples, or ambiguous)
 *
 * @param samples - Recent location samples, ideally in chronological order.
 * @returns A {@link MovementClassification} result.
 */
export function classifyMovementByDistance(
  samples: readonly LocationSampleInput[],
): MovementClassification {
  // 1. Filter to usable samples (good accuracy)
  const usable = samples.filter(isAccurate);

  if (usable.length < MIN_SAMPLES) {
    return {
      state: null,
      confidence: 0,
      totalDistance: 0,
      timeSpan: 0,
      usableSamples: usable.length,
    };
  }

  // 2. Sort by timestamp ascending
  const sorted = [...usable].sort((a, b) => toEpoch(a.recorded_at) - toEpoch(b.recorded_at));

  // 3. Compute total distance across consecutive pairs, ignoring GPS drift
  let totalDistance = 0;
  for (let i = 1; i < sorted.length; i++) {
    const d = calculateDistance(
      { latitude: sorted[i - 1].latitude, longitude: sorted[i - 1].longitude },
      { latitude: sorted[i].latitude, longitude: sorted[i].longitude },
    );
    totalDistance += d < GPS_DRIFT_THRESHOLD_METERS ? 0 : d;
  }

  // 4. Time span from first to last usable sample
  const timeSpan = toEpoch(sorted[sorted.length - 1].recorded_at) - toEpoch(sorted[0].recorded_at);

  // 5. Classify
  const result: MovementClassification = {
    state: null,
    confidence: 0,
    totalDistance,
    timeSpan,
    usableSamples: sorted.length,
  };

  if (totalDistance > MOVING_DISTANCE_THRESHOLD && timeSpan >= MOVING_MIN_SPAN_MS) {
    result.state = 'moving';
    // Confidence increases with distance beyond threshold, capped at 1
    const distanceRatio = Math.min(totalDistance / (MOVING_DISTANCE_THRESHOLD * 2), 1);
    result.confidence = 0.7 + 0.3 * distanceRatio;
  } else if (totalDistance < STATIONARY_DISTANCE_THRESHOLD && timeSpan >= STATIONARY_MIN_SPAN_MS) {
    result.state = 'stationary';
    // Confidence increases with longer time stationary and less distance
    const timeRatio = Math.min(timeSpan / (STATIONARY_MIN_SPAN_MS * 2), 1);
    const stillness = 1 - totalDistance / STATIONARY_DISTANCE_THRESHOLD;
    result.confidence = 0.7 + 0.3 * Math.min(timeRatio + stillness, 1) / 1;
  }
  // else: ambiguous zone or insufficient time span → state stays null

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAccurate(sample: LocationSampleInput): boolean {
  return sample.accuracy_m !== null && sample.accuracy_m <= MAX_ACCURACY_METERS;
}

function toEpoch(value: string | number): number {
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}
