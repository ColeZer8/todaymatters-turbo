/**
 * Tests for actual-ingestion.ts
 * Focuses on sessionization, micro-gap merging, and short session absorption.
 */

import {
  sessionizeWindow,
  mergeSessionMicroGaps,
  absorbShortSessions,
  type SessionBlock,
  type SessionizableEvent,
} from "./actual-ingestion";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock sessionizable event for testing.
 */
function createMockEvent(
  id: string,
  start: Date,
  end: Date,
  options: {
    placeId?: string | null;
    placeLabel?: string | null;
    appId?: string;
    isCommute?: boolean;
  } = {},
): SessionizableEvent {
  const meta: Record<string, unknown> = {};

  if (options.placeId !== undefined) {
    meta.place_id = options.placeId;
  }
  if (options.placeLabel !== undefined) {
    meta.place_label = options.placeLabel;
  }
  if (options.appId !== undefined) {
    meta.app_id = options.appId;
  }
  if (options.isCommute) {
    meta.kind = "commute";
  }

  return {
    id,
    title: options.isCommute ? "Commute" : `Event ${id}`,
    scheduledStart: start,
    scheduledEnd: end,
    meta,
  };
}

/**
 * Create a mock session block for testing.
 */
function createMockSession(
  id: string,
  start: Date,
  end: Date,
  options: {
    placeId?: string | null;
    placeLabel?: string | null;
    intent?: "work" | "leisure" | "distracted_work" | "offline" | "mixed";
    isCommute?: boolean;
    confidence?: number;
    summary?: Array<{ label: string; seconds: number }>;
  } = {},
): SessionBlock {
  const placeId = options.placeId ?? null;
  const placeLabel = options.placeLabel ?? null;
  const intent = options.intent ?? "offline";
  const confidence = options.confidence ?? 0.5;
  const isCommute = options.isCommute ?? false;

  return {
    sourceId: `session:test:${placeId ?? "unknown"}:${start.getTime()}`,
    title: isCommute ? "Commute" : `${placeLabel ?? "Unknown Location"} - ${intent}`,
    start,
    end,
    placeId,
    placeLabel,
    intent,
    intentClassification: {
      intent,
      breakdown: { work: 0, social: 0, entertainment: 0, comms: 0, utility: 0, ignore: 0 },
      totalSeconds: 0,
      reasoning: "Test session",
    },
    childEventIds: [id],
    confidence,
    meta: {
      kind: "session_block",
      place_id: placeId,
      place_label: placeLabel,
      intent,
      children: [id],
      confidence,
      summary: options.summary,
    },
  };
}

// ============================================================================
// Tests for mergeSessionMicroGaps
// ============================================================================

