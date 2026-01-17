import type { ScheduledEvent } from '@/stores';
import type { EvidenceBundle, LocationHourlyRow } from '@/lib/supabase/services/evidence-data';
import type { UsageSummary } from '@/lib/android-insights';
import type { ActualBlock, VerificationResult } from './verification-engine';
import { appMatchesList, DISTRACTION_APPS, WORK_APPS } from './verification-rules';

export const DERIVED_ACTUAL_PREFIX = 'derived_actual:';
export const DERIVED_EVIDENCE_PREFIX = 'derived_evidence:';

const MIN_EVIDENCE_BLOCK_MINUTES = 10;
const DISTRACTION_THRESHOLD_MINUTES = 10;
const PRODUCTIVE_APPS = ['calculator', 'notes', 'today matters', 'todaymatters', 'mobile'];
const SCREEN_TIME_GAP_MINUTES = 15;
const SLEEP_SCREEN_TIME_GAP_MINUTES = 5;
const SLEEP_MAX_START_OFFSET_MINUTES = 120;
const SLEEP_MIN_REMAINING_MINUTES = 30;
const SLEEP_OVERRIDE_MIN_COVERAGE = 0.7;
const SLEEP_OVERRIDE_MIN_MINUTES = 60;

interface BuildActualDisplayEventsInput {
  ymd: string;
  plannedEvents: ScheduledEvent[];
  actualEvents: ScheduledEvent[];
  derivedActualEvents?: ScheduledEvent[] | null;
  actualBlocks?: ActualBlock[];
  verificationResults?: Map<string, VerificationResult>;
  evidence?: EvidenceBundle | null;
  usageSummary?: UsageSummary | null;
  minEvidenceBlockMinutes?: number;
}

interface LocationBlock {
  startMinutes: number;
  endMinutes: number;
  placeLabel: string;
  placeCategory: string | null;
}

interface SleepStartAdjustment {
  sleepStartMinutes: number;
  sleepDurationMinutes: number;
  screenTimeMinutes: number;
  topAppName: string | null;
  screenTimeBlock: ScheduledEvent;
}

interface SleepOverrideInterval {
  startMinutes: number;
  endMinutes: number;
  topAppName: string | null;
}

export function buildActualDisplayEvents({
  ymd,
  plannedEvents,
  actualEvents,
  derivedActualEvents,
  actualBlocks = [],
  verificationResults,
  evidence,
  usageSummary,
  minEvidenceBlockMinutes = MIN_EVIDENCE_BLOCK_MINUTES,
}: BuildActualDisplayEventsInput): ScheduledEvent[] {
  const locationBlocks = evidence ? buildLocationBlocks(ymd, evidence.locationHourly) : [];
  const plannedSorted = [...plannedEvents].sort((a, b) => a.startMinutes - b.startMinutes);

  const sleepOverrideIntervals = buildSleepScheduleIntervals(plannedSorted);

  const filteredActualEvents = actualEvents.filter((event) => event.category !== 'sleep');

  const results: ScheduledEvent[] = [...filteredActualEvents];
  const occupied: Array<{ start: number; end: number }> = results.map((event) => ({
    start: event.startMinutes,
    end: event.startMinutes + event.duration,
  }));

  const addIfFree = (event: ScheduledEvent, minOverlapMinutes = 1) => {
    const start = event.startMinutes;
    const end = event.startMinutes + event.duration;
    if (end <= start) return;
    if (hasOverlap(start, end, occupied, minOverlapMinutes)) return;
    results.push(event);
    occupied.push({ start, end });
  };

  if (derivedActualEvents && derivedActualEvents.length > 0) {
    for (const event of derivedActualEvents) {
      const existingIndex = results.findIndex((candidate) => candidate.id === event.id);
      if (existingIndex >= 0) {
        results[existingIndex] = event;
        occupied[existingIndex] = {
          start: event.startMinutes,
          end: event.startMinutes + event.duration,
        };
        continue;
      }
      const nextEvent =
        event.id.startsWith('st_') || event.id.startsWith('st_session_')
          ? { ...event, id: `${DERIVED_EVIDENCE_PREFIX}${event.id}` }
          : event;
      addIfFree(nextEvent);
    }
  }

  if (usageSummary) {

    if (sleepOverrideIntervals.length > 0) {
      const sleepOverrideBlocks = buildSleepOverrideBlocksFromUsageSummary({
        usageSummary,
        intervals: sleepOverrideIntervals,
        minMinutes: minEvidenceBlockMinutes,
      });
      for (const block of sleepOverrideBlocks) {
        results.push(block);
        occupied.push({ start: block.startMinutes, end: block.startMinutes + block.duration });
      }
    }

    const usageBlocks = deriveUsageSummaryBlocks({
      usageSummary,
      plannedEvents: plannedSorted,
      minMinutes: minEvidenceBlockMinutes,
    });
    for (const block of usageBlocks) {
      addIfFree(block);
    }
  }

  if (actualBlocks.length > 0) {
    for (const block of actualBlocks) {
      const duration = Math.max(1, block.endMinutes - block.startMinutes);
      if (duration < minEvidenceBlockMinutes) continue;
      addIfFree({
        id: `${DERIVED_EVIDENCE_PREFIX}${block.id}`,
        title: block.title,
        description: block.description ?? '',
        startMinutes: block.startMinutes,
        duration,
        category: block.category,
      });
    }
  }

  for (const planned of plannedSorted) {
    let plannedForDerivation = planned;
    let sleepAdjustment: SleepStartAdjustment | null = null;
    const isSleepOverridden =
      planned.category === 'sleep' &&
      sleepOverrideIntervals.some((interval) =>
        intervalsOverlap(
          planned.startMinutes,
          planned.startMinutes + planned.duration,
          interval.startMinutes,
          interval.endMinutes,
        ),
      );

    if (isSleepOverridden) {
      continue;
    }

    if (planned.category === 'sleep' && usageSummary) {
      sleepAdjustment = buildSleepStartAdjustmentFromUsageSummary({
        usageSummary,
        sleepEvent: planned,
        minScreenTimeMinutes: DISTRACTION_THRESHOLD_MINUTES,
        maxStartOffsetMinutes: SLEEP_MAX_START_OFFSET_MINUTES,
        mergeGapMinutes: SLEEP_SCREEN_TIME_GAP_MINUTES,
        minRemainingMinutes: SLEEP_MIN_REMAINING_MINUTES,
      });
      if (sleepAdjustment) {
        plannedForDerivation = {
          ...planned,
          startMinutes: sleepAdjustment.sleepStartMinutes,
          duration: sleepAdjustment.sleepDurationMinutes,
          description: buildSleepLateDescription({
            minutes: sleepAdjustment.screenTimeMinutes,
            topAppName: sleepAdjustment.topAppName,
          }),
        };
      }
    }

    const plannedStart = plannedForDerivation.startMinutes;
    const plannedEnd = plannedForDerivation.startMinutes + plannedForDerivation.duration;
    if (hasOverlap(plannedStart, plannedEnd, occupied, 10)) {
      continue;
    }

    if (sleepAdjustment) {
      addIfFree(sleepAdjustment.screenTimeBlock, 5);
    }

    const verification = verificationResults?.get(planned.id) ?? null;
    const derived = buildPlannedActualEvent({
      planned: plannedForDerivation,
      verification,
      plannedEvents: plannedSorted,
      locationBlocks,
      usageSummary,
    });
    if (!derived) continue;
    addIfFree(derived, 1);
  }

  const sleepOverrideApplied = sleepOverrideIntervals.length > 0;
  const filteredResults = sleepOverrideApplied
    ? results.filter((event) => {
        if (event.category !== 'sleep') return true;
        const start = event.startMinutes;
        const end = event.startMinutes + event.duration;
        const overlapsOverride = sleepOverrideIntervals.some((interval) =>
          intervalsOverlap(start, end, interval.startMinutes, interval.endMinutes),
        );
        return !overlapsOverride;
      })
    : results;

  const withUnknowns = fillUnknownGaps(filteredResults);
  const withSleepFilled = replaceUnknownWithSleepSchedule(withUnknowns, sleepOverrideIntervals);
  const withProductiveFilled = replaceUnknownWithProductiveUsage(
    withSleepFilled,
    usageSummary,
    minEvidenceBlockMinutes,
  );

  return mergeAdjacentSleep(withProductiveFilled).sort((a, b) => a.startMinutes - b.startMinutes);
}

