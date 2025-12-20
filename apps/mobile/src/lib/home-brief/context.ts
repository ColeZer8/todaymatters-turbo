import type { ScheduledEvent } from '@/stores';
import type {
  HomeBriefContext,
  HomeBriefEventSummary,
  HomeBriefGoalSummary,
  HomeBriefPersona,
} from './types';
import { getTimeOfDayBucket } from './time';

function toEventSummary(e: ScheduledEvent): HomeBriefEventSummary {
  return {
    id: e.id,
    title: e.title,
    startMinutes: e.startMinutes,
    duration: e.duration,
    category: e.category,
    isBig3: e.isBig3,
  };
}

export interface BuildHomeBriefContextInput {
  nowDate: Date;
  nowMinutesFromMidnight: number;

  rhythm: {
    wakeTimeIso?: string | null;
    sleepTimeIso?: string | null;
  };

  profile: {
    fullName?: string | null;
    /** YYYY-MM-DD */
    birthday?: string | null;
  };

  persona: HomeBriefPersona;

  scheduledEvents: ScheduledEvent[];

  goals: HomeBriefGoalSummary;

  reviewTime: {
    unassignedCount: number;
  };
}

export function buildHomeBriefContext(input: BuildHomeBriefContextInput): HomeBriefContext {
  const { nowDate, nowMinutesFromMidnight, scheduledEvents } = input;

  const hour24 = nowDate.getHours();
  const bucket = getTimeOfDayBucket(hour24);

  const wakeMinutesFromMidnight = isoTimeToMinutesFromMidnight(input.rhythm.wakeTimeIso);
  const sleepMinutesFromMidnight = isoTimeToMinutesFromMidnight(input.rhythm.sleepTimeIso);
  const isWakeWindowActive =
    wakeMinutesFromMidnight != null &&
    nowMinutesFromMidnight >= wakeMinutesFromMidnight &&
    nowMinutesFromMidnight < wakeMinutesFromMidnight + 120;

  // Current event = event covering now.
  const current = scheduledEvents.find(
    (e) => e.startMinutes <= nowMinutesFromMidnight && e.startMinutes + e.duration > nowMinutesFromMidnight
  );

  // Next event = earliest event that starts after now.
  const next = scheduledEvents
    .filter((e) => e.startMinutes > nowMinutesFromMidnight)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0];

  const minutesUntilNextEvent = next ? Math.max(0, next.startMinutes - nowMinutesFromMidnight) : null;

  return {
    now: {
      iso: nowDate.toISOString(),
      minutesFromMidnight: nowMinutesFromMidnight,
      hour24,
      dayOfWeek: nowDate.getDay(),
      bucket,
    },
    rhythm: {
      wakeMinutesFromMidnight,
      sleepMinutesFromMidnight,
      isWakeWindowActive,
    },
    profile: {
      fullName: input.profile.fullName ?? null,
      birthday: input.profile.birthday ?? null,
    },
    schedule: {
      currentEvent: current ? toEventSummary(current) : undefined,
      nextEvent: next ? toEventSummary(next) : undefined,
      minutesUntilNextEvent,
    },
    goals: input.goals,
    reviewTime: {
      unassignedCount: input.reviewTime.unassignedCount,
    },
    persona: input.persona,
  };
}

function isoTimeToMinutesFromMidnight(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}




