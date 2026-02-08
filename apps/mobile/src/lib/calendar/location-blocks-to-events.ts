/**
 * location-blocks-to-events.ts
 *
 * Converts LocationBlock[] (from the BRAVO/CHARLIE pipeline) into
 * ScheduledEvent[] that ComprehensiveCalendarTemplate can render in
 * the Actual column.
 *
 * This replaces the 3400-line `actual-display-events.ts` monster with
 * a clean, focused converter (< 300 lines).
 */

import type { LocationBlock } from "@/lib/types/location-block";
import type {
  ScheduledEvent,
  CalendarEventMeta,
  EventCategory,
} from "@/stores/events-store";

// ============================================================================
// Public API
// ============================================================================

export interface ConvertOptions {
  /** Location blocks from the BRAVO/CHARLIE pipeline. */
  blocks: LocationBlock[];
  /** The day being rendered (YYYY-MM-DD). */
  ymd: string;
  /** Planned events — used for sleep-gap detection. */
  plannedEvents?: ScheduledEvent[];
  /** User-saved actual events that take priority over location blocks. */
  userActualEvents?: ScheduledEvent[];
}

/**
 * Convert LocationBlock[] → ScheduledEvent[] for the calendar grid.
 *
 * Steps:
 * 1. Filter out blocks that overlap with user-created actual events
 * 2. Convert each remaining block to a ScheduledEvent
 * 3. Merge in user actual events
 * 4. Fill gaps (unknown or sleep)
 * 5. Sort by startMinutes
 *
 * Edge cases handled:
 * - Future dates: returns empty (no actual data expected)
 * - No CHARLIE data: returns only user actual events (if any)
 * - Partial data: gaps between blocks filled with unknown/sleep
 */
export function locationBlocksToScheduledEvents(
  options: ConvertOptions,
): ScheduledEvent[] {
  const { blocks, ymd, plannedEvents = [], userActualEvents = [] } = options;

  // ── Edge case: future date → no actual data expected ──
  const today = new Date();
  const [y, m, d] = ymd.split("-").map(Number);
  const targetDate = new Date(y, m - 1, d);
  if (targetDate.getTime() > today.getTime() + 24 * 60 * 60_000) {
    // More than ~1 day in the future — return only user-created events
    return userActualEvents.length > 0
      ? [...userActualEvents].sort((a, b) => a.startMinutes - b.startMinutes)
      : [];
  }

  // ── Edge case: no blocks and no user events → empty ──
  if (blocks.length === 0 && userActualEvents.length === 0) {
    return [];
  }

  // 1. Convert blocks → events
  const blockEvents = blocks.map((block) =>
    locationBlockToEvent(block, ymd),
  );

  // 2. Filter out block events that overlap with user actual events
  const filtered = filterOverlapping(blockEvents, userActualEvents);

  // 3. Merge user events + filtered block events, sorted by start
  const merged = [...userActualEvents, ...filtered].sort(
    (a, b) => a.startMinutes - b.startMinutes,
  );

  // 4. Fill gaps between events
  const plannedSleepRanges = extractPlannedSleepRanges(plannedEvents);
  const withGaps = fillGaps(merged, plannedSleepRanges, ymd);

  return withGaps;
}

// ============================================================================
// Category Mapping
// ============================================================================

/**
 * Map a LocationBlock's category/type → EventCategory.
 */
export function locationCategoryToEventCategory(
  block: LocationBlock,
): EventCategory {
  if (block.type === "travel") return "travel";

  const cat = block.locationCategory?.toLowerCase() ?? "";
  switch (cat) {
    case "home":
      return "routine";
    case "office":
    case "coworking":
      return "work";
    case "gym":
    case "fitness":
      return "health";
    case "restaurant":
    case "cafe":
    case "bar":
      return "meal";
    case "church":
    case "temple":
    case "mosque":
      return "routine";
    case "school":
    case "university":
      return "work";
    case "park":
    case "recreation":
      return "health";
    case "store":
    case "shopping":
      return "free";
    default:
      return "unknown";
  }
}

// ============================================================================
// Single Block → ScheduledEvent
// ============================================================================

function locationBlockToEvent(
  block: LocationBlock,
  ymd: string,
): ScheduledEvent {
  const category = locationCategoryToEventCategory(block);
  const startMinutes = dateToMinutesFromMidnight(block.startTime, ymd);
  const endMinutes = dateToMinutesFromMidnight(block.endTime, ymd);
  // Ensure at least 1 minute duration, clamp to day boundary (1440 = 24h)
  const duration = Math.max(1, Math.min(endMinutes - startMinutes, 1440 - startMinutes));

  const meta: CalendarEventMeta = {
    category,
    source: "derived",
    kind: block.type === "travel" ? "travel" : "location_block",
    confidence: block.confidenceScore,
    place_label: block.locationLabel,
    place_id: block.inferredPlace?.geohash7 ?? null,
    latitude: block.inferredPlace?.latitude ?? null,
    longitude: block.inferredPlace?.longitude ?? null,
    fuzzy_location: block.isPlaceInferred,
    // App usage summary for session block display in template
    summary: block.apps.slice(0, 5).map((app) => ({
      label: app.displayName,
      seconds: app.totalMinutes * 60,
    })),
  };

  // Build description from activity inference or app summary
  let description = "";
  if (block.activityInference?.primary) {
    description = block.activityInference.primary;
  } else if (block.apps.length > 0) {
    description = block.apps
      .slice(0, 3)
      .map((a) => a.displayName)
      .join(", ");
  }

  return {
    id: `lb:${block.id}`,
    title: block.locationLabel,
    description,
    startMinutes: Math.max(0, startMinutes),
    duration,
    category,
    meta,
  };
}