function buildPlannedActualEvent(options: {
  planned: ScheduledEvent;
  verification: VerificationResult | null;
  plannedEvents: ScheduledEvent[];
  locationBlocks: LocationBlock[];
  usageSummary?: UsageSummary | null;
}): ScheduledEvent | null {
  const { planned, verification, plannedEvents, locationBlocks, usageSummary } = options;
  const startMinutes = clampMinutes(planned.startMinutes);
  const plannedEnd = clampMinutes(planned.startMinutes + planned.duration);
  if (plannedEnd <= startMinutes) return null;

  const nextPlannedStart = plannedEvents.find((e) => e.startMinutes > planned.startMinutes)?.startMinutes;
  const maxEnd = nextPlannedStart !== undefined ? Math.min(nextPlannedStart, 24 * 60) : 24 * 60;

  const locationEvidence = verification?.evidence.location;
  const matchingLocation = locationEvidence?.matchesExpected
    ? findMatchingLocationBlock(locationBlocks, startMinutes, plannedEnd, locationEvidence)
    : null;

  let actualEnd = plannedEnd;
  if (matchingLocation && matchingLocation.endMinutes > plannedEnd) {
    const candidateEnd = Math.min(matchingLocation.endMinutes, maxEnd);
    if (candidateEnd - plannedEnd >= MIN_EVIDENCE_BLOCK_MINUTES) {
      actualEnd = candidateEnd;
    }
  }

  const usageInfo = usageSummary
    ? getUsageOverlapInfo(usageSummary, startMinutes, actualEnd)
    : null;

  const description = buildActualDescription({
    planned,
    verification,
    extendedMinutes: Math.max(0, actualEnd - plannedEnd),
    locationLabel: matchingLocation?.placeLabel ?? locationEvidence?.placeLabel ?? null,
    usageInfo,
  });

  return {
    ...planned,
    id: `${DERIVED_ACTUAL_PREFIX}${planned.id}`,
    description,
    startMinutes,
    duration: Math.max(1, actualEnd - startMinutes),
    location: planned.location ?? matchingLocation?.placeLabel ?? planned.location,
  };
}

function buildActualDescription(options: {
  planned: ScheduledEvent;
  verification: VerificationResult | null;
  extendedMinutes: number;
  locationLabel: string | null;
  usageInfo: UsageOverlapInfo | null;
}): string {
  const { planned, verification, extendedMinutes, locationLabel, usageInfo } = options;
  const parts: string[] = [];

  if (planned.description?.trim()) {
    parts.push(planned.description.trim());
  }

  if (planned.category === 'sleep' && usageInfo && usageInfo.totalMinutes >= DISTRACTION_THRESHOLD_MINUTES) {
    parts.push(
      buildSleepLateDescription({
        minutes: usageInfo.totalMinutes,
        topAppName: usageInfo.topApp,
      }),
    );
    return parts.join(' • ');
  }

  if (extendedMinutes >= MIN_EVIDENCE_BLOCK_MINUTES) {
    parts.push(`Ran ${Math.round(extendedMinutes)} min over`);
  }

  if (locationLabel && !planned.location) {
    parts.push(`At ${locationLabel}`);
  }

  const screenTime = verification?.evidence.screenTime ?? null;
  if (screenTime) {
    const distractionMinutes = Math.round(screenTime.distractionMinutes);
    const totalMinutes = Math.round(screenTime.totalMinutes);
    const topApp = screenTime.topApps[0]?.app;

    if (distractionMinutes >= DISTRACTION_THRESHOLD_MINUTES) {
      parts.push(`Distracted: ${distractionMinutes} min${topApp ? ` on ${topApp}` : ''}`);
    } else if (totalMinutes >= DISTRACTION_THRESHOLD_MINUTES && planned.category !== 'digital') {
      parts.push(`Phone use: ${totalMinutes} min${topApp ? ` on ${topApp}` : ''}`);
    }
  } else if (usageInfo && usageInfo.totalMinutes >= DISTRACTION_THRESHOLD_MINUTES) {
    const minutes = Math.round(usageInfo.totalMinutes);
    if (usageInfo.isDistraction) {
      parts.push(`Distracted: ${minutes} min${usageInfo.topApp ? ` on ${usageInfo.topApp}` : ''}`);
    } else if (usageInfo.isProductive) {
      parts.push(`Productive: ${minutes} min${usageInfo.topApp ? ` on ${usageInfo.topApp}` : ''}`);
    } else {
      parts.push(`Phone use: ${minutes} min${usageInfo.topApp ? ` on ${usageInfo.topApp}` : ''}`);
    }
  }

  if (verification?.status === 'contradicted' && verification.reason) {
    parts.push(verification.reason);
  }

  return parts.join(' • ');
}

