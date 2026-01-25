import type { CalendarEventMeta, ScheduledEvent, EventCategory } from '@/stores';
import type {
  EvidenceBundle,
  HealthDailyRow,
  LocationHourlyRow,
  ScreenTimeSessionRow,
} from '@/lib/supabase/services/evidence-data';
import type { UsageSummary } from '@/lib/android-insights';
import type { ActualBlock, VerificationResult } from './verification-engine';
import { classifyAppUsage, type AppCategoryOverrides } from './app-classification';
import { buildSleepQualityMetrics } from './sleep-analysis';
import { buildDataQualityMetrics } from './data-quality';
import { buildEvidenceFusion } from './evidence-fusion';
import {
  applyPatternSuggestions,
  buildPatternSummary,
  getPatternSuggestionForRange,
  type PatternIndex,
} from './pattern-recognition';

export const DERIVED_ACTUAL_PREFIX = 'derived_actual:';
export const DERIVED_EVIDENCE_PREFIX = 'derived_evidence:';

const MIN_EVIDENCE_BLOCK_MINUTES = 10;
const DISTRACTION_THRESHOLD_MINUTES = 10;
const SCREEN_TIME_GAP_MINUTES = 15;
const SLEEP_SCREEN_TIME_GAP_MINUTES = 5;
const SLEEP_MAX_START_OFFSET_MINUTES = 120;
const SLEEP_MIN_REMAINING_MINUTES = 30;
const SLEEP_OVERRIDE_MIN_COVERAGE = 0.7;
const SLEEP_OVERRIDE_MIN_MINUTES = 60;
const LOCATION_MIN_BLOCK_MINUTES = 10;

/**
 * Generate a unique deterministic event ID.
 * Format: derived:{type}:{startMinutes}:{endMinutes}:{source}
 * This ensures uniqueness by including both start and end times plus a source identifier.
 */
function generateDerivedId(
  prefix: string,
  type: string,
  startMinutes: number,
  endMinutes: number,
  source: string,
): string {
  return `${prefix}${type}:${startMinutes}:${endMinutes}:${source}`;
}

interface BuildActualDisplayEventsInput {
  ymd: string;
  plannedEvents: ScheduledEvent[];
  actualEvents: ScheduledEvent[];
  derivedActualEvents?: ScheduledEvent[] | null;
  actualBlocks?: ActualBlock[];
  verificationResults?: Map<string, VerificationResult>;
  evidence?: EvidenceBundle | null;
  usageSummary?: UsageSummary | null;
  patternIndex?: PatternIndex | null;
  patternMinConfidence?: number;
  minEvidenceBlockMinutes?: number;
  appCategoryOverrides?: AppCategoryOverrides;
  gapFillingPreference?: 'conservative' | 'aggressive' | 'manual';
  confidenceThreshold?: number;
  allowAutoSuggestions?: boolean;
}

interface LocationBlock {
  startMinutes: number;
  endMinutes: number;
  placeLabel: string;
  placeCategory: string | null;
}

interface TransitionContext {
  locationBlocks: LocationBlock[];
}

const TRANSITION_TARGET_CATEGORIES: EventCategory[] = ['work', 'health', 'meeting'];

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

interface ScreenTimeOverlapInfo {
  totalMinutes: number;
  topApp: string | null;
  isDistraction: boolean;
  isProductive: boolean;
}

