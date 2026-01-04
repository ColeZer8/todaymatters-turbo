import type { ScreenTimeSummary } from '@/lib/ios-insights';
import type { ScheduledEvent } from '@/stores/events-store';

interface DeriveActualEventsFromScreenTimeOptions {
  existingActualEvents: ScheduledEvent[];
  screenTimeSummary: ScreenTimeSummary;
  /**
   * Minimum estimated minutes of phone use inside an event before we annotate it as distracted.
   * Defaults to 10 minutes to avoid noisy annotations from tiny checks.
   */
  distractionThresholdMinutes?: number;
  /**
   * Minimum minutes in an hour bucket before we render a standalone "Screen Time" block (only when it
   * doesn't overlap any non-digital actual events).
   */
  minScreenTimeBlockMinutes?: number;
}

export function deriveActualEventsFromScreenTime({
  existingActualEvents,
  screenTimeSummary,
  distractionThresholdMinutes = 10,
  minScreenTimeBlockMinutes = 15,
}: DeriveActualEventsFromScreenTimeOptions): ScheduledEvent[] {
  const hourlyBucketsSeconds = screenTimeSummary.hourlyBucketsSeconds ?? null;
  if (!hourlyBucketsSeconds || hourlyBucketsSeconds.length === 0) {
    return existingActualEvents;
  }

  // We treat blocks with this prefix as derived, so we can regenerate without clobbering user-entered events.
  const baseActualEvents = existingActualEvents.filter((event) => !event.id.startsWith('st_'));

  const sleepLateBlocks: ScheduledEvent[] = [];

  const distractedActualEvents = baseActualEvents.map((event) => {
    // Don't mark "Screen Time" itself as distracted.
    if (event.category === 'digital') return event;

    const distractedMinutes = estimateDistractedMinutes(event, hourlyBucketsSeconds);
    if (distractedMinutes < distractionThresholdMinutes) return event;

    const distractedLabel = formatMinuteLabel(distractedMinutes);
    if (event.category === 'sleep') {
      // For sleep: interpret phone time as "sleep started late" and (when possible) represent it
      // as a Screen Time block immediately before sleep (only if it won't overlap other non-digital events).
      const nextDescription = `Started late (${distractedLabel} on phone)`;
      const preSleepBlock = buildPreSleepScreenTimeBlock({
        screenTimeSummary,
        sleepEvent: event,
        distractedMinutes,
      });
      if (preSleepBlock) {
        const overlapsNonDigital = baseActualEvents
          .filter((e) => e.category !== 'digital' && e.id !== event.id)
          .some((e) =>
            intervalsOverlap(
              preSleepBlock.startMinutes,
              preSleepBlock.startMinutes + preSleepBlock.duration,
              e.startMinutes,
              e.startMinutes + e.duration,
            ),
          );
        if (!overlapsNonDigital) {
          sleepLateBlocks.push(preSleepBlock);
        }
      }

      return { ...event, description: nextDescription };
    }

    const nextDescription = buildDistractedDescription(event, distractedLabel);

    return {
      ...event,
      description: nextDescription,
    };
  });

  const screenTimeBlocks = deriveStandaloneScreenTimeBlocks({
    screenTimeSummary,
    hourlyBucketsSeconds,
    existingNonDigitalEvents: baseActualEvents.filter((e) => e.category !== 'digital'),
    minScreenTimeBlockMinutes,
  });

  return [...distractedActualEvents, ...sleepLateBlocks, ...screenTimeBlocks].sort((a, b) => a.startMinutes - b.startMinutes);
}

function estimateDistractedMinutes(event: ScheduledEvent, hourlyBucketsSeconds: number[]): number {
  const eventStart = clampMinutes(event.startMinutes);
  const eventEnd = clampMinutes(event.startMinutes + event.duration);
  if (eventEnd <= eventStart) return 0;

  let distractedSeconds = 0;
  const startHour = Math.floor(eventStart / 60);
  const endHour = Math.floor((eventEnd - 1) / 60);

  for (let hour = startHour; hour <= endHour; hour++) {
    const bucketSeconds = hourlyBucketsSeconds[hour] ?? 0;
    if (bucketSeconds <= 0) continue;

    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;
    const overlapMinutes = Math.max(0, Math.min(eventEnd, hourEnd) - Math.max(eventStart, hourStart));
    if (overlapMinutes <= 0) continue;

    // Approximation: usage is uniformly distributed across the hour.
    const hourFraction = overlapMinutes / 60;
    distractedSeconds += bucketSeconds * hourFraction;
  }

  // Round to the nearest 5 minutes to keep labels stable with coarse hourly buckets.
  const distractedMinutesRaw = distractedSeconds / 60;
  return roundToNearest(distractedMinutesRaw, 5);
}

