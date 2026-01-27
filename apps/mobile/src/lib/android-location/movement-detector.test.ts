import { classifyMovementByDistance, type LocationSampleInput } from './movement-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a sample at the given lat/lng with good accuracy and a timestamp offset (ms) from a base. */
function makeSample(
  latitude: number,
  longitude: number,
  offsetMs: number,
  accuracy_m: number = 10,
): LocationSampleInput {
  const base = new Date('2026-01-27T12:00:00Z').getTime();
  return {
    latitude,
    longitude,
    accuracy_m,
    recorded_at: new Date(base + offsetMs).toISOString(),
  };
}

const FIFTEEN_MIN = 15 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('classifyMovementByDistance', () => {
  // -----------------------------------------------------------------------
  // Insufficient data
  // -----------------------------------------------------------------------

  it('returns null state when given no samples', () => {
    const result = classifyMovementByDistance([]);
    expect(result.state).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.usableSamples).toBe(0);
  });

  it('returns null state when fewer than 3 usable samples', () => {
    const samples = [
      makeSample(40.7128, -74.006, 0),
      makeSample(40.7228, -74.006, FIFTEEN_MIN),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.usableSamples).toBe(2);
  });

  it('returns null state when all samples have bad accuracy', () => {
    const samples = [
      makeSample(40.7128, -74.006, 0, 100),
      makeSample(40.7228, -74.006, FIFTEEN_MIN, 60),
      makeSample(40.7328, -74.006, THIRTY_MIN, 200),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBeNull();
    expect(result.usableSamples).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Accuracy filtering
  // -----------------------------------------------------------------------

  it('filters out samples with accuracy >50m', () => {
    const samples = [
      makeSample(40.7128, -74.006, 0, 10),           // good
      makeSample(40.7228, -74.006, FIFTEEN_MIN, 55),  // bad, filtered
      makeSample(40.7128, -74.006, FIFTEEN_MIN * 2, 20), // good
      makeSample(40.7128, -74.006, THIRTY_MIN, 5),     // good
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.usableSamples).toBe(3);
  });

  it('filters out samples with null accuracy', () => {
    const samples = [
      makeSample(40.7128, -74.006, 0, 10),
      { latitude: 40.7228, longitude: -74.006, accuracy_m: null, recorded_at: new Date('2026-01-27T12:15:00Z').toISOString() },
      makeSample(40.7128, -74.006, THIRTY_MIN, 20),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.usableSamples).toBe(2);
    expect(result.state).toBeNull(); // only 2 usable samples
  });

  // -----------------------------------------------------------------------
  // Moving classification
  // -----------------------------------------------------------------------

  it('classifies as moving when distance >200m over 15+ minutes', () => {
    // Points roughly 1.1km apart along latitude (each step ~0.005 deg ≈ 556m)
    const samples = [
      makeSample(40.7000, -74.006, 0),
      makeSample(40.7050, -74.006, FIFTEEN_MIN / 2),
      makeSample(40.7100, -74.006, FIFTEEN_MIN),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBe('moving');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.totalDistance).toBeGreaterThan(200);
    expect(result.timeSpan).toBeGreaterThanOrEqual(FIFTEEN_MIN);
  });

  it('returns confidence >0.85 for large distances while moving', () => {
    // Points ~3.3km apart
    const samples = [
      makeSample(40.7000, -74.006, 0),
      makeSample(40.7150, -74.006, FIFTEEN_MIN / 2),
      makeSample(40.7300, -74.006, FIFTEEN_MIN),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBe('moving');
    expect(result.confidence).toBeGreaterThan(0.85);
  });

  it('does not classify as moving when time span <15 minutes', () => {
    // Large distance but under 15 minutes
    const samples = [
      makeSample(40.7000, -74.006, 0),
      makeSample(40.7050, -74.006, 5 * 60_000),
      makeSample(40.7100, -74.006, 10 * 60_000),
    ];
    const result = classifyMovementByDistance(samples);
    // Distance is >200m but time span is only 10 minutes
    expect(result.state).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Stationary classification
  // -----------------------------------------------------------------------

  it('classifies as stationary when distance <50m over 30+ minutes', () => {
    // Same location with tiny GPS jitter (<10m treated as 0)
    const samples = [
      makeSample(40.7128, -74.00600, 0),
      makeSample(40.71282, -74.00602, FIFTEEN_MIN),
      makeSample(40.71281, -74.00601, THIRTY_MIN),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBe('stationary');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.totalDistance).toBeLessThan(50);
    expect(result.timeSpan).toBeGreaterThanOrEqual(THIRTY_MIN);
  });

  it('returns high confidence when perfectly stationary for a long time', () => {
    const samples = [
      makeSample(40.7128, -74.006, 0),
      makeSample(40.7128, -74.006, FIFTEEN_MIN),
      makeSample(40.7128, -74.006, THIRTY_MIN),
      makeSample(40.7128, -74.006, THIRTY_MIN + FIFTEEN_MIN),
      makeSample(40.7128, -74.006, THIRTY_MIN * 2),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBe('stationary');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.totalDistance).toBe(0);
  });

  it('does not classify as stationary when time span <30 minutes', () => {
    const samples = [
      makeSample(40.7128, -74.006, 0),
      makeSample(40.7128, -74.006, 10 * 60_000),
      makeSample(40.7128, -74.006, 20 * 60_000),
    ];
    const result = classifyMovementByDistance(samples);
    // Distance is 0 but time span is only 20 minutes
    expect(result.state).toBeNull();
  });

  // -----------------------------------------------------------------------
  // GPS drift handling
  // -----------------------------------------------------------------------

  it('ignores GPS drift (movements <10m)', () => {
    // Points ~5m apart each (should all be zeroed as drift)
    const samples = [
      makeSample(40.712800, -74.006000, 0),
      makeSample(40.712804, -74.006003, FIFTEEN_MIN),
      makeSample(40.712802, -74.006001, THIRTY_MIN),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.totalDistance).toBe(0);
    expect(result.state).toBe('stationary');
  });

  // -----------------------------------------------------------------------
  // Ambiguous zone
  // -----------------------------------------------------------------------

  it('returns null for ambiguous distance (between 50-200m)', () => {
    // Move ~100m total over 30+ minutes - not clearly moving or stationary
    // 0.001 deg latitude ≈ 111m
    const samples = [
      makeSample(40.7128, -74.006, 0),
      makeSample(40.7133, -74.006, FIFTEEN_MIN),   // ~55m
      makeSample(40.7137, -74.006, THIRTY_MIN),     // ~44m more → ~100m total
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBeNull();
    expect(result.totalDistance).toBeGreaterThan(50);
    expect(result.totalDistance).toBeLessThan(200);
  });

  // -----------------------------------------------------------------------
  // Sorting / order handling
  // -----------------------------------------------------------------------

  it('handles samples in non-chronological order', () => {
    // Submit in reverse order - should still classify correctly
    const samples = [
      makeSample(40.7100, -74.006, FIFTEEN_MIN),   // last by location, middle by time
      makeSample(40.7000, -74.006, 0),              // first
      makeSample(40.7100, -74.006, THIRTY_MIN),     // same coords as middle, last by time
    ];
    const result = classifyMovementByDistance(samples);
    // Total: ~1.1km from first to second, ~0m from second to third
    // Time span: 30 minutes
    // Distance > 200m and time >= 15 min → moving
    expect(result.state).toBe('moving');
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('handles exactly 3 samples at accuracy boundary (50m)', () => {
    const samples = [
      makeSample(40.7128, -74.006, 0, 50),          // exactly 50 → included
      makeSample(40.7128, -74.006, FIFTEEN_MIN, 50),
      makeSample(40.7128, -74.006, THIRTY_MIN, 50),
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.usableSamples).toBe(3);
    expect(result.state).toBe('stationary');
  });

  it('accepts epoch ms timestamps', () => {
    const base = Date.now();
    const samples: LocationSampleInput[] = [
      { latitude: 40.7128, longitude: -74.006, accuracy_m: 10, recorded_at: base },
      { latitude: 40.7128, longitude: -74.006, accuracy_m: 10, recorded_at: base + FIFTEEN_MIN },
      { latitude: 40.7128, longitude: -74.006, accuracy_m: 10, recorded_at: base + THIRTY_MIN },
    ];
    const result = classifyMovementByDistance(samples);
    expect(result.state).toBe('stationary');
    expect(result.usableSamples).toBe(3);
  });

  it('handles many samples with mixed accuracy', () => {
    const samples = [
      makeSample(40.7000, -74.006, 0, 10),           // good
      makeSample(40.7020, -74.006, 5 * 60_000, 80),  // bad
      makeSample(40.7040, -74.006, 10 * 60_000, 5),  // good
      makeSample(40.7060, -74.006, FIFTEEN_MIN, 100), // bad
      makeSample(40.7080, -74.006, 20 * 60_000, 15), // good
      makeSample(40.7100, -74.006, 25 * 60_000, 60), // bad
      makeSample(40.7120, -74.006, THIRTY_MIN, 20),   // good
    ];
    const result = classifyMovementByDistance(samples);
    // 4 usable samples, spanning 30 min, distance >200m → should classify
    expect(result.usableSamples).toBe(4);
    expect(result.state).toBe('moving');
  });
});