interface LocationReplacementContext {
  ymd: string;
  locationBlocks: LocationBlock[];
  usageSummary?: UsageSummary | null;
  screenTimeSessions?: ScreenTimeSessionRow[] | null;
  appCategoryOverrides?: AppCategoryOverrides;
  dataQuality: ReturnType<typeof buildDataQualityMetrics>;
  minMinutes: number;
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
  patternIndex,
  patternMinConfidence,
  minEvidenceBlockMinutes = MIN_EVIDENCE_BLOCK_MINUTES,
  appCategoryOverrides,
  gapFillingPreference = 'conservative',
  confidenceThreshold = 0.6,
  allowAutoSuggestions = true,
}: BuildActualDisplayEventsInput): ScheduledEvent[] {
  const todayYmd = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();
  const locationBlocks = evidence ? buildLocationBlocks(ymd, evidence.locationHourly) : [];
  const dataQuality = buildDataQualityMetrics({ evidence, usageSummary });
  const plannedSorted = [...plannedEvents].sort((a, b) => a.startMinutes - b.startMinutes);

  const sleepOverrideIntervals = buildSleepScheduleIntervals(plannedSorted);

  const filteredActualEvents = actualEvents.filter((event) => event.category !== 'sleep');

  const results: ScheduledEvent[] = [...filteredActualEvents];
  const occupied: Array<{ start: number; end: number }> = results.map((event) => ({
    start: event.startMinutes,
    end: event.startMinutes + event.duration,
  }));

  // Track saved derived events by their source_id to avoid duplicates
  const savedDerivedEventKeys = new Set<string>();
  for (const event of filteredActualEvents) {
    const meta = event.meta as Record<string, unknown> | undefined;
    if (meta?.source_id && typeof meta.source_id === 'string') {
      // Check if this is a saved derived event
      if (meta.source_id.startsWith('derived_actual:') || meta.source_id.startsWith('derived_evidence:')) {
        // Create a key based on time range and kind to detect duplicates
        const key = `${event.startMinutes}_${event.startMinutes + event.duration}_${meta.kind ?? 'unknown'}`;
        savedDerivedEventKeys.add(key);
      }
    }
  }

  const addIfFree = (event: ScheduledEvent, minOverlapMinutes = 1) => {
    const start = event.startMinutes;
    const end = event.startMinutes + event.duration;
    if (end <= start) return;
    
    // Check for overlap with existing events
    if (hasOverlap(start, end, occupied, minOverlapMinutes)) return;
    
    // For derived events, check if we already have a saved version with the same time range
    if (event.id.startsWith('derived_actual:') || event.id.startsWith('derived_evidence:')) {
      const key = `${start}_${end}_${event.meta?.kind ?? 'unknown'}`;
      if (savedDerivedEventKeys.has(key)) {
        return; // Skip - we already have this event saved
      }
    }
    
    results.push(event);
    occupied.push({ start, end });
  };

  const removeSleepOverlaps = (start: number, end: number) => {
    for (let i = results.length - 1; i >= 0; i -= 1) {
      const existing = results[i];
      if (existing.category !== 'sleep') continue;
      const source = existing.meta?.source;
      if (source === 'user' || source === 'actual_adjust') continue;
      if (!intervalsOverlap(start, end, existing.startMinutes, existing.startMinutes + existing.duration)) {
        continue;
      }
      results.splice(i, 1);
      occupied.splice(i, 1);
    }
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
        addIfFree(block);
      }
    }

    const usageBlocks = deriveUsageSummaryBlocks({
      usageSummary,
      plannedEvents: plannedSorted,
      minMinutes: minEvidenceBlockMinutes,
      appCategoryOverrides,
    });
    for (const block of usageBlocks) {
      addIfFree(block);
    }
  }

  if (actualBlocks.length > 0) {
    for (const block of actualBlocks) {
      const duration = Math.max(1, block.endMinutes - block.startMinutes);
      if (duration < minEvidenceBlockMinutes) continue;
      const isScreenTimeBlock = block.source === 'screen_time';
      const meta: CalendarEventMeta = {
        category: block.category,
        source: 'evidence',
        kind: isScreenTimeBlock ? 'screen_time' : 'evidence_block',
        confidence: block.confidence ?? 0.55,
        dataQuality,
        evidence: {
          locationLabel: block.evidence.location?.placeLabel ?? null,
          screenTimeMinutes: block.evidence.screenTime?.totalMinutes,
          topApp: block.evidence.screenTime?.topApps[0]?.app ?? null,
        },
      };
      const nextEvent: ScheduledEvent = {
        id: `${DERIVED_EVIDENCE_PREFIX}${block.id}`,
        title: block.title,
        description: block.description ?? '',
        startMinutes: block.startMinutes,
        duration,
        category: block.category,
        meta,
      };

      if (isScreenTimeBlock) {
        const start = nextEvent.startMinutes;
        const end = start + nextEvent.duration;
        const overlapsSleep = results.some(
          (event) =>
            event.category === 'sleep' &&
            intervalsOverlap(start, end, event.startMinutes, event.startMinutes + event.duration),
        );
        const overlapsLocation = locationBlocks.some((block) =>
          intervalsOverlap(start, end, block.startMinutes, block.endMinutes),
        );
        if (overlapsSleep) {
          removeSleepOverlaps(start, end);
          addIfFree(nextEvent);
          continue;
        }
        if (overlapsLocation) {
          continue;
        }
      }

      addIfFree(nextEvent);
    }
  }

  const hasEvidence =
    Boolean(usageSummary) ||
    Boolean(evidence?.locationHourly?.length) ||
    Boolean(evidence?.screenTimeSessions?.length) ||
    Boolean(evidence?.healthDaily) ||
    actualBlocks.length > 0 ||
    (derivedActualEvents?.length ?? 0) > 0 ||
    actualEvents.length > 0;

  const shouldDerivePlanned = ymd <= todayYmd || hasEvidence;

  for (const planned of plannedSorted) {
    if (!shouldDerivePlanned) {
      break;
    }
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
      healthDaily: evidence?.healthDaily ?? null,
      patternIndex,
      ymd,
      dataQuality,
      appCategoryOverrides,
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
  const withSleepFilled = replaceUnknownWithSleepSchedule(withUnknowns, sleepOverrideIntervals, {
    ymd,
    usageSummary,
    screenTimeSessions: evidence?.screenTimeSessions ?? null,
    healthDaily: evidence?.healthDaily ?? null,
    dataQuality,
  });
  const withLocationFilled = replaceUnknownWithLocationEvidence(withSleepFilled, {
    ymd,
    locationBlocks,
    usageSummary,
    screenTimeSessions: evidence?.screenTimeSessions ?? null,
    appCategoryOverrides,
    dataQuality,
    minMinutes: minEvidenceBlockMinutes,
  });
  const allowGapFilling = gapFillingPreference !== 'manual';
  const allowProductiveFill = gapFillingPreference === 'aggressive';
  const allowTransitions = gapFillingPreference === 'aggressive';
  const allowPatterns = allowGapFilling && allowAutoSuggestions;
  const preferenceOffset = gapFillingPreference === 'aggressive' ? -0.1 : gapFillingPreference === 'conservative' ? 0.1 : 0;
  const effectivePatternMinConfidence = Math.max(
    0.4,
    Math.min(0.95, Math.max(patternMinConfidence ?? 0.6, confidenceThreshold + preferenceOffset)),
  );

  const withProductiveFilled = allowProductiveFill
    ? replaceUnknownWithProductiveUsage(
        withLocationFilled,
        usageSummary,
        minEvidenceBlockMinutes,
        appCategoryOverrides,
      )
    : withLocationFilled;
  const withTransitions = allowTransitions
    ? replaceUnknownWithTransitions(withProductiveFilled, {
        locationBlocks,
      })
    : withProductiveFilled;
  const withPrepWindDown = allowTransitions
    ? replaceUnknownWithPrepWindDown(withTransitions, {
        locationBlocks,
      })
    : withTransitions;
  const withPatternFilled = allowPatterns
    ? applyPatternSuggestions(
        withPrepWindDown,
        patternIndex ?? null,
        ymd,
        effectivePatternMinConfidence,
      )
    : withPrepWindDown;
  const withQuality = attachDataQuality(withPatternFilled, dataQuality);

  // Final deduplication pass: remove any overlapping events, keeping the first one encountered
  const deduplicated = removeOverlappingEvents(mergeAdjacentSleep(withQuality));

  // CRITICAL: Always ensure gaps are filled with unknown events, even after deduplication
  // This guarantees there's always something in the "actual" column
  const withGapsFilled = fillUnknownGaps(deduplicated);

  return withGapsFilled.sort((a, b) => a.startMinutes - b.startMinutes);
}

/**
 * Removes overlapping events, keeping the first event encountered for each time slot.
 * Only removes events if there's significant overlap (more than 10 minutes) to avoid
 * removing events that just touch at boundaries or have minor overlaps.
 * This ensures no visual overlaps in the calendar display while preserving events.
 * 
 * Priority: Keep events in this order:
 * 1. Events from Supabase (already saved)
 * 2. Derived events with higher confidence
 * 3. Unknown events (lowest priority - can be replaced)
 */
