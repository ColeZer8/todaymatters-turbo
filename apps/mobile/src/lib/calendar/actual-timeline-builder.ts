/**
 * ActualTimelineBuilder - Handles overlap resolution for actual timeline events
 *
 * This class implements a split algorithm that ensures no events overlap in the
 * final timeline. When events overlap, lower-priority events are split around
 * higher-priority events.
 *
 * Priority order (1 = highest):
 * 1. User-edited actual events (source: 'user' or 'actual_adjust')
 * 2. Supabase actual events (non-derived, source: 'system' or no source)
 * 3. Derived from evidence (kind: 'evidence_block', 'location_inferred', etc.)
 * 4. Screen time derived (kind: 'screen_time')
 * 5. Unknown/gap filler (kind: 'unknown_gap', 'pattern_gap')
 */

import type { ScheduledEvent, CalendarEventMeta } from '@/stores';

/**
 * Event priority levels - lower number = higher priority
 */
export enum EventPriority {
  UserEdited = 1,
  SupabaseActual = 2,
  DerivedEvidence = 3,
  ScreenTime = 4,
  Unknown = 5,
}

/**
 * Internal representation of a timeline event with computed priority
 */
interface TimelineEvent {
  event: ScheduledEvent;
  startMinutes: number;
  endMinutes: number;
  priority: EventPriority;
}

/**
 * Determines the priority of an event based on its metadata
 */
export function getEventPriority(event: ScheduledEvent): EventPriority {
  const meta = event.meta as CalendarEventMeta | undefined;
  const source = meta?.source;
  const kind = meta?.kind;

  // Priority 1: User-edited actual events
  if (source === 'user' || source === 'actual_adjust') {
    return EventPriority.UserEdited;
  }

  // Priority 5: Unknown/gap filler events
  if (kind === 'unknown_gap' || kind === 'pattern_gap') {
    return EventPriority.Unknown;
  }

  // Priority 4: Screen time derived events
  if (kind === 'screen_time') {
    return EventPriority.ScreenTime;
  }

  // Priority 3: Derived from evidence
  if (
    source === 'evidence' ||
    source === 'derived' ||
    kind === 'evidence_block' ||
    kind === 'location_inferred' ||
    kind === 'planned_actual' ||
    kind === 'sleep_schedule' ||
    kind === 'sleep_interrupted' ||
    kind === 'sleep_late' ||
    kind === 'transition_commute' ||
    kind === 'transition_prep' ||
    kind === 'transition_wind_down'
  ) {
    return EventPriority.DerivedEvidence;
  }

  // Priority 2: Supabase actual events (default for events without specific markers)
  if (source === 'system' || !source) {
    // Check if this looks like a derived event by ID prefix
    if (
      event.id.startsWith('derived_actual:') ||
      event.id.startsWith('derived_evidence:') ||
      event.id.startsWith('st:')
    ) {
      return EventPriority.DerivedEvidence;
    }
    return EventPriority.SupabaseActual;
  }

  // Default to derived evidence priority
  return EventPriority.DerivedEvidence;
}

/**
 * Calculates the overlap between two intervals in minutes
 */
function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

/**
 * Checks if two intervals overlap
 */
function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return overlapMinutes(aStart, aEnd, bStart, bEnd) > 0;
}

/**
 * Generates a unique ID for a split event segment
 */
function generateSplitId(originalId: string, segmentIndex: number): string {
  return `${originalId}:split:${segmentIndex}`;
}

/**
 * ActualTimelineBuilder class for building non-overlapping timelines
 */
export class ActualTimelineBuilder {
  private events: TimelineEvent[] = [];
  private minDurationMinutes: number;

  /**
   * Creates a new ActualTimelineBuilder
   * @param minDurationMinutes - Minimum duration for an event segment to be included (default: 1)
   */
  constructor(minDurationMinutes = 1) {
    this.minDurationMinutes = minDurationMinutes;
  }