// ============================================================================
// Overlap Filtering
// ============================================================================

/**
 * Remove block events that overlap with user actual events.
 * User events always win.
 */
function filterOverlapping(
  blockEvents: ScheduledEvent[],
  userEvents: ScheduledEvent[],
): ScheduledEvent[] {
  if (userEvents.length === 0) return blockEvents;

  return blockEvents.filter((block) => {
    const bStart = block.startMinutes;
    const bEnd = bStart + block.duration;
    return !userEvents.some((user) => {
      const uStart = user.startMinutes;
      const uEnd = uStart + user.duration;
      // Overlap: the block's midpoint falls within a user event
      const midpoint = (bStart + bEnd) / 2;
      return midpoint >= uStart && midpoint < uEnd;
    });
  });
}

// ============================================================================
// Gap Filling
// ============================================================================

interface TimeRange {
  startMinutes: number;
  endMinutes: number;
}

function extractPlannedSleepRanges(
  plannedEvents: ScheduledEvent[],
): TimeRange[] {
  return plannedEvents
    .filter(
      (e) =>
        e.category === "sleep" || e.meta?.kind === "sleep_schedule",
    )
    .map((e) => ({
      startMinutes: e.startMinutes,
      endMinutes: e.startMinutes + e.duration,
    }));
}

/**
 * Fill gaps between events. Gaps that overlap with planned sleep become
 * sleep events; all others become unknown.
 *
 * Only fills gaps ≥ 5 minutes to avoid micro-gap noise.
 */
function fillGaps(
  events: ScheduledEvent[],
  sleepRanges: TimeRange[],
  ymd: string,
): ScheduledEvent[] {
  if (events.length === 0) return [];

  const result: ScheduledEvent[] = [];
  const DAY_END = 1440; // 24 * 60
  const MIN_GAP = 5; // Minimum gap to fill (minutes)

  // Find the earliest and latest event to determine the day range to fill
  const firstStart = events[0].startMinutes;
  const lastEvent = events[events.length - 1];
  const lastEnd = lastEvent.startMinutes + lastEvent.duration;

  // We only fill gaps between the first and last event, not 00:00→first or last→24:00
  let cursor = firstStart;

  for (const event of events) {
    const gapStart = cursor;
    const gapEnd = event.startMinutes;

    if (gapEnd - gapStart >= MIN_GAP) {
      result.push(
        buildGapEvent(gapStart, gapEnd - gapStart, sleepRanges, ymd),
      );
    }

    result.push(event);
    cursor = Math.max(cursor, event.startMinutes + event.duration);
  }

  // Fill from last event to end of day only if last event doesn't reach midnight
  // and there's a sleep range that covers it
  if (lastEnd < DAY_END) {
    const remainingGap = DAY_END - lastEnd;
    if (remainingGap >= MIN_GAP && overlapsSleep(lastEnd, DAY_END, sleepRanges)) {
      result.push(buildGapEvent(lastEnd, remainingGap, sleepRanges, ymd));
    }
  }

  return result;
}

function buildGapEvent(
  startMinutes: number,
  duration: number,
  sleepRanges: TimeRange[],
  ymd: string,
): ScheduledEvent {
  const endMinutes = startMinutes + duration;
  const isSleep = overlapsSleep(startMinutes, endMinutes, sleepRanges);

  return {
    id: `lb:gap:${ymd}:${startMinutes}`,
    title: isSleep ? "Sleep" : "Unknown",
    description: "",
    startMinutes,
    duration,
    category: isSleep ? "sleep" : "unknown",
    meta: {
      category: isSleep ? "sleep" : "unknown",
      source: "derived",
      kind: isSleep ? "sleep_schedule" : "unknown_gap",
    },
  };
}

/**
 * Returns true if ≥50% of the gap overlaps with any planned sleep range.
 */
function overlapsSleep(
  gapStart: number,
  gapEnd: number,
  sleepRanges: TimeRange[],
): boolean {
  const gapDuration = gapEnd - gapStart;
  if (gapDuration <= 0) return false;

  let totalOverlap = 0;
  for (const range of sleepRanges) {
    const overlapStart = Math.max(gapStart, range.startMinutes);
    const overlapEnd = Math.min(gapEnd, range.endMinutes);
    if (overlapEnd > overlapStart) {
      totalOverlap += overlapEnd - overlapStart;
    }
  }

  return totalOverlap >= gapDuration * 0.5;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert a Date to minutes-from-midnight for a given YMD.
 * Clamps to [0, 1440] range.
 */
function dateToMinutesFromMidnight(date: Date, ymd: string): number {
  // Build midnight of the target day in local timezone
  const [year, month, day] = ymd.split("-").map(Number);
  const midnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  const diffMs = date.getTime() - midnight.getTime();
  const minutes = Math.round(diffMs / 60_000);
  return Math.max(0, Math.min(minutes, 1440));
}