function removeOverlappingEvents(events: ScheduledEvent[]): ScheduledEvent[] {
  const sorted = [...events].sort((a, b) => {
    const aMeta = a.meta as { confidence?: number; source?: string; actual?: boolean } | undefined;
    const bMeta = b.meta as { confidence?: number; source?: string; actual?: boolean } | undefined;

    const aIsUserActual = Boolean(aMeta?.actual) || aMeta?.source === 'user' || aMeta?.source === 'actual_adjust';
    const bIsUserActual = Boolean(bMeta?.actual) || bMeta?.source === 'user' || bMeta?.source === 'actual_adjust';
    if (aIsUserActual && !bIsUserActual) return -1;
    if (!aIsUserActual && bIsUserActual) return 1;

    const aIsDerived = aMeta?.source === 'derived';
    const bIsDerived = bMeta?.source === 'derived';
    if (!aIsDerived && bIsDerived) return -1;
    if (aIsDerived && !bIsDerived) return 1;

    // Sort by priority: non-unknown events first, then by confidence, then by start time
    if (a.category !== 'unknown' && b.category === 'unknown') return -1;
    if (a.category === 'unknown' && b.category !== 'unknown') return 1;

    const aConfidence = aMeta?.confidence ?? 0;
    const bConfidence = bMeta?.confidence ?? 0;
    if (aConfidence !== bConfidence) return bConfidence - aConfidence; // Higher confidence first

    return a.startMinutes - b.startMinutes;
  });

  const result: ScheduledEvent[] = [];
  const occupied: Array<{ start: number; end: number }> = [];

  for (const event of sorted) {
    const start = event.startMinutes;
    const end = event.startMinutes + event.duration;
    
    // Check for significant overlap (more than 10 minutes) with any existing event
    const hasSignificantOverlap = occupied.some((interval) => {
      const overlapStart = Math.max(start, interval.start);
      const overlapEnd = Math.min(end, interval.end);
      const overlapMinutes = overlapEnd - overlapStart;
      return overlapMinutes > 10; // Only consider it overlapping if more than 10 minutes
    });

    if (!hasSignificantOverlap) {
      result.push(event);
      occupied.push({ start, end });
    }
  }

  return result;
}

function buildPlannedActualEvent(options: {
  planned: ScheduledEvent;
  verification: VerificationResult | null;
  plannedEvents: ScheduledEvent[];
  locationBlocks: LocationBlock[];
  usageSummary?: UsageSummary | null;
  healthDaily?: HealthDailyRow | null;
  patternIndex?: PatternIndex | null;
  ymd: string;
  dataQuality: ReturnType<typeof buildDataQualityMetrics>;
  appCategoryOverrides?: AppCategoryOverrides;
}): ScheduledEvent | null {
  const {
    planned,
    verification,
    plannedEvents,
    locationBlocks,
    usageSummary,
    healthDaily,
    patternIndex,
    ymd,
    dataQuality,
    appCategoryOverrides,
  } = options;
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
    ? getUsageOverlapInfo(usageSummary, startMinutes, actualEnd, appCategoryOverrides)
    : null;

  const description = buildActualDescription({
    planned,
    verification,
    extendedMinutes: Math.max(0, actualEnd - plannedEnd),
    locationLabel: matchingLocation?.placeLabel ?? locationEvidence?.placeLabel ?? null,
    usageInfo,
  });

  const sleepQuality = buildSleepQualityMetrics(healthDaily ?? null);

  const conflicts: Array<{ source: 'location' | 'screen_time' | 'health'; detail: string }> = [];
  if (planned.category === 'work' && usageInfo?.isDistraction) {
    conflicts.push({ source: 'screen_time', detail: 'Distraction apps during work' });
  }
  if (
    planned.category === 'sleep' &&
    usageInfo &&
    usageInfo.totalMinutes >= DISTRACTION_THRESHOLD_MINUTES
  ) {
    conflicts.push({ source: 'screen_time', detail: 'Phone use during sleep window' });
  }
  if (planned.category === 'work' && sleepQuality?.qualityScore && sleepQuality.qualityScore < 50) {
    conflicts.push({ source: 'health', detail: 'Low sleep quality before work' });
  }
  if (
    planned.location &&
    matchingLocation?.placeLabel &&
    planned.location.toLowerCase() !== matchingLocation.placeLabel.toLowerCase()
  ) {
    conflicts.push({ source: 'location', detail: 'Location differs from plan' });
  }

  const patternSuggestion = getPatternSuggestionForRange(
    patternIndex ?? null,
    ymd,
    startMinutes,
    actualEnd,
  );
  if (patternSuggestion && patternSuggestion.category !== planned.category && patternSuggestion.confidence >= 0.6) {
    conflicts.push({
      source: 'pattern',
      detail: `Typical ${patternSuggestion.category} at this time`,
    });
  }

  const patternSummary = buildPatternSummary(
    patternIndex ?? null,
    ymd,
    startMinutes,
    actualEnd,
    planned.category,
  );

  const verificationReport = verification?.report
    ? {
        status: verification.report.status,
        confidence: verification.report.confidence,
        discrepancies: [
          ...(verification.report.discrepancies ?? []),
          ...(patternSummary?.deviation && patternSummary.typicalCategory
            ? [
                {
                  type: 'pattern',
                  expected: `Typical ${patternSummary.typicalCategory}`,
                  actual: planned.category,
                  severity: 'minor',
                },
              ]
            : []),
        ],
        suggestions: verification.report.suggestions,
      }
    : undefined;

  const fusion = buildEvidenceFusion({
    verification,
    dataQuality,
    patternSummary: patternSummary ?? null,
    conflicts,
    plannedCategory: planned.category,
  });

  const meta: CalendarEventMeta = {
    category: planned.category,
    source: 'derived',
    plannedEventId: planned.id,
    confidence: fusion.confidence,
    dataQuality,
    patternSummary: patternSummary ?? undefined,
    verificationReport,
    evidence: {
      locationLabel: matchingLocation?.placeLabel ?? locationEvidence?.placeLabel ?? null,
      screenTimeMinutes: usageInfo ? Math.round(usageInfo.totalMinutes) : undefined,
      topApp: usageInfo?.topApp ?? null,
      sleep:
        planned.category === 'sleep'
          ? {
              asleepMinutes: sleepQuality?.asleepMinutes,
              deepMinutes: sleepQuality?.deepMinutes ?? null,
              remMinutes: sleepQuality?.remMinutes ?? null,
              awakeMinutes: sleepQuality?.awakeMinutes ?? null,
              inBedMinutes: sleepQuality?.inBedMinutes ?? null,
              wakeTimeMinutes: sleepQuality?.wakeTimeMinutes ?? null,
              hrvMs: sleepQuality?.hrvMs ?? null,
              restingHeartRateBpm: sleepQuality?.restingHeartRateBpm ?? null,
              heartRateAvgBpm: sleepQuality?.heartRateAvgBpm ?? null,
              qualityScore: sleepQuality?.qualityScore ?? null,
            }
          : undefined,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    },
    evidenceFusion: fusion,
    kind:
      planned.category === 'sleep' && usageInfo && usageInfo.totalMinutes >= DISTRACTION_THRESHOLD_MINUTES
        ? 'sleep_late'
        : 'planned_actual',
  };

  return {
    ...planned,
    id: `${DERIVED_ACTUAL_PREFIX}${planned.id}`,
    description,
    startMinutes,
    duration: Math.max(1, actualEnd - startMinutes),
    location: planned.location ?? matchingLocation?.placeLabel ?? planned.location,
    meta,
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
    const hourStart = parseDbTimestamp(row.hour_start);
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

/**
 * Parse a database timestamp string to a Date object.
 * Ensures the timestamp is interpreted as UTC if no timezone info is present.
 */
function parseDbTimestamp(timestamp: string): Date {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(timestamp)) {
    return new Date(timestamp);
  }
  return new Date(timestamp + 'Z');
}

function fillUnknownGaps(events: ScheduledEvent[]): ScheduledEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const filled: ScheduledEvent[] = [];
  let cursor = 0;
  let unknownCounter = 0;

  for (const event of sorted) {
    const start = clampMinutes(event.startMinutes);
    const end = clampMinutes(event.startMinutes + event.duration);
    if (start > cursor) {
      const gapDuration = Math.max(1, start - cursor);
      filled.push(buildUnknownEvent(cursor, gapDuration, unknownCounter++));
    }
    filled.push(event);
    cursor = Math.max(cursor, end);
  }

  if (cursor < 24 * 60) {
    const gapDuration = Math.max(1, 24 * 60 - cursor);
    filled.push(buildUnknownEvent(cursor, gapDuration, unknownCounter++));
  }

  return mergeAdjacentUnknowns(filled);
}