  /**
   * Adds an event to the timeline, handling overlaps with existing events
   *
   * When an overlap occurs:
   * - If the new event has higher priority, existing lower-priority events are split
   * - If the new event has lower priority, it is split around existing events
   * - If priorities are equal, the earlier-added event wins (existing events preserved)
   */
  addEvent(event: ScheduledEvent): void {
    const startMinutes = event.startMinutes;
    const endMinutes = event.startMinutes + event.duration;

    if (endMinutes <= startMinutes) {
      return; // Invalid event duration
    }

    const newPriority = getEventPriority(event);
    const newTimelineEvent: TimelineEvent = {
      event,
      startMinutes,
      endMinutes,
      priority: newPriority,
    };

    // Find all overlapping events
    const overlapping = this.events.filter((existing) =>
      intervalsOverlap(startMinutes, endMinutes, existing.startMinutes, existing.endMinutes)
    );

    if (overlapping.length === 0) {
      // No overlap - simply add the event
      this.events.push(newTimelineEvent);
      return;
    }

    // Process overlaps
    // Separate events into those we need to split (lower priority than new event)
    // and those we need to split the new event around (higher or equal priority)
    const lowerPriorityEvents: TimelineEvent[] = [];
    const higherOrEqualPriorityEvents: TimelineEvent[] = [];

    for (const existing of overlapping) {
      // Lower number = higher priority, so we compare with >
      if (existing.priority > newPriority) {
        lowerPriorityEvents.push(existing);
      } else {
        higherOrEqualPriorityEvents.push(existing);
      }
    }

    // Split lower priority events around the new event
    for (const toSplit of lowerPriorityEvents) {
      this.splitEventAround(toSplit, startMinutes, endMinutes);
    }

    // If there are higher or equal priority events, split the new event around them
    if (higherOrEqualPriorityEvents.length > 0) {
      const splitSegments = this.computeSplitSegments(
        newTimelineEvent,
        higherOrEqualPriorityEvents
      );

      for (const segment of splitSegments) {
        if (segment.endMinutes - segment.startMinutes >= this.minDurationMinutes) {
          this.events.push(segment);
        }
      }
    } else {
      // No higher priority events - add the new event as-is
      this.events.push(newTimelineEvent);
    }
  }

  /**
   * Adds multiple events to the timeline
   */
  addEvents(events: ScheduledEvent[]): void {
    // Sort by priority (higher priority first) to ensure proper ordering
    const sortedEvents = [...events].sort((a, b) => {
      const priorityA = getEventPriority(a);
      const priorityB = getEventPriority(b);
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower number = higher priority, process first
      }
      // Same priority - sort by start time
      return a.startMinutes - b.startMinutes;
    });

