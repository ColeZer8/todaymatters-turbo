import type { ActualPatternSourceEvent } from "@/lib/supabase/services/calendar-events";
import type {
  CalendarEventMeta,
  EventCategory,
  ScheduledEvent,
} from "@/stores";

const SLOT_MINUTES = 30;
const MIN_CONFIDENCE = 0.6;
const LEARNED_EVENT_WEIGHT = 1.5;

export interface PatternSlot {
  dayOfWeek: number;
  slotStartMinutes: number;
  slotEndMinutes: number;
  category: EventCategory;
  title: string;
  confidence: number;
  sampleCount: number;
  avgDurationMinutes: number;
}

export interface PatternIndex {
  slots: Map<string, PatternSlot>;
}

export interface PatternSummaryResult {
  confidence: number;
  sampleCount: number;
  typicalCategory?: EventCategory;
  deviation: boolean;
}

export interface PatternAnomaly {
  startMinutes: number;
  endMinutes: number;
  expectedCategory: EventCategory;
  actualCategory: EventCategory;
  confidence: number;
}

export interface DailyPatternAnomalyReport {
  ymd: string;
  anomalyScore: number;
  anomalies: PatternAnomaly[];
  slotCount: number;
}

export interface PatternPrediction {
  startMinutes: number;
  endMinutes: number;
  category: EventCategory;
  title: string;
  confidence: number;
}

interface PatternAccumulator {
  totalCount: number;
  counts: Map<string, number>;
  durationSum: number;
}

const keyFor = (dayOfWeek: number, slotStartMinutes: number): string =>
  `${dayOfWeek}:${slotStartMinutes}`;

const entryKey = (category: EventCategory, title: string): string =>
  `${category}:${title}`;

function getDayOfWeek(ymd: string): number {
  const match = ymd.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day).getDay();
}

export function buildPatternIndex(
  entries: ActualPatternSourceEvent[],
): PatternIndex {
  const accumulators = new Map<string, PatternAccumulator>();

  for (const entry of entries) {
    const { ymd, event } = entry;
    const dayOfWeek = getDayOfWeek(ymd);
    const startBucket =
      Math.floor(event.startMinutes / SLOT_MINUTES) * SLOT_MINUTES;
    const key = keyFor(dayOfWeek, startBucket);

    const accumulator = accumulators.get(key) ?? {
      totalCount: 0,
      counts: new Map<string, number>(),
      durationSum: 0,
    };
    const title = event.title?.trim() || "Actual";
    const eventKey = entryKey(event.category, title);
    const weight = event.meta?.learnedFrom ? LEARNED_EVENT_WEIGHT : 1;
    accumulator.totalCount += weight;
    accumulator.durationSum += event.duration * weight;
    accumulator.counts.set(
      eventKey,
      (accumulator.counts.get(eventKey) ?? 0) + weight,
    );
    accumulators.set(key, accumulator);
  }

  const slots = new Map<string, PatternSlot>();
  for (const [key, accumulator] of accumulators.entries()) {
    if (accumulator.totalCount === 0) continue;
    const sorted = Array.from(accumulator.counts.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    const [winnerKey, winnerCount] = sorted[0] ?? [];
    if (!winnerKey) continue;
    const [category, title] = winnerKey.split(":");
    const confidence = winnerCount / accumulator.totalCount;
    const [dayOfWeekString, slotStartString] = key.split(":");
    const dayOfWeek = Number(dayOfWeekString);
    const slotStartMinutes = Number(slotStartString);
    const avgDurationMinutes = accumulator.durationSum / accumulator.totalCount;

    slots.set(key, {
      dayOfWeek,
      slotStartMinutes,
      slotEndMinutes: slotStartMinutes + SLOT_MINUTES,
      category: category as EventCategory,
      title,
      confidence,
      sampleCount: Math.round(accumulator.totalCount),
      avgDurationMinutes,
    });
  }

  return { slots };
}

export function buildPatternIndexFromSlots(slots: PatternSlot[]): PatternIndex {
  const map = new Map<string, PatternSlot>();
  for (const slot of slots) {
    map.set(keyFor(slot.dayOfWeek, slot.slotStartMinutes), slot);
  }
  return { slots: map };
}

export function serializePatternIndex(
  index: PatternIndex | null,
): PatternSlot[] {
  if (!index) return [];
  return Array.from(index.slots.values());
}

function findBestPatternForRange(
  index: PatternIndex,
  ymd: string,
  startMinutes: number,
  endMinutes: number,
): PatternSlot | null {
  const dayOfWeek = getDayOfWeek(ymd);
  let best: PatternSlot | null = null;

  for (let minute = startMinutes; minute < endMinutes; minute += SLOT_MINUTES) {
    const bucket = Math.floor(minute / SLOT_MINUTES) * SLOT_MINUTES;
    const slot = index.slots.get(keyFor(dayOfWeek, bucket));
    if (!slot) continue;
    if (!best || slot.confidence > best.confidence) {
      best = slot;
    }
  }

  return best;
}

export function getPatternSuggestionForRange(
  index: PatternIndex | null,
  ymd: string,
  startMinutes: number,
  endMinutes: number,
): PatternSlot | null {
  if (!index) return null;
  return findBestPatternForRange(index, ymd, startMinutes, endMinutes);
}

export function buildPatternSummary(
  index: PatternIndex | null,
  ymd: string,
  startMinutes: number,
  endMinutes: number,
  currentCategory: EventCategory,
): PatternSummaryResult | null {
  const suggestion = getPatternSuggestionForRange(
    index,
    ymd,
    startMinutes,
    endMinutes,
  );
  if (!suggestion) return null;
  const deviation =
    suggestion.category !== currentCategory && suggestion.confidence >= 0.6;
  return {
    confidence: suggestion.confidence,
    sampleCount: suggestion.sampleCount,
    typicalCategory: suggestion.category,
    deviation,
  };
}

export function applyPatternSuggestions(
  events: ScheduledEvent[],
  index: PatternIndex | null,
  ymd: string,
  minConfidence: number = MIN_CONFIDENCE,
): ScheduledEvent[] {
  if (!index) return events;

  return events.map((event) => {
    if (event.category !== "unknown") return event;
    const start = event.startMinutes;
    const end = event.startMinutes + event.duration;
    const suggestion = findBestPatternForRange(index, ymd, start, end);
    if (!suggestion || suggestion.confidence < minConfidence) return event;

    const meta: CalendarEventMeta = {
      category: suggestion.category,
      source: "derived",
      kind: "pattern_gap",
      confidence: suggestion.confidence,
    };

    return {
      ...event,
      title: suggestion.title,
      category: suggestion.category,
      meta,
    };
  });
}

function overlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function findActualCategoryForSlot(
  events: ScheduledEvent[],
  startMinutes: number,
  endMinutes: number,
): EventCategory {
  let bestOverlap = 0;
  let bestCategory: EventCategory = "unknown";

  for (const event of events) {
    const overlap = overlapMinutes(
      startMinutes,
      endMinutes,
      event.startMinutes,
      event.startMinutes + event.duration,
    );
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestCategory = event.category;
    }
  }

  return bestCategory;
}