interface SleepInterruptionContext {
  ymd: string;
  usageSummary?: UsageSummary | null;
  screenTimeSessions?: ScreenTimeSessionRow[] | null;
  healthDaily?: HealthDailyRow | null;
  dataQuality: ReturnType<typeof buildDataQualityMetrics>;
}

function replaceUnknownWithSleepSchedule(
  events: ScheduledEvent[],
  sleepIntervals: Array<{ startMinutes: number; endMinutes: number }>,
  context: SleepInterruptionContext,
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
  let unknownCounter = 0;

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
        updated.push(buildUnknownEvent(cursor, overlapStart - cursor, unknownCounter++));
      }

      if (overlapEnd > overlapStart) {
        updated.push(buildInterruptedSleepEvent(overlapStart, overlapEnd - overlapStart, context));
      }

      cursor = Math.max(cursor, overlapEnd);
    }

    if (cursor < end) {
      updated.push(buildUnknownEvent(cursor, end - cursor, unknownCounter++));
    }
  }

  return mergeAdjacentUnknowns(updated);
}

function replaceUnknownWithLocationEvidence(
  events: ScheduledEvent[],
  context: LocationReplacementContext,
): ScheduledEvent[] {
  const { locationBlocks, minMinutes } = context;
  if (locationBlocks.length === 0) return events;

  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const updated: ScheduledEvent[] = [];
  let unknownCounter = 0;

  for (const event of sorted) {
    if (event.category !== 'unknown') {
      updated.push(event);
      continue;
    }

    const start = clampMinutes(event.startMinutes);
    const end = clampMinutes(event.startMinutes + event.duration);
    if (end <= start) continue;

    const startLocation = findLocationLabelAtMinute(locationBlocks, start);
    const endLocation = findLocationLabelAtMinute(locationBlocks, Math.max(start, end - 1));
    const startLabel = startLocation.label?.trim() ?? null;
    const endLabel = endLocation.label?.trim() ?? null;
    const gapMinutes = end - start;

    const canCommute =
      startLabel &&
      endLabel &&
      startLabel.toLowerCase() !== endLabel.toLowerCase() &&
      gapMinutes >= 15 &&
      gapMinutes <= 90;

    if (canCommute) {
      updated.push(
        buildCommuteEvent({
          startMinutes: start,
          duration: gapMinutes,
          fromLabel: startLabel,
          toLabel: endLabel,
          context,
        }),
      );
      continue;
    }

    const overlaps = locationBlocks
      .filter((block) => intervalsOverlap(start, end, block.startMinutes, block.endMinutes))
      .sort((a, b) => a.startMinutes - b.startMinutes);

    if (overlaps.length === 0) {
      updated.push(event);
      continue;
    }

    let cursor = start;
    for (const block of overlaps) {
      const overlapStart = Math.max(cursor, block.startMinutes, start);
      const overlapEnd = Math.min(end, block.endMinutes);
      if (overlapEnd <= overlapStart) continue;

      const duration = overlapEnd - overlapStart;
      if (duration < minMinutes) {
        updated.push(buildUnknownEvent(overlapStart, duration, unknownCounter++));
        cursor = Math.max(cursor, overlapEnd);
        continue;
      }

      const locationLabel = block.placeLabel?.trim() ?? '';
      const placeCategory = block.placeCategory?.trim() ?? null;
      if (!locationLabel && !placeCategory) {
        updated.push(buildUnknownEvent(overlapStart, duration, unknownCounter++));
        cursor = Math.max(cursor, overlapEnd);
        continue;
      }

      updated.push(
        buildLocationEvent({
          startMinutes: overlapStart,
          duration,
          locationLabel: locationLabel || placeCategory || 'Unknown location',
          placeCategory,
          context,
          uniqueId: unknownCounter++,
        }),
      );
      cursor = Math.max(cursor, overlapEnd);
    }

    if (cursor < end) {
      updated.push(buildUnknownEvent(cursor, end - cursor, unknownCounter++));
    }
  }

  return mergeAdjacentUnknowns(updated);
}

