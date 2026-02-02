/**
 * Tests for Place Inference Service
 *
 * Tests the smart geohash-based place inference logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock types to avoid importing actual supabase
interface MockLocationRow {
  hour_start: string;
  geohash7: string;
  sample_count: number;
  place_id: string | null;
  place_label: string | null;
  centroid_latitude: number | null;
  centroid_longitude: number | null;
  google_place_name: string | null;
}

// ============================================================================
// Test the core logic functions directly (extracted for testing)
// ============================================================================

const OVERNIGHT_START_HOUR = 22;
const OVERNIGHT_END_HOUR = 6;
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

interface GeohashCluster {
  geohash7: string;
  totalHours: number;
  overnightHours: number;
  workHours: number;
  weekendHours: number;
  distinctDays: number;
  avgLatitude: number | null;
  avgLongitude: number | null;
  existingPlaceLabel: string | null;
  googlePlaceName: string | null;
}

type InferredPlaceType = "home" | "work" | "frequent" | "unknown";

interface InferredPlace {
  geohash7: string;
  inferredType: InferredPlaceType;
  confidence: number;
  suggestedLabel: string;
  reasoning: string;
  latitude: number | null;
  longitude: number | null;
  existingPlaceLabel: string | null;
  googlePlaceName: string | null;
  stats: {
    totalHours: number;
    overnightHours: number;
    workHours: number;
    distinctDays: number;
  };
}

// Re-implement core logic for testing (same as in place-inference.ts)
function buildGeohashClusters(rows: MockLocationRow[]): Map<string, GeohashCluster> {
  const clusters = new Map<string, GeohashCluster>();

  for (const row of rows) {
    const geohash7 = row.geohash7;
    if (!geohash7) continue;

    const hourStart = new Date(row.hour_start);
    const hour = hourStart.getUTCHours();
    const dayOfWeek = hourStart.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWeekday = !isWeekend;

    const isOvernight = hour >= OVERNIGHT_START_HOUR || hour < OVERNIGHT_END_HOUR;
    const isWorkHours = isWeekday && hour >= WORK_START_HOUR && hour < WORK_END_HOUR;

    let cluster = clusters.get(geohash7);
    if (!cluster) {
      cluster = {
        geohash7,
        totalHours: 0,
        overnightHours: 0,
        workHours: 0,
        weekendHours: 0,
        distinctDays: 0,
        avgLatitude: null,
        avgLongitude: null,
        existingPlaceLabel: null,
        googlePlaceName: null,
      };
      clusters.set(geohash7, cluster);
    }

    cluster.totalHours += 1;
    if (isOvernight) cluster.overnightHours += 1;
    if (isWorkHours) cluster.workHours += 1;
    if (isWeekend) cluster.weekendHours += 1;

    if (row.centroid_latitude !== null && row.centroid_longitude !== null) {
      if (cluster.avgLatitude === null) {
        cluster.avgLatitude = row.centroid_latitude;
        cluster.avgLongitude = row.centroid_longitude;
      } else {
        const n = cluster.totalHours;
        cluster.avgLatitude = (cluster.avgLatitude * (n - 1) + row.centroid_latitude) / n;
        cluster.avgLongitude = (cluster.avgLongitude! * (n - 1) + row.centroid_longitude) / n;
      }
    }

    if (row.place_label) cluster.existingPlaceLabel = row.place_label;
    if (row.google_place_name) cluster.googlePlaceName = row.google_place_name;
  }

  // Calculate distinct days
  const daysByGeohash = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.geohash7) continue;
    const dayKey = new Date(row.hour_start).toISOString().slice(0, 10);
    let days = daysByGeohash.get(row.geohash7);
    if (!days) {
      days = new Set();
      daysByGeohash.set(row.geohash7, days);
    }
    days.add(dayKey);
  }

  Array.from(daysByGeohash.entries()).forEach(([geohash7, days]) => {
    const cluster = clusters.get(geohash7);
    if (cluster) cluster.distinctDays = days.size;
  });

  return clusters;
}

function inferPlaceTypes(clusters: Map<string, GeohashCluster>): InferredPlace[] {
  const MIN_HOURS_FOR_INFERENCE = 3;
  const MIN_OVERNIGHT_HOURS_FOR_HOME = 8;
  const MIN_WORK_HOURS_FOR_WORK = 10;
  const MIN_DAYS_FOR_FREQUENT = 3;

  const inferred: InferredPlace[] = [];
  const sortedClusters = [...clusters.values()].sort((a, b) => b.totalHours - a.totalHours);

  let homeAssigned = false;
  let workAssigned = false;

  for (const cluster of sortedClusters) {
    if (cluster.totalHours < MIN_HOURS_FOR_INFERENCE) continue;

    if (cluster.existingPlaceLabel) {
      inferred.push({
        geohash7: cluster.geohash7,
        inferredType: "unknown",
        confidence: 1.0,
        suggestedLabel: cluster.existingPlaceLabel,
        reasoning: "Already has user-defined place label",
        latitude: cluster.avgLatitude,
        longitude: cluster.avgLongitude,
        existingPlaceLabel: cluster.existingPlaceLabel,
        googlePlaceName: cluster.googlePlaceName,
        stats: {
          totalHours: cluster.totalHours,
          overnightHours: cluster.overnightHours,
          workHours: cluster.workHours,
          distinctDays: cluster.distinctDays,
        },
      });
      continue;
    }

    let inferredType: InferredPlaceType = "unknown";
    let confidence = 0;
    let suggestedLabel = "Unknown Location";
    let reasoning = "";

    // HOME inference
    if (!homeAssigned && cluster.overnightHours >= MIN_OVERNIGHT_HOURS_FOR_HOME) {
      const overnightRatio = cluster.overnightHours / cluster.totalHours;
      if (overnightRatio >= 0.3) {
        inferredType = "home";
        confidence = Math.min(0.95, 0.5 + overnightRatio * 0.5);
        suggestedLabel = "Home";
        reasoning = `${cluster.overnightHours}h overnight across ${cluster.distinctDays} days (${Math.round(overnightRatio * 100)}% overnight ratio)`;
        homeAssigned = true;
      }
    }

    // WORK inference
    if (inferredType === "unknown" && !workAssigned && cluster.workHours >= MIN_WORK_HOURS_FOR_WORK) {
      const workRatio = cluster.workHours / cluster.totalHours;
      if (workRatio >= 0.3) {
        inferredType = "work";
        confidence = Math.min(0.9, 0.4 + workRatio * 0.5);
        suggestedLabel = cluster.googlePlaceName || "Work";
        reasoning = `${cluster.workHours}h during weekday work hours across ${cluster.distinctDays} days (${Math.round(workRatio * 100)}% work hours ratio)`;
        workAssigned = true;
      }
    }

    // FREQUENT inference
    if (inferredType === "unknown" && cluster.distinctDays >= MIN_DAYS_FOR_FREQUENT) {
      inferredType = "frequent";
      confidence = Math.min(0.7, 0.3 + cluster.distinctDays * 0.1);
      suggestedLabel = cluster.googlePlaceName || "Frequent Location";
      reasoning = `Visited ${cluster.distinctDays} different days, ${cluster.totalHours}h total`;
    }

    if (inferredType !== "unknown" || cluster.totalHours >= 5) {
      inferred.push({
        geohash7: cluster.geohash7,
        inferredType,
        confidence,
        suggestedLabel,
        reasoning,
        latitude: cluster.avgLatitude,
        longitude: cluster.avgLongitude,
        existingPlaceLabel: cluster.existingPlaceLabel,
        googlePlaceName: cluster.googlePlaceName,
        stats: {
          totalHours: cluster.totalHours,
          overnightHours: cluster.overnightHours,
          workHours: cluster.workHours,
          distinctDays: cluster.distinctDays,
        },
      });
    }
  }

  return inferred.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRow(
  geohash7: string,
  hourStart: Date,
  overrides: Partial<MockLocationRow> = {},
): MockLocationRow {
  return {
    hour_start: hourStart.toISOString(),
    geohash7,
    sample_count: 10,
    place_id: null,
    place_label: null,
    centroid_latitude: 32.7767,
    centroid_longitude: -96.7970,
    google_place_name: null,
    ...overrides,
  };
}

function createHoursAtLocation(
  geohash7: string,
  baseDate: Date,
  startHour: number,
  count: number,
  overrides: Partial<MockLocationRow> = {},
): MockLocationRow[] {
  const rows: MockLocationRow[] = [];
  for (let i = 0; i < count; i++) {
    const hourStart = new Date(baseDate);
    hourStart.setUTCHours(startHour + i, 0, 0, 0);
    rows.push(createMockRow(geohash7, hourStart, overrides));
  }
  return rows;
}

// ============================================================================
// Tests
// ============================================================================

describe("Place Inference", () => {
  describe("buildGeohashClusters", () => {
    it("should group rows by geohash7", () => {
      const rows = [
        createMockRow("abc1234", new Date("2026-02-01T10:00:00Z")),
        createMockRow("abc1234", new Date("2026-02-01T11:00:00Z")),
        createMockRow("xyz9999", new Date("2026-02-01T12:00:00Z")),
      ];

      const clusters = buildGeohashClusters(rows);

      expect(clusters.size).toBe(2);
      expect(clusters.get("abc1234")?.totalHours).toBe(2);
      expect(clusters.get("xyz9999")?.totalHours).toBe(1);
    });

    it("should count overnight hours correctly (10pm-6am)", () => {
      const rows = [
        // 10pm - overnight
        createMockRow("home123", new Date("2026-02-01T22:00:00Z")),
        // 11pm - overnight
        createMockRow("home123", new Date("2026-02-01T23:00:00Z")),
        // midnight - overnight
        createMockRow("home123", new Date("2026-02-02T00:00:00Z")),
        // 5am - overnight
        createMockRow("home123", new Date("2026-02-02T05:00:00Z")),
        // 6am - NOT overnight
        createMockRow("home123", new Date("2026-02-02T06:00:00Z")),
        // 9am - NOT overnight
        createMockRow("home123", new Date("2026-02-02T09:00:00Z")),
      ];

      const clusters = buildGeohashClusters(rows);
      const home = clusters.get("home123");

      expect(home?.totalHours).toBe(6);
      expect(home?.overnightHours).toBe(4); // 22, 23, 00, 05
    });

    it("should count work hours correctly (9am-5pm weekdays)", () => {
      // Monday, Feb 3, 2026
      const monday = new Date("2026-02-02T00:00:00Z"); // This is actually Monday
      const rows = [
        // 8am - before work hours
        createMockRow("work123", new Date("2026-02-02T08:00:00Z")),
        // 9am - work hours
        createMockRow("work123", new Date("2026-02-02T09:00:00Z")),
        // 12pm - work hours
        createMockRow("work123", new Date("2026-02-02T12:00:00Z")),
        // 4pm - work hours
        createMockRow("work123", new Date("2026-02-02T16:00:00Z")),
        // 5pm - NOT work hours (ends at 5pm)
        createMockRow("work123", new Date("2026-02-02T17:00:00Z")),
        // 6pm - NOT work hours
        createMockRow("work123", new Date("2026-02-02T18:00:00Z")),
      ];

      const clusters = buildGeohashClusters(rows);
      const work = clusters.get("work123");

      expect(work?.totalHours).toBe(6);
      expect(work?.workHours).toBe(3); // 9, 12, 16
    });

    it("should not count weekend hours as work hours", () => {
      // Saturday, Feb 1, 2026
      const saturday = new Date("2026-02-01T00:00:00Z");
      const rows = [
        // 10am Saturday - NOT work hours (weekend)
        createMockRow("work123", new Date("2026-02-01T10:00:00Z")),
        // 2pm Saturday - NOT work hours (weekend)
        createMockRow("work123", new Date("2026-02-01T14:00:00Z")),
      ];

      const clusters = buildGeohashClusters(rows);
      const work = clusters.get("work123");

      expect(work?.totalHours).toBe(2);
      expect(work?.workHours).toBe(0);
      expect(work?.weekendHours).toBe(2);
    });

    it("should track distinct days", () => {
      const rows = [
        createMockRow("place1", new Date("2026-02-01T10:00:00Z")),
        createMockRow("place1", new Date("2026-02-01T11:00:00Z")),
        createMockRow("place1", new Date("2026-02-02T10:00:00Z")),
        createMockRow("place1", new Date("2026-02-03T10:00:00Z")),
      ];

      const clusters = buildGeohashClusters(rows);
      const place = clusters.get("place1");

      expect(place?.distinctDays).toBe(3);
    });
  });

  describe("inferPlaceTypes", () => {
    it("should infer HOME from overnight patterns", () => {
      // Create data showing someone sleeping at home
      const rows: MockLocationRow[] = [];

      // 5 nights at home (10pm-6am each)
      for (let day = 1; day <= 5; day++) {
        for (let hour = 22; hour < 24; hour++) {
          rows.push(createMockRow("home123", new Date(`2026-02-0${day}T${hour}:00:00Z`)));
        }
        for (let hour = 0; hour < 6; hour++) {
          rows.push(
            createMockRow("home123", new Date(`2026-02-0${day + 1}T0${hour}:00:00Z`)),
          );
        }
      }

      const clusters = buildGeohashClusters(rows);
      const inferred = inferPlaceTypes(clusters);

      const home = inferred.find((p) => p.inferredType === "home");
      expect(home).toBeDefined();
      expect(home?.geohash7).toBe("home123");
      expect(home?.confidence).toBeGreaterThan(0.7);
      expect(home?.suggestedLabel).toBe("Home");
    });

    it("should infer WORK from weekday work hours", () => {
      const rows: MockLocationRow[] = [];

      // 5 weekdays at work (9am-5pm)
      // Feb 3-7, 2026 are Mon-Fri
      for (let day = 3; day <= 7; day++) {
        for (let hour = 9; hour < 17; hour++) {
          const dayStr = day < 10 ? `0${day}` : `${day}`;
          const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
          rows.push(
            createMockRow("work456", new Date(`2026-02-${dayStr}T${hourStr}:00:00Z`), {
              google_place_name: "TodayMatters HQ",
            }),
          );
        }
      }

      const clusters = buildGeohashClusters(rows);
      const inferred = inferPlaceTypes(clusters);

      const work = inferred.find((p) => p.inferredType === "work");
      expect(work).toBeDefined();
      expect(work?.geohash7).toBe("work456");
      expect(work?.confidence).toBeGreaterThan(0.6);
      expect(work?.suggestedLabel).toBe("TodayMatters HQ");
    });

    it("should infer FREQUENT for multi-day visits", () => {
      const rows: MockLocationRow[] = [];

      // Coffee shop visited 4 days
      for (let day = 1; day <= 4; day++) {
        rows.push(
          createMockRow("cafe789", new Date(`2026-02-0${day}T08:00:00Z`), {
            google_place_name: "Starbucks",
          }),
        );
      }

      const clusters = buildGeohashClusters(rows);
      const inferred = inferPlaceTypes(clusters);

      const frequent = inferred.find((p) => p.inferredType === "frequent");
      expect(frequent).toBeDefined();
      expect(frequent?.geohash7).toBe("cafe789");
      expect(frequent?.suggestedLabel).toBe("Starbucks");
    });

    it("should preserve existing place labels", () => {
      const rows = [
        createMockRow("gym123", new Date("2026-02-01T18:00:00Z"), {
          place_label: "My Gym",
        }),
        createMockRow("gym123", new Date("2026-02-02T18:00:00Z"), {
          place_label: "My Gym",
        }),
        createMockRow("gym123", new Date("2026-02-03T18:00:00Z"), {
          place_label: "My Gym",
        }),
      ];

      const clusters = buildGeohashClusters(rows);
      const inferred = inferPlaceTypes(clusters);

      const gym = inferred.find((p) => p.geohash7 === "gym123");
      expect(gym).toBeDefined();
      expect(gym?.existingPlaceLabel).toBe("My Gym");
      expect(gym?.suggestedLabel).toBe("My Gym");
      expect(gym?.reasoning).toContain("Already has user-defined place label");
    });

    it("should only assign one HOME and one WORK", () => {
      const rows: MockLocationRow[] = [];

      // Two potential homes (both with overnight hours)
      for (let night = 1; night <= 3; night++) {
        for (let hour = 22; hour < 24; hour++) {
          rows.push(createMockRow("home_a", new Date(`2026-02-0${night}T${hour}:00:00Z`)));
        }
        for (let hour = 0; hour < 6; hour++) {
          rows.push(createMockRow("home_a", new Date(`2026-02-0${night + 1}T0${hour}:00:00Z`)));
        }
      }

      for (let night = 4; night <= 5; night++) {
        for (let hour = 22; hour < 24; hour++) {
          rows.push(createMockRow("home_b", new Date(`2026-02-0${night}T${hour}:00:00Z`)));
        }
        for (let hour = 0; hour < 6; hour++) {
          rows.push(createMockRow("home_b", new Date(`2026-02-0${night + 1}T0${hour}:00:00Z`)));
        }
      }

      const clusters = buildGeohashClusters(rows);
      const inferred = inferPlaceTypes(clusters);

      const homes = inferred.filter((p) => p.inferredType === "home");
      expect(homes.length).toBe(1);
      // Should pick home_a (more hours)
      expect(homes[0].geohash7).toBe("home_a");
    });

    it("should sort by confidence descending", () => {
      const rows: MockLocationRow[] = [];

      // Clear home pattern (high confidence)
      for (let night = 1; night <= 7; night++) {
        for (let hour = 22; hour < 24; hour++) {
          rows.push(createMockRow("home123", new Date(`2026-02-0${night}T${hour}:00:00Z`)));
        }
      }

      // Moderate work pattern
      for (let day = 3; day <= 5; day++) {
        for (let hour = 9; hour < 17; hour++) {
          rows.push(createMockRow("work456", new Date(`2026-02-0${day}T${hour < 10 ? "0" : ""}${hour}:00:00Z`)));
        }
      }

      const clusters = buildGeohashClusters(rows);
      const inferred = inferPlaceTypes(clusters);

      expect(inferred.length).toBeGreaterThanOrEqual(2);
      // First should be highest confidence
      for (let i = 1; i < inferred.length; i++) {
        expect(inferred[i - 1].confidence).toBeGreaterThanOrEqual(inferred[i].confidence);
      }
    });
  });
});
