import {
  classifyIntent,
  classifyIntentSimple,
  getAppCategory,
  isWorkCategory,
  isLeisureCategory,
  INTENT_THRESHOLDS,
  type AppSummary,
  type Intent,
  type UserAppCategoryOverrides,
} from "./app-categories";

describe("app-categories", () => {
  describe("getAppCategory", () => {
    it("should return work for known work apps", () => {
      expect(getAppCategory("slack")).toBe("work");
      expect(getAppCategory("google docs")).toBe("work");
      expect(getAppCategory("figma")).toBe("work");
      expect(getAppCategory("zoom")).toBe("work");
    });

    it("should return social for known social apps", () => {
      expect(getAppCategory("instagram")).toBe("social");
      expect(getAppCategory("tiktok")).toBe("social");
      expect(getAppCategory("twitter")).toBe("social");
      expect(getAppCategory("reddit")).toBe("social");
    });

    it("should return entertainment for known entertainment apps", () => {
      expect(getAppCategory("youtube")).toBe("entertainment");
      expect(getAppCategory("netflix")).toBe("entertainment");
      expect(getAppCategory("spotify")).toBe("entertainment");
    });

    it("should return comms for known communication apps", () => {
      expect(getAppCategory("messages")).toBe("comms");
      expect(getAppCategory("whatsapp")).toBe("comms");
      expect(getAppCategory("facetime")).toBe("comms");
    });

    it("should return utility for unknown apps", () => {
      // Using names that won't partially match any known apps
      expect(getAppCategory("qqq random zzz")).toBe("utility");
      expect(getAppCategory("private journal")).toBe("utility");
    });

    it("should respect user overrides", () => {
      const overrides: UserAppCategoryOverrides = {
        instagram: { category: "work" }, // User uses Instagram for work
        slack: { category: "social" }, // User uses Slack socially
      };

      expect(getAppCategory("instagram", overrides)).toBe("work");
      expect(getAppCategory("slack", overrides)).toBe("social");
      // Non-overridden apps still use defaults
      expect(getAppCategory("figma", overrides)).toBe("work");
    });
  });

  describe("isWorkCategory", () => {
    it("should return true for work category", () => {
      expect(isWorkCategory("work")).toBe(true);
    });

    it("should return false for non-work categories", () => {
      expect(isWorkCategory("social")).toBe(false);
      expect(isWorkCategory("entertainment")).toBe(false);
      expect(isWorkCategory("comms")).toBe(false);
      expect(isWorkCategory("utility")).toBe(false);
      expect(isWorkCategory("ignore")).toBe(false);
    });
  });

  describe("isLeisureCategory", () => {
    it("should return true for social and entertainment", () => {
      expect(isLeisureCategory("social")).toBe(true);
      expect(isLeisureCategory("entertainment")).toBe(true);
    });

    it("should return false for non-leisure categories", () => {
      expect(isLeisureCategory("work")).toBe(false);
      expect(isLeisureCategory("comms")).toBe(false);
      expect(isLeisureCategory("utility")).toBe(false);
      expect(isLeisureCategory("ignore")).toBe(false);
    });
  });

  describe("classifyIntent", () => {
    describe("offline intent", () => {
      it("should return offline when no screen-time", () => {
        const result = classifyIntent([]);
        expect(result.intent).toBe("offline");
        expect(result.totalSeconds).toBe(0);
        expect(result.reasoning).toBe("No screen-time recorded");
      });

      it("should return offline when only ignored apps are used", () => {
        const summary: AppSummary[] = [
          { appId: "springboard", seconds: 600 },
          { appId: "siri", seconds: 300 },
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("offline");
        expect(result.totalSeconds).toBe(0);
      });
    });

    describe("work intent (>=60% work)", () => {
      it("should classify as work when work apps dominate", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 1800 }, // 30 min work
          { appId: "google docs", seconds: 1200 }, // 20 min work
          { appId: "instagram", seconds: 600 }, // 10 min social
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("work");
        expect(result.breakdown.work).toBe(3000); // 50 min total work
        expect(result.totalSeconds).toBe(3600); // 60 min total
        // Work is 83% (3000/3600)
        expect(result.reasoning).toContain("Work");
        expect(result.reasoning).toContain("83%");
      });

      it("should classify as work at exactly 60%", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 600 }, // 10 min work (60%)
          { appId: "instagram", seconds: 400 }, // ~6.67 min social (40%)
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("work");
      });

      it("should classify as work when mixing work apps", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 600 },
          { appId: "figma", seconds: 600 },
          { appId: "zoom", seconds: 600 },
          { appId: "vs code", seconds: 600 },
          { appId: "youtube", seconds: 200 }, // entertainment
        ];
        const result = classifyIntent(summary);
        // Work = 2400, Entertainment = 200, Total = 2600
        // Work % = 2400/2600 = 92%
        expect(result.intent).toBe("work");
      });
    });

    describe("leisure intent (>=60% social+entertainment)", () => {
      it("should classify as leisure when social apps dominate", () => {
        const summary: AppSummary[] = [
          { appId: "instagram", seconds: 1200 }, // 20 min social
          { appId: "tiktok", seconds: 1200 }, // 20 min social
          { appId: "slack", seconds: 600 }, // 10 min work
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("leisure");
        // Social = 2400, Work = 600, Total = 3000
        // Social % = 80%
        expect(result.breakdown.social).toBe(2400);
        expect(result.reasoning).toContain("Leisure");
      });

      it("should classify as leisure when entertainment dominates", () => {
        const summary: AppSummary[] = [
          { appId: "youtube", seconds: 1800 }, // 30 min entertainment
          { appId: "netflix", seconds: 1200 }, // 20 min entertainment
          { appId: "messages", seconds: 600 }, // 10 min comms
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("leisure");
        // Entertainment = 3000, Comms = 600, Total = 3600
        // Leisure % = 83%
        expect(result.breakdown.entertainment).toBe(3000);
      });

      it("should classify as leisure when social+entertainment combined >= 60%", () => {
        const summary: AppSummary[] = [
          { appId: "instagram", seconds: 600 }, // 10 min social (30%)
          { appId: "youtube", seconds: 700 }, // ~11 min entertainment (35%)
          { appId: "slack", seconds: 700 }, // ~11 min work (35%)
        ];
        const result = classifyIntent(summary);
        // Social = 600 (30%), Entertainment = 700 (35%), Work = 700 (35%)
        // Leisure = 65% > 60%
        expect(result.intent).toBe("leisure");
      });
    });

    describe("distracted_work intent (40-60% work AND >=25% social)", () => {
      it("should classify as distracted_work with moderate work and social distraction", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 1000 }, // work
          { appId: "instagram", seconds: 600 }, // social
          { appId: "messages", seconds: 400 }, // comms
        ];
        // Total = 2000, Work = 1000 (50%), Social = 600 (30%)
        const result = classifyIntent(summary);
        expect(result.intent).toBe("distracted_work");
        expect(result.reasoning).toContain("Distracted Work");
        expect(result.reasoning).toContain("50%");
        expect(result.reasoning).toContain("30%");
      });

      it("should classify as distracted_work at boundary (40% work, 25% social)", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 400 }, // 40% work
          { appId: "instagram", seconds: 250 }, // 25% social
          { appId: "messages", seconds: 350 }, // 35% comms
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("distracted_work");
      });

      it("should NOT classify as distracted_work when work < 40%", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 390 }, // 39% work (just below threshold)
          { appId: "instagram", seconds: 300 }, // 30% social
          { appId: "messages", seconds: 310 }, // 31% comms
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("mixed"); // Not distracted_work
      });

      it("should NOT classify as distracted_work when social < 25%", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 500 }, // 50% work
          { appId: "instagram", seconds: 200 }, // 20% social (below 25%)
          { appId: "messages", seconds: 300 }, // 30% comms
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("mixed"); // Not distracted_work
      });
    });

    describe("mixed intent (fallback)", () => {
      it("should classify as mixed when no category dominates", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 300 }, // 30% work
          { appId: "instagram", seconds: 200 }, // 20% social
          { appId: "youtube", seconds: 200 }, // 20% entertainment
          { appId: "messages", seconds: 300 }, // 30% comms
        ];
        const result = classifyIntent(summary);
        expect(result.intent).toBe("mixed");
        expect(result.reasoning).toContain("Mixed");
      });

      it("should classify as mixed with balanced work and comms", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 400 }, // 40% work
          { appId: "messages", seconds: 300 }, // 30% comms
          { appId: "maps", seconds: 300 }, // 30% utility
        ];
        const result = classifyIntent(summary);
        // Work 40%, but social is 0%, so not distracted_work
        expect(result.intent).toBe("mixed");
      });

      it("should classify as mixed when work is high but not dominant", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 500 }, // 50% work
          { appId: "youtube", seconds: 250 }, // 25% entertainment
          { appId: "messages", seconds: 250 }, // 25% comms
        ];
        const result = classifyIntent(summary);
        // Work 50% (not >= 60%), Leisure 25% (not >= 60%), Social 0% (not >= 25%)
        expect(result.intent).toBe("mixed");
      });
    });

    describe("user overrides", () => {
      it("should respect user overrides when classifying", () => {
        const overrides: UserAppCategoryOverrides = {
          instagram: { category: "work" }, // User uses Instagram for work
        };
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 300 },
          { appId: "instagram", seconds: 700 }, // Now counted as work
        ];
        const result = classifyIntent(summary, overrides);
        // Work = 1000, Total = 1000, Work = 100%
        expect(result.intent).toBe("work");
      });
    });

    describe("pre-computed categories", () => {
      it("should use pre-computed category when provided", () => {
        const summary: AppSummary[] = [
          { appId: "unknown-app-1", seconds: 600, category: "work" },
          { appId: "unknown-app-2", seconds: 400, category: "social" },
        ];
        const result = classifyIntent(summary);
        // Work = 600 (60%), Social = 400 (40%)
        expect(result.intent).toBe("work");
      });
    });

    describe("breakdown accuracy", () => {
      it("should correctly calculate breakdown for all categories", () => {
        const summary: AppSummary[] = [
          { appId: "slack", seconds: 100 }, // work
          { appId: "instagram", seconds: 200 }, // social
          { appId: "youtube", seconds: 300 }, // entertainment
          { appId: "messages", seconds: 400 }, // comms
          { appId: "maps", seconds: 500 }, // utility
          { appId: "springboard", seconds: 600 }, // ignore
        ];
        const result = classifyIntent(summary);

        expect(result.breakdown.work).toBe(100);
        expect(result.breakdown.social).toBe(200);
        expect(result.breakdown.entertainment).toBe(300);
        expect(result.breakdown.comms).toBe(400);
        expect(result.breakdown.utility).toBe(500);
        expect(result.breakdown.ignore).toBe(600);
        // Total excludes ignored apps
        expect(result.totalSeconds).toBe(1500);
      });
    });
  });

  describe("classifyIntentSimple", () => {
    it("should return just the intent string", () => {
      const summary: AppSummary[] = [
        { appId: "slack", seconds: 1800 },
        { appId: "figma", seconds: 1200 },
      ];
      const intent = classifyIntentSimple(summary);
      expect(intent).toBe("work");
    });

    it("should return offline for empty summary", () => {
      expect(classifyIntentSimple([])).toBe("offline");
    });
  });

  describe("INTENT_THRESHOLDS", () => {
    it("should have correct threshold values", () => {
      expect(INTENT_THRESHOLDS.WORK_HIGH).toBe(0.6);
      expect(INTENT_THRESHOLDS.WORK_MEDIUM_MIN).toBe(0.4);
      expect(INTENT_THRESHOLDS.WORK_MEDIUM_MAX).toBe(0.6);
      expect(INTENT_THRESHOLDS.LEISURE_HIGH).toBe(0.6);
      expect(INTENT_THRESHOLDS.SOCIAL_DISTRACTION).toBe(0.25);
    });
  });
});