function buildLocationBlocks(ymd: string, rows: LocationHourlyRow[]): LocationBlock[] {
  const blocks: LocationBlock[] = [];
  const dayStart = ymdToDate(ymd);
  const sorted = [...rows].sort((a, b) => a.hour_start.localeCompare(b.hour_start));
  let current: LocationBlock | null = null;

  for (const row of sorted) {
    const hourStart = new Date(row.hour_start);
    const startMinutes = Math.floor((hourStart.getTime() - dayStart.getTime()) / 60_000);
    if (startMinutes < 0 || startMinutes >= 24 * 60) continue;

    const placeLabel = row.place_label || row.place_category || '';
    const placeCategory = row.place_category ?? null;
    const nextStart = startMinutes;
    const nextEnd = startMinutes + 60;

    if (
      current &&
      current.placeLabel.toLowerCase() === placeLabel.toLowerCase() &&
      current.endMinutes === nextStart
    ) {
      current.endMinutes = nextEnd;
      continue;
    }

    current = {
      startMinutes: nextStart,
      endMinutes: nextEnd,
      placeLabel,
      placeCategory,
    };
    blocks.push(current);
  }

  return blocks;
}

function findMatchingLocationBlock(
  blocks: LocationBlock[],
  startMinutes: number,
  endMinutes: number,
  evidence: { placeLabel: string | null; placeCategory: string | null }
): LocationBlock | null {
  const label = evidence.placeLabel?.toLowerCase() ?? null;
  const category = evidence.placeCategory?.toLowerCase() ?? null;

  for (const block of blocks) {
    if (!intervalsOverlap(startMinutes, endMinutes, block.startMinutes, block.endMinutes)) {
      continue;
    }
    const blockLabel = block.placeLabel.toLowerCase();
    const blockCategory = block.placeCategory?.toLowerCase() ?? null;
    const labelMatches = label && blockLabel === label;
    const categoryMatches = category && blockCategory === category;
    if (labelMatches || categoryMatches) {
      return block;
    }
  }

  return null;
}

function hasOverlap(
  start: number,
  end: number,
  intervals: Array<{ start: number; end: number }>,
  minMinutes: number
): boolean {
  return intervals.some((interval) => overlapMinutes(start, end, interval.start, interval.end) >= minMinutes);
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return overlapMinutes(aStart, aEnd, bStart, bEnd) > 0;
}

function clampMinutes(minutes: number): number {
  if (minutes < 0) return 0;
  if (minutes > 24 * 60) return 24 * 60;
  return minutes;
}

function ymdToDate(ymd: string): Date {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day, 0, 0, 0, 0);
}

function fillUnknownGaps(events: ScheduledEvent[]): ScheduledEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const filled: ScheduledEvent[] = [];
  let cursor = 0;

  for (const event of sorted) {
    const start = clampMinutes(event.startMinutes);
    const end = clampMinutes(event.startMinutes + event.duration);
    if (start > cursor) {
      const gapDuration = Math.max(1, start - cursor);
      filled.push(buildUnknownEvent(cursor, gapDuration));
    }
    filled.push(event);
    cursor = Math.max(cursor, end);
  }

  if (cursor < 24 * 60) {
    const gapDuration = Math.max(1, 24 * 60 - cursor);
    filled.push(buildUnknownEvent(cursor, gapDuration));
  }

  return mergeAdjacentUnknowns(filled);
}

