import {
  computeReconciliationOps,
  computeReconciliationOpsWithExtension,
  computeReconciliationOpsWithLocationExtension,
  computeReconciliationOpsWithPriority,
  findExtendableEvent,
  findExtendableLocationEvent,
  canExtendEvent,
  canExtendLocationEvent,
  getEventPriority,
  getDerivedEventPriority,
  trimEventToGaps,
  type ReconciliationEvent,
  type DerivedEvent,
  type EventPriority,
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

  // ============================================================================
  // Priority-Based Reconciliation Tests (US-011)
  // ============================================================================

  describe("getEventPriority", () => {
    it("should return 'protected' for locked events", () => {
      const lockedEvent: ReconciliationEvent = {
        id: "locked-1",
        userId: "user-123",
        title: "Locked Event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived" },
        lockedAt: new Date("2026-01-29T09:00:00Z"),
      };

      expect(getEventPriority(lockedEvent)).toBe("protected");
    });

    it("should return 'protected' for user-edited events", () => {
      const userEvent: ReconciliationEvent = {
        id: "user-1",
        userId: "user-123",
        title: "User Event",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "user" },
        lockedAt: null,
      };

      expect(getEventPriority(userEvent)).toBe("protected");
    });

    it("should return 'screen_time' for events with app_id", () => {
      const screenTimeEvent: ReconciliationEvent = {
        id: "st-1",
        userId: "user-123",
        title: "Slack",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
        lockedAt: null,
      };

      expect(getEventPriority(screenTimeEvent)).toBe("screen_time");
    });

    it("should return 'location' for location_block events", () => {
      const locationEvent: ReconciliationEvent = {
        id: "loc-1",
        userId: "user-123",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", kind: "location_block", place_id: "office" },
        lockedAt: null,
      };

      expect(getEventPriority(locationEvent)).toBe("location");
    });

    it("should return 'location' for commute events", () => {
      const commuteEvent: ReconciliationEvent = {
        id: "commute-1",
        userId: "user-123",
        title: "Commute",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", kind: "commute", intent: "commute" },
        lockedAt: null,
      };

      expect(getEventPriority(commuteEvent)).toBe("location");
    });

    it("should return 'unknown' for events without app_id or kind", () => {
      const unknownEvent: ReconciliationEvent = {
        id: "unknown-1",
        userId: "user-123",
        title: "Unknown",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived" },
        lockedAt: null,
      };

      expect(getEventPriority(unknownEvent)).toBe("unknown");
    });
  });

  describe("getDerivedEventPriority", () => {
    it("should return 'screen_time' for derived events with app_id", () => {
      const derived: DerivedEvent = {
        sourceId: "st-1",
        title: "Slack",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", app_id: "com.slack.Slack" },
      };

      expect(getDerivedEventPriority(derived)).toBe("screen_time");
    });

    it("should return 'location' for derived location events", () => {
      const derived: DerivedEvent = {
        sourceId: "loc-1",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", kind: "location_block", place_id: "office" },
      };

      expect(getDerivedEventPriority(derived)).toBe("location");
    });
  });

  describe("trimEventToGaps", () => {
    it("should return event unchanged when no higher priority events", () => {
      const event: DerivedEvent = {
        sourceId: "loc-1",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { kind: "location_block" },
      };

      const result = trimEventToGaps(event, []);

      expect(result).toHaveLength(1);
      expect(result[0].scheduledStart).toEqual(event.scheduledStart);
      expect(result[0].scheduledEnd).toEqual(event.scheduledEnd);
    });

    it("should return empty when event is completely covered", () => {
      const event: DerivedEvent = {
        sourceId: "loc-1",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { kind: "location_block" },
      };

      const higherPriority = [
        {
          start: new Date("2026-01-29T09:55:00Z"),
          end: new Date("2026-01-29T10:35:00Z"),
        },
      ];

      const result = trimEventToGaps(event, higherPriority);

      expect(result).toHaveLength(0);
    });

    it("should trim event to fill gap before higher priority", () => {
      const event: DerivedEvent = {
        sourceId: "loc-1",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { kind: "location_block" },
      };

      const higherPriority = [
        {
          start: new Date("2026-01-29T10:30:00Z"),
          end: new Date("2026-01-29T11:00:00Z"),
        },
      ];

      const result = trimEventToGaps(event, higherPriority);

      expect(result).toHaveLength(1);
      expect(result[0].scheduledStart).toEqual(new Date("2026-01-29T10:00:00Z"));
      expect(result[0].scheduledEnd).toEqual(new Date("2026-01-29T10:30:00Z"));
    });

    it("should trim event to fill gap after higher priority", () => {
      const event: DerivedEvent = {
        sourceId: "loc-1",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { kind: "location_block" },
      };

      const higherPriority = [
        {
          start: new Date("2026-01-29T10:00:00Z"),
          end: new Date("2026-01-29T10:30:00Z"),
        },
      ];

      const result = trimEventToGaps(event, higherPriority);

      expect(result).toHaveLength(1);
      expect(result[0].scheduledStart).toEqual(new Date("2026-01-29T10:30:00Z"));
      expect(result[0].scheduledEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
    });

    it("should split event around higher priority in the middle", () => {
      const event: DerivedEvent = {
        sourceId: "loc-1",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { kind: "location_block" },
      };

      const higherPriority = [
        {
          start: new Date("2026-01-29T10:20:00Z"),
          end: new Date("2026-01-29T10:40:00Z"),
        },
      ];

      const result = trimEventToGaps(event, higherPriority);

      expect(result).toHaveLength(2);
      // First segment: 10:00 - 10:20
      expect(result[0].scheduledStart).toEqual(new Date("2026-01-29T10:00:00Z"));
      expect(result[0].scheduledEnd).toEqual(new Date("2026-01-29T10:20:00Z"));
      expect(result[0].sourceId).toBe("loc-1:0");
      // Second segment: 10:40 - 11:00
      expect(result[1].scheduledStart).toEqual(new Date("2026-01-29T10:40:00Z"));
      expect(result[1].scheduledEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
      expect(result[1].sourceId).toBe("loc-1:1");
    });

    it("should handle multiple higher priority events", () => {
      const event: DerivedEvent = {
        sourceId: "loc-1",
        title: "At Office",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
        meta: { kind: "location_block" },
      };

      const higherPriority = [
        {
          start: new Date("2026-01-29T10:10:00Z"),
          end: new Date("2026-01-29T10:20:00Z"),
        },
        {
          start: new Date("2026-01-29T10:40:00Z"),
          end: new Date("2026-01-29T10:50:00Z"),
        },
      ];

      const result = trimEventToGaps(event, higherPriority);

      expect(result).toHaveLength(3);
      // Gap 1: 10:00 - 10:10
      expect(result[0].scheduledStart).toEqual(new Date("2026-01-29T10:00:00Z"));
      expect(result[0].scheduledEnd).toEqual(new Date("2026-01-29T10:10:00Z"));
      // Gap 2: 10:20 - 10:40
      expect(result[1].scheduledStart).toEqual(new Date("2026-01-29T10:20:00Z"));
      expect(result[1].scheduledEnd).toEqual(new Date("2026-01-29T10:40:00Z"));
      // Gap 3: 10:50 - 11:00
      expect(result[2].scheduledStart).toEqual(new Date("2026-01-29T10:50:00Z"));
      expect(result[2].scheduledEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
    });
  });

  describe("computeReconciliationOpsWithPriority", () => {
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

    // Helper to create a screen-time DerivedEvent
    const makeScreenTimeDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `st-${Math.random().toString(36).slice(2)}`,
      title: "Slack",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: { source: "derived", app_id: "com.slack.Slack" },
      ...overrides,
    });

    // Helper to create a location DerivedEvent
    const makeLocationDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `loc-${Math.random().toString(36).slice(2)}`,
      title: "At Office",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: {
        source: "derived",
        kind: "location_block",
        place_id: "place-office-123",
        place_label: "Office",
      },
      ...overrides,
    });

    // Helper to create a commute DerivedEvent
    const makeCommuteDerived = (
      overrides: Partial<DerivedEvent> = {},
    ): DerivedEvent => ({
      sourceId: `commute-${Math.random().toString(36).slice(2)}`,
      title: "Commute",
      scheduledStart: new Date("2026-01-29T10:00:00Z"),
      scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      meta: {
        source: "derived",
        kind: "commute",
        intent: "commute",
      },
      ...overrides,
    });

    it("should insert both screen-time and location when no overlap", () => {
      const screenTimeEvent = makeScreenTimeDerived({
        sourceId: "st-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      const locationEvent = makeLocationDerived({
        sourceId: "loc-1",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [screenTimeEvent],
        [locationEvent],
        [],
      );

      expect(ops.inserts).toHaveLength(2);
      const sourceIds = ops.inserts.map((i) => i.event.sourceId);
      expect(sourceIds).toContain("st-1");
      expect(sourceIds).toContain("loc-1");
    });

    it("screen-time takes precedence over location (location fills gaps)", () => {
      const screenTimeEvent = makeScreenTimeDerived({
        sourceId: "st-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      const locationEvent = makeLocationDerived({
        sourceId: "loc-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"), // Overlaps screen-time
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [screenTimeEvent],
        [locationEvent],
        [],
      );

      // Screen-time should be fully inserted
      const screenTimeInsert = ops.inserts.find((i) => i.event.sourceId === "st-1");
      expect(screenTimeInsert).toBeDefined();

      // Location should be trimmed to fill gap after screen-time (10:30-11:00)
      const locationInsert = ops.inserts.find((i) =>
        i.event.sourceId.startsWith("loc-1"),
      );
      expect(locationInsert).toBeDefined();
      expect(locationInsert!.event.scheduledStart).toEqual(new Date("2026-01-29T10:30:00Z"));
      expect(locationInsert!.event.scheduledEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
    });

    it("protected events block both screen-time and location", () => {
      const protectedEvent = makeExisting({
        id: "protected-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        lockedAt: new Date("2026-01-29T09:00:00Z"),
      });

      const screenTimeEvent = makeScreenTimeDerived({
        sourceId: "st-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      const locationEvent = makeLocationDerived({
        sourceId: "loc-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [protectedEvent],
        [screenTimeEvent],
        [locationEvent],
        [],
      );

      // Nothing should be inserted due to protected overlap
      expect(ops.inserts).toHaveLength(0);
      expect(ops.protectedIds).toContain("protected-1");
    });

    it("commute and screen-time can coexist (screen-time inside commute)", () => {
      const screenTimeEvent = makeScreenTimeDerived({
        sourceId: "st-1",
        scheduledStart: new Date("2026-01-29T10:10:00Z"),
        scheduledEnd: new Date("2026-01-29T10:20:00Z"),
        meta: { source: "derived", app_id: "com.spotify.client" },
      });

      const commuteEvent = makeCommuteDerived({
        sourceId: "commute-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [screenTimeEvent],
        [commuteEvent],
        [],
      );

      // Both should be inserted - commute is kept as-is (not trimmed)
      expect(ops.inserts).toHaveLength(2);
      const sourceIds = ops.inserts.map((i) => i.event.sourceId);
      expect(sourceIds).toContain("st-1");
      expect(sourceIds).toContain("commute-1");

      // Commute should be full duration
      const commuteInsert = ops.inserts.find((i) => i.event.sourceId === "commute-1");
      expect(commuteInsert!.event.scheduledStart).toEqual(new Date("2026-01-29T10:00:00Z"));
      expect(commuteInsert!.event.scheduledEnd).toEqual(new Date("2026-01-29T10:30:00Z"));
    });

    it("location block fills gaps between multiple screen-time events", () => {
      const screenTime1 = makeScreenTimeDerived({
        sourceId: "st-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:15:00Z"),
      });

      const screenTime2 = makeScreenTimeDerived({
        sourceId: "st-2",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T10:45:00Z"),
        meta: { source: "derived", app_id: "com.google.Gmail" },
      });

      const locationEvent = makeLocationDerived({
        sourceId: "loc-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [screenTime1, screenTime2],
        [locationEvent],
        [],
      );

      // Both screen-time events inserted
      expect(ops.inserts.filter((i) => i.event.sourceId.startsWith("st-"))).toHaveLength(2);

      // Location should be split into 2 gaps: 10:15-10:30 and 10:45-11:00
      const locationInserts = ops.inserts.filter((i) =>
        i.event.sourceId.startsWith("loc-1"),
      );
      expect(locationInserts).toHaveLength(2);

      // First gap: 10:15-10:30
      const gap1 = locationInserts.find(
        (i) => i.event.scheduledStart.getTime() === new Date("2026-01-29T10:15:00Z").getTime(),
      );
      expect(gap1).toBeDefined();
      expect(gap1!.event.scheduledEnd).toEqual(new Date("2026-01-29T10:30:00Z"));

      // Second gap: 10:45-11:00
      const gap2 = locationInserts.find(
        (i) => i.event.scheduledStart.getTime() === new Date("2026-01-29T10:45:00Z").getTime(),
      );
      expect(gap2).toBeDefined();
      expect(gap2!.event.scheduledEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
    });

    it("should extend screen-time events from previous window", () => {
      const previousScreenTime = makeExisting({
        id: "prev-st-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: { source: "derived", source_id: "st-old", app_id: "com.slack.Slack" },
      });

      const currentScreenTime = makeScreenTimeDerived({
        sourceId: "st-new",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [currentScreenTime],
        [],
        [previousScreenTime],
      );

      // Should extend the previous event, not create new
      expect(ops.extensions).toHaveLength(1);
      expect(ops.extensions[0].eventId).toBe("prev-st-1");
      expect(ops.extensions[0].newEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
      expect(ops.inserts).toHaveLength(0);
    });

    it("should extend location events from previous window", () => {
      const previousLocation = makeExisting({
        id: "prev-loc-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
        meta: {
          source: "derived",
          source_id: "loc-old",
          kind: "location_block",
          place_id: "place-office-123",
          place_label: "Office",
        },
      });

      const currentLocation = makeLocationDerived({
        sourceId: "loc-new",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [],
        [currentLocation],
        [previousLocation],
      );

      // Should extend the previous event, not create new
      expect(ops.extensions).toHaveLength(1);
      expect(ops.extensions[0].eventId).toBe("prev-loc-1");
      expect(ops.extensions[0].newEnd).toEqual(new Date("2026-01-29T11:00:00Z"));
      expect(ops.inserts).toHaveLength(0);
    });

    it("should delete orphaned derived events", () => {
      const orphanedEvent = makeExisting({
        id: "orphan-1",
        meta: { source: "derived", source_id: "old-source" },
      });

      const ops = computeReconciliationOpsWithPriority(
        [orphanedEvent],
        [],
        [],
        [],
      );

      // Orphaned derived event should be deleted
      expect(ops.deletes).toHaveLength(1);
      expect(ops.deletes[0].eventId).toBe("orphan-1");
    });

    it("should not delete locked orphaned events", () => {
      const lockedOrphan = makeExisting({
        id: "locked-orphan",
        meta: { source: "derived", source_id: "old-source" },
        lockedAt: new Date("2026-01-29T09:00:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [lockedOrphan],
        [],
        [],
        [],
      );

      // Locked event should NOT be deleted
      expect(ops.deletes).toHaveLength(0);
      expect(ops.protectedIds).toContain("locked-orphan");
    });

    it("short location gaps (< 1 min) are not inserted", () => {
      const screenTimeEvent = makeScreenTimeDerived({
        sourceId: "st-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:29:30Z"), // Ends 30s before location ends
      });

      const locationEvent = makeLocationDerived({
        sourceId: "loc-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"), // Only 30s gap at end
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [screenTimeEvent],
        [locationEvent],
        [],
      );

      // Screen-time inserted
      expect(ops.inserts.some((i) => i.event.sourceId === "st-1")).toBe(true);

      // Location gap is < 1 min, should NOT be inserted
      expect(ops.inserts.some((i) => i.event.sourceId.startsWith("loc-1"))).toBe(false);
    });

    it("handles mixed screen-time, location, and commute events together", () => {
      const screenTimeEvent = makeScreenTimeDerived({
        sourceId: "st-1",
        scheduledStart: new Date("2026-01-29T10:15:00Z"),
        scheduledEnd: new Date("2026-01-29T10:25:00Z"),
        meta: { source: "derived", app_id: "com.spotify.client" },
      });

      const commuteEvent = makeCommuteDerived({
        sourceId: "commute-1",
        scheduledStart: new Date("2026-01-29T10:00:00Z"),
        scheduledEnd: new Date("2026-01-29T10:30:00Z"),
      });

      const locationEvent = makeLocationDerived({
        sourceId: "loc-1",
        scheduledStart: new Date("2026-01-29T10:30:00Z"),
        scheduledEnd: new Date("2026-01-29T11:00:00Z"),
      });

      const ops = computeReconciliationOpsWithPriority(
        [],
        [screenTimeEvent],
        [commuteEvent, locationEvent],
        [],
      );

      // All three should be inserted
      expect(ops.inserts).toHaveLength(3);
      const sourceIds = ops.inserts.map((i) => i.event.sourceId);
      expect(sourceIds).toContain("st-1");
      expect(sourceIds).toContain("commute-1");
      expect(sourceIds).toContain("loc-1");
    });
  });
});
