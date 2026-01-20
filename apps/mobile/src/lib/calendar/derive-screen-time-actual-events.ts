import type { ScreenTimeSummary, ScreenTimeAppSession } from '@/lib/ios-insights';
import type { ScheduledEvent } from '@/stores/events-store';
import { classifyAppUsage, type AppCategoryOverrides } from './app-classification';

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
  appCategoryOverrides?: AppCategoryOverrides;
}

interface DistractionInfo {
  totalMinutes: number;
  topApps: Array<{ appName: string; minutes: number }>;
}

interface SleepStartAdjustment {
  sleepStartMinutes: number;
  sleepDurationMinutes: number;
  screenTimeMinutes: number;
  topAppName: string | null;
  screenTimeBlock: ScheduledEvent | null;
}

export function deriveActualEventsFromScreenTime({
  existingActualEvents,
  screenTimeSummary,
  distractionThresholdMinutes = 10,
  minScreenTimeBlockMinutes = 10,
  appCategoryOverrides,
}: DeriveActualEventsFromScreenTimeOptions): ScheduledEvent[] {
  // Prefer sessions for precise overlap detection, fallback to hourlyByApp, then aggregate hourly buckets
  const hasSessions = screenTimeSummary.appSessions && screenTimeSummary.appSessions.length > 0;
  const hasHourlyByApp = screenTimeSummary.hourlyByApp && Object.keys(screenTimeSummary.hourlyByApp).length > 0;
  const hasHourlyBuckets = screenTimeSummary.hourlyBucketsSeconds && screenTimeSummary.hourlyBucketsSeconds.length > 0;

  if (!hasSessions && !hasHourlyByApp && !hasHourlyBuckets) {
    return existingActualEvents;
  }

  // We treat blocks with this prefix as derived, so we can regenerate without clobbering user-entered events.
  const baseActualEvents = existingActualEvents.filter((event) => !event.id.startsWith('st_'));

  const sleepLateBlocks: ScheduledEvent[] = [];

  const distractedActualEvents = baseActualEvents.map((event) => {
    // Don't mark "Screen Time" itself as distracted.
    if (event.category === 'digital') return event;

    // Use sessions for precise detection, fallback to hourlyByApp, then aggregate buckets
    const distractionInfo = hasSessions
      ? calculateDistractionFromSessions(event, screenTimeSummary.appSessions!)
      : hasHourlyByApp
        ? calculateDistractionFromHourlyByApp(event, screenTimeSummary.hourlyByApp!, screenTimeSummary.topApps)
        : calculateDistractionFromAggregateHourly(event, screenTimeSummary.hourlyBucketsSeconds!);

    if (distractionInfo.totalMinutes < distractionThresholdMinutes) return event;

    const distractedLabel = formatMinuteLabel(distractionInfo.totalMinutes);
    const topAppLabel = distractionInfo.topApps.length > 0 ? distractionInfo.topApps[0].appName : null;

    if (event.category === 'sleep') {
      const sleepAdjustment = buildSleepStartScreenTimeAdjustment({
        screenTimeSummary,
        sleepEvent: event,
        minScreenTimeMinutes: distractionThresholdMinutes,
        maxStartOffsetMinutes: 120,
        mergeGapMinutes: 5,
      });
      if (sleepAdjustment) {
        const nextDescription = buildSleepLateDescription({
          distractedMinutes: sleepAdjustment.screenTimeMinutes,
          topAppName: sleepAdjustment.topAppName,
        });
        if (sleepAdjustment.screenTimeBlock) {
          const overlapsNonDigital = baseActualEvents
            .filter((e) => e.category !== 'digital' && e.id !== event.id)
            .some((e) =>
              intervalsOverlap(
                sleepAdjustment.screenTimeBlock.startMinutes,
                sleepAdjustment.screenTimeBlock.startMinutes + sleepAdjustment.screenTimeBlock.duration,
                e.startMinutes,
                e.startMinutes + e.duration,
              ),
            );
          if (!overlapsNonDigital) {
            sleepLateBlocks.push(sleepAdjustment.screenTimeBlock);
          }
        }
        return {
          ...event,
          startMinutes: sleepAdjustment.sleepStartMinutes,
          duration: sleepAdjustment.sleepDurationMinutes,
          description: nextDescription,
        };
      }

      // Fallback: interpret phone time as "sleep started late" and (when possible) represent it
      // as a Screen Time block immediately before sleep (only if it won't overlap other non-digital events).
      const nextDescription = buildSleepLateDescription({
        distractedMinutes: distractionInfo.totalMinutes,
        topAppName: topAppLabel,
      });
      const preSleepBlock = buildPreSleepScreenTimeBlock({
        screenTimeSummary,
        sleepEvent: event,
        distractedMinutes: distractionInfo.totalMinutes,
        topAppName: topAppLabel,
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

    const nextDescription = buildDistractedDescription(event, distractedLabel, topAppLabel);

    return {
      ...event,
      description: nextDescription,
    };
  });

  const screenTimeBlocks = deriveStandaloneScreenTimeBlocks({
    screenTimeSummary,
    hourlyBucketsSeconds: screenTimeSummary.hourlyBucketsSeconds ?? null,
    hourlyByApp: screenTimeSummary.hourlyByApp ?? null,
    appSessions: screenTimeSummary.appSessions ?? null,
    existingNonDigitalEvents: baseActualEvents.filter((e) => e.category !== 'digital'),
    minScreenTimeBlockMinutes,
    appCategoryOverrides,
  });

  return [...distractedActualEvents, ...sleepLateBlocks, ...screenTimeBlocks].sort((a, b) => a.startMinutes - b.startMinutes);
}

/**
 * Calculate distraction using precise session overlap (most accurate).
 */
function calculateDistractionFromSessions(event: ScheduledEvent, appSessions: ScreenTimeAppSession[]): DistractionInfo {
  const eventStartMinutes = clampMinutes(event.startMinutes);
  const eventEndMinutes = clampMinutes(event.startMinutes + event.duration);
  if (eventEndMinutes <= eventStartMinutes) {
    return { totalMinutes: 0, topApps: [] };
  }

  const eventStartMs = minutesToMs(eventStartMinutes);
  const eventEndMs = minutesToMs(eventEndMinutes);

  const appUsage: Record<string, number> = {};

  for (const session of appSessions) {
    const sessionStartMs = new Date(session.startedAtIso).getTime();
    const sessionEndMs = new Date(session.endedAtIso).getTime();

    // Calculate precise overlap
    const overlapStartMs = Math.max(eventStartMs, sessionStartMs);
    const overlapEndMs = Math.min(eventEndMs, sessionEndMs);
    if (overlapEndMs <= overlapStartMs) continue;

    const overlapSeconds = (overlapEndMs - overlapStartMs) / 1000;
    const appName = session.displayName;
    appUsage[appName] = (appUsage[appName] ?? 0) + overlapSeconds;
  }

  const totalSeconds = Object.values(appUsage).reduce((sum, seconds) => sum + seconds, 0);
  const totalMinutes = roundToNearest(totalSeconds / 60, 5);

  const topApps = Object.entries(appUsage)
    .map(([appName, seconds]) => ({ appName, minutes: roundToNearest(seconds / 60, 5) }))
    .filter((app) => app.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);

  return { totalMinutes, topApps };
}

/**
 * Calculate distraction using per-app hourly breakdown (fallback when sessions unavailable).
 */
function calculateDistractionFromHourlyByApp(
  event: ScheduledEvent,
  hourlyByApp: Record<string, Record<number, number>>,
  topApps: Array<{ bundleIdentifier: string; displayName: string }>,
): DistractionInfo {
  const eventStart = clampMinutes(event.startMinutes);
  const eventEnd = clampMinutes(event.startMinutes + event.duration);
  if (eventEnd <= eventStart) {
    return { totalMinutes: 0, topApps: [] };
  }

  const startHour = Math.floor(eventStart / 60);
  const endHour = Math.floor((eventEnd - 1) / 60);

  // Build app ID -> display name mapping
  const appIdToDisplayName = new Map<string, string>();
  for (const app of topApps) {
    appIdToDisplayName.set(app.bundleIdentifier, app.displayName);
  }

  const appUsage: Record<string, number> = {};

  for (let hour = startHour; hour <= endHour; hour++) {
    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;
    const overlapMinutes = Math.max(0, Math.min(eventEnd, hourEnd) - Math.max(eventStart, hourStart));
    if (overlapMinutes <= 0) continue;

    const hourFraction = overlapMinutes / 60;

    // Sum per-app usage for this hour
    for (const [appId, hourData] of Object.entries(hourlyByApp)) {
      const appSeconds = hourData[hour] ?? 0;
      if (appSeconds <= 0) continue;

      // Distribute app usage proportionally across the overlap
      const appOverlapSeconds = appSeconds * hourFraction;
      const appName = appIdToDisplayName.get(appId) ?? appId;
      appUsage[appName] = (appUsage[appName] ?? 0) + appOverlapSeconds;
    }
  }

  const totalSeconds = Object.values(appUsage).reduce((sum, seconds) => sum + seconds, 0);
  const totalMinutes = roundToNearest(totalSeconds / 60, 5);

  const topAppsList = Object.entries(appUsage)
    .map(([appName, seconds]) => ({ appName, minutes: roundToNearest(seconds / 60, 5) }))
    .filter((app) => app.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);

  return { totalMinutes, topApps: topAppsList };
}

/**
 * Calculate distraction using aggregate hourly buckets (fallback when per-app data unavailable).
 */
function calculateDistractionFromAggregateHourly(event: ScheduledEvent, hourlyBucketsSeconds: number[]): DistractionInfo {
  const eventStart = clampMinutes(event.startMinutes);
  const eventEnd = clampMinutes(event.startMinutes + event.duration);
  if (eventEnd <= eventStart) {
    return { totalMinutes: 0, topApps: [] };
  }

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

  const totalMinutes = roundToNearest(distractedSeconds / 60, 5);
  return { totalMinutes, topApps: [] };
}


function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

function deriveStandaloneScreenTimeBlocks(options: {
  screenTimeSummary: ScreenTimeSummary;
  hourlyBucketsSeconds: number[] | null;
  hourlyByApp: Record<string, Record<number, number>> | null;
  appSessions: ScreenTimeAppSession[] | null;
  existingNonDigitalEvents: ScheduledEvent[];
  minScreenTimeBlockMinutes: number;
  appCategoryOverrides?: AppCategoryOverrides;
}): ScheduledEvent[] {
  const {
    screenTimeSummary,
    hourlyBucketsSeconds,
    hourlyByApp,
    appSessions,
    existingNonDigitalEvents,
    minScreenTimeBlockMinutes,
    appCategoryOverrides,
  } = options;

  // Prefer sessions for precise blocks, fallback to hourly data
  if (appSessions && appSessions.length > 0) {
    return deriveBlocksFromSessions(
      appSessions,
      existingNonDigitalEvents,
      minScreenTimeBlockMinutes,
      screenTimeSummary,
      appCategoryOverrides,
    );
  }

  if (hourlyByApp && Object.keys(hourlyByApp).length > 0) {
    return deriveBlocksFromHourlyByApp(
      hourlyByApp,
      existingNonDigitalEvents,
      minScreenTimeBlockMinutes,
      screenTimeSummary,
      appCategoryOverrides,
    );
  }

  if (hourlyBucketsSeconds && hourlyBucketsSeconds.length > 0) {
    return deriveBlocksFromAggregateHourly(
      hourlyBucketsSeconds,
      existingNonDigitalEvents,
      minScreenTimeBlockMinutes,
      screenTimeSummary,
      appCategoryOverrides,
    );
  }

  return [];
}

function deriveBlocksFromSessions(
  appSessions: ScreenTimeAppSession[],
  existingNonDigitalEvents: ScheduledEvent[],
  minScreenTimeBlockMinutes: number,
  screenTimeSummary: ScreenTimeSummary,
  appCategoryOverrides?: AppCategoryOverrides,
): ScheduledEvent[] {
  const blocks: ScheduledEvent[] = [];
  let derivedIndex = 0;

  // Group sessions by hour and check for overlaps
  for (const session of appSessions) {
    const sessionStartMs = new Date(session.startedAtIso).getTime();
    const sessionEndMs = new Date(session.endedAtIso).getTime();
    const sessionStartMinutes = Math.floor(sessionStartMs / (60 * 1000)) % (24 * 60);
    const sessionEndMinutes = Math.floor(sessionEndMs / (60 * 1000)) % (24 * 60);
    const sessionDuration = Math.round((sessionEndMs - sessionStartMs) / (60 * 1000));

    if (sessionDuration < minScreenTimeBlockMinutes) continue;

    // Check if this session overlaps any non-digital events
    const overlapsNonDigital = existingNonDigitalEvents.some((e) =>
      intervalsOverlap(sessionStartMinutes, sessionEndMinutes, e.startMinutes, e.startMinutes + e.duration),
    );
    if (overlapsNonDigital) continue;

    const appName = session.displayName;
    const description = toScreenTimePhrase(appName);
    const classification = classifyAppUsage(appName, appCategoryOverrides);

    blocks.push({
      id: `st_session_${screenTimeSummary.generatedAtIso}_${derivedIndex++}`,
      title: classification.title,
      description,
      startMinutes: sessionStartMinutes,
      duration: clampDurationMinutes(sessionDuration),
      category: classification.category,
      meta: {
        category: classification.category,
        source: 'derived',
        kind: 'screen_time',
        confidence: classification.confidence,
        evidence: {
          topApp: appName,
          screenTimeMinutes: sessionDuration,
        },
      },
    });
  }

  return blocks;
}

function deriveBlocksFromHourlyByApp(
  hourlyByApp: Record<string, Record<number, number>>,
  existingNonDigitalEvents: ScheduledEvent[],
  minScreenTimeBlockMinutes: number,
  screenTimeSummary: ScreenTimeSummary,
  appCategoryOverrides?: AppCategoryOverrides,
): ScheduledEvent[] {
  const blocks: ScheduledEvent[] = [];
  let derivedIndex = 0;

  // Aggregate per-app hourly data into hour-level blocks
  const hourlyTotals: Record<number, { seconds: number; topApp: string | null }> = {};

  for (const [appId, hourData] of Object.entries(hourlyByApp)) {
    for (const [hour, seconds] of Object.entries(hourData)) {
      const hourNum = parseInt(hour, 10);
      if (!hourlyTotals[hourNum]) {
        hourlyTotals[hourNum] = { seconds: 0, topApp: null };
      }
      hourlyTotals[hourNum].seconds += seconds;
      if (!hourlyTotals[hourNum].topApp || seconds > (hourlyTotals[hourNum].seconds - seconds)) {
        hourlyTotals[hourNum].topApp = appId;
      }
    }
  }

  for (let hour = 0; hour < 24; hour++) {
    const hourData = hourlyTotals[hour];
    if (!hourData || hourData.seconds === 0) continue;

    const bucketMinutes = Math.round(hourData.seconds / 60);
    if (bucketMinutes < minScreenTimeBlockMinutes) continue;

    const startMinutes = hour * 60;
    const duration = clampDurationMinutes(bucketMinutes);
    const endMinutes = startMinutes + duration;

    const overlapsNonDigital = existingNonDigitalEvents.some((e) =>
      intervalsOverlap(startMinutes, endMinutes, e.startMinutes, e.startMinutes + e.duration),
    );
    if (overlapsNonDigital) continue;

    const appName = hourData.topApp ?? 'Phone usage';
    const description = hourData.topApp ? toScreenTimePhrase(hourData.topApp) : 'Phone use';
    const classification = classifyAppUsage(appName, appCategoryOverrides);

    blocks.push({
      id: `st_${screenTimeSummary.generatedAtIso}_${startMinutes}_${derivedIndex++}`,
      title: classification.title,
      description,
      startMinutes,
      duration,
      category: classification.category,
      meta: {
        category: classification.category,
        source: 'derived',
        kind: 'screen_time',
        confidence: classification.confidence,
        evidence: {
          topApp: hourData.topApp ?? null,
          screenTimeMinutes: duration,
        },
      },
    });
  }

  return blocks;
}

function deriveBlocksFromAggregateHourly(
  hourlyBucketsSeconds: number[],
  existingNonDigitalEvents: ScheduledEvent[],
  minScreenTimeBlockMinutes: number,
  screenTimeSummary: ScreenTimeSummary,
  appCategoryOverrides?: AppCategoryOverrides,
): ScheduledEvent[] {
  const blocks: ScheduledEvent[] = [];
  let derivedIndex = 0;
  const topAppName = screenTimeSummary.topApps[0]?.displayName ?? null;
  const description = topAppName ? toScreenTimePhrase(topAppName) : 'Phone use';
  const classification = classifyAppUsage(topAppName ?? 'Phone usage', appCategoryOverrides);

  for (let hour = 0; hour < 24; hour++) {
    const bucketSeconds = hourlyBucketsSeconds[hour] ?? 0;
    const bucketMinutes = Math.round(bucketSeconds / 60);
    if (bucketMinutes < minScreenTimeBlockMinutes) continue;

    const startMinutes = hour * 60;
    const duration = clampDurationMinutes(bucketMinutes);
    const endMinutes = startMinutes + duration;

    const overlapsNonDigital = existingNonDigitalEvents.some((e) =>
      intervalsOverlap(startMinutes, endMinutes, e.startMinutes, e.startMinutes + e.duration),
    );
    if (overlapsNonDigital) continue;

    blocks.push({
      id: `st_${screenTimeSummary.generatedAtIso}_${startMinutes}_${derivedIndex++}`,
      title: classification.title,
      description,
      startMinutes,
      duration,
      category: classification.category,
      meta: {
        category: classification.category,
        source: 'derived',
        kind: 'screen_time',
        confidence: classification.confidence,
        evidence: {
          topApp: topAppName,
          screenTimeMinutes: duration,
        },
      },
    });
  }

  return blocks;
}

function buildPreSleepScreenTimeBlock(options: {
  screenTimeSummary: ScreenTimeSummary;
  sleepEvent: ScheduledEvent;
  distractedMinutes: number;
  topAppName: string | null;
}): ScheduledEvent | null {
  const { screenTimeSummary, sleepEvent, distractedMinutes, topAppName } = options;
  const duration = clampDurationMinutes(distractedMinutes);
  if (duration <= 0) return null;

  const endMinutes = clampMinutes(sleepEvent.startMinutes);
  const startMinutes = clampMinutes(endMinutes - duration);
  if (endMinutes <= startMinutes) return null;

  const description = topAppName ? toScreenTimePhrase(topAppName) : 'Phone use';

  return {
    id: `st_presleep_${screenTimeSummary.generatedAtIso}_${sleepEvent.id}_${startMinutes}`,
    title: 'Screen Time',
    description,
    startMinutes,
    duration: endMinutes - startMinutes,
    category: 'digital',
    meta: {
      category: 'digital',
      source: 'derived',
      kind: 'screen_time',
      confidence: 0.6,
      evidence: {
        topApp: topAppName,
        screenTimeMinutes: duration,
      },
    },
  };
}

function buildSleepStartScreenTimeAdjustment(options: {
  screenTimeSummary: ScreenTimeSummary;
  sleepEvent: ScheduledEvent;
  minScreenTimeMinutes: number;
  maxStartOffsetMinutes: number;
  mergeGapMinutes: number;
}): SleepStartAdjustment | null {
  const {
    screenTimeSummary,
    sleepEvent,
    minScreenTimeMinutes,
    maxStartOffsetMinutes,
    mergeGapMinutes,
  } = options;
  if (!screenTimeSummary.appSessions || screenTimeSummary.appSessions.length === 0) {
    return null;
  }

  const sleepStart = clampMinutes(sleepEvent.startMinutes);
  const sleepEnd = clampMinutes(sleepEvent.startMinutes + sleepEvent.duration);
  if (sleepEnd <= sleepStart) return null;

  const sessionIntervals = buildSleepSessionIntervals({
    sessions: screenTimeSummary.appSessions,
    sleepStart,
    sleepEnd,
  });
  if (sessionIntervals.length === 0) return null;

  const mergedIntervals = mergeIntervals(sessionIntervals, mergeGapMinutes);
  const candidate = mergedIntervals
    .filter(
      (interval) =>
        interval.durationMinutes >= minScreenTimeMinutes &&
        interval.startMinutes - sleepStart <= maxStartOffsetMinutes,
    )
    .at(-1);
  if (!candidate) return null;

  const remainingMinutes = sleepEnd - candidate.endMinutes;
  if (remainingMinutes < 15) return null;

  return {
    sleepStartMinutes: candidate.endMinutes,
    sleepDurationMinutes: remainingMinutes,
    screenTimeMinutes: candidate.durationMinutes,
    topAppName: candidate.topAppName,
    screenTimeBlock: {
      id: `st_sleepstart_${screenTimeSummary.generatedAtIso}_${sleepEvent.id}_${candidate.startMinutes}`,
      title: 'Screen Time',
      description: candidate.topAppName ? toScreenTimePhrase(candidate.topAppName) : 'Phone use',
      startMinutes: candidate.startMinutes,
      duration: candidate.durationMinutes,
      category: 'digital',
      meta: {
        category: 'digital',
        source: 'derived',
        kind: 'screen_time',
        confidence: 0.6,
        evidence: {
          topApp: candidate.topAppName,
          screenTimeMinutes: candidate.durationMinutes,
        },
      },
    },
  };
}

function buildSleepLateDescription(options: { distractedMinutes: number; topAppName: string | null }): string {
  const { distractedMinutes, topAppName } = options;
  const distractedLabel = formatMinuteLabel(distractedMinutes);
  if (topAppName) {
    return `Started late (Stayed up scrolling on ${topAppName}, ${distractedLabel})`;
  }
  return `Started late (Stayed up scrolling, ${distractedLabel})`;
}

function buildSleepSessionIntervals(options: {
  sessions: ScreenTimeAppSession[];
  sleepStart: number;
  sleepEnd: number;
}): Array<{ startMinutes: number; endMinutes: number; durationMinutes: number; topAppName: string | null }> {
  const { sessions, sleepStart, sleepEnd } = options;
  const intervals: Array<{ startMinutes: number; endMinutes: number; appName: string }> = [];

  for (const session of sessions) {
    const sessionStartMs = new Date(session.startedAtIso).getTime();
    const sessionEndMs = new Date(session.endedAtIso).getTime();
    const sessionStartMinutes = Math.floor(sessionStartMs / (60 * 1000)) % (24 * 60);
    const sessionEndMinutes = Math.floor(sessionEndMs / (60 * 1000)) % (24 * 60);
    const overlapStart = Math.max(sleepStart, sessionStartMinutes);
    const overlapEnd = Math.min(sleepEnd, sessionEndMinutes);
    if (overlapEnd <= overlapStart) continue;
    intervals.push({
      startMinutes: overlapStart,
      endMinutes: overlapEnd,
      appName: session.displayName,
    });
  }

  intervals.sort((a, b) => a.startMinutes - b.startMinutes);

  return intervals.map((interval) => ({
    startMinutes: interval.startMinutes,
    endMinutes: interval.endMinutes,
    durationMinutes: interval.endMinutes - interval.startMinutes,
    topAppName: interval.appName,
  }));
}

function mergeIntervals(
  intervals: Array<{ startMinutes: number; endMinutes: number; topAppName: string | null }>,
  gapMinutes: number,
): Array<{ startMinutes: number; endMinutes: number; durationMinutes: number; topAppName: string | null }> {
  if (intervals.length === 0) return [];
  const merged: Array<{ startMinutes: number; endMinutes: number; topAppName: string | null }> = [];

  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...interval });
      continue;
    }
    if (interval.startMinutes <= last.endMinutes + gapMinutes) {
      last.endMinutes = Math.max(last.endMinutes, interval.endMinutes);
      if (!last.topAppName && interval.topAppName) {
        last.topAppName = interval.topAppName;
      }
      continue;
    }
    merged.push({ ...interval });
  }

  return merged.map((interval) => ({
    ...interval,
    durationMinutes: interval.endMinutes - interval.startMinutes,
  }));
}

function buildDistractedDescription(event: ScheduledEvent, distractedLabel: string, topAppName: string | null): string {
  const appLabel = topAppName ? `on ${topAppName}` : 'on phone';

  // Favor the distraction note for family time (matches the user story).
  if (event.category === 'family') {
    return `Distracted: ${distractedLabel} ${appLabel}`;
  }

  if (!event.description) {
    return `Distracted: ${distractedLabel} ${appLabel}`;
  }

  return `${event.description} • Distracted: ${distractedLabel} ${appLabel}`;
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
