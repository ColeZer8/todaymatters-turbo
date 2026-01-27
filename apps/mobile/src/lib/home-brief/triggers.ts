import type { ScheduledEvent } from "@/stores";
import { addMinutes } from "./time";

export interface NextBoundary {
  /** Date when we should reevaluate */
  at: Date;
  /** Description for debugging */
  reason: string;
}

const BUCKET_BOUNDARIES = [5 * 60, 12 * 60, 15 * 60, 18 * 60, 21 * 60];

export function getNextTimeOfDayBoundary(nowDate: Date): NextBoundary {
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  const next = BUCKET_BOUNDARIES.find((m) => m > nowMinutes);
  if (next != null) {
    const at = new Date(nowDate);
    at.setHours(Math.floor(next / 60), next % 60, 0, 0);
    return { at, reason: "timeOfDayBoundary" };
  }

  // Next day at 5:00
  const at = new Date(nowDate);
  at.setDate(at.getDate() + 1);
  at.setHours(5, 0, 0, 0);
  return { at, reason: "timeOfDayBoundaryNextDay" };
}

export function getNextScheduleBoundary(
  nowDate: Date,
  nowMinutesFromMidnight: number,
  scheduledEvents: ScheduledEvent[],
): NextBoundary | null {
  let bestMinutes: number | null = null;
  let bestReason: string | null = null;

  for (const e of scheduledEvents) {
    const start = e.startMinutes;
    const end = e.startMinutes + e.duration;

    // Next start
    if (start > nowMinutesFromMidnight) {
      const delta = start - nowMinutesFromMidnight;
      if (bestMinutes == null || delta < bestMinutes) {
        bestMinutes = delta;
        bestReason = "eventStart";
      }
    }

    // Current event ending
    if (start <= nowMinutesFromMidnight && end > nowMinutesFromMidnight) {
      const delta = end - nowMinutesFromMidnight;
      if (bestMinutes == null || delta < bestMinutes) {
        bestMinutes = delta;
        bestReason = "eventEnd";
      }
    }
  }

  if (bestMinutes == null || bestReason == null) return null;

  const at = addMinutes(nowDate, bestMinutes);
  return { at, reason: bestReason };
}