function replaceUnknownWithProductiveUsage(
  events: ScheduledEvent[],
  usageSummary: UsageSummary | null | undefined,
  minMinutes: number,
  appCategoryOverrides?: AppCategoryOverrides,
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

    const usageInfo = getUsageOverlapInfo(usageSummary, start, end, appCategoryOverrides);
    if (!usageInfo || !usageInfo.isProductive || usageInfo.totalMinutes < minMinutes) {
      updated.push(event);
      continue;
    }

    const durationMinutes = Math.round(Math.min(usageInfo.totalMinutes, end - start));
    updated.push(buildProductiveUnknownEvent(start, durationMinutes, usageInfo.topApp));
  }

  return updated;
}

function findLocationLabelAtMinute(
  blocks: LocationBlock[],
  minute: number,
): { label: string | null; category: string | null } {
  for (const block of blocks) {
    if (minute >= block.startMinutes && minute < block.endMinutes) {
      return { label: block.placeLabel, category: block.placeCategory };
    }
  }
  return { label: null, category: null };
}

function replaceUnknownWithTransitions(
  events: ScheduledEvent[],
  context: TransitionContext,
): ScheduledEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const updated: ScheduledEvent[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const event = sorted[i];
    if (event.category !== 'unknown') {
      updated.push(event);
      continue;
    }

    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    if (!prev || !next) {
      updated.push(event);
      continue;
    }

    const gapMinutes = event.duration;
    if (gapMinutes < 15 || gapMinutes > 90) {
      updated.push(event);
      continue;
    }

    const startMinute = event.startMinutes;
    const endMinute = event.startMinutes + event.duration;
    const fromLocation = findLocationLabelAtMinute(context.locationBlocks, startMinute);
    const toLocation = findLocationLabelAtMinute(context.locationBlocks, endMinute);
    const fromLabel = fromLocation.label ?? prev.location ?? null;
    const toLabel = toLocation.label ?? next.location ?? null;

    if (!fromLabel || !toLabel || fromLabel.toLowerCase() === toLabel.toLowerCase()) {
      updated.push(event);
      continue;
    }

    const meta: CalendarEventMeta = {
      category: 'comm',
      source: 'derived',
      kind: 'transition_commute',
      confidence: 0.45,
      evidence: {
        locationLabel: `${fromLabel} → ${toLabel}`,
      },
    };

    updated.push({
      ...event,
      title: 'Commute',
      description: `${fromLabel} → ${toLabel}`,
      category: 'comm',
      meta,
    });
  }

  return updated;
}

function replaceUnknownWithPrepWindDown(
  events: ScheduledEvent[],
  context: TransitionContext,
): ScheduledEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const updated: ScheduledEvent[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const event = sorted[i];
    if (event.category !== 'unknown') {
      updated.push(event);
      continue;
    }

    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    if (!prev || !next) {
      updated.push(event);
      continue;
    }

    const gapMinutes = event.duration;
    if (gapMinutes < 10 || gapMinutes > 45) {
      updated.push(event);
      continue;
    }

    const sameCategory = prev.category === next.category;
    const isTargetCategory = TRANSITION_TARGET_CATEGORIES.includes(prev.category);
    if (!sameCategory || !isTargetCategory) {
      updated.push(event);
      continue;
    }

    const startMinute = event.startMinutes;
    const endMinute = event.startMinutes + event.duration;
    const fromLocation = findLocationLabelAtMinute(context.locationBlocks, startMinute);
    const toLocation = findLocationLabelAtMinute(context.locationBlocks, endMinute);
    const fromLabel = fromLocation.label ?? prev.location ?? null;
    const toLabel = toLocation.label ?? next.location ?? null;

    if (fromLabel && toLabel && fromLabel.toLowerCase() !== toLabel.toLowerCase()) {
      updated.push(event);
      continue;
    }

    const isPrep = next.category === prev.category;
    const title = isPrep ? 'Prep' : 'Wind down';
    const kind = isPrep ? 'transition_prep' : 'transition_wind_down';
    const meta: CalendarEventMeta = {
      category: prev.category,
      source: 'derived',
      kind,
      confidence: 0.35,
      evidence: {
        locationLabel: fromLabel ?? toLabel ?? null,
      },
    };

    updated.push({
      ...event,
      title,
      description: fromLabel ? `${title} at ${fromLabel}` : title,
      category: prev.category,
      meta,
    });
  }

  return updated;
}

function attachDataQuality(
  events: ScheduledEvent[],
  dataQuality: ReturnType<typeof buildDataQualityMetrics>,
): ScheduledEvent[] {
  return events.map((event) => {
    if (!event.meta) return event;
    if (event.meta.dataQuality) return event;
    return {
      ...event,
      meta: {
        ...event.meta,
        dataQuality,
      },
    };
  });
}

function buildCommuteEvent(options: {
  startMinutes: number;
  duration: number;
  fromLabel: string;
  toLabel: string;
  context: LocationReplacementContext;
}): ScheduledEvent {
  const { startMinutes, duration, fromLabel, toLabel, context } = options;
  const screenTime = getScreenTimeOverlapInfo({
    ymd: context.ymd,
    startMinutes,
    endMinutes: startMinutes + duration,
    usageSummary: context.usageSummary,
    screenTimeSessions: context.screenTimeSessions,
    appCategoryOverrides: context.appCategoryOverrides,
  });
  const description = buildLocationDescription({
    base: `${fromLabel} → ${toLabel}`,
    screenTime,
  });
  const meta: CalendarEventMeta = {
    category: 'comm',
    source: 'derived',
    kind: 'transition_commute',
    confidence: 0.5,
    dataQuality: context.dataQuality,
    evidence: {
      locationLabel: `${fromLabel} → ${toLabel}`,
      screenTimeMinutes: screenTime?.totalMinutes,
      topApp: screenTime?.topApp ?? null,
    },
  };

  const endMinutes = startMinutes + duration;
  return {
    id: generateDerivedId(DERIVED_EVIDENCE_PREFIX, 'commute', startMinutes, endMinutes, 'location'),
    title: 'Driving',
    description,
    startMinutes,
    duration,
    category: 'comm',
    meta,
  };
}

