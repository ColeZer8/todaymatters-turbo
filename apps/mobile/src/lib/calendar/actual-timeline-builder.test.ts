/**
 * Unit tests for ActualTimelineBuilder
 *
 * Tests the overlap elimination algorithm to ensure:
 * 1. Two overlapping events result in split/non-overlapping output
 * 2. Priority order is respected when splitting
 * 3. Edge cases are handled (exact same time, partial overlap, contained event)
 */

import {
  ActualTimelineBuilder,
  buildNonOverlappingTimeline,
  getEventPriority,
  EventPriority,
} from './actual-timeline-builder';
import type { ScheduledEvent, CalendarEventMeta } from '@/stores';

/**
 * Helper function to create a test event with minimal required fields
 */
function createTestEvent(
  id: string,
  startMinutes: number,
  duration: number,
  meta?: Partial<CalendarEventMeta>
): ScheduledEvent {
  return {
    id,
    title: `Event ${id}`,
    description: '',
    startMinutes,
    duration,
    category: 'work',
    meta: meta as CalendarEventMeta,
  };
}

/**
 * Helper function to check if any two events overlap
 */
function hasOverlaps(events: ScheduledEvent[]): boolean {
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      const aEnd = a.startMinutes + a.duration;
      const bEnd = b.startMinutes + b.duration;

      // Check if intervals overlap
      const overlapStart = Math.max(a.startMinutes, b.startMinutes);
      const overlapEnd = Math.min(aEnd, bEnd);
      if (overlapEnd > overlapStart) {
        return true;
      }
    }
  }
  return false;
}