function replaceUnknownWithSleepSchedule(
  events: ScheduledEvent[],
  sleepIntervals: Array<{ startMinutes: number; endMinutes: number }>,
): ScheduledEvent[] {
  if (sleepIntervals.length === 0) return events;

  const sortedIntervals = [...sleepIntervals]
    .map((interval) => ({
      startMinutes: clampMinutes(interval.startMinutes),
      endMinutes: clampMinutes(interval.endMinutes),
    }))
    .filter((interval) => interval.endMinutes > interval.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const updated: ScheduledEvent[] = [];

  for (const event of events) {
    if (event.category !== 'unknown') {
      updated.push(event);
      continue;
    }

    const start = clampMinutes(event.startMinutes);
    const end = clampMinutes(event.startMinutes + event.duration);
    if (end <= start) continue;

    let cursor = start;
    for (const interval of sortedIntervals) {
      if (interval.endMinutes <= cursor) continue;
      if (interval.startMinutes >= end) break;

      const overlapStart = Math.max(cursor, interval.startMinutes);
      const overlapEnd = Math.min(end, interval.endMinutes);

      if (overlapStart > cursor) {
        updated.push(buildUnknownEvent(cursor, overlapStart - cursor));
      }

      if (overlapEnd > overlapStart) {
        updated.push(buildInterruptedSleepEvent(overlapStart, overlapEnd - overlapStart));
      }

      cursor = Math.max(cursor, overlapEnd);
    }

    if (cursor < end) {
      updated.push(buildUnknownEvent(cursor, end - cursor));
    }
  }

  return mergeAdjacentUnknowns(updated);
}

function replaceUnknownWithProductiveUsage(
  events: ScheduledEvent[],
  usageSummary: UsageSummary | null | undefined,
  minMinutes: number,
): ScheduledEvent[] {
  if (!usageSummary) return events;

  const updated: ScheduledEvent[] = [];

  for (const event of events) {
    if (event.category !== 'unknown') {
      updated.push(event);
      continue;
    }

    const start = clampMinutes(event.startMinutes);
    const end = clampMinutes(event.startMinutes + event.duration);
    if (end <= start) continue;

    const usageInfo = getUsageOverlapInfo(usageSummary, start, end);
    if (!usageInfo || !usageInfo.isProductive || usageInfo.totalMinutes < minMinutes) {
      updated.push(event);
      continue;
    }

    const durationMinutes = Math.round(Math.min(usageInfo.totalMinutes, end - start));
    updated.push(buildProductiveUnknownEvent(start, durationMinutes, usageInfo.topApp));
  }

  return updated;
}

function buildInterruptedSleepEvent(startMinutes: number, duration: number): ScheduledEvent {
  return {
    id: `${DERIVED_ACTUAL_PREFIX}sleep_interrupted_${startMinutes}_${duration}`,
    title: 'Sleep',
    description: 'Sleep schedule • Ended early (Interrupted)',
    startMinutes,
    duration,
    category: 'sleep',
  };
}

function buildProductiveUnknownEvent(startMinutes: number, duration: number, topAppName: string | null): ScheduledEvent {
  const minutes = Math.max(1, Math.round(duration));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
  const appLabel = topAppName ? ` on ${topAppName}` : '';

  return {
    id: `${DERIVED_ACTUAL_PREFIX}productive_${startMinutes}_${minutes}`,
    title: 'Productive',
    description: `${durationLabel}${appLabel}`,
    startMinutes,
    duration: minutes,
    category: 'work',
  };
}

function buildUnknownEvent(startMinutes: number, duration: number): ScheduledEvent {
  return {
    id: `${DERIVED_ACTUAL_PREFIX}unknown_${startMinutes}_${duration}`,
    title: 'Unknown',
    description: 'Tap to assign',
    startMinutes,
    duration,
    category: 'unknown',
  };
}

function mergeAdjacentUnknowns(events: ScheduledEvent[]): ScheduledEvent[] {
  const merged: ScheduledEvent[] = [];

  for (const event of events) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.category === 'unknown' &&
      event.category === 'unknown' &&
      last.startMinutes + last.duration === event.startMinutes
    ) {
      last.duration += event.duration;
      continue;
    }

    merged.push(event);
  }

  return merged;
}

function mergeAdjacentSleep(events: ScheduledEvent[]): ScheduledEvent[] {
  const merged: ScheduledEvent[] = [];

  for (const event of events) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.category === 'sleep' &&
      event.category === 'sleep' &&
      last.description === event.description &&
      last.startMinutes + last.duration === event.startMinutes
    ) {
      last.duration += event.duration;
      continue;
    }

    merged.push(event);
  }

  return merged;
}
function deriveUsageSummaryBlocks(options: {
  usageSummary: UsageSummary;
  plannedEvents: ScheduledEvent[];
  minMinutes: number;
}): ScheduledEvent[] {
  const { usageSummary, plannedEvents, minMinutes } = options;
  const plannedIntervals = plannedEvents.map((event) => ({
    start: event.startMinutes,
    end: event.startMinutes + event.duration,
  }));

  const appIdToName = new Map(usageSummary.topApps.map((app) => [app.packageName, app.displayName]));

  if (usageSummary.sessions && usageSummary.sessions.length > 0) {
    const sessions = [...usageSummary.sessions].sort((a, b) => a.startIso.localeCompare(b.startIso));
    const blocks: Array<{ startMinutes: number; endMinutes: number; topApp: string }> = [];
    let current: { startMinutes: number; endMinutes: number; topApp: string } | null = null;

    for (const session of sessions) {
      const start = new Date(session.startIso);
      const end = new Date(session.endIso);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const topApp = appIdToName.get(session.packageName) ?? session.packageName;

      if (current && startMinutes - current.endMinutes <= SCREEN_TIME_GAP_MINUTES) {
        current.endMinutes = Math.max(current.endMinutes, endMinutes);
        continue;
      }

      if (current) blocks.push(current);
      current = {
        startMinutes: clampMinutes(startMinutes),
        endMinutes: clampMinutes(endMinutes),
        topApp,
      };
    }
    if (current) blocks.push(current);

    return blocks
      .filter((b) => b.endMinutes - b.startMinutes >= minMinutes)
      .filter((b) => !hasOverlap(b.startMinutes, b.endMinutes, plannedIntervals, 5))
      .map((b) => buildScreenTimeEvent(b.startMinutes, b.endMinutes, b.topApp, usageSummary.generatedAtIso));
  }

  if (usageSummary.hourlyByApp && Object.keys(usageSummary.hourlyByApp).length > 0) {
    const hourlyTotals: Record<number, { seconds: number; topApp: string }> = {};
    for (const [appId, hours] of Object.entries(usageSummary.hourlyByApp)) {
      for (const [hourKey, seconds] of Object.entries(hours)) {
        const hour = Number(hourKey);
        if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
        if (!hourlyTotals[hour]) {
          hourlyTotals[hour] = { seconds: 0, topApp: appId };
        }
        hourlyTotals[hour].seconds += seconds;
        if (seconds > hourlyTotals[hour].seconds - seconds) {
          hourlyTotals[hour].topApp = appId;
        }
      }
    }

    return Object.entries(hourlyTotals)
      .map(([hourKey, data]) => {
        const hour = Number(hourKey);
        const durationMinutes = Math.round(data.seconds / 60);
        const startMinutes = hour * 60;
        const endMinutes = startMinutes + durationMinutes;
        const topApp = appIdToName.get(data.topApp) ?? data.topApp;
        return { startMinutes, endMinutes, topApp };
      })
      .filter((b) => b.endMinutes - b.startMinutes >= minMinutes)
      .filter((b) => !hasOverlap(b.startMinutes, b.endMinutes, plannedIntervals, 5))
      .map((b) => buildScreenTimeEvent(b.startMinutes, b.endMinutes, b.topApp, usageSummary.generatedAtIso));
  }

  if (usageSummary.hourlyBucketsSeconds && usageSummary.hourlyBucketsSeconds.length > 0) {
    const topApp = usageSummary.topApps[0]?.displayName ?? 'Phone usage';
    return usageSummary.hourlyBucketsSeconds
      .map((seconds, hour) => {
        const durationMinutes = Math.round(seconds / 60);
        const startMinutes = hour * 60;
        const endMinutes = startMinutes + durationMinutes;
        return { startMinutes, endMinutes, topApp };
      })
      .filter((b) => b.endMinutes - b.startMinutes >= minMinutes)
      .filter((b) => !hasOverlap(b.startMinutes, b.endMinutes, plannedIntervals, 5))
      .map((b) => buildScreenTimeEvent(b.startMinutes, b.endMinutes, b.topApp, usageSummary.generatedAtIso));
  }

  return [];
}

