import { generateLocationSegments } from "./actual-ingestion";
import type { EvidenceLocationSample, UserPlaceRow } from "./evidence-data";

describe("generateLocationSegments telemetry fallback", () => {
  const windowStart = new Date("2026-02-09T20:00:00.000Z");
  const windowEnd = new Date("2026-02-09T20:30:00.000Z");

  const homePlace: UserPlaceRow = {
    id: "home-place",
    user_id: "u1",
    label: "Home",
    category: "home",
    category_id: null,
    radius_m: 150,
    latitude: 30.2672,
    longitude: -97.7431,
  };

  it("does not crash when telemetry is missing (legacy samples)", () => {
    const samples: EvidenceLocationSample[] = [
      {
        recorded_at: "2026-02-09T20:00:00.000Z",
        latitude: 30.2672,
        longitude: -97.7431,
      },
      {
        recorded_at: "2026-02-09T20:08:00.000Z",
        latitude: 30.26721,
        longitude: -97.74311,
      },
    ];

    const segments = generateLocationSegments(
      samples,
      [homePlace],
      windowStart,
      windowEnd,
    );

    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].meta.provider ?? null).toBeNull();
  });

  it("propagates iOS telemetry into segment meta when present", () => {
    const samples: EvidenceLocationSample[] = [
      {
        recorded_at: "2026-02-09T20:00:00.000Z",
        latitude: 30.2672,
        longitude: -97.7431,
        telemetry: {
          provider: "corelocation",
          activity: "walking",
          battery_level: 0.51,
          battery_state: "unplugged",
          is_simulator: false,
          is_mocked: false,
        },
      },
      {
        recorded_at: "2026-02-09T20:08:00.000Z",
        latitude: 30.26721,
        longitude: -97.74311,
        is_mocked: true,
        telemetry: {
          provider: "corelocation",
          activity: "walking",
          battery_level: 0.49,
          battery_state: "unplugged",
          is_simulator: false,
          is_mocked: true,
        },
      },
    ];

    const segments = generateLocationSegments(
      samples,
      [homePlace],
      windowStart,
      windowEnd,
    );

    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].meta.provider).toBe("corelocation");
    expect(segments[0].meta.activity).toBe("walking");
    expect(segments[0].meta.battery_level).toBeCloseTo(0.5, 3);
    expect(segments[0].meta.is_mocked).toBe(true);
  });
});