describe('ActualTimelineBuilder', () => {
  describe('getEventPriority', () => {
    it('should assign UserEdited priority (1) to user-sourced events', () => {
      const event = createTestEvent('1', 0, 60, { source: 'user' });
      expect(getEventPriority(event)).toBe(EventPriority.UserEdited);
    });

    it('should assign UserEdited priority (1) to actual_adjust events', () => {
      const event = createTestEvent('1', 0, 60, { source: 'actual_adjust' as any });
      expect(getEventPriority(event)).toBe(EventPriority.UserEdited);
    });

    it('should assign Unknown priority (5) to unknown_gap events', () => {
      const event = createTestEvent('1', 0, 60, { kind: 'unknown_gap' });
      expect(getEventPriority(event)).toBe(EventPriority.Unknown);
    });

    it('should assign Unknown priority (5) to pattern_gap events', () => {
      const event = createTestEvent('1', 0, 60, { kind: 'pattern_gap' });
      expect(getEventPriority(event)).toBe(EventPriority.Unknown);
    });

    it('should assign ScreenTime priority (4) to screen_time events', () => {
      const event = createTestEvent('1', 0, 60, { kind: 'screen_time' });
      expect(getEventPriority(event)).toBe(EventPriority.ScreenTime);
    });

    it('should assign DerivedEvidence priority (3) to evidence events', () => {
      const event = createTestEvent('1', 0, 60, { source: 'evidence' });
      expect(getEventPriority(event)).toBe(EventPriority.DerivedEvidence);
    });

    it('should assign DerivedEvidence priority (3) to sleep_schedule events', () => {
      const event = createTestEvent('1', 0, 60, { kind: 'sleep_schedule' });
      expect(getEventPriority(event)).toBe(EventPriority.DerivedEvidence);
    });

    it('should assign SupabaseActual priority (2) to system events', () => {
      const event = createTestEvent('1', 0, 60, { source: 'system' });
      expect(getEventPriority(event)).toBe(EventPriority.SupabaseActual);
    });

    it('should assign SupabaseActual priority (2) to events without source', () => {
      const event = createTestEvent('1', 0, 60);
      expect(getEventPriority(event)).toBe(EventPriority.SupabaseActual);
    });

    it('should assign DerivedEvidence priority (3) to events with derived ID prefix', () => {
      const event = createTestEvent('derived_actual:test:0:60:app', 0, 60);
      expect(getEventPriority(event)).toBe(EventPriority.DerivedEvidence);
    });

    it('should assign DerivedEvidence priority (3) to events with st: ID prefix', () => {
      const event = createTestEvent('st:screen_time:0:60:app', 0, 60);
      expect(getEventPriority(event)).toBe(EventPriority.DerivedEvidence);
    });
  });

  describe('Two overlapping events result in split/non-overlapping output', () => {
    it('should not modify non-overlapping events', () => {
      const builder = new ActualTimelineBuilder();

      // Event A: 9:00 - 10:00
      const eventA = createTestEvent('A', 9 * 60, 60, { source: 'system' });
      // Event B: 10:00 - 11:00
      const eventB = createTestEvent('B', 10 * 60, 60, { source: 'system' });

      builder.addEvent(eventA);
      builder.addEvent(eventB);

      const result = builder.build();

      expect(result).toHaveLength(2);
      expect(hasOverlaps(result)).toBe(false);
    });

    it('should split lower-priority event when two events overlap', () => {
      const builder = new ActualTimelineBuilder();

      // Lower priority event first: 9:00 - 11:00 (screen_time = priority 4)
      const lowPriority = createTestEvent('low', 9 * 60, 120, { kind: 'screen_time' });
      // Higher priority event: 9:30 - 10:30 (user = priority 1)
      const highPriority = createTestEvent('high', 9 * 60 + 30, 60, { source: 'user' });

      builder.addEvent(lowPriority);
      builder.addEvent(highPriority);

      const result = builder.build();

      // Should have: low split (9:00-9:30), high (9:30-10:30), low split (10:30-11:00)
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(hasOverlaps(result)).toBe(false);

      // Find the high priority event - it should be intact
      const highResult = result.find((e) => e.title === 'Event high');
      expect(highResult).toBeDefined();
      expect(highResult!.startMinutes).toBe(9 * 60 + 30);
      expect(highResult!.duration).toBe(60);
    });

    it('should split higher-priority event when added after lower-priority', () => {
      const builder = new ActualTimelineBuilder();

      // Higher priority event first: 9:30 - 10:30 (user = priority 1)
      const highPriority = createTestEvent('high', 9 * 60 + 30, 60, { source: 'user' });
      // Lower priority event: 9:00 - 11:00 (screen_time = priority 4)
      const lowPriority = createTestEvent('low', 9 * 60, 120, { kind: 'screen_time' });

      builder.addEvent(highPriority);
      builder.addEvent(lowPriority);

      const result = builder.build();

      // Should have non-overlapping result
      expect(hasOverlaps(result)).toBe(false);

      // High priority event should be intact
      const highResult = result.find((e) => e.title === 'Event high');
      expect(highResult).toBeDefined();
      expect(highResult!.startMinutes).toBe(9 * 60 + 30);
      expect(highResult!.duration).toBe(60);
    });

    it('should produce non-overlapping timeline via buildNonOverlappingTimeline', () => {
      // Event A: 9:00 - 10:00 (evidence)
      const eventA = createTestEvent('A', 9 * 60, 60, { source: 'evidence' });
      // Event B: 9:30 - 10:30 (user - higher priority)
      const eventB = createTestEvent('B', 9 * 60 + 30, 60, { source: 'user' });
      // Event C: 10:00 - 11:00 (screen_time - lower priority)
      const eventC = createTestEvent('C', 10 * 60, 60, { kind: 'screen_time' });

      const result = buildNonOverlappingTimeline([eventA, eventB, eventC]);

      expect(hasOverlaps(result)).toBe(false);
    });
  });

  describe('Priority order is respected when splitting', () => {
    it('should preserve UserEdited events over all others', () => {
      const builder = new ActualTimelineBuilder();

      // Add events in mixed order with overlaps
      // User event: 10:00 - 11:00 (priority 1)
      const userEvent = createTestEvent('user', 10 * 60, 60, { source: 'user' });
      // System event: 9:30 - 10:30 (priority 2)
      const systemEvent = createTestEvent('system', 9 * 60 + 30, 60, { source: 'system' });
      // Screen time: 9:00 - 12:00 (priority 4)
      const screenEvent = createTestEvent('screen', 9 * 60, 180, { kind: 'screen_time' });

      builder.addEvents([screenEvent, systemEvent, userEvent]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // User event should be intact
      const userResult = result.find((e) => e.title === 'Event user');
      expect(userResult).toBeDefined();
      expect(userResult!.startMinutes).toBe(10 * 60);
      expect(userResult!.duration).toBe(60);
    });

    it('should preserve SupabaseActual over DerivedEvidence', () => {
      const builder = new ActualTimelineBuilder();

      // System event: 10:00 - 11:00 (priority 2)
      const systemEvent = createTestEvent('system', 10 * 60, 60, { source: 'system' });
      // Evidence event: 9:30 - 10:30 (priority 3)
      const evidenceEvent = createTestEvent('evidence', 9 * 60 + 30, 60, { source: 'evidence' });

      builder.addEvents([evidenceEvent, systemEvent]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // System event should be intact
      const systemResult = result.find((e) => e.title === 'Event system');
      expect(systemResult).toBeDefined();
      expect(systemResult!.startMinutes).toBe(10 * 60);
      expect(systemResult!.duration).toBe(60);
    });

    it('should preserve DerivedEvidence over ScreenTime', () => {
      const builder = new ActualTimelineBuilder();

      // Evidence event: 10:00 - 11:00 (priority 3)
      const evidenceEvent = createTestEvent('evidence', 10 * 60, 60, { kind: 'sleep_schedule' });
      // Screen time: 9:30 - 10:30 (priority 4)
      const screenEvent = createTestEvent('screen', 9 * 60 + 30, 60, { kind: 'screen_time' });

      builder.addEvents([screenEvent, evidenceEvent]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Evidence event should be intact
      const evidenceResult = result.find((e) => e.title === 'Event evidence');
      expect(evidenceResult).toBeDefined();
      expect(evidenceResult!.startMinutes).toBe(10 * 60);
      expect(evidenceResult!.duration).toBe(60);
    });

    it('should preserve ScreenTime over Unknown', () => {
      const builder = new ActualTimelineBuilder();

      // Screen time: 10:00 - 11:00 (priority 4)
      const screenEvent = createTestEvent('screen', 10 * 60, 60, { kind: 'screen_time' });
      // Unknown gap: 9:30 - 10:30 (priority 5)
      const unknownEvent = createTestEvent('unknown', 9 * 60 + 30, 60, { kind: 'unknown_gap' });

      builder.addEvents([unknownEvent, screenEvent]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Screen event should be intact
      const screenResult = result.find((e) => e.title === 'Event screen');
      expect(screenResult).toBeDefined();
      expect(screenResult!.startMinutes).toBe(10 * 60);
      expect(screenResult!.duration).toBe(60);
    });

    it('should handle equal priority by preserving first-added event', () => {
      const builder = new ActualTimelineBuilder();

      // Two system events at same priority (2)
      const event1 = createTestEvent('first', 10 * 60, 60, { source: 'system' });
      const event2 = createTestEvent('second', 10 * 60 + 30, 60, { source: 'system' });

      builder.addEvent(event1);
      builder.addEvent(event2);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // First event should be intact (added first)
      const firstResult = result.find((e) => e.title === 'Event first');
      expect(firstResult).toBeDefined();
      expect(firstResult!.startMinutes).toBe(10 * 60);
      expect(firstResult!.duration).toBe(60);
    });
  });

  describe('Edge cases', () => {
    it('should handle exact same time (complete overlap)', () => {
      const builder = new ActualTimelineBuilder();

      // Two events at exact same time
      const highPriority = createTestEvent('high', 10 * 60, 60, { source: 'user' });
      const lowPriority = createTestEvent('low', 10 * 60, 60, { kind: 'screen_time' });

      builder.addEvents([lowPriority, highPriority]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Only high priority should remain (low is completely consumed)
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Event high');
    });

    it('should handle partial overlap at start', () => {
      const builder = new ActualTimelineBuilder();

      // Event A: 9:00 - 10:00 (lower priority)
      const eventA = createTestEvent('A', 9 * 60, 60, { kind: 'screen_time' });
      // Event B: 9:30 - 10:30 (higher priority)
      const eventB = createTestEvent('B', 9 * 60 + 30, 60, { source: 'user' });

      builder.addEvents([eventA, eventB]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Should have: A split (9:00-9:30), B (9:30-10:30)
      const sortedResult = result.sort((a, b) => a.startMinutes - b.startMinutes);

      expect(sortedResult[0].startMinutes).toBe(9 * 60);
      expect(sortedResult[0].startMinutes + sortedResult[0].duration).toBeLessThanOrEqual(
        9 * 60 + 30
      );

      const bResult = result.find((e) => e.title === 'Event B');
      expect(bResult).toBeDefined();
      expect(bResult!.startMinutes).toBe(9 * 60 + 30);
    });

    it('should handle partial overlap at end', () => {
      const builder = new ActualTimelineBuilder();

      // Event A: 9:30 - 10:30 (lower priority)
      const eventA = createTestEvent('A', 9 * 60 + 30, 60, { kind: 'screen_time' });
      // Event B: 9:00 - 10:00 (higher priority)
      const eventB = createTestEvent('B', 9 * 60, 60, { source: 'user' });

      builder.addEvents([eventA, eventB]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Should have: B (9:00-10:00), A split (10:00-10:30)
      const bResult = result.find((e) => e.title === 'Event B');
      expect(bResult).toBeDefined();
      expect(bResult!.startMinutes).toBe(9 * 60);
      expect(bResult!.duration).toBe(60);
    });

    it('should handle contained event (one event fully inside another)', () => {
      const builder = new ActualTimelineBuilder();

      // Outer event: 9:00 - 12:00 (lower priority)
      const outer = createTestEvent('outer', 9 * 60, 180, { kind: 'screen_time' });
      // Inner event: 10:00 - 11:00 (higher priority)
      const inner = createTestEvent('inner', 10 * 60, 60, { source: 'user' });

      builder.addEvents([outer, inner]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Should have: outer split (9:00-10:00), inner (10:00-11:00), outer split (11:00-12:00)
      const innerResult = result.find((e) => e.title === 'Event inner');
      expect(innerResult).toBeDefined();
      expect(innerResult!.startMinutes).toBe(10 * 60);
      expect(innerResult!.duration).toBe(60);

      // Check the total coverage is preserved
      const sortedResult = result.sort((a, b) => a.startMinutes - b.startMinutes);
      expect(sortedResult[0].startMinutes).toBe(9 * 60);

      const lastEvent = sortedResult[sortedResult.length - 1];
      expect(lastEvent.startMinutes + lastEvent.duration).toBe(12 * 60);
    });

    it('should handle adjacent events (no overlap, touching boundaries)', () => {
      const builder = new ActualTimelineBuilder();

      // Event A: 9:00 - 10:00
      const eventA = createTestEvent('A', 9 * 60, 60, { source: 'system' });
      // Event B: 10:00 - 11:00 (starts exactly when A ends)
      const eventB = createTestEvent('B', 10 * 60, 60, { source: 'system' });

      builder.addEvents([eventA, eventB]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);
      expect(result).toHaveLength(2);
    });

    it('should handle zero-duration event (invalid, should be skipped)', () => {
      const builder = new ActualTimelineBuilder();

      const validEvent = createTestEvent('valid', 9 * 60, 60, { source: 'system' });
      const zeroEvent = createTestEvent('zero', 10 * 60, 0, { source: 'system' });

      builder.addEvent(validEvent);
      builder.addEvent(zeroEvent);

      const result = builder.build();

      // Zero duration event should not be added
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });

    it('should handle negative-duration event (invalid, should be skipped)', () => {
      const builder = new ActualTimelineBuilder();

      const validEvent = createTestEvent('valid', 9 * 60, 60, { source: 'system' });
      const negativeEvent = createTestEvent('negative', 10 * 60, -30, { source: 'system' });

      builder.addEvent(validEvent);
      builder.addEvent(negativeEvent);

      const result = builder.build();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });

    it('should filter out segments below minDurationMinutes', () => {
      const builder = new ActualTimelineBuilder(5); // 5 minute minimum

      // Event A: 9:00 - 10:00 (lower priority)
      const eventA = createTestEvent('A', 9 * 60, 60, { kind: 'screen_time' });
      // Event B: 9:02 - 9:58 (higher priority - leaves 2-minute segments)
      const eventB = createTestEvent('B', 9 * 60 + 2, 56, { source: 'user' });

      builder.addEvents([eventA, eventB]);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Small segments (less than 5 minutes) should be filtered out
      for (const event of result) {
        expect(event.duration).toBeGreaterThanOrEqual(5);
      }
    });

    it('should handle multiple overlapping events', () => {
      const builder = new ActualTimelineBuilder();

      // Multiple events all overlapping
      const events = [
        createTestEvent('A', 9 * 60, 120, { kind: 'unknown_gap' }), // 9:00-11:00, priority 5
        createTestEvent('B', 9 * 60 + 30, 90, { kind: 'screen_time' }), // 9:30-11:00, priority 4
        createTestEvent('C', 10 * 60, 60, { source: 'evidence' }), // 10:00-11:00, priority 3
        createTestEvent('D', 10 * 60 + 15, 30, { source: 'user' }), // 10:15-10:45, priority 1
      ];

      builder.addEvents(events);

      const result = builder.build();

      expect(hasOverlaps(result)).toBe(false);

      // Highest priority event (D) should be intact
      const dResult = result.find((e) => e.title === 'Event D');
      expect(dResult).toBeDefined();
      expect(dResult!.startMinutes).toBe(10 * 60 + 15);
      expect(dResult!.duration).toBe(30);
    });
  });

  describe('validate method', () => {
    it('should return valid: true for non-overlapping timeline', () => {
      const builder = new ActualTimelineBuilder();

      builder.addEvent(createTestEvent('A', 9 * 60, 60, { source: 'system' }));
      builder.addEvent(createTestEvent('B', 10 * 60, 60, { source: 'system' }));

      const validation = builder.validate();

      expect(validation.valid).toBe(true);
      expect(validation.overlaps).toHaveLength(0);
    });

    it('should correctly validate after overlap resolution', () => {
      const builder = new ActualTimelineBuilder();

      // Add overlapping events
      builder.addEvent(createTestEvent('A', 9 * 60, 120, { kind: 'screen_time' }));
      builder.addEvent(createTestEvent('B', 10 * 60, 60, { source: 'user' }));

      const validation = builder.validate();

      expect(validation.valid).toBe(true);
    });
  });

  describe('clear and eventCount', () => {
    it('should clear all events', () => {
      const builder = new ActualTimelineBuilder();

      builder.addEvent(createTestEvent('A', 9 * 60, 60, { source: 'system' }));
      builder.addEvent(createTestEvent('B', 10 * 60, 60, { source: 'system' }));

      expect(builder.eventCount).toBe(2);

      builder.clear();

      expect(builder.eventCount).toBe(0);
      expect(builder.build()).toHaveLength(0);
    });
  });
});
