import {
  computeReconciliationOps,
  computeReconciliationOpsWithExtension,
  computeReconciliationOpsWithLocationExtension,
  findExtendableEvent,
  findExtendableLocationEvent,
  canExtendEvent,
  canExtendLocationEvent,
  type ReconciliationEvent,
  type DerivedEvent,
} from "./event-reconciliation";

describe("event-reconciliation", () => {
  describe("computeReconciliationOps", () => {
    // Helper to create a ReconciliationEvent
    const makeExisting = (
      overrides: Partial<ReconciliationEvent> = {},
    ): ReconciliationEvent => ({
      id: `existing-${Math.random().toString(36).slice(2)}`,
      userId: "user-123",
      title: "Existing Event",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: { source: "derived", source_id: `src-${Math.random().toString(36).slice(2)}` },
      lockedAt: null,
      ...overrides,
    });

    // Helper to create a DerivedEvent
    const makeDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `src-${Math.random().toString(36).slice(2)}`,
      title: "Derived Event",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: { source: "derived" },
      ...overrides,
    });

    it("should insert new derived events when no existing events", () => {
      const derived = [makeDerived({ sourceId: "new-event-1" })];
      const ops = computeReconciliationOps([], derived);

      expect(ops.inserts).toHaveLength(1);
      expect(ops.inserts[0].event.sourceId).toBe("new-event-1");
      expect(ops.updates).toHaveLength(0);
      expect(ops.deletes).toHaveLength(0);
      expect(ops.protectedIds).toHaveLength(0);
    });

    it("should not delete locked events", () => {
      const lockedEvent = makeExisting({
        id: "locked-event-1",
        meta: { source: "derived", source_id: "old-source-1" },
        lockedAt: new Date("2026-01-29T09:00:00Z"),
      });

      // No derived events matching this existing event
      const ops = computeReconciliationOps([lockedEvent], []);

      // Locked event should NOT be in deletes
      expect(ops.deletes).toHaveLength(0);
      // Locked event should be in protectedIds
      expect(ops.protectedIds).toContain("locked-event-1");
    });

    it("should delete unlocked derived events that no longer have a match", () => {
      const unlockedEvent = makeExisting({
        id: "unlocked-event-1",
        meta: { source: "derived", source_id: "old-source-1" },
        lockedAt: null,
      });

      // No derived events matching this existing event
      const ops = computeReconciliationOps([unlockedEvent], []);

      // Unlocked derived event SHOULD be deleted
      expect(ops.deletes).toHaveLength(1);
      expect(ops.deletes[0].eventId).toBe("unlocked-event-1");
      expect(ops.protectedIds).toHaveLength(0);
    });

    it("should not modify locked events even when derived events match", () => {
      const sourceId = "matching-source-1";
      const lockedEvent = makeExisting({
        id: "locked-event-1",
        meta: { source: "derived", source_id: sourceId },
        lockedAt: new Date("2026-01-29T09:00:00Z"),
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      // Derived event with same source_id but different times
      const derivedWithNewTimes = makeDerived({
        sourceId,
        scheduledStart: new Date("2026-01-29T10:15:00Z"),
        scheduledEnd: new Date("2026-01-29T10:45:00Z"),
      });

      const ops = computeReconciliationOps([lockedEvent], [derivedWithNewTimes]);

      // No updates should happen because event is locked
      expect(ops.updates).toHaveLength(0);
      expect(ops.inserts).toHaveLength(0);
      expect(ops.deletes).toHaveLength(0);
      // Locked event should be in protectedIds
      expect(ops.protectedIds).toContain("locked-event-1");
    });

    it("should update unlocked events when derived event has new times", () => {
      const sourceId = "matching-source-1";
      const unlockedEvent = makeExisting({
        id: "unlocked-event-1",
        meta: { source: "derived", source_id: sourceId },
        lockedAt: null,
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      // Derived event with same source_id but different times
      const derivedWithNewTimes = makeDerived({
        sourceId,
        scheduledStart: new Date("2026-01-29T10:15:00Z"),
        scheduledEnd: new Date("2026-01-29T10:45:00Z"),
      });

      const ops = computeReconciliationOps(
        [unlockedEvent],
        [derivedWithNewTimes],
      );

      // Update should happen because event is unlocked
      expect(ops.updates).toHaveLength(1);
      expect(ops.updates[0].eventId).toBe("unlocked-event-1");
      expect(ops.updates[0].updates.scheduledStart).toEqual(
        new Date("2026-01-29T10:15:00Z"),
      );
      expect(ops.inserts).toHaveLength(0);
      expect(ops.deletes).toHaveLength(0);
      expect(ops.protectedIds).toHaveLength(0);
    });

    it("should not insert events that overlap with locked events", () => {
      const lockedEvent = makeExisting({
        id: "locked-event-1",
        meta: { source: "derived", source_id: "locked-source" },
        lockedAt: new Date("2026-01-29T09:00:00Z"),
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      // New derived event that overlaps with locked event
      const overlappingDerived = makeDerived({
        sourceId: "new-overlapping-source",
        scheduledStart: new Date("2026-01-29T10:15:00Z"),
        scheduledEnd: new Date("2026-01-29T10:45:00Z"),
      });

      const ops = computeReconciliationOps([lockedEvent], [overlappingDerived]);

      // Should not insert because it overlaps with a locked event
      expect(ops.inserts).toHaveLength(0);
      expect(ops.updates).toHaveLength(0);
      expect(ops.deletes).toHaveLength(0);
    });

    it("should not insert events that overlap with user-edited events", () => {
      const userEvent = makeExisting({
        id: "user-event-1",
        meta: { source: "user", source_id: "user-source" },
        lockedAt: null, // Not locked, but user-edited
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      // New derived event that overlaps with user event
      const overlappingDerived = makeDerived({
        sourceId: "new-overlapping-source",
        scheduledStart: new Date("2026-01-29T10:15:00Z"),
        scheduledEnd: new Date("2026-01-29T10:45:00Z"),
      });

      const ops = computeReconciliationOps([userEvent], [overlappingDerived]);

      // Should not insert because it overlaps with a user-edited event
      expect(ops.inserts).toHaveLength(0);
    });

    it("should not delete user-edited events even if unlocked", () => {
      const userEvent = makeExisting({
        id: "user-event-1",
        meta: { source: "user" }, // User-created event
        lockedAt: null,
      });

      const ops = computeReconciliationOps([userEvent], []);

      // User event should NOT be deleted
      expect(ops.deletes).toHaveLength(0);
    });

    it("should handle multiple events with mixed lock states", () => {
      const lockedEvent = makeExisting({
        id: "locked-1",
        meta: { source: "derived", source_id: "locked-src" },
        lockedAt: new Date("2026-01-29T09:00:00Z"),
        scheduledStart: new Date("2026-01-29T09:00:00Z"),
        scheduledEnd: new Date("2026-01-29T09:30:00Z"),
      });

      const unlockedEvent = makeExisting({
        id: "unlocked-1",
        meta: { source: "derived", source_id: "unlocked-src" },
        lockedAt: null,
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      // No derived events - both should be candidates for deletion
      // But only unlocked should actually be deleted
      const ops = computeReconciliationOps([lockedEvent, unlockedEvent], []);

      expect(ops.deletes).toHaveLength(1);
      expect(ops.deletes[0].eventId).toBe("unlocked-1");
      expect(ops.protectedIds).toContain("locked-1");
    });

    it("should insert non-overlapping events alongside locked events", () => {
      const lockedEvent = makeExisting({
        id: "locked-1",
        meta: { source: "derived", source_id: "locked-src" },
        lockedAt: new Date("2026-01-29T09:00:00Z"),
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      // Non-overlapping derived event
      const nonOverlappingDerived = makeDerived({
        sourceId: "new-non-overlapping",
        scheduledStart: new Date("2026-01-29T11:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:30:00Z"),
      });

      const ops = computeReconciliationOps(
        [lockedEvent],
        [nonOverlappingDerived],
      );

      // Should insert because it doesn't overlap with locked event
      expect(ops.inserts).toHaveLength(1);
      expect(ops.inserts[0].event.sourceId).toBe("new-non-overlapping");
    });

    it("should match events by source_id", () => {
      const sourceId = "same-source-id";
      const existingEvent = makeExisting({
        id: "existing-1",
        meta: { source: "derived", source_id: sourceId },
        lockedAt: null,
      });

      const derivedEvent = makeDerived({
        sourceId,
      });

      const ops = computeReconciliationOps([existingEvent], [derivedEvent]);

      // Should match - no insert, no delete
      expect(ops.inserts).toHaveLength(0);
      expect(ops.deletes).toHaveLength(0);
      // No update needed since times are the same
      expect(ops.updates).toHaveLength(0);
    });

    it("should handle events without source_id in meta", () => {
      const eventWithoutSourceId = makeExisting({
        id: "no-source-id",
        meta: { source: "derived" }, // No source_id
        lockedAt: null,
      });

      const derivedEvent = makeDerived({
        sourceId: "new-source",
      });

      const ops = computeReconciliationOps(
        [eventWithoutSourceId],
        [derivedEvent],
      );

      // Existing event without source_id should be deleted (can't be matched)
      // New derived should be inserted
      expect(ops.deletes).toHaveLength(1);
      expect(ops.deletes[0].eventId).toBe("no-source-id");
      expect(ops.inserts).toHaveLength(1);
    });
  });

  describe("findExtendableEvent", () => {
    // Helper to create a ReconciliationEvent
    const makeExisting = (
      overrides: Partial<ReconciliationEvent> = {},
    ): ReconciliationEvent => ({
      id: `existing-${Math.random().toString(36).slice(2)}`,
      userId: "user-123",
      title: "Existing Event",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: { source: "derived", source_id: `src-${Math.random().toString(36).slice(2)}`, app_id: "com.example.app" },
      lockedAt: null,
      ...overrides,
    });

    it("should find extendable event when same app_id and gap < 60s", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeExisting({
        id: "slack-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"), // Ends exactly at window start
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const result = findExtendableEvent([existingEvent], windowStart, "com.slack.Slack");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("slack-event");
    });

    it("should find extendable event when gap is 30 seconds", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeExisting({
        id: "slack-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:29:30Z"), // 30 seconds before window start
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const result = findExtendableEvent([existingEvent], windowStart, "com.slack.Slack");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("slack-event");
    });

    it("should return null when gap > 60s", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeExisting({
        id: "slack-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:28:59Z"), // 61 seconds before window start
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const result = findExtendableEvent([existingEvent], windowStart, "com.slack.Slack");

      expect(result).toBeNull();
    });

    it("should return null when app_id differs", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeExisting({
        id: "slack-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const result = findExtendableEvent([existingEvent], windowStart, "com.google.Gmail");

      expect(result).toBeNull();
    });

    it("should return the most recent event when multiple candidates exist", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const olderEvent = makeExisting({
        id: "older-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:29:00Z"), // 1 minute before window start
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });
      const newerEvent = makeExisting({
        id: "newer-event",
        scheduledStart: new Date("2026-01-29T10:15:00Z"),
        scheduledEnd: new Date("2026-01-29T10:29:45Z"), // 15 seconds before window start
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const result = findExtendableEvent([olderEvent, newerEvent], windowStart, "com.slack.Slack");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("newer-event");
    });

    it("should return null when no events have app_id", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeExisting({
        id: "no-app-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived" }, // No app_id
      });

      const result = findExtendableEvent([existingEvent], windowStart, "com.slack.Slack");

      expect(result).toBeNull();
    });
  });

  describe("canExtendEvent", () => {
    // Helper to create a ReconciliationEvent
    const makeExisting = (
      overrides: Partial<ReconciliationEvent> = {},
    ): ReconciliationEvent => ({
      id: `existing-${Math.random().toString(36).slice(2)}`,
      userId: "user-123",
      title: "Existing Event",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: { source: "derived", source_id: `src-${Math.random().toString(36).slice(2)}`, app_id: "com.example.app" },
      lockedAt: null,
      ...overrides,
    });

    // Helper to create a DerivedEvent
    const makeDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `src-${Math.random().toString(36).slice(2)}`,
      title: "Derived Event",
      scheduledStart: new Date("2026-01-29T10:30:00Z"),
      scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      meta: { source: "derived", app_id: "com.example.app" },
      ...overrides,
    });

    it("should return true when same app_id and gap is 0", () => {
      const existing = makeExisting({
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { app_id: "com.slack.Slack" },
      });
      const derived = makeDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { app_id: "com.slack.Slack" },
      });

      expect(canExtendEvent(derived, existing)).toBe(true);
    });

    it("should return true when same app_id and gap < 60s", () => {
      const existing = makeExisting({
        scheduledEnd: new Date("2026-01-29T10:29:30Z"),
        meta: { app_id: "com.slack.Slack" },
      });
      const derived = makeDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { app_id: "com.slack.Slack" },
      });

      expect(canExtendEvent(derived, existing)).toBe(true);
    });

    it("should return false when gap > 60s", () => {
      const existing = makeExisting({
        scheduledEnd: new Date("2026-01-29T10:28:59Z"),
        meta: { app_id: "com.slack.Slack" },
      });
      const derived = makeDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { app_id: "com.slack.Slack" },
      });

      expect(canExtendEvent(derived, existing)).toBe(false);
    });

    it("should return false when app_ids differ", () => {
      const existing = makeExisting({
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { app_id: "com.slack.Slack" },
      });
      const derived = makeDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { app_id: "com.google.Gmail" },
      });

      expect(canExtendEvent(derived, existing)).toBe(false);
    });

    it("should return false when derived has no app_id", () => {
      const existing = makeExisting({
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { app_id: "com.slack.Slack" },
      });
      const derived = makeDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived" }, // No app_id
      });

      expect(canExtendEvent(derived, existing)).toBe(false);
    });
  });

  describe("computeReconciliationOpsWithExtension", () => {
    // Helper to create a ReconciliationEvent
    const makeExisting = (
      overrides: Partial<ReconciliationEvent> = {},
    ): ReconciliationEvent => ({
      id: `existing-${Math.random().toString(36).slice(2)}`,
      userId: "user-123",
      title: "Existing Event",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: { source: "derived", source_id: `src-${Math.random().toString(36).slice(2)}`, app_id: "com.example.app" },
      lockedAt: null,
      ...overrides,
    });

    // Helper to create a DerivedEvent
    const makeDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `src-${Math.random().toString(36).slice(2)}`,
      title: "Derived Event",
      scheduledStart: new Date("2026-01-29T10:30:00Z"),
      scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      meta: { source: "derived", app_id: "com.example.app" },
      ...overrides,
    });

    it("continuous session across windows creates extension instead of new event", () => {
      // Window 1: 10:00-10:30 - Slack event ends at 10:30
      const previousWindowEvent = makeExisting({
        id: "slack-window-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", source_id: "slack-session-1", app_id: "com.slack.Slack" },
      });

      // Window 2: 10:30-11:00 - Slack continues
      const newSlackDerived = makeDerived({
        sourceId: "slack-session-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const ops = computeReconciliationOpsWithExtension(
        [], // No existing events in current window
        [newSlackDerived],
        [previousWindowEvent], // Previous window events for extension
      );

      // Should have extension, not insert
      expect(ops.extensions).toHaveLength(1);
      expect(ops.extensions[0].eventId).toBe("slack-window-1");
      expect(ops.extensions[0].newEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
      expect(ops.inserts).toHaveLength(0);
    });

    it("gap > 60s creates separate events", () => {
      // Window 1: 10:00-10:30 - Slack event ends at 10:28:50
      const previousWindowEvent = makeExisting({
        id: "slack-window-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:28:50Z"), // 70 seconds gap
        meta: { source: "derived", source_id: "slack-session-1", app_id: "com.slack.Slack" },
      });

      // Window 2: 10:30-11:00 - Slack starts again
      const newSlackDerived = makeDerived({
        sourceId: "slack-session-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const ops = computeReconciliationOpsWithExtension(
        [],
        [newSlackDerived],
        [previousWindowEvent],
      );

      // Should have insert, not extension (gap > 60s)
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(1);
      expect(ops.inserts[0].event.sourceId).toBe("slack-session-2");
    });

    it("different app creates separate event even with 0 gap", () => {
      // Window 1: 10:00-10:30 - Slack event
      const previousWindowEvent = makeExisting({
        id: "slack-window-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", source_id: "slack-session-1", app_id: "com.slack.Slack" },
      });

      // Window 2: 10:30-11:00 - Gmail starts (different app)
      const newGmailDerived = makeDerived({
        sourceId: "gmail-session-1",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { source: "derived", app_id: "com.google.Gmail" },
      });

      const ops = computeReconciliationOpsWithExtension(
        [],
        [newGmailDerived],
        [previousWindowEvent],
      );

      // Should have insert, not extension (different app)
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(1);
      expect(ops.inserts[0].event.sourceId).toBe("gmail-session-1");
    });

    it("should not extend locked events", () => {
      // Window 1: Locked Slack event
      const previousWindowEvent = makeExisting({
        id: "locked-slack",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", source_id: "slack-session-1", app_id: "com.slack.Slack" },
        lockedAt: new Date("2026-01-29T10:31:00Z"), // Locked
      });

      // Window 2: Slack continues
      const newSlackDerived = makeDerived({
        sourceId: "slack-session-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const ops = computeReconciliationOpsWithExtension(
        [],
        [newSlackDerived],
        [previousWindowEvent],
      );

      // Should create new event, not extend (locked)
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(1);
      expect(ops.protectedIds).toContain("locked-slack");
    });

    it("should handle empty previous window events", () => {
      const newDerived = makeDerived({
        sourceId: "new-event",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const ops = computeReconciliationOpsWithExtension(
        [],
        [newDerived],
        [], // No previous window events
      );

      // Should insert new event
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(1);
    });

    it("should still work with regular reconciliation logic for matched events", () => {
      const sourceId = "matching-source";
      const existingEvent = makeExisting({
        id: "existing-1",
        meta: { source: "derived", source_id: sourceId, app_id: "com.slack.Slack" },
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      });

      const derivedEvent = makeDerived({
        sourceId,
        scheduledStart: new Date("2026-01-29T10:35:00Z"), // Different time
        scheduledEnd: new Date("2026-01-29T11:05:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
      });

      const ops = computeReconciliationOpsWithExtension(
        [existingEvent],
        [derivedEvent],
        [],
      );

      // Should update existing event (matched by source_id)
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(0);
      expect(ops.updates).toHaveLength(1);
      expect(ops.updates[0].eventId).toBe("existing-1");
    });
  });

  // ============================================================================
  // Location Extension Tests (US-010)
  // ============================================================================

  describe("findExtendableLocationEvent", () => {
    // Helper to create a location ReconciliationEvent
    const makeLocationEvent = (
      overrides: Partial<ReconciliationEvent> = {},
    ): ReconciliationEvent => ({
      id: `loc-${Math.random().toString(36).slice(2)}`,
      userId: "user-123",
      title: "At Office",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: {
        source: "derived",
        source_id: `loc-src-${Math.random().toString(36).slice(2)}`,
        kind: "location_block",
        place_id: "place-office-123",
        place_label: "Office",
      },
      lockedAt: null,
      ...overrides,
    });

    it("should find extendable location event when same place_id and gap < 60s", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeLocationEvent({
        id: "office-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"), // Ends exactly at window start
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const result = findExtendableLocationEvent(
        [existingEvent],
        windowStart,
        "place-office-123",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("office-event");
    });

    it("should find extendable location event when gap is 30 seconds", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeLocationEvent({
        id: "office-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:29:30Z"), // 30 seconds before window start
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const result = findExtendableLocationEvent(
        [existingEvent],
        windowStart,
        "place-office-123",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("office-event");
    });

    it("should return null when gap > 60s", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeLocationEvent({
        id: "office-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:28:59Z"), // 61 seconds before window start
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const result = findExtendableLocationEvent(
        [existingEvent],
        windowStart,
        "place-office-123",
      );

      expect(result).toBeNull();
    });

    it("should return null when place_id differs", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeLocationEvent({
        id: "office-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const result = findExtendableLocationEvent(
        [existingEvent],
        windowStart,
        "place-home-456", // Different place
      );

      expect(result).toBeNull();
    });

    it("should match null place_id for unknown locations", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const existingEvent = makeLocationEvent({
        id: "unknown-location-event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: null, // Unknown location
          place_label: null,
        },
      });

      const result = findExtendableLocationEvent(
        [existingEvent],
        windowStart,
        null, // Also unknown location
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("unknown-location-event");
    });

    it("should return the most recent event when multiple candidates exist", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const olderEvent = makeLocationEvent({
        id: "older-office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:29:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });
      const newerEvent = makeLocationEvent({
        id: "newer-office",
        scheduledStart: new Date("2026-01-29T10:15:00Z"),
        scheduledEnd: new Date("2026-01-29T10:29:45Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const result = findExtendableLocationEvent(
        [olderEvent, newerEvent],
        windowStart,
        "place-office-123",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("newer-office");
    });

    it("should not match non-location events", () => {
      const windowStart = new Date("2026-01-29T10:30:00Z");
      const screenTimeEvent: ReconciliationEvent = {
        id: "screen-time-event",
        userId: "user-123",
        title: "Slack",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          app_id: "com.slack.Slack", // Screen-time event, not location
        },
        lockedAt: null,
      };

      const result = findExtendableLocationEvent(
        [screenTimeEvent],
        windowStart,
        "place-office-123",
      );

      expect(result).toBeNull();
    });
  });

  describe("canExtendLocationEvent", () => {
    // Helper to create a location ReconciliationEvent
    const makeLocationEvent = (
      overrides: Partial<ReconciliationEvent> = {},
    ): ReconciliationEvent => ({
      id: `loc-${Math.random().toString(36).slice(2)}`,
      userId: "user-123",
      title: "At Office",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: {
        source: "derived",
        source_id: `loc-src-${Math.random().toString(36).slice(2)}`,
        kind: "location_block",
        place_id: "place-office-123",
        place_label: "Office",
      },
      lockedAt: null,
      ...overrides,
    });

    // Helper to create a location DerivedEvent
    const makeLocationDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `loc-src-${Math.random().toString(36).slice(2)}`,
      title: "At Office",
      scheduledStart: new Date("2026-01-29T10:30:00Z"),
      scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      meta: {
        source: "derived",
        kind: "location_block",
        place_id: "place-office-123",
        place_label: "Office",
      },
      ...overrides,
    });

    it("should return true when same place_id and gap is 0", () => {
      const existing = makeLocationEvent({
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });
      const derived = makeLocationDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });

      expect(canExtendLocationEvent(derived, existing)).toBe(true);
    });

    it("should return true when same place_id and gap < 60s", () => {
      const existing = makeLocationEvent({
        scheduledEnd: new Date("2026-01-29T10:29:30Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });
      const derived = makeLocationDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });

      expect(canExtendLocationEvent(derived, existing)).toBe(true);
    });

    it("should return false when gap > 60s", () => {
      const existing = makeLocationEvent({
        scheduledEnd: new Date("2026-01-29T10:28:59Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });
      const derived = makeLocationDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });

      expect(canExtendLocationEvent(derived, existing)).toBe(false);
    });

    it("should return false when place_ids differ", () => {
      const existing = makeLocationEvent({
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });
      const derived = makeLocationDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: "place-home-456" },
      });

      expect(canExtendLocationEvent(derived, existing)).toBe(false);
    });

    it("should return true when both have null place_id (unknown locations)", () => {
      const existing = makeLocationEvent({
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: null },
      });
      const derived = makeLocationDerived({
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: null },
      });

      expect(canExtendLocationEvent(derived, existing)).toBe(true);
    });

    it("should return false when derived is not a location event", () => {
      const existing = makeLocationEvent({
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block", place_id: "place-office-123" },
      });
      const derived: DerivedEvent = {
        sourceId: "screen-time-src",
        title: "Slack",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" }, // Not a location event
      };

      expect(canExtendLocationEvent(derived, existing)).toBe(false);
    });
  });

  describe("computeReconciliationOpsWithLocationExtension", () => {
    // Helper to create a location ReconciliationEvent
    const makeLocationEvent = (
      overrides: Partial<ReconciliationEvent> = {},
    ): ReconciliationEvent => ({
      id: `loc-${Math.random().toString(36).slice(2)}`,
      userId: "user-123",
      title: "At Office",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: {
        source: "derived",
        source_id: `loc-src-${Math.random().toString(36).slice(2)}`,
        kind: "location_block",
        place_id: "place-office-123",
        place_label: "Office",
      },
      lockedAt: null,
      ...overrides,
    });

    // Helper to create a location DerivedEvent
    const makeLocationDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `loc-src-${Math.random().toString(36).slice(2)}`,
      title: "At Office",
      scheduledStart: new Date("2026-01-29T10:30:00Z"),
      scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      meta: {
        source: "derived",
        kind: "location_block",
        place_id: "place-office-123",
        place_label: "Office",
      },
      ...overrides,
    });

    it("staying at office across windows creates one 'At Office' event (extension)", () => {
      // Window 1: 10:00-10:30 - At Office
      const previousWindowEvent = makeLocationEvent({
        id: "office-window-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          source_id: "office-session-1",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      // Window 2: 10:30-11:00 - Still at Office
      const newOfficeDerived = makeLocationDerived({
        sourceId: "office-session-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const ops = computeReconciliationOpsWithLocationExtension(
        [], // No existing events in current window
        [newOfficeDerived],
        [previousWindowEvent], // Previous window events for extension
      );

      // Should have extension, not insert
      expect(ops.extensions).toHaveLength(1);
      expect(ops.extensions[0].eventId).toBe("office-window-1");
      expect(ops.extensions[0].newEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
      expect(ops.inserts).toHaveLength(0);
    });

    it("different place creates separate event even with 0 gap", () => {
      // Window 1: 10:00-10:30 - At Office
      const previousWindowEvent = makeLocationEvent({
        id: "office-window-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          source_id: "office-session-1",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      // Window 2: 10:30-11:00 - At Home (different place)
      const newHomeDerived = makeLocationDerived({
        sourceId: "home-session-1",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-home-456",
          place_label: "Home",
        },
      });

      const ops = computeReconciliationOpsWithLocationExtension(
        [],
        [newHomeDerived],
        [previousWindowEvent],
      );

      // Should have insert, not extension (different place)
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(1);
      expect(ops.inserts[0].event.sourceId).toBe("home-session-1");
    });

    it("gap > 60s creates separate events", () => {
      // Window 1: Office ends at 10:28:50 (70 seconds gap)
      const previousWindowEvent = makeLocationEvent({
        id: "office-window-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:28:50Z"),
        meta: {
          source: "derived",
          source_id: "office-session-1",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      // Window 2: Office continues at 10:30
      const newOfficeDerived = makeLocationDerived({
        sourceId: "office-session-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const ops = computeReconciliationOpsWithLocationExtension(
        [],
        [newOfficeDerived],
        [previousWindowEvent],
      );

      // Should have insert, not extension (gap > 60s)
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(1);
    });

    it("should not extend locked location events", () => {
      // Window 1: Locked Office event
      const previousWindowEvent = makeLocationEvent({
        id: "locked-office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          source_id: "office-session-1",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
        lockedAt: new Date("2026-01-29T10:31:00Z"), // Locked
      });

      // Window 2: Office continues
      const newOfficeDerived = makeLocationDerived({
        sourceId: "office-session-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const ops = computeReconciliationOpsWithLocationExtension(
        [],
        [newOfficeDerived],
        [previousWindowEvent],
      );

      // Should create new event, not extend (locked)
      expect(ops.extensions).toHaveLength(0);
      expect(ops.inserts).toHaveLength(1);
      expect(ops.protectedIds).toContain("locked-office");
    });

    it("unknown locations (null place_id) can be extended", () => {
      // Window 1: Unknown location
      const previousWindowEvent = makeLocationEvent({
        id: "unknown-window-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          source_id: "unknown-session-1",
          kind: "location_block",
          place_id: null,
          place_label: null,
        },
      });

      // Window 2: Still unknown location
      const newUnknownDerived = makeLocationDerived({
        sourceId: "unknown-session-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: null,
          place_label: null,
        },
      });

      const ops = computeReconciliationOpsWithLocationExtension(
        [],
        [newUnknownDerived],
        [previousWindowEvent],
      );

      // Should have extension for unknown -> unknown
      expect(ops.extensions).toHaveLength(1);
      expect(ops.extensions[0].eventId).toBe("unknown-window-1");
      expect(ops.inserts).toHaveLength(0);
    });

    it("should handle mixed location and screen-time events", () => {
      // Previous window has both location and screen-time events
      const prevLocationEvent = makeLocationEvent({
        id: "office-location",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          source_id: "office-loc-1",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const prevScreenTimeEvent: ReconciliationEvent = {
        id: "slack-event",
        userId: "user-123",
        title: "Slack",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          source_id: "slack-1",
          app_id: "com.slack.Slack",
        },
        lockedAt: null,
      };

      // Current window continues both
      const newLocationDerived = makeLocationDerived({
        sourceId: "office-loc-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: {
          source: "derived",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const newScreenTimeDerived: DerivedEvent = {
        sourceId: "slack-2",
        title: "Slack",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: {
          source: "derived",
          app_id: "com.slack.Slack",
        },
      };

      const ops = computeReconciliationOpsWithLocationExtension(
        [],
        [newLocationDerived, newScreenTimeDerived],
        [prevLocationEvent, prevScreenTimeEvent],
      );

      // Should have extensions for both location and screen-time
      expect(ops.extensions).toHaveLength(2);
      const extensionIds = ops.extensions.map((e) => e.eventId);
      expect(extensionIds).toContain("office-location");
      expect(extensionIds).toContain("slack-event");
      expect(ops.inserts).toHaveLength(0);
    });
  });
});