function buildLocationEvent(options: {
  startMinutes: number;
  duration: number;
  locationLabel: string;
  placeCategory: string | null;
  context: LocationReplacementContext;
  uniqueId: number;
}): ScheduledEvent {
  const { startMinutes, duration, locationLabel, placeCategory, context, uniqueId } = options;
  const resolved = resolveLocationDetails(locationLabel, placeCategory);
  const screenTime = getScreenTimeOverlapInfo({
    ymd: context.ymd,
    startMinutes,
    endMinutes: startMinutes + duration,
    usageSummary: context.usageSummary,
    screenTimeSessions: context.screenTimeSessions,
    appCategoryOverrides: context.appCategoryOverrides,
  });
  const description = buildLocationDescription({
    base: resolved.description,
    screenTime,
  });
  const meta: CalendarEventMeta = {
    category: resolved.category,
    source: 'derived',
    kind: 'location_inferred',
    confidence: 0.45,
    dataQuality: context.dataQuality,
    evidence: {
      locationLabel,
      placeCategory,
      screenTimeMinutes: screenTime?.totalMinutes,
      topApp: screenTime?.topApp ?? null,
    },
  };

  const endMinutes = startMinutes + duration;
  return {
    id: generateDerivedId(DERIVED_EVIDENCE_PREFIX, 'location', startMinutes, endMinutes, `loc_${uniqueId}`),
    title: resolved.title,
    description,
    location: locationLabel,
    startMinutes,
    duration,
    category: resolved.category,
    meta,
  };
}

function resolveLocationDetails(locationLabel: string, placeCategory: string | null): {
  title: string;
  description: string;
  category: EventCategory;
} {
  const raw = [locationLabel, placeCategory].find(Boolean) ?? 'Location';
  const label = formatPlaceLabel(raw);
  const category = mapPlaceToCategory(locationLabel, placeCategory);
  const description = placeCategory && formatPlaceLabel(placeCategory) !== label ? formatPlaceLabel(placeCategory) : '';
  return { title: label, description, category };
}

