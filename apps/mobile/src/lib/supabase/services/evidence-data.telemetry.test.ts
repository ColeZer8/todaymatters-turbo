import {
  coerceEvidenceLocationSample,
  extractIosTelemetryFromRaw,
} from "./evidence-data";

describe("extractIosTelemetryFromRaw", () => {
  it("reads telemetry from raw.telemetry", () => {
    const telemetry = extractIosTelemetryFromRaw({
      telemetry: {
        provider: "corelocation",
        activity: "automotive",
        battery_level: 0.72,
        battery_state: "charging",
        is_simulator: false,
        is_mocked: false,
      },
    });

    expect(telemetry).toEqual({
      provider: "corelocation",
      activity: "automotive",
      battery_level: 0.72,
      battery_state: "charging",
      is_simulator: false,
      is_mocked: false,
    });
  });

  it("falls back to raw.meta (backward-compatible mapper)", () => {
    const telemetry = extractIosTelemetryFromRaw({
      meta: {
        provider: "gps",
        activity: "walking",
        is_simulator: true,
      },
    });

    expect(telemetry).toEqual({
      provider: "gps",
      activity: "walking",
      battery_level: null,
      battery_state: null,
      is_simulator: true,
      is_mocked: null,
    });
  });

  it("returns null when telemetry payload is absent", () => {
    expect(extractIosTelemetryFromRaw({ timestamp: 1 })).toBeNull();
    expect(extractIosTelemetryFromRaw(null)).toBeNull();
  });
});

describe("coerceEvidenceLocationSample", () => {
  it("keeps working for legacy rows without raw telemetry", () => {
    const sample = coerceEvidenceLocationSample({
      recorded_at: "2026-02-09T20:00:00.000Z",
      latitude: 30.2672,
      longitude: -97.7431,
    });

    expect(sample.telemetry).toBeNull();
    expect(sample.is_mocked).toBeNull();
  });
});