export function buildDailyPatternAnomalies(options: {
  actualEvents: ScheduledEvent[];
  index: PatternIndex | null;
  ymd: string;
  minConfidence?: number;
}): DailyPatternAnomalyReport | null {
  const { actualEvents, index, ymd, minConfidence = MIN_CONFIDENCE } = options;
  if (!index) return null;

  const dayOfWeek = getDayOfWeek(ymd);
  const anomalies: PatternAnomaly[] = [];
  let slotCount = 0;

  for (let slotStart = 0; slotStart < 24 * 60; slotStart += SLOT_MINUTES) {
    const slot = index.slots.get(keyFor(dayOfWeek, slotStart));
    if (!slot || slot.confidence < minConfidence) continue;
    slotCount += 1;
    const slotEnd = slotStart + SLOT_MINUTES;
    const actualCategory = findActualCategoryForSlot(
      actualEvents,
      slotStart,
      slotEnd,
    );
    if (actualCategory !== slot.category && actualCategory !== "unknown") {
      anomalies.push({
        startMinutes: slotStart,
        endMinutes: slotEnd,
        expectedCategory: slot.category,
        actualCategory,
        confidence: slot.confidence,
      });
    }
  }

  const anomalyScore = slotCount > 0 ? anomalies.length / slotCount : 0;

  return {
    ymd,
    anomalyScore,
    anomalies,
    slotCount,
  };
}

export function buildPatternPredictions(options: {
  index: PatternIndex | null;
  ymd: string;
  minConfidence?: number;
}): PatternPrediction[] {
  const { index, ymd, minConfidence = MIN_CONFIDENCE } = options;
  if (!index) return [];
  const dayOfWeek = getDayOfWeek(ymd);

  return Array.from(index.slots.values())
    .filter(
      (slot) =>
        slot.dayOfWeek === dayOfWeek && slot.confidence >= minConfidence,
    )
    .sort((a, b) => a.slotStartMinutes - b.slotStartMinutes)
    .map((slot) => ({
      startMinutes: slot.slotStartMinutes,
      endMinutes: slot.slotEndMinutes,
      category: slot.category,
      title: slot.title,
      confidence: slot.confidence,
    }));
}