    for (const event of sortedEvents) {
      this.addEvent(event);
    }
  }

  /**
   * Splits an existing event around a blocking interval
   */
  private splitEventAround(
    toSplit: TimelineEvent,
    blockStart: number,
    blockEnd: number
  ): void {
    // Remove the original event
    const index = this.events.indexOf(toSplit);
    if (index >= 0) {
      this.events.splice(index, 1);
    }

    let segmentIndex = 0;

    // Create segment before the block (if there's room)
    if (toSplit.startMinutes < blockStart) {
      const beforeEnd = Math.min(toSplit.endMinutes, blockStart);
      const beforeDuration = beforeEnd - toSplit.startMinutes;

      if (beforeDuration >= this.minDurationMinutes) {
        const beforeEvent: ScheduledEvent = {
          ...toSplit.event,
          id: generateSplitId(toSplit.event.id, segmentIndex++),
          startMinutes: toSplit.startMinutes,
          duration: beforeDuration,
        };

        this.events.push({
          event: beforeEvent,
          startMinutes: toSplit.startMinutes,
          endMinutes: beforeEnd,
          priority: toSplit.priority,
        });
      }
    }

    // Create segment after the block (if there's room)
    if (toSplit.endMinutes > blockEnd) {
      const afterStart = Math.max(toSplit.startMinutes, blockEnd);
      const afterDuration = toSplit.endMinutes - afterStart;

      if (afterDuration >= this.minDurationMinutes) {
        const afterEvent: ScheduledEvent = {
          ...toSplit.event,
          id: generateSplitId(toSplit.event.id, segmentIndex++),
          startMinutes: afterStart,
          duration: afterDuration,
        };

        this.events.push({
          event: afterEvent,
          startMinutes: afterStart,
          endMinutes: toSplit.endMinutes,
          priority: toSplit.priority,
        });
      }
    }
  }

  /**
   * Computes the segments of a new event after splitting around blocking events
   */
  private computeSplitSegments(
    newEvent: TimelineEvent,
    blockers: TimelineEvent[]
  ): TimelineEvent[] {
    // Sort blockers by start time
    const sortedBlockers = [...blockers].sort((a, b) => a.startMinutes - b.startMinutes);

    const segments: TimelineEvent[] = [];
    let currentStart = newEvent.startMinutes;
    let segmentIndex = 0;

    for (const blocker of sortedBlockers) {
      // If there's a gap before this blocker, create a segment
      if (currentStart < blocker.startMinutes && currentStart < newEvent.endMinutes) {
        const segmentEnd = Math.min(blocker.startMinutes, newEvent.endMinutes);
        const segmentDuration = segmentEnd - currentStart;

        if (segmentDuration >= this.minDurationMinutes) {
          const segmentEvent: ScheduledEvent = {
            ...newEvent.event,
            id: generateSplitId(newEvent.event.id, segmentIndex++),
            startMinutes: currentStart,
            duration: segmentDuration,
          };

          segments.push({
            event: segmentEvent,
            startMinutes: currentStart,
            endMinutes: segmentEnd,
            priority: newEvent.priority,
          });
        }
      }

      // Move past this blocker
      currentStart = Math.max(currentStart, blocker.endMinutes);
    }

    // Handle remaining segment after all blockers
    if (currentStart < newEvent.endMinutes) {
      const segmentDuration = newEvent.endMinutes - currentStart;

      if (segmentDuration >= this.minDurationMinutes) {
        const segmentEvent: ScheduledEvent = {
          ...newEvent.event,
          id: segmentIndex > 0 ? generateSplitId(newEvent.event.id, segmentIndex) : newEvent.event.id,
          startMinutes: currentStart,
          duration: segmentDuration,
        };

        segments.push({
          event: segmentEvent,
          startMinutes: currentStart,
          endMinutes: newEvent.endMinutes,
          priority: newEvent.priority,
        });
      }
    }

    return segments;
  }

  /**
   * Builds and returns the final non-overlapping timeline
   * Events are sorted by start time
   */
  build(): ScheduledEvent[] {
    // Sort by start time
    const sorted = [...this.events].sort((a, b) => a.startMinutes - b.startMinutes);

    // Return the ScheduledEvent objects
    return sorted.map((te) => te.event);
  }

  /**
   * Validates that no events overlap in the timeline
   * Returns true if the timeline is valid (no overlaps)
   */
  validate(): { valid: boolean; overlaps: Array<{ event1: string; event2: string }> } {
    const overlaps: Array<{ event1: string; event2: string }> = [];
    const sorted = [...this.events].sort((a, b) => a.startMinutes - b.startMinutes);

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];

        // Since sorted by start time, if b starts after a ends, no more overlaps with a
        if (b.startMinutes >= a.endMinutes) {
          break;
        }

        if (intervalsOverlap(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes)) {
          overlaps.push({
            event1: a.event.id,
            event2: b.event.id,
          });
        }
      }
    }

    return {
      valid: overlaps.length === 0,
      overlaps,
    };
  }

  /**
   * Clears all events from the builder
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Gets the current number of events
   */
  get eventCount(): number {
    return this.events.length;
  }
}

/**
 * Convenience function to build a non-overlapping timeline from events
 */
export function buildNonOverlappingTimeline(
  events: ScheduledEvent[],
  minDurationMinutes = 1
): ScheduledEvent[] {
  const builder = new ActualTimelineBuilder(minDurationMinutes);
  builder.addEvents(events);
  return builder.build();
}