function buildSleepOverrideBlocksFromUsageSummary(options: {
  usageSummary: UsageSummary;
  intervals: SleepOverrideInterval[];
  minMinutes: number;
}): ScheduledEvent[] {
  const { usageSummary, intervals, minMinutes } = options;
  const blocks: ScheduledEvent[] = [];

  for (const interval of intervals) {
    const intervalBlocks = deriveUsageSummaryBlocksForInterval({
      usageSummary,
      startMinutes: interval.startMinutes,
      endMinutes: interval.endMinutes,
      minMinutes,
    });
    for (const block of intervalBlocks) {
      blocks.push({
        ...block,
        title: 'Screen Time',
        description: buildSleepOverrideDescription({
          topAppName: block.description || interval.topAppName,
        }),
        category: 'digital',
      });
    }
  }

  return blocks;
}

function buildSleepScheduleIntervals(plannedEvents: ScheduledEvent[]): SleepOverrideInterval[] {
  return plannedEvents
    .filter((event) => event.category === 'sleep')
    .map((event) => ({
      startMinutes: clampMinutes(event.startMinutes),
      endMinutes: clampMinutes(event.startMinutes + event.duration),
      topAppName: null,
    }))
    .filter((interval) => interval.endMinutes > interval.startMinutes);
}

function buildSleepOverrideIntervals(options: {
  usageSummary: UsageSummary;
  plannedEvents: ScheduledEvent[];
  actualEvents: ScheduledEvent[];
  verificationResults?: Map<string, VerificationResult>;
  locationBlocks: LocationBlock[];
}): SleepOverrideInterval[] {
  const { usageSummary, plannedEvents, actualEvents, verificationResults, locationBlocks } = options;

  const plannedOverrides = plannedEvents
    .filter((event) => event.category === 'sleep')
    .map((event) => {
      const startMinutes = clampMinutes(event.startMinutes);
      const plannedEnd = clampMinutes(event.startMinutes + event.duration);
      if (plannedEnd <= startMinutes) return null;

      const nextPlannedStart = plannedEvents.find((e) => e.startMinutes > event.startMinutes)?.startMinutes;
      const maxEnd = nextPlannedStart !== undefined ? Math.min(nextPlannedStart, 24 * 60) : 24 * 60;

      const verification = verificationResults?.get(event.id) ?? null;
      const locationEvidence = verification?.evidence.location;
      const matchingLocation = locationEvidence?.matchesExpected
        ? findMatchingLocationBlock(locationBlocks, startMinutes, plannedEnd, locationEvidence)
        : null;

      let actualEnd = plannedEnd;
      if (matchingLocation && matchingLocation.endMinutes > plannedEnd) {
        const candidateEnd = Math.min(matchingLocation.endMinutes, maxEnd);
        if (candidateEnd - plannedEnd >= MIN_EVIDENCE_BLOCK_MINUTES) {
          actualEnd = candidateEnd;
        }
      }

      const duration = Math.max(0, actualEnd - startMinutes);
      if (duration === 0) return null;

      const usageInfo = getUsageOverlapInfo(usageSummary, startMinutes, actualEnd);
      if (!usageInfo) return null;
      const isOverride =
        usageInfo.totalMinutes >= Math.max(SLEEP_OVERRIDE_MIN_MINUTES, duration * SLEEP_OVERRIDE_MIN_COVERAGE);
      if (!isOverride) return null;

      return {
        startMinutes,
        endMinutes: actualEnd,
        topAppName: usageInfo.topApp,
      } as SleepOverrideInterval;
    })
    .filter((interval): interval is SleepOverrideInterval => Boolean(interval));

  const actualOverrides = actualEvents
    .filter((event) => event.category === 'sleep')
    .map((event) => {
      const startMinutes = clampMinutes(event.startMinutes);
      const endMinutes = clampMinutes(event.startMinutes + event.duration);
      const duration = Math.max(0, endMinutes - startMinutes);
      if (duration === 0) return null;
      const usageInfo = getUsageOverlapInfo(usageSummary, startMinutes, endMinutes);
      if (!usageInfo) return null;
      const isOverride =
        usageInfo.totalMinutes >= Math.max(SLEEP_OVERRIDE_MIN_MINUTES, duration * SLEEP_OVERRIDE_MIN_COVERAGE);
      if (!isOverride) return null;
      return {
        startMinutes,
        endMinutes,
        topAppName: usageInfo.topApp,
      } as SleepOverrideInterval;
    })
    .filter((interval): interval is SleepOverrideInterval => Boolean(interval));

  const overrides = [...plannedOverrides, ...actualOverrides];
  if (overrides.length === 0) return [];

  const merged = mergeIntervals(
    overrides.map((interval) => ({ startMinutes: interval.startMinutes, endMinutes: interval.endMinutes })),
    SLEEP_SCREEN_TIME_GAP_MINUTES,
  );

  return merged.map((interval) => ({
    ...interval,
    topAppName: overrides.find((candidate) =>
      intervalsOverlap(interval.startMinutes, interval.endMinutes, candidate.startMinutes, candidate.endMinutes),
    )?.topAppName ?? null,
  }));
}