function deriveStandaloneScreenTimeBlocks(options: {
  screenTimeSummary: ScreenTimeSummary;
  hourlyBucketsSeconds: number[];
  existingNonDigitalEvents: ScheduledEvent[];
  minScreenTimeBlockMinutes: number;
}): ScheduledEvent[] {
  const { screenTimeSummary, hourlyBucketsSeconds, existingNonDigitalEvents, minScreenTimeBlockMinutes } = options;
  const topAppName = screenTimeSummary.topApps[0]?.displayName ?? null;
  const description = topAppName ? toScreenTimePhrase(topAppName) : 'Phone use';

  const blocks: ScheduledEvent[] = [];
  let derivedIndex = 0;

  for (let hour = 0; hour < 24; hour++) {
    const bucketSeconds = hourlyBucketsSeconds[hour] ?? 0;
    const bucketMinutes = Math.round(bucketSeconds / 60);
    if (bucketMinutes < minScreenTimeBlockMinutes) continue;

    const startMinutes = hour * 60;
    const duration = clampDurationMinutes(bucketMinutes);
    const endMinutes = startMinutes + duration;

    // Conservative: only render standalone "Screen Time" blocks in truly open space (no overlap at all).
    const overlapsNonDigital = existingNonDigitalEvents.some((e) =>
      intervalsOverlap(startMinutes, endMinutes, e.startMinutes, e.startMinutes + e.duration),
    );
    if (overlapsNonDigital) continue;

    blocks.push({
      id: `st_${screenTimeSummary.generatedAtIso}_${startMinutes}_${derivedIndex++}`,
      title: 'Screen Time',
      description,
      startMinutes,
      duration,
      category: 'digital',
    });
  }

  return blocks;
}

function buildPreSleepScreenTimeBlock(options: {
  screenTimeSummary: ScreenTimeSummary;
  sleepEvent: ScheduledEvent;
  distractedMinutes: number;
}): ScheduledEvent | null {
  const { screenTimeSummary, sleepEvent, distractedMinutes } = options;
  const duration = clampDurationMinutes(distractedMinutes);
  if (duration <= 0) return null;

  const endMinutes = clampMinutes(sleepEvent.startMinutes);
  const startMinutes = clampMinutes(endMinutes - duration);
  if (endMinutes <= startMinutes) return null;

  const topAppName = screenTimeSummary.topApps[0]?.displayName ?? null;
  const description = topAppName ? toScreenTimePhrase(topAppName) : 'Phone use';

  return {
    id: `st_presleep_${screenTimeSummary.generatedAtIso}_${sleepEvent.id}_${startMinutes}`,
    title: 'Screen Time',
    description,
    startMinutes,
    duration: endMinutes - startMinutes,
    category: 'digital',
  };
}

function buildDistractedDescription(event: ScheduledEvent, distractedLabel: string): string {
  // Favor the distraction note for family time (matches the user story).
  if (event.category === 'family') {
    return `Distracted: ${distractedLabel} on phone`;
  }

  if (!event.description) {
    return `Distracted: ${distractedLabel} on phone`;
  }

  return `${event.description} • Distracted: ${distractedLabel} on phone`;
}

function toScreenTimePhrase(appName: string): string {
  const name = appName.toLowerCase();
  if (name.includes('youtube')) return 'YouTube rabbit hole';
  if (name.includes('instagram')) return 'Instagram scroll';
  if (name.includes('tiktok')) return 'TikTok spiral';
  if (name.includes('x ') || name === 'x' || name.includes('twitter')) return 'Endless scroll';
  return appName;
}

function formatMinuteLabel(minutes: number): string {
  if (minutes <= 0) return '0 min';
  return `${minutes} min`;
}

function clampMinutes(minutes: number): number {
  if (minutes < 0) return 0;
  if (minutes > 24 * 60) return 24 * 60;
  return minutes;
}

function clampDurationMinutes(minutes: number): number {
  if (minutes < 5) return 5;
  if (minutes > 60) return 60;
  return minutes;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return end > start;
}

function roundToNearest(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}