function formatPlaceLabel(value: string): string {
  const cleaned = value.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return 'Location';
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

function mapPlaceToCategory(locationLabel: string, placeCategory: string | null): EventCategory {
  const combined = `${locationLabel} ${placeCategory ?? ''}`.toLowerCase();
  if (combined.includes('coffee') || combined.includes('cafe') || combined.includes('restaurant') || combined.includes('diner') || combined.includes('food') || combined.includes('bar')) {
    return 'meal';
  }
  if (combined.includes('gym') || combined.includes('fitness') || combined.includes('workout') || combined.includes('yoga') || combined.includes('park')) {
    return 'health';
  }
  if (combined.includes('office') || combined.includes('work') || combined.includes('cowork') || combined.includes('studio') || combined.includes('school') || combined.includes('university')) {
    return 'work';
  }
  if (combined.includes('church') || combined.includes('chapel') || combined.includes('temple')) {
    return 'routine';
  }
  if (combined.includes('home')) {
    return 'family';
  }
  if (combined.includes('bank') || combined.includes('finance')) {
    return 'finance';
  }
  if (combined.includes('airport') || combined.includes('station') || combined.includes('transit') || combined.includes('travel')) {
    return 'travel';
  }
  return 'free';
}

function buildLocationDescription(options: { base: string; screenTime: ScreenTimeOverlapInfo | null }): string {
  const parts: string[] = [];
  const base = options.base.trim();
  if (base) parts.push(base);
  const screenTime = options.screenTime;
  if (screenTime && screenTime.totalMinutes >= DISTRACTION_THRESHOLD_MINUTES) {
    const minutes = Math.round(screenTime.totalMinutes);
    if (screenTime.isDistraction) {
      parts.push(`Distracted: ${minutes} min${screenTime.topApp ? ` on ${screenTime.topApp}` : ''}`);
    } else if (screenTime.isProductive) {
      parts.push(`Productive: ${minutes} min${screenTime.topApp ? ` on ${screenTime.topApp}` : ''}`);
    } else {
      parts.push(`Phone use: ${minutes} min${screenTime.topApp ? ` on ${screenTime.topApp}` : ''}`);
    }
  }
  return parts.join(' • ');
}

interface SleepInterruptionSummary {
  interruptionCount: number;
  interruptionMinutes: number;
  topAppName: string | null;
}

function buildSleepInterruptionSummaryFromSessions(
  sessions: ScreenTimeSessionRow[],
  ymd: string,
  startMinutes: number,
  endMinutes: number,
): SleepInterruptionSummary | null {
  if (endMinutes <= startMinutes || sessions.length === 0) return null;

  const dayStart = ymdToDate(ymd);
  const intervals: Array<{ startMinutes: number; endMinutes: number }> = [];
  const appUsage = new Map<string, number>();

  for (const session of sessions) {
    const sessionStart = parseDbTimestamp(session.started_at);
    const sessionEnd = parseDbTimestamp(session.ended_at);
    const sessionStartMinutes = (sessionStart.getTime() - dayStart.getTime()) / 60_000;
    const sessionEndMinutes = (sessionEnd.getTime() - dayStart.getTime()) / 60_000;
    const overlapStart = Math.max(startMinutes, sessionStartMinutes);
    const overlapEnd = Math.min(endMinutes, sessionEndMinutes);
    if (overlapEnd <= overlapStart) continue;

    intervals.push({ startMinutes: overlapStart, endMinutes: overlapEnd });
    const overlapMinutes = overlapEnd - overlapStart;
    const appName = session.display_name || session.app_id;
    const current = appUsage.get(appName) ?? 0;
    appUsage.set(appName, current + overlapMinutes);
  }

  if (intervals.length === 0) return null;
  const mergedIntervals = mergeIntervals(intervals, SLEEP_SCREEN_TIME_GAP_MINUTES);
  const interruptionCount = Math.max(1, mergedIntervals.length);
  const interruptionMinutes = mergedIntervals.reduce(
    (total, interval) => total + (interval.endMinutes - interval.startMinutes),
    0,
  );
  const topAppName =
    Array.from(appUsage.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    interruptionCount,
    interruptionMinutes,
    topAppName,
  };
}

function getScreenTimeOverlapInfo(options: {
  ymd: string;
  startMinutes: number;
  endMinutes: number;
  usageSummary?: UsageSummary | null;
  screenTimeSessions?: ScreenTimeSessionRow[] | null;
  appCategoryOverrides?: AppCategoryOverrides;
}): ScreenTimeOverlapInfo | null {
  const { ymd, startMinutes, endMinutes, usageSummary, screenTimeSessions, appCategoryOverrides } = options;
  if (endMinutes <= startMinutes) return null;

  if (screenTimeSessions && screenTimeSessions.length > 0) {
    const overlap = buildScreenTimeOverlapFromSessions(screenTimeSessions, ymd, startMinutes, endMinutes);
    if (!overlap || overlap.totalMinutes <= 0) return null;
    const classification = overlap.topApp ? classifyAppUsage(overlap.topApp, appCategoryOverrides) : null;
    return {
      totalMinutes: overlap.totalMinutes,
      topApp: overlap.topApp,
      isDistraction: classification?.isDistraction ?? false,
      isProductive: classification?.isProductive ?? false,
    };
  }

  if (usageSummary) {
    const usageInfo = getUsageOverlapInfo(usageSummary, startMinutes, endMinutes, appCategoryOverrides);
    if (!usageInfo) return null;
    return {
      totalMinutes: usageInfo.totalMinutes,
      topApp: usageInfo.topApp,
      isDistraction: usageInfo.isDistraction,
      isProductive: usageInfo.isProductive,
    };
  }

  return null;
}

function buildScreenTimeOverlapFromSessions(
  sessions: ScreenTimeSessionRow[],
  ymd: string,
  startMinutes: number,
  endMinutes: number,
): { totalMinutes: number; topApp: string | null } | null {
  if (endMinutes <= startMinutes || sessions.length === 0) return null;
  const dayStart = ymdToDate(ymd);
  const appUsage = new Map<string, number>();

  for (const session of sessions) {
    const sessionStart = parseDbTimestamp(session.started_at);
    const sessionEnd = parseDbTimestamp(session.ended_at);
    const sessionStartMinutes = (sessionStart.getTime() - dayStart.getTime()) / 60_000;
    const sessionEndMinutes = (sessionEnd.getTime() - dayStart.getTime()) / 60_000;
    const overlapStart = Math.max(startMinutes, sessionStartMinutes);
    const overlapEnd = Math.min(endMinutes, sessionEndMinutes);
    if (overlapEnd <= overlapStart) continue;
    const overlapMinutes = overlapEnd - overlapStart;
    const appName = session.display_name || session.app_id;
    const current = appUsage.get(appName) ?? 0;
    appUsage.set(appName, current + overlapMinutes);
  }

  if (appUsage.size === 0) return null;
  const totalMinutes = Array.from(appUsage.values()).reduce((sum, minutes) => sum + minutes, 0);
  const topApp = Array.from(appUsage.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { totalMinutes, topApp };
}

function buildSleepInterruptionSummary(
  usageSummary: UsageSummary,
  startMinutes: number,
  endMinutes: number,
): SleepInterruptionSummary | null {
  if (endMinutes <= startMinutes) return null;
  const usageInfo = getUsageOverlapInfo(usageSummary, startMinutes, endMinutes);
  if (!usageInfo || usageInfo.totalMinutes <= 0) return null;

  let interruptionCount = 1;
  if (usageSummary.sessions && usageSummary.sessions.length > 0) {
    const appIdToName = new Map(usageSummary.topApps.map((app) => [app.packageName, app.displayName]));
    const intervals = buildSleepSessionIntervals({
      sessions: usageSummary.sessions,
      sleepStart: startMinutes,
      sleepEnd: endMinutes,
      appIdToName,
    });
    if (intervals.length > 0) {
      const mergedIntervals = mergeIntervals(intervals, SLEEP_SCREEN_TIME_GAP_MINUTES);
      interruptionCount = Math.max(1, mergedIntervals.length);
    }
  }

  return {
    interruptionCount,
    interruptionMinutes: usageInfo.totalMinutes,
    topAppName: usageInfo.topApp,
  };
}

function buildSleepInterruptedDescription(summary: SleepInterruptionSummary | null): string {
  if (!summary) return 'Sleep schedule • Interrupted';
  const rounded = Math.round(summary.interruptionMinutes);
  const timesLabel = summary.interruptionCount === 1 ? 'time' : 'times';
  const appLabel = summary.topAppName ? ` on ${summary.topAppName}` : '';
  return `Sleep schedule • Interrupted ${summary.interruptionCount} ${timesLabel} (${rounded} min${appLabel})`;
}

function buildInterruptedSleepEvent(
  startMinutes: number,
  duration: number,
  context: SleepInterruptionContext,
): ScheduledEvent {
  const endMinutes = startMinutes + duration;
  const interruptionSummary =
    context.screenTimeSessions && context.screenTimeSessions.length > 0
      ? buildSleepInterruptionSummaryFromSessions(
          context.screenTimeSessions,
          context.ymd,
          startMinutes,
          endMinutes,
        )
      : context.usageSummary
        ? buildSleepInterruptionSummary(context.usageSummary, startMinutes, endMinutes)
        : null;

  const sleepQuality = buildSleepQualityMetrics(context.healthDaily ?? null);

  const meta: CalendarEventMeta = {
    category: 'sleep',
    source: 'derived',
    kind: 'sleep_interrupted',
    confidence: interruptionSummary ? 0.7 : 0.5,
    dataQuality: context.dataQuality,
    evidence: {
      topApp: interruptionSummary?.topAppName ?? null,
      sleep: {
        interruptions: interruptionSummary?.interruptionCount,
        interruptionMinutes: interruptionSummary
          ? Math.round(interruptionSummary.interruptionMinutes)
          : undefined,
        asleepMinutes: sleepQuality?.asleepMinutes,
        hrvMs: sleepQuality?.hrvMs ?? null,
        restingHeartRateBpm: sleepQuality?.restingHeartRateBpm ?? null,
        heartRateAvgBpm: sleepQuality?.heartRateAvgBpm ?? null,
        qualityScore: sleepQuality?.qualityScore ?? null,
      },
    },
  };

  return {
    id: generateDerivedId(DERIVED_ACTUAL_PREFIX, 'sleep_interrupted', startMinutes, endMinutes, 'sleep'),
    title: 'Sleep',
    description: buildSleepInterruptedDescription(interruptionSummary),
    startMinutes,
    duration,
    category: 'sleep',
    meta,
  };
}

function buildProductiveUnknownEvent(startMinutes: number, duration: number, topAppName: string | null): ScheduledEvent {
  const minutes = Math.max(1, Math.round(duration));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
  const appLabel = topAppName ? ` on ${topAppName}` : '';
  const meta: CalendarEventMeta = {
    category: 'work',
    source: 'derived',
    kind: 'unknown_gap',
    confidence: 0.45,
    evidence: {
      topApp: topAppName,
    },
  };

  const endMinutes = startMinutes + minutes;
  return {
    id: generateDerivedId(DERIVED_ACTUAL_PREFIX, 'productive', startMinutes, endMinutes, topAppName ?? 'unknown'),
    title: 'Productive',
    description: `${durationLabel}${appLabel}`,
    startMinutes,
    duration: minutes,
    category: 'work',
    meta,
  };
}

function buildUnknownEvent(startMinutes: number, duration: number, uniqueId?: number): ScheduledEvent {
  const meta: CalendarEventMeta = {
    category: 'unknown',
    source: 'derived',
    kind: 'unknown_gap',
    confidence: 0.2,
  };

  const endMinutes = startMinutes + duration;
  // Use uniqueId if provided, otherwise fall back to counter-based suffix for uniqueness
  const uniqueSuffix = uniqueId !== undefined ? String(uniqueId) : 'gap';
  return {
    id: generateDerivedId(DERIVED_ACTUAL_PREFIX, 'unknown', startMinutes, endMinutes, uniqueSuffix),
    title: 'Unknown',
    description: 'Tap to assign',
    startMinutes,
    duration,
    category: 'unknown',
    meta,
  };
}

function mergeAdjacentUnknowns(events: ScheduledEvent[]): ScheduledEvent[] {
  const merged: ScheduledEvent[] = [];
  let unknownCounter = 0;

  for (const event of events) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.category === 'unknown' &&
      event.category === 'unknown' &&
      last.startMinutes + last.duration === event.startMinutes
    ) {
      // Merge by updating duration and regenerating ID to ensure uniqueness
      last.duration += event.duration;
      const endMinutes = last.startMinutes + last.duration;
      last.id = generateDerivedId(DERIVED_ACTUAL_PREFIX, 'unknown', last.startMinutes, endMinutes, `merged_${unknownCounter++}`);
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
  appCategoryOverrides?: AppCategoryOverrides;
}): ScheduledEvent[] {
  const { usageSummary, plannedEvents, minMinutes, appCategoryOverrides } = options;
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
      .map((b) =>
        buildScreenTimeEvent(
          b.startMinutes,
          b.endMinutes,
          b.topApp,
          usageSummary.generatedAtIso,
          appCategoryOverrides,
        ),
      );
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
      .map((b) =>
        buildScreenTimeEvent(
          b.startMinutes,
          b.endMinutes,
          b.topApp,
          usageSummary.generatedAtIso,
          appCategoryOverrides,
        ),
      );
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
      .map((b) =>
        buildScreenTimeEvent(
          b.startMinutes,
          b.endMinutes,
          b.topApp,
          usageSummary.generatedAtIso,
          appCategoryOverrides,
        ),
      );
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
      const meta: CalendarEventMeta = {
        category: 'digital',
        source: 'derived',
        kind: 'screen_time',
        confidence: 0.6,
        evidence: {
          topApp: block.description || interval.topAppName || null,
          screenTimeMinutes: block.duration,
        },
      };
      blocks.push({
        ...block,
        title: 'Screen Time',
        description: buildSleepOverrideDescription({
          topAppName: block.description || interval.topAppName,
        }),
        category: 'digital',
        meta,
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
        id: generateDerivedId(DERIVED_EVIDENCE_PREFIX, 'android_sleep_override', b.startMinutes, b.endMinutes, 'screen'),
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
  endMinutes: number,
  appCategoryOverrides?: AppCategoryOverrides,
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
    const classification = topApp ? classifyAppUsage(topApp, appCategoryOverrides) : null;
    return {
      totalMinutes,
      topApp,
      isDistraction: classification?.isDistraction ?? false,
      isProductive: classification?.isProductive ?? false,
    };
  }

  if (appUsage.size === 0) return null;

  const sorted = Array.from(appUsage.entries())
    .map(([app, minutes]) => ({ app, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = sorted.reduce((sum, entry) => sum + entry.minutes, 0);
  const topApp = sorted[0]?.app ?? null;
  const classification = topApp ? classifyAppUsage(topApp, appCategoryOverrides) : null;

  return {
    totalMinutes,
    topApp,
    isDistraction: classification?.isDistraction ?? false,
    isProductive: classification?.isProductive ?? false,
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
      id: generateDerivedId(DERIVED_EVIDENCE_PREFIX, 'android_sleep', candidate.startMinutes, candidate.endMinutes, 'screen'),
      title: 'Screen Time',
      description: topAppName ? toSleepScreenTimePhrase(topAppName) : 'Phone use',
      startMinutes: candidate.startMinutes,
      duration: candidate.durationMinutes,
      category: 'digital',
      meta: {
        category: 'digital',
        source: 'derived',
        kind: 'screen_time',
        confidence: 0.6,
        evidence: {
          screenTimeMinutes: Math.round(candidate.durationMinutes),
          topApp: topAppName,
        },
      },
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
  generatedAtIso: string,
  appCategoryOverrides?: AppCategoryOverrides,
): ScheduledEvent {
  const classification = classifyAppUsage(topApp, appCategoryOverrides);
  const meta: CalendarEventMeta = {
    category: classification.category,
    source: 'derived',
    kind: 'screen_time',
    confidence: classification.confidence,
    evidence: {
      topApp,
      screenTimeMinutes: Math.max(1, Math.round(endMinutes - startMinutes)),
    },
  };
  return {
    id: generateDerivedId(DERIVED_EVIDENCE_PREFIX, 'android', startMinutes, endMinutes, topApp ?? 'screen'),
    title: classification.title,
    description: classification.description,
    startMinutes,
    duration: Math.max(1, endMinutes - startMinutes),
    category: classification.category,
    meta,
  };
}