function deriveUsageSummaryBlocksForInterval(options: {
  usageSummary: UsageSummary;
  startMinutes: number;
  endMinutes: number;
  minMinutes: number;
}): ScheduledEvent[] {
  const { usageSummary, startMinutes, endMinutes, minMinutes } = options;
  if (endMinutes <= startMinutes) return [];

  const appIdToName = new Map(usageSummary.topApps.map((app) => [app.packageName, app.displayName]));
  const blocks: Array<{ startMinutes: number; endMinutes: number }> = [];

  if (usageSummary.sessions && usageSummary.sessions.length > 0) {
    const sessions = [...usageSummary.sessions].sort((a, b) => a.startIso.localeCompare(b.startIso));
    let current: { startMinutes: number; endMinutes: number } | null = null;

    for (const session of sessions) {
      const start = new Date(session.startIso);
      const end = new Date(session.endIso);
      const sessionStart = start.getHours() * 60 + start.getMinutes();
      const sessionEnd = end.getHours() * 60 + end.getMinutes();
      const clippedStart = Math.max(startMinutes, sessionStart);
      const clippedEnd = Math.min(endMinutes, sessionEnd);
      if (clippedEnd <= clippedStart) continue;

      if (current && clippedStart - current.endMinutes <= SLEEP_SCREEN_TIME_GAP_MINUTES) {
        current.endMinutes = Math.max(current.endMinutes, clippedEnd);
        continue;
      }

      if (current) blocks.push(current);
      current = { startMinutes: clampMinutes(clippedStart), endMinutes: clampMinutes(clippedEnd) };
    }
    if (current) blocks.push(current);
  } else if (usageSummary.hourlyByApp && Object.keys(usageSummary.hourlyByApp).length > 0) {
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.floor((endMinutes - 1) / 60);
    for (let hour = startHour; hour <= endHour; hour++) {
      const hourStart = hour * 60;
      const hourEnd = hourStart + 60;
      const overlapMinutesInHour = Math.max(0, Math.min(endMinutes, hourEnd) - Math.max(startMinutes, hourStart));
      if (overlapMinutesInHour < minMinutes) continue;
      blocks.push({
        startMinutes: Math.max(startMinutes, hourStart),
        endMinutes: Math.min(endMinutes, hourEnd),
      });
    }
  } else if (usageSummary.hourlyBucketsSeconds && usageSummary.hourlyBucketsSeconds.length > 0) {
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.floor((endMinutes - 1) / 60);
    for (let hour = startHour; hour <= endHour; hour++) {
      const seconds = usageSummary.hourlyBucketsSeconds[hour] ?? 0;
      if (seconds <= 0) continue;
      const durationMinutes = Math.round(seconds / 60);
      const hourStart = hour * 60;
      const hourEnd = hourStart + 60;
      const clippedStart = Math.max(startMinutes, hourStart);
      const clippedEnd = Math.min(endMinutes, hourStart + durationMinutes);
      if (clippedEnd - clippedStart < minMinutes) continue;
      blocks.push({ startMinutes: clippedStart, endMinutes: clippedEnd });
    }
  }

  return blocks
    .filter((b) => b.endMinutes - b.startMinutes >= minMinutes)
    .map((b) => {
      const topApp = getTopAppLabelForUsageInterval({
        usageSummary,
        startMinutes: b.startMinutes,
        endMinutes: b.endMinutes,
        appIdToName,
      });
      return {
        id: `${DERIVED_EVIDENCE_PREFIX}android_sleep_override_${usageSummary.generatedAtIso}_${b.startMinutes}`,
        title: 'Screen Time',
        description: topApp ?? 'Phone use',
        startMinutes: b.startMinutes,
        duration: Math.max(1, b.endMinutes - b.startMinutes),
        category: 'digital',
      };
    });
}

