import {
  computeReconciliationOps,
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
});
