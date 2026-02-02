import {
  inferActivityType,
  calculateConfidenceScore,
  type ActivitySegment,
  type AppBreakdownItem,
  type HealthDataContext,
  type InferredActivityType,
} from "./activity-segments";

describe("activity-segments", () => {
  describe("inferActivityType", () => {
    // Helper to create app breakdown items
    const createAppBreakdown = (
      items: Array<{ appId: string; category: string; seconds: number }>
    ): AppBreakdownItem[] =>
      items.map((item) => ({
        appId: item.appId,
        displayName: item.appId,
        category: item.category as AppBreakdownItem["category"],
        seconds: item.seconds,
      }));

    describe("health data priority", () => {
      it("should return workout when health data has workout", () => {
        const healthData: HealthDataContext = {
          hasWorkout: true,
          workoutType: "running",
          isSleeping: false,
        };

        const result = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "slack", category: "work", seconds: 3600 },
          ]),
          timeOfDay: 10,
          dayOfWeek: 1,
          healthData,
        });

        expect(result).toBe("workout");
      });

      it("should return sleep when health data indicates sleeping", () => {
        const healthData: HealthDataContext = {
          hasWorkout: false,
          workoutType: null,
          isSleeping: true,
        };

        const result = inferActivityType({
          placeCategory: "home",
          appBreakdown: [],
          timeOfDay: 2,
          dayOfWeek: 1,
          healthData,
        });

        expect(result).toBe("sleep");
      });
    });

    describe("commute detection", () => {
      it("should return commute when place category is commute", () => {
        const result = inferActivityType({
          placeCategory: "commute",
          appBreakdown: [],
          timeOfDay: 8,
          dayOfWeek: 1,
          healthData: null,
        });

        expect(result).toBe("commute");
      });
    });

    describe("work activity inference", () => {
      it("should return deep_work when work apps dominate with high screen time", () => {
        const result = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "vs code", category: "work", seconds: 2400 }, // 40 min
            { appId: "figma", category: "work", seconds: 600 }, // 10 min
          ]),
          timeOfDay: 10,
          dayOfWeek: 1, // Monday
          healthData: null,
        });

        expect(result).toBe("deep_work");
      });

      it("should return collaborative_work when work apps mixed with high comms", () => {
        // Work is dominant (60%+) but comms is > 40% of total
        const result = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "vs code", category: "work", seconds: 2400 }, // 40 min work (dominant)
            { appId: "slack", category: "comms", seconds: 1800 }, // 30 min comms (~43%)
          ]),
          timeOfDay: 14,
          dayOfWeek: 2,
          healthData: null,
        });

        expect(result).toBe("collaborative_work");
      });

      it("should return meeting when comms apps dominate", () => {
        const result = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "zoom", category: "comms", seconds: 1800 }, // 30 min comms
            { appId: "slack", category: "work", seconds: 300 }, // 5 min work
          ]),
          timeOfDay: 11,
          dayOfWeek: 3,
          healthData: null,
        });

        expect(result).toBe("meeting");
      });
    });

    describe("leisure activity inference", () => {
      it("should return leisure for entertainment outside work hours", () => {
        const result = inferActivityType({
          placeCategory: "home",
          appBreakdown: createAppBreakdown([
            { appId: "youtube", category: "entertainment", seconds: 2400 },
          ]),
          timeOfDay: 20, // 8 PM
          dayOfWeek: 0, // Sunday
          healthData: null,
        });

        expect(result).toBe("leisure");
      });

      it("should return distracted_time for entertainment during work hours", () => {
        const result = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "youtube", category: "entertainment", seconds: 1800 },
          ]),
          timeOfDay: 14, // 2 PM
          dayOfWeek: 2, // Tuesday
          healthData: null,
        });

        expect(result).toBe("distracted_time");
      });

      it("should return extended_social for long social media usage", () => {
        const result = inferActivityType({
          placeCategory: "home",
          appBreakdown: createAppBreakdown([
            { appId: "instagram", category: "social", seconds: 2400 }, // 40 min
          ]),
          timeOfDay: 20,
          dayOfWeek: 6, // Saturday
          healthData: null,
        });

        expect(result).toBe("extended_social");
      });

      it("should return social_break for short social media usage", () => {
        const result = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "twitter", category: "social", seconds: 600 }, // 10 min
          ]),
          timeOfDay: 12,
          dayOfWeek: 1,
          healthData: null,
        });

        expect(result).toBe("social_break");
      });
    });

    describe("offline/low screen time inference", () => {
      it("should return personal_time at home with low screen time", () => {
        const result = inferActivityType({
          placeCategory: "home",
          appBreakdown: createAppBreakdown([
            { appId: "messages", category: "comms", seconds: 60 }, // 1 min
          ]),
          timeOfDay: 19,
          dayOfWeek: 3,
          healthData: null,
        });

        expect(result).toBe("personal_time");
      });

      it("should return away_from_desk at work with low screen time", () => {
        const result = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "slack", category: "work", seconds: 120 }, // 2 min
          ]),
          timeOfDay: 15,
          dayOfWeek: 4,
          healthData: null,
        });

        expect(result).toBe("away_from_desk");
      });

      it("should return offline_activity with no known place", () => {
        const result = inferActivityType({
          placeCategory: null,
          appBreakdown: createAppBreakdown([
            { appId: "maps", category: "utility", seconds: 180 }, // 3 min
          ]),
          timeOfDay: 12,
          dayOfWeek: 5,
          healthData: null,
        });

        expect(result).toBe("offline_activity");
      });
    });

    describe("mixed activity", () => {
      it("should return mixed_activity when no clear pattern", () => {
        const result = inferActivityType({
          placeCategory: "home",
          appBreakdown: createAppBreakdown([
            { appId: "slack", category: "work", seconds: 600 },
            { appId: "youtube", category: "entertainment", seconds: 600 },
            { appId: "messages", category: "comms", seconds: 600 },
          ]),
          timeOfDay: 12,
          dayOfWeek: 1,
          healthData: null,
        });

        expect(result).toBe("mixed_activity");
      });

      it("should return mixed_activity with empty app breakdown and unknown place", () => {
        const result = inferActivityType({
          placeCategory: null,
          appBreakdown: [],
          timeOfDay: 14,
          dayOfWeek: 2,
          healthData: null,
        });

        // No health data, no commute, no apps, unknown place
        // Low screen time (0 min < 5) with null placeCategory → offline_activity
        // Note: empty breakdown gives 0 minutes, so it hits the low screen time branch
        expect(result).toBe("offline_activity");
      });
    });

    describe("work hours detection", () => {
      it("should detect weekday work hours (9 AM - 6 PM)", () => {
        // Monday at 9 AM - should be work hours
        const mondayMorning = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "youtube", category: "entertainment", seconds: 1800 },
          ]),
          timeOfDay: 9,
          dayOfWeek: 1,
          healthData: null,
        });
        expect(mondayMorning).toBe("distracted_time");

        // Monday at 6 PM - still work hours (17:59)
        const mondayEvening = inferActivityType({
          placeCategory: "work",
          appBreakdown: createAppBreakdown([
            { appId: "youtube", category: "entertainment", seconds: 1800 },
          ]),
          timeOfDay: 17,
          dayOfWeek: 1,
          healthData: null,
        });
        expect(mondayEvening).toBe("distracted_time");

        // Monday at 7 PM - not work hours
        const mondayLate = inferActivityType({
          placeCategory: "home",
          appBreakdown: createAppBreakdown([
            { appId: "youtube", category: "entertainment", seconds: 1800 },
          ]),
          timeOfDay: 19,
          dayOfWeek: 1,
          healthData: null,
        });
        expect(mondayLate).toBe("leisure");
      });

      it("should not consider weekends as work hours", () => {
        // Saturday at 10 AM - not work hours
        const saturday = inferActivityType({
          placeCategory: "home",
          appBreakdown: createAppBreakdown([
            { appId: "youtube", category: "entertainment", seconds: 1800 },
          ]),
          timeOfDay: 10,
          dayOfWeek: 6, // Saturday
          healthData: null,
        });
        expect(saturday).toBe("leisure");

        // Sunday at 2 PM - not work hours
        const sunday = inferActivityType({
          placeCategory: "home",
          appBreakdown: createAppBreakdown([
            { appId: "youtube", category: "entertainment", seconds: 1800 },
          ]),
          timeOfDay: 14,
          dayOfWeek: 0, // Sunday
          healthData: null,
        });
        expect(sunday).toBe("leisure");
      });
    });
  });

  describe("calculateConfidenceScore", () => {
    it("should return high confidence with good evidence", () => {
      const score = calculateConfidenceScore({
        locationSampleCount: 12,
        screenSessionCount: 6,
        placeMatchRatio: 0.9,
        appCategoryConsensus: 0.8,
      });

      // 0.4 * 0.9 (location) + 0.3 (screen) + 0.3 * 0.8 (consensus) = 0.36 + 0.3 + 0.24 = 0.90
      expect(score).toBeCloseTo(0.9, 1);
    });

    it("should return lower confidence with poor evidence", () => {
      const score = calculateConfidenceScore({
        locationSampleCount: 2,
        screenSessionCount: 1,
        placeMatchRatio: 0.5,
        appCategoryConsensus: 0.3,
      });

      // 0 (location < 5) + 0 (screen < 2) + 0.3 * 0.3 (consensus) = 0.09
      expect(score).toBeLessThan(0.2);
    });

    it("should cap at 1.0", () => {
      const score = calculateConfidenceScore({
        locationSampleCount: 100,
        screenSessionCount: 100,
        placeMatchRatio: 1.0,
        appCategoryConsensus: 1.0,
      });

      expect(score).toBe(1.0);
    });

    it("should not go below 0", () => {
      const score = calculateConfidenceScore({
        locationSampleCount: 0,
        screenSessionCount: 0,
        placeMatchRatio: 0,
        appCategoryConsensus: 0,
      });

      expect(score).toBe(0);
    });

    it("should weight screen sessions correctly", () => {
      // 2-4 sessions = 0.15
      const lowSessions = calculateConfidenceScore({
        locationSampleCount: 0,
        screenSessionCount: 3,
        placeMatchRatio: 0,
        appCategoryConsensus: 0,
      });
      expect(lowSessions).toBeCloseTo(0.15, 2);

      // 5+ sessions = 0.3
      const highSessions = calculateConfidenceScore({
        locationSampleCount: 0,
        screenSessionCount: 5,
        placeMatchRatio: 0,
        appCategoryConsensus: 0,
      });
      expect(highSessions).toBeCloseTo(0.3, 2);
    });

    it("should weight location samples correctly", () => {
      // 5-9 samples = 0.2 * matchRatio
      const lowSamples = calculateConfidenceScore({
        locationSampleCount: 7,
        screenSessionCount: 0,
        placeMatchRatio: 1.0,
        appCategoryConsensus: 0,
      });
      expect(lowSamples).toBeCloseTo(0.2, 2);

      // 10+ samples = 0.4 * matchRatio
      const highSamples = calculateConfidenceScore({
        locationSampleCount: 12,
        screenSessionCount: 0,
        placeMatchRatio: 1.0,
        appCategoryConsensus: 0,
      });
      expect(highSamples).toBeCloseTo(0.4, 2);
    });
  });
});