function getTopAppLabelForUsageInterval(options: {
  usageSummary: UsageSummary;
  startMinutes: number;
  endMinutes: number;
  appIdToName: Map<string, string>;
}): string | null {
  const { usageSummary, startMinutes, endMinutes, appIdToName } = options;
  if (endMinutes <= startMinutes) return null;

  const usageByApp = new Map<string, number>();

  if (usageSummary.sessions && usageSummary.sessions.length > 0) {
    for (const session of usageSummary.sessions) {
      const start = new Date(session.startIso);
      const end = new Date(session.endIso);
      const sessionStart = start.getHours() * 60 + start.getMinutes();
      const sessionEnd = end.getHours() * 60 + end.getMinutes();
      const overlap = overlapMinutes(startMinutes, endMinutes, sessionStart, sessionEnd);
      if (overlap <= 0) continue;
      const appName = appIdToName.get(session.packageName) ?? session.packageName;
      usageByApp.set(appName, (usageByApp.get(appName) ?? 0) + overlap);
    }
  } else if (usageSummary.hourlyByApp && Object.keys(usageSummary.hourlyByApp).length > 0) {
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.floor((endMinutes - 1) / 60);
    for (let hour = startHour; hour <= endHour; hour++) {
      const hourStart = hour * 60;
      const hourEnd = hourStart + 60;
      const overlapMinutesInHour = Math.max(0, Math.min(endMinutes, hourEnd) - Math.max(startMinutes, hourStart));
      if (overlapMinutesInHour <= 0) continue;
      const fraction = overlapMinutesInHour / 60;
      for (const [appId, hours] of Object.entries(usageSummary.hourlyByApp)) {
        const seconds = hours[hour] ?? 0;
        if (seconds <= 0) continue;
        const appName = appIdToName.get(appId) ?? appId;
        usageByApp.set(appName, (usageByApp.get(appName) ?? 0) + (seconds / 60) * fraction);
      }
    }
  } else if (usageSummary.hourlyBucketsSeconds && usageSummary.hourlyBucketsSeconds.length > 0) {
    return usageSummary.topApps[0]?.displayName ?? null;
  }

  if (usageByApp.size === 0) return null;
  return Array.from(usageByApp.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function buildSleepOverrideDescription(options: { topAppName: string | null }): string {
  const { topAppName } = options;
  if (topAppName) {
    return `Sleep scheduled • ${topAppName}`;
  }
  return 'Sleep scheduled • Phone use';
}

interface UsageOverlapInfo {
  totalMinutes: number;
  topApp: string | null;
  isDistraction: boolean;
  isProductive: boolean;
}

function getUsageOverlapInfo(
  usageSummary: UsageSummary,
  startMinutes: number,
  endMinutes: number
): UsageOverlapInfo | null {
  if (endMinutes <= startMinutes) return null;

  const appIdToName = new Map(usageSummary.topApps.map((app) => [app.packageName, app.displayName]));
  const appUsage = new Map<string, number>();

  if (usageSummary.sessions && usageSummary.sessions.length > 0) {
    for (const session of usageSummary.sessions) {
      const start = new Date(session.startIso);
      const end = new Date(session.endIso);
      const sessionStart = start.getHours() * 60 + start.getMinutes();
      const sessionEnd = end.getHours() * 60 + end.getMinutes();
      const overlap = overlapMinutes(startMinutes, endMinutes, sessionStart, sessionEnd);
      if (overlap <= 0) continue;
      const appName = appIdToName.get(session.packageName) ?? session.packageName;
      const current = appUsage.get(appName) ?? 0;
      appUsage.set(appName, current + overlap);
    }
  } else if (usageSummary.hourlyByApp && Object.keys(usageSummary.hourlyByApp).length > 0) {
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.floor((endMinutes - 1) / 60);
    for (let hour = startHour; hour <= endHour; hour++) {
      const hourStart = hour * 60;
      const hourEnd = hourStart + 60;
      const overlapMinutesInHour = Math.max(0, Math.min(endMinutes, hourEnd) - Math.max(startMinutes, hourStart));
      if (overlapMinutesInHour <= 0) continue;
      const fraction = overlapMinutesInHour / 60;

      for (const [appId, hours] of Object.entries(usageSummary.hourlyByApp)) {
        const seconds = hours[hour] ?? 0;
        if (seconds <= 0) continue;
        const appName = appIdToName.get(appId) ?? appId;
        const current = appUsage.get(appName) ?? 0;
        appUsage.set(appName, current + (seconds / 60) * fraction);
      }
    }
  } else if (usageSummary.hourlyBucketsSeconds && usageSummary.hourlyBucketsSeconds.length > 0) {
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.floor((endMinutes - 1) / 60);
    const topApp = usageSummary.topApps[0]?.displayName ?? null;
    let totalMinutes = 0;
    for (let hour = startHour; hour <= endHour; hour++) {
      const seconds = usageSummary.hourlyBucketsSeconds[hour] ?? 0;
      if (seconds <= 0) continue;
      const hourStart = hour * 60;
      const hourEnd = hourStart + 60;
      const overlapMinutesInHour = Math.max(0, Math.min(endMinutes, hourEnd) - Math.max(startMinutes, hourStart));
      if (overlapMinutesInHour <= 0) continue;
      totalMinutes += (seconds / 60) * (overlapMinutesInHour / 60);
    }
    if (totalMinutes <= 0) return null;
    return {
      totalMinutes,
      topApp,
      isDistraction: Boolean(topApp && appMatchesList(topApp, DISTRACTION_APPS)),
      isProductive: Boolean(topApp && (appMatchesList(topApp, WORK_APPS) || appMatchesList(topApp, PRODUCTIVE_APPS))),
    };
  }

  if (appUsage.size === 0) return null;

  const sorted = Array.from(appUsage.entries())
    .map(([app, minutes]) => ({ app, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = sorted.reduce((sum, entry) => sum + entry.minutes, 0);
  const topApp = sorted[0]?.app ?? null;

  return {
    totalMinutes,
    topApp,
    isDistraction: Boolean(topApp && appMatchesList(topApp, DISTRACTION_APPS)),
    isProductive: Boolean(topApp && (appMatchesList(topApp, WORK_APPS) || appMatchesList(topApp, PRODUCTIVE_APPS))),
  };
}

function buildSleepStartAdjustmentFromUsageSummary(options: {
  usageSummary: UsageSummary;
  sleepEvent: ScheduledEvent;
  minScreenTimeMinutes: number;
  maxStartOffsetMinutes: number;
  mergeGapMinutes: number;
  minRemainingMinutes: number;
}): SleepStartAdjustment | null {
  const {
    usageSummary,
    sleepEvent,
    minScreenTimeMinutes,
    maxStartOffsetMinutes,
    mergeGapMinutes,
    minRemainingMinutes,
  } = options;

  if (!usageSummary.sessions || usageSummary.sessions.length === 0) return null;

  const sleepStart = clampMinutes(sleepEvent.startMinutes);
  const sleepEnd = clampMinutes(sleepEvent.startMinutes + sleepEvent.duration);
  if (sleepEnd <= sleepStart) return null;

  const appIdToName = new Map(usageSummary.topApps.map((app) => [app.packageName, app.displayName]));
  const intervals = buildSleepSessionIntervals({
    sessions: usageSummary.sessions,
    sleepStart,
    sleepEnd,
    appIdToName,
  });
  if (intervals.length === 0) return null;

  const mergedIntervals = mergeIntervals(intervals, mergeGapMinutes);
  const candidate = mergedIntervals
    .filter(
      (interval) =>
        interval.durationMinutes >= minScreenTimeMinutes &&
        interval.startMinutes - sleepStart <= maxStartOffsetMinutes,
    )
    .at(-1);
  if (!candidate) return null;

  const remainingMinutes = sleepEnd - candidate.endMinutes;
  if (remainingMinutes < minRemainingMinutes) return null;

  const topAppName = getTopAppForInterval({
    sessions: usageSummary.sessions,
    startMinutes: candidate.startMinutes,
    endMinutes: candidate.endMinutes,
    appIdToName,
  });

  return {
    sleepStartMinutes: candidate.endMinutes,
    sleepDurationMinutes: remainingMinutes,
    screenTimeMinutes: candidate.durationMinutes,
    topAppName,
    screenTimeBlock: {
      id: `${DERIVED_EVIDENCE_PREFIX}android_sleep_${usageSummary.generatedAtIso}_${candidate.startMinutes}`,
      title: 'Screen Time',
      description: topAppName ? toSleepScreenTimePhrase(topAppName) : 'Phone use',
      startMinutes: candidate.startMinutes,
      duration: candidate.durationMinutes,
      category: 'digital',
    },
  };
}

function buildSleepLateDescription(options: { minutes: number; topAppName: string | null }): string {
  const { minutes, topAppName } = options;
  const rounded = Math.round(minutes);
  if (topAppName) {
    return `Started late (Stayed up scrolling on ${topAppName}, ${rounded} min)`;
  }
  return `Started late (Stayed up scrolling, ${rounded} min)`;
}

function buildSleepSessionIntervals(options: {
  sessions: Array<{ packageName: string; startIso: string; endIso: string }>;
  sleepStart: number;
  sleepEnd: number;
  appIdToName: Map<string, string>;
}): Array<{ startMinutes: number; endMinutes: number }> {
  const { sessions, sleepStart, sleepEnd, appIdToName } = options;
  const intervals: Array<{ startMinutes: number; endMinutes: number; appName: string }> = [];

  for (const session of sessions) {
    const start = new Date(session.startIso);
    const end = new Date(session.endIso);
    const sessionStart = start.getHours() * 60 + start.getMinutes();
    const sessionEnd = end.getHours() * 60 + end.getMinutes();
    const overlapStart = Math.max(sleepStart, sessionStart);
    const overlapEnd = Math.min(sleepEnd, sessionEnd);
    if (overlapEnd <= overlapStart) continue;
    const appName = appIdToName.get(session.packageName) ?? session.packageName;
    intervals.push({ startMinutes: overlapStart, endMinutes: overlapEnd, appName });
  }

  intervals.sort((a, b) => a.startMinutes - b.startMinutes);
  return intervals.map((interval) => ({
    startMinutes: interval.startMinutes,
    endMinutes: interval.endMinutes,
  }));
}

function mergeIntervals(
  intervals: Array<{ startMinutes: number; endMinutes: number }>,
  gapMinutes: number,
): Array<{ startMinutes: number; endMinutes: number; durationMinutes: number }> {
  if (intervals.length === 0) return [];
  const merged: Array<{ startMinutes: number; endMinutes: number }> = [];

  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...interval });
      continue;
    }
    if (interval.startMinutes <= last.endMinutes + gapMinutes) {
      last.endMinutes = Math.max(last.endMinutes, interval.endMinutes);
      continue;
    }
    merged.push({ ...interval });
  }

  return merged.map((interval) => ({
    ...interval,
    durationMinutes: interval.endMinutes - interval.startMinutes,
  }));
}

function getTopAppForInterval(options: {
  sessions: Array<{ packageName: string; startIso: string; endIso: string }>;
  startMinutes: number;
  endMinutes: number;
  appIdToName: Map<string, string>;
}): string | null {
  const { sessions, startMinutes, endMinutes, appIdToName } = options;
  const usageByApp = new Map<string, number>();

  for (const session of sessions) {
    const start = new Date(session.startIso);
    const end = new Date(session.endIso);
    const sessionStart = start.getHours() * 60 + start.getMinutes();
    const sessionEnd = end.getHours() * 60 + end.getMinutes();
    const overlap = overlapMinutes(startMinutes, endMinutes, sessionStart, sessionEnd);
    if (overlap <= 0) continue;
    const appName = appIdToName.get(session.packageName) ?? session.packageName;
    usageByApp.set(appName, (usageByApp.get(appName) ?? 0) + overlap);
  }

  if (usageByApp.size === 0) return null;
  return Array.from(usageByApp.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function toSleepScreenTimePhrase(appName: string): string {
  const name = appName.toLowerCase();
  if (name.includes('youtube')) return 'YouTube rabbit hole';
  if (name.includes('instagram')) return 'Instagram scroll';
  if (name.includes('tiktok')) return 'TikTok spiral';
  if (name.includes('x ') || name === 'x' || name.includes('twitter')) return 'Endless scroll';
  return appName;
}

function buildScreenTimeEvent(
  startMinutes: number,
  endMinutes: number,
  topApp: string,
  generatedAtIso: string
): ScheduledEvent {
  const classification = classifyScreenTimeApp(topApp);
  return {
    id: `${DERIVED_EVIDENCE_PREFIX}android_${generatedAtIso}_${startMinutes}`,
    title: classification.title,
    description: classification.description,
    startMinutes,
    duration: Math.max(1, endMinutes - startMinutes),
    category: classification.category,
  };
}

function classifyScreenTimeApp(appName: string): { title: string; description: string; category: ScheduledEvent['category'] } {
  const isDistraction = appMatchesList(appName, DISTRACTION_APPS);
  const isWork = appMatchesList(appName, WORK_APPS) || appMatchesList(appName, PRODUCTIVE_APPS);

  if (isDistraction) {
    return { title: 'Doom Scroll', description: appName, category: 'digital' };
  }
  if (isWork) {
    return { title: 'Productive Screen Time', description: appName, category: 'work' };
  }
  return { title: 'Screen Time', description: appName, category: 'digital' };
}