describe("mergeSessionMicroGaps", () => {
  const windowStart = new Date("2026-01-29T10:00:00Z");

  it("should return single session unchanged", () => {
    const session = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );

    const result = mergeSessionMicroGaps([session], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(session);
  });

  it("should merge sessions with gap < 5 minutes at same place", () => {
    const session1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );
    const session2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:33:00Z"), // 3 minute gap
      new Date("2026-01-29T11:00:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );

    const result = mergeSessionMicroGaps([session1, session2], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(new Date("2026-01-29T10:00:00Z"));
    expect(result[0].end).toEqual(new Date("2026-01-29T11:00:00Z"));
    expect(result[0].childEventIds).toContain("s1");
    expect(result[0].childEventIds).toContain("s2");
  });

  it("should NOT merge sessions with gap >= 5 minutes", () => {
    const session1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );
    const session2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:36:00Z"), // 6 minute gap
      new Date("2026-01-29T11:00:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );

    const result = mergeSessionMicroGaps([session1, session2], windowStart);

    expect(result).toHaveLength(2);
    expect(result[0].childEventIds).toEqual(["s1"]);
    expect(result[1].childEventIds).toEqual(["s2"]);
  });

  it("should NOT merge sessions at different places", () => {
    const session1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );
    const session2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:32:00Z"), // 2 minute gap
      new Date("2026-01-29T11:00:00Z"),
      { placeId: "cafe", placeLabel: "Cafe" },
    );

    const result = mergeSessionMicroGaps([session1, session2], windowStart);

    expect(result).toHaveLength(2);
  });

  it("should NOT merge commute sessions", () => {
    const session1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"),
      { isCommute: true, intent: "offline" },
    );
    const session2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:32:00Z"), // 2 minute gap
      new Date("2026-01-29T11:00:00Z"),
      { isCommute: true, intent: "offline" },
    );

    const result = mergeSessionMicroGaps([session1, session2], windowStart);

    expect(result).toHaveLength(2);
  });

  it("should merge multiple consecutive gaps < 5 minutes", () => {
    const session1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:15:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );
    const session2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:18:00Z"), // 3 minute gap
      new Date("2026-01-29T10:30:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );
    const session3 = createMockSession(
      "s3",
      new Date("2026-01-29T10:34:00Z"), // 4 minute gap
      new Date("2026-01-29T11:00:00Z"),
      { placeId: "office", placeLabel: "Office" },
    );

    const result = mergeSessionMicroGaps([session1, session2, session3], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(new Date("2026-01-29T10:00:00Z"));
    expect(result[0].end).toEqual(new Date("2026-01-29T11:00:00Z"));
    expect(result[0].childEventIds).toHaveLength(3);
  });

  it("should combine app summaries when merging", () => {
    const session1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"),
      {
        placeId: "office",
        placeLabel: "Office",
        summary: [
          { label: "Slack", seconds: 600 },
          { label: "Gmail", seconds: 300 },
        ],
      },
    );
    const session2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:33:00Z"), // 3 minute gap
      new Date("2026-01-29T11:00:00Z"),
      {
        placeId: "office",
        placeLabel: "Office",
        summary: [
          { label: "Slack", seconds: 400 },
          { label: "VS Code", seconds: 500 },
        ],
      },
    );

    const result = mergeSessionMicroGaps([session1, session2], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0].meta.summary).toBeDefined();
    // Slack should be combined: 600 + 400 = 1000
    const slackEntry = result[0].meta.summary?.find((s) => s.label === "Slack");
    expect(slackEntry?.seconds).toBe(1000);
  });
});

// ============================================================================
// Tests for absorbShortSessions
// ============================================================================

describe("absorbShortSessions", () => {
  const windowStart = new Date("2026-01-29T10:00:00Z");

  it("should return single session unchanged", () => {
    const session = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:05:00Z"), // 5 minutes - short
      { placeId: "office", placeLabel: "Office" },
    );

    const result = absorbShortSessions([session], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(session);
  });

  it("should absorb short session into preceding session at same place", () => {
    const longSession = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"), // 30 minutes - long
      { placeId: "office", placeLabel: "Office" },
    );
    const shortSession = createMockSession(
      "s2",
      new Date("2026-01-29T10:30:00Z"),
      new Date("2026-01-29T10:35:00Z"), // 5 minutes - short
      { placeId: "office", placeLabel: "Office" },
    );

    const result = absorbShortSessions([longSession, shortSession], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0].end).toEqual(new Date("2026-01-29T10:35:00Z"));
    expect(result[0].childEventIds).toContain("s1");
    expect(result[0].childEventIds).toContain("s2");
  });

  it("should absorb short session into following session if no preceding available", () => {
    const shortSession = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:05:00Z"), // 5 minutes - short
      { placeId: "office", placeLabel: "Office" },
    );
    const longSession = createMockSession(
      "s2",
      new Date("2026-01-29T10:05:00Z"),
      new Date("2026-01-29T10:35:00Z"), // 30 minutes - long
      { placeId: "office", placeLabel: "Office" },
    );

    const result = absorbShortSessions([shortSession, longSession], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(new Date("2026-01-29T10:00:00Z"));
    expect(result[0].end).toEqual(new Date("2026-01-29T10:35:00Z"));
  });

  it("should NOT absorb short session if at different place", () => {
    const longSession = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"), // 30 minutes - long
      { placeId: "office", placeLabel: "Office" },
    );
    const shortSession = createMockSession(
      "s2",
      new Date("2026-01-29T10:30:00Z"),
      new Date("2026-01-29T10:35:00Z"), // 5 minutes - short
      { placeId: "cafe", placeLabel: "Cafe" },
    );

    const result = absorbShortSessions([longSession, shortSession], windowStart);

    expect(result).toHaveLength(2);
    expect(result[0].childEventIds).toEqual(["s1"]);
    expect(result[1].childEventIds).toEqual(["s2"]);
  });

  it("should NOT absorb commute sessions regardless of duration", () => {
    const longSession = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"), // 30 minutes - long
      { placeId: null, placeLabel: null },
    );
    const shortCommute = createMockSession(
      "s2",
      new Date("2026-01-29T10:30:00Z"),
      new Date("2026-01-29T10:35:00Z"), // 5 minutes - short commute
      { isCommute: true, intent: "offline" },
    );

    const result = absorbShortSessions([longSession, shortCommute], windowStart);

    expect(result).toHaveLength(2);
    expect(result[1].title).toBe("Commute");
  });

  it("should keep session >= 10 minutes unchanged", () => {
    const session1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:30:00Z"), // 30 minutes
      { placeId: "office", placeLabel: "Office" },
    );
    const session2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:30:00Z"),
      new Date("2026-01-29T10:45:00Z"), // 15 minutes
      { placeId: "cafe", placeLabel: "Cafe" },
    );

    const result = absorbShortSessions([session1, session2], windowStart);

    expect(result).toHaveLength(2);
  });

  it("should absorb multiple short sessions iteratively", () => {
    const short1 = createMockSession(
      "s1",
      new Date("2026-01-29T10:00:00Z"),
      new Date("2026-01-29T10:05:00Z"), // 5 minutes - short
      { placeId: "office", placeLabel: "Office" },
    );
    const short2 = createMockSession(
      "s2",
      new Date("2026-01-29T10:05:00Z"),
      new Date("2026-01-29T10:08:00Z"), // 3 minutes - short
      { placeId: "office", placeLabel: "Office" },
    );
    const long = createMockSession(
      "s3",
      new Date("2026-01-29T10:08:00Z"),
      new Date("2026-01-29T10:30:00Z"), // 22 minutes - long
      { placeId: "office", placeLabel: "Office" },
    );

    const result = absorbShortSessions([short1, short2, long], windowStart);

    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(new Date("2026-01-29T10:00:00Z"));
    expect(result[0].end).toEqual(new Date("2026-01-29T10:30:00Z"));
    expect(result[0].childEventIds).toHaveLength(3);
  });
});

// ============================================================================
// Tests for sessionizeWindow with micro-gap merging
// ============================================================================

describe("sessionizeWindow with micro-gap merging", () => {
  const windowStart = new Date("2026-01-29T10:00:00Z");
  const windowEnd = new Date("2026-01-29T11:00:00Z");
  const userId = "test-user";

  it("should merge events with 3-minute gap at same place", () => {
    const events: SessionizableEvent[] = [
      createMockEvent(
        "e1",
        new Date("2026-01-29T10:00:00Z"),
        new Date("2026-01-29T10:15:00Z"),
        { placeId: "office", placeLabel: "Office", appId: "com.slack.Slack" },
      ),
      createMockEvent(
        "e2",
        new Date("2026-01-29T10:18:00Z"), // 3 minute gap
        new Date("2026-01-29T10:45:00Z"),
        { placeId: "office", placeLabel: "Office", appId: "com.google.Gmail" },
      ),
    ];

    const result = sessionizeWindow(userId, windowStart, windowEnd, events);

    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(new Date("2026-01-29T10:00:00Z"));
    expect(result[0].end).toEqual(new Date("2026-01-29T10:45:00Z"));
    expect(result[0].childEventIds).toContain("e1");
    expect(result[0].childEventIds).toContain("e2");
    expect(result[0].placeLabel).toBe("Office");
  });

  it("should NOT merge SESSIONS with gap >= 5 minutes", () => {
    // Note: Events at the SAME place form a single session regardless of gaps.
    // The 5-minute gap merging applies to gaps between SESSIONS at the same place.
    // To test this, we need sessions that were initially separated (e.g., by a place change).
    // This test verifies that two sessions at different places, with a 6-min gap, stay separate.
    const events: SessionizableEvent[] = [
      createMockEvent(
        "e1",
        new Date("2026-01-29T10:00:00Z"),
        new Date("2026-01-29T10:15:00Z"),
        { placeId: "office", placeLabel: "Office", appId: "com.slack.Slack" },
      ),
      createMockEvent(
        "e2",
        new Date("2026-01-29T10:21:00Z"), // 6 minute gap
        new Date("2026-01-29T10:45:00Z"),
        { placeId: "cafe", placeLabel: "Cafe", appId: "com.google.Gmail" }, // Different place
      ),
    ];

    const result = sessionizeWindow(userId, windowStart, windowEnd, events);

    // Different places stay separate
    expect(result).toHaveLength(2);
    expect(result[0].placeLabel).toBe("Office");
    expect(result[1].placeLabel).toBe("Cafe");
  });

  it("should absorb 5-minute session into preceding 20-minute session", () => {
    const events: SessionizableEvent[] = [
      createMockEvent(
        "e1",
        new Date("2026-01-29T10:00:00Z"),
        new Date("2026-01-29T10:20:00Z"), // 20 minutes
        { placeId: "office", placeLabel: "Office", appId: "com.slack.Slack" },
      ),
      createMockEvent(
        "e2",
        new Date("2026-01-29T10:20:00Z"),
        new Date("2026-01-29T10:25:00Z"), // 5 minutes (short)
        { placeId: "office", placeLabel: "Office", appId: "com.google.Gmail" },
      ),
    ];

    const result = sessionizeWindow(userId, windowStart, windowEnd, events);

    expect(result).toHaveLength(1);
    expect(result[0].end).toEqual(new Date("2026-01-29T10:25:00Z"));
  });

  it("should create separate sessions for different places even with short duration", () => {
    const events: SessionizableEvent[] = [
      createMockEvent(
        "e1",
        new Date("2026-01-29T10:00:00Z"),
        new Date("2026-01-29T10:20:00Z"),
        { placeId: "office", placeLabel: "Office", appId: "com.slack.Slack" },
      ),
      createMockEvent(
        "e2",
        new Date("2026-01-29T10:20:00Z"),
        new Date("2026-01-29T10:25:00Z"), // 5 min at different place - stays separate
        { placeId: "cafe", placeLabel: "Cafe", appId: "com.twitter.Twitter" },
      ),
    ];

    const result = sessionizeWindow(userId, windowStart, windowEnd, events);

    // Different places - cannot absorb
    expect(result).toHaveLength(2);
    expect(result[0].placeLabel).toBe("Office");
    expect(result[1].placeLabel).toBe("Cafe");
  });

  it("should keep commute sessions separate", () => {
    const events: SessionizableEvent[] = [
      createMockEvent(
        "e1",
        new Date("2026-01-29T10:00:00Z"),
        new Date("2026-01-29T10:20:00Z"),
        { placeId: "office", placeLabel: "Office", appId: "com.slack.Slack" },
      ),
      createMockEvent(
        "commute",
        new Date("2026-01-29T10:22:00Z"), // 2 minute gap
        new Date("2026-01-29T10:27:00Z"), // 5 minute commute
        { isCommute: true },
      ),
      createMockEvent(
        "e2",
        new Date("2026-01-29T10:27:00Z"),
        new Date("2026-01-29T10:45:00Z"),
        { placeId: "cafe", placeLabel: "Cafe", appId: "com.twitter.Twitter" },
      ),
    ];

    const result = sessionizeWindow(userId, windowStart, windowEnd, events);

    // Commute stays separate even though it's short
    expect(result).toHaveLength(3);
    expect(result[0].placeLabel).toBe("Office");
    expect(result[1].title).toBe("Commute");
    expect(result[2].placeLabel).toBe("Cafe");
  });
});
