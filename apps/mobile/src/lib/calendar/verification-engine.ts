import type { ScheduledEvent, EventCategory, VerificationStrictness } from '@/stores';
import {
  type EvidenceBundle,
  type LocationHourlyRow,
  type ScreenTimeSessionRow,
  type HealthWorkoutRow,
  findOverlappingLocations,
  findOverlappingSessions,
  findOverlappingWorkouts,
  calculateOverlapMinutes,
} from '@/lib/supabase/services/evidence-data';
import {
  type VerificationRule,
  getVerificationRule,
  appMatchesList,
  DISTRACTION_APPS,
  WORK_APPS,
} from './verification-rules';
import { classifyAppUsage, type AppCategoryOverrides } from './app-classification';

// ============================================================================
// Types
// ============================================================================

export type VerificationStatus =
  | 'verified' // Evidence strongly supports the planned event
  | 'mostly_verified' // Strong evidence with timing variance
  | 'partially_verified' // Some evidence, timing gaps
  | 'partial' // Some evidence, but gaps or minor contradictions
  | 'unverified' // No relevant evidence available
  | 'contradicted' // Evidence directly contradicts the planned event
  | 'distracted' // User was on phone when they shouldn't have been
  | 'early'
  | 'late'
  | 'shortened'
  | 'extended';

export interface EvidenceSummary {
  /** Location evidence */
  location?: {
    placeLabel: string | null;
    placeCategory: string | null;
    sampleCount: number;
    matchesExpected: boolean;
  };

  /** Screen time evidence */
  screenTime?: {
    totalMinutes: number;
    distractionMinutes: number;
    topApps: Array<{ app: string; minutes: number }>;
    wasDistracted: boolean;
  };

  /** Health/workout evidence */
  health?: {
    hasWorkout: boolean;
    workoutType: string | null;
    workoutDurationMinutes: number;
  };
}

export interface VerificationResult {
  eventId: string;
  status: VerificationStatus;
  confidence: number; // 0-1, how confident we are in this verification
  evidence: EvidenceSummary;
  /** Human-readable reason for the status */
  reason: string;
  /** Suggestions for the user */
  suggestions?: string[];
  report?: VerificationReport;
  timing?: {
    earlyMinutes?: number;
    lateMinutes?: number;
    extendedMinutes?: number;
    shortenedMinutes?: number;
  };
}

export interface VerificationReport {
  eventId: string;
  status: VerificationStatus;
  confidence: number;
  evidenceBreakdown: {
    location?: { matches: boolean; detail: string; weight: number };
    screenTime?: { matches: boolean; detail: string; weight: number };
    health?: { matches: boolean; detail: string; weight: number };
  };
  discrepancies: Array<{
    type: 'timing' | 'location' | 'activity' | 'duration';
    expected: string;
    actual: string;
    severity: 'minor' | 'moderate' | 'major';
  }>;
  suggestions: string[];
}

export interface VerificationThresholds {
  verifiedMin: number;
  partialMin: number;
  mostlyVerifiedMin: number;
  timingVarianceMinutes: number;
}

export const DEFAULT_VERIFICATION_THRESHOLDS: VerificationThresholds = {
  verifiedMin: 0.7,
  partialMin: 0.3,
  mostlyVerifiedMin: 0.85,
  timingVarianceMinutes: 15,
};

export function getVerificationThresholds(
  strictness: VerificationStrictness | undefined
): VerificationThresholds {
  if (strictness === 'lenient') {
    return {
      verifiedMin: 0.6,
      partialMin: 0.2,
      mostlyVerifiedMin: 0.78,
      timingVarianceMinutes: 20,
    };
  }
  if (strictness === 'strict') {
    return {
      verifiedMin: 0.8,
      partialMin: 0.4,
      mostlyVerifiedMin: 0.9,
      timingVarianceMinutes: 10,
    };
  }
  return DEFAULT_VERIFICATION_THRESHOLDS;
}

export interface ActualBlock {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startMinutes: number;
  endMinutes: number;
  source: 'location' | 'screen_time' | 'workout' | 'derived';
  linkedPlannedEventId?: string;
  evidence: EvidenceSummary;
  confidence?: number;
}

const MIN_SCREEN_TIME_BLOCK_MINUTES = 10;
const SCREEN_TIME_GAP_MINUTES = 15;

// ============================================================================
// Verification Logic
// ============================================================================

/**
 * Verify a single planned event against available evidence.
 */
export function verifyEvent(
  event: ScheduledEvent,
  evidence: EvidenceBundle,
  ymd: string,
  appCategoryOverrides?: AppCategoryOverrides,
  thresholds: VerificationThresholds = DEFAULT_VERIFICATION_THRESHOLDS,
): VerificationResult {
  const rule = getVerificationRule(event.category);
  const eventEndMinutes = event.startMinutes + event.duration;

  // Find overlapping evidence
  const overlappingLocations = findOverlappingLocations(
    event.startMinutes,
    eventEndMinutes,
    evidence.locationHourly
  );
  const overlappingSessions = findOverlappingSessions(
    event.startMinutes,
    eventEndMinutes,
    ymd,
    evidence.screenTimeSessions
  );
  const overlappingWorkouts = findOverlappingWorkouts(
    event.startMinutes,
    eventEndMinutes,
    ymd,
    evidence.healthWorkouts
  );

  // Build evidence summary
  const evidenceSummary: EvidenceSummary = {};
  let totalScore = 0;
  let maxScore = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];

  // ----- LOCATION VERIFICATION -----
  if (rule.verifyWith.includes('location') && overlappingLocations.length > 0) {
    const locationWeight = rule.evidenceWeights?.location ?? 0.5;
    maxScore += locationWeight;

    // Aggregate location data
    const primaryLocation = overlappingLocations[0];
    const totalSamples = overlappingLocations.reduce((sum, l) => sum + l.sample_count, 0);
    const placeCategory = primaryLocation?.place_category?.toLowerCase() ?? null;
    const placeLabel = primaryLocation?.place_label ?? null;

    // Check if location matches expected
    const matchesExpected =
      rule.locationExpected.includes(null) ||
      (placeCategory !== null &&
        rule.locationExpected.some((exp) => exp === placeCategory));

    evidenceSummary.location = {
      placeLabel,
      placeCategory,
      sampleCount: totalSamples,
      matchesExpected,
    };

    if (matchesExpected) {
      totalScore += locationWeight;
      reasons.push(
        `At ${placeLabel || placeCategory || 'expected location'}`
      );
    } else if (rule.locationRequired) {
      reasons.push(
        `Expected ${rule.locationExpected.filter(Boolean).join('/')} but was at ${placeLabel || placeCategory || 'unknown'}`
      );
    } else {
      // Partial credit for having location data even if not expected place
      totalScore += locationWeight * 0.3;
      reasons.push(`At ${placeLabel || placeCategory || 'unknown location'}`);
    }
  } else if (rule.verifyWith.includes('location')) {
    maxScore += rule.evidenceWeights?.location ?? 0.5;
    reasons.push('No location data available');
  }

  // ----- SCREEN TIME VERIFICATION -----
  if (rule.verifyWith.includes('screen_time') && overlappingSessions.length > 0) {
    const screenWeight = rule.evidenceWeights?.screen_time ?? 0.5;
    maxScore += screenWeight;

    // Calculate screen time
    const dayStart = ymdToDate(ymd);
    const appUsage = new Map<string, number>();
    let distractionMinutes = 0;
    let totalMinutes = 0;

    for (const session of overlappingSessions) {
      const sessionStart = new Date(session.started_at);
      const sessionEnd = new Date(session.ended_at);
      const sessionStartMins = (sessionStart.getTime() - dayStart.getTime()) / (60 * 1000);
      const sessionEndMins = (sessionEnd.getTime() - dayStart.getTime()) / (60 * 1000);

      const overlap = calculateOverlapMinutes(
        event.startMinutes,
        eventEndMinutes,
        sessionStartMins,
        sessionEndMins
      );

      const appName = session.display_name || session.app_id;
      const currentUsage = appUsage.get(appName) ?? 0;
      appUsage.set(appName, currentUsage + overlap);
      totalMinutes += overlap;

      // Check if this is a distraction app
      const classification = classifyAppUsage(appName, appCategoryOverrides);
      const isAllowed = rule.allowedApps && appMatchesList(appName, rule.allowedApps);
      const hasWildcardDistraction = Boolean(rule.distractionApps?.some((app) => app === '*'));
      const matchesRuleList = rule.distractionApps
        ? appMatchesList(appName, rule.distractionApps)
        : false;
      let isDistraction = false;

      if (hasWildcardDistraction) {
        isDistraction = true;
      } else if (matchesRuleList) {
        isDistraction = classification.category !== 'work';
      } else {
        isDistraction = classification.isDistraction;
      }

      if (isAllowed) {
        isDistraction = false;
      }

      if (isDistraction) {
        distractionMinutes += overlap;
      }
    }

    // Top apps
    const topApps = Array.from(appUsage.entries())
      .map(([app, minutes]) => ({ app, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    const wasDistracted =
      distractionMinutes > (rule.maxDistractionMinutes ?? 30);

    evidenceSummary.screenTime = {
      totalMinutes,
      distractionMinutes,
      topApps,
      wasDistracted,
    };

    if (rule.requiresScreenTime) {
      // Screen time is expected
      if (totalMinutes > 0) {
        totalScore += screenWeight;
        reasons.push(`${Math.round(totalMinutes)} min screen time`);
      } else {
        reasons.push('Expected screen time but none detected');
      }
    } else {
      // Screen time = potential distraction
      if (wasDistracted) {
        reasons.push(
          `${Math.round(distractionMinutes)} min on distracting apps`
        );
        suggestions.push(
          `Consider putting phone away during ${event.category} time`
        );
      } else if (totalMinutes <= (rule.maxScreenTimeMinutes ?? 30)) {
        totalScore += screenWeight;
        reasons.push('Minimal phone usage');
      } else {
        totalScore += screenWeight * 0.5;
        reasons.push(`${Math.round(totalMinutes)} min phone usage`);
      }
    }
  } else if (rule.verifyWith.includes('screen_time')) {
    maxScore += rule.evidenceWeights?.screen_time ?? 0.5;
    if (rule.requiresScreenTime) {
      reasons.push('No screen time data available');
    } else {
      // No screen time is actually good for most activities
      totalScore += (rule.evidenceWeights?.screen_time ?? 0.5) * 0.8;
      reasons.push('No phone usage detected');
    }
  }

  // ----- HEALTH/WORKOUT VERIFICATION -----
  if (rule.verifyWith.includes('health_workout')) {
    const healthWeight = rule.evidenceWeights?.health_workout ?? 0.5;
    maxScore += healthWeight;

    if (overlappingWorkouts.length > 0) {
      const workout = overlappingWorkouts[0];
      const durationMinutes = Math.round(workout.duration_seconds / 60);

      evidenceSummary.health = {
        hasWorkout: true,
        workoutType: workout.activity_type,
        workoutDurationMinutes: durationMinutes,
      };

      if (rule.requiresWorkout) {
        totalScore += healthWeight;
        reasons.push(
          `${workout.activity_type || 'Workout'} for ${durationMinutes} min`
        );
      } else if (rule.workoutContradictsIfDuring) {
        reasons.push(`Working out during ${event.category}?`);
      } else {
        totalScore += healthWeight * 0.5;
        reasons.push(`Also did a ${workout.activity_type || 'workout'}`);
      }
    } else if (rule.requiresWorkout) {
      evidenceSummary.health = {
        hasWorkout: false,
        workoutType: null,
        workoutDurationMinutes: 0,
      };
      reasons.push('No workout detected');
      suggestions.push('Track your workout in the Health app for verification');
    }
  }

  // ----- TIMING CHECKS (COARSE, LOCATION-BASED) -----
  let timing: VerificationResult['timing'] | undefined;
  if (overlappingLocations.length > 0) {
    const dayStart = ymdToDate(ymd);
    const windows = overlappingLocations.map((loc) => {
      const hourStart = new Date(loc.hour_start);
      const startMinutes = Math.floor((hourStart.getTime() - dayStart.getTime()) / 60_000);
      return { startMinutes, endMinutes: startMinutes + 60 };
    });
    const earliest = Math.min(...windows.map((w) => w.startMinutes));
    const latest = Math.max(...windows.map((w) => w.endMinutes));
    const earlyMinutes = event.startMinutes - earliest;
    const lateMinutes = earliest - event.startMinutes;
    const extendedMinutes = latest - eventEndMinutes;
    const shortenedMinutes = eventEndMinutes - latest;
    const timingVariance = thresholds.timingVarianceMinutes;
    timing = {
      earlyMinutes: earlyMinutes >= timingVariance ? earlyMinutes : undefined,
      lateMinutes: lateMinutes >= timingVariance ? lateMinutes : undefined,
      extendedMinutes: extendedMinutes >= timingVariance ? extendedMinutes : undefined,
      shortenedMinutes: shortenedMinutes >= timingVariance ? shortenedMinutes : undefined,
    };
  }

  // ----- DETERMINE STATUS -----
  let status: VerificationStatus;
  const confidence = maxScore > 0 ? totalScore / maxScore : 0;

  // Check for explicit contradictions
  const locationContradicted =
    evidenceSummary.location &&
    rule.locationRequired &&
    !evidenceSummary.location.matchesExpected;

  const wasDistracted = evidenceSummary.screenTime?.wasDistracted ?? false;

  if (locationContradicted) {
    status = 'contradicted';
  } else if (wasDistracted) {
    status = 'distracted';
  } else if (confidence >= thresholds.verifiedMin) {
    status = 'verified';
  } else if (confidence >= thresholds.partialMin) {
    status = 'partial';
  } else if (maxScore === 0 || rule.verifyWith.length === 0) {
    // Can't verify categories with no evidence requirements
    status = 'unverified';
  } else {
    status = 'unverified';
  }

  let timingStatus: VerificationStatus | null = null;
  if (status === 'verified' || status === 'partial') {
    if (timing?.earlyMinutes) timingStatus = 'early';
    if (timing?.lateMinutes) timingStatus = 'late';
    if (timing?.shortenedMinutes) timingStatus = 'shortened';
    if (timing?.extendedMinutes) timingStatus = 'extended';
    if (!timingStatus && status === 'verified' && confidence >= thresholds.mostlyVerifiedMin) {
      timingStatus = 'mostly_verified';
    } else if (!timingStatus && status === 'partial') {
      timingStatus = 'partially_verified';
    }
  }

  const finalStatus = timingStatus ?? status;
  const evidenceBreakdown: VerificationReport['evidenceBreakdown'] = {};
  const discrepancies: VerificationReport['discrepancies'] = [];

  if (evidenceSummary.location) {
    const weight = rule.evidenceWeights?.location ?? 0.5;
    const detail = evidenceSummary.location.placeLabel || evidenceSummary.location.placeCategory || 'Unknown';
    evidenceBreakdown.location = {
      matches: evidenceSummary.location.matchesExpected,
      detail,
      weight,
    };
    if (locationContradicted) {
      discrepancies.push({
        type: 'location',
        expected: rule.locationExpected.filter(Boolean).join('/') || 'Expected location',
        actual: detail,
        severity: 'major',
      });
    }
  }

  if (evidenceSummary.screenTime) {
    const weight = rule.evidenceWeights?.screen_time ?? 0.5;
    const detail = `${Math.round(evidenceSummary.screenTime.totalMinutes)} min phone use`;
    const matches = rule.requiresScreenTime
      ? evidenceSummary.screenTime.totalMinutes > 0
      : !evidenceSummary.screenTime.wasDistracted;
    evidenceBreakdown.screenTime = {
      matches,
      detail,
      weight,
    };
    if (evidenceSummary.screenTime.wasDistracted) {
      discrepancies.push({
        type: 'activity',
        expected: `Stay focused during ${event.category}`,
        actual: `${Math.round(evidenceSummary.screenTime.distractionMinutes)} min distraction`,
        severity: 'moderate',
      });
    }
  }

  if (evidenceSummary.health) {
    const weight = rule.evidenceWeights?.health_workout ?? 0.5;
    const detail = evidenceSummary.health.hasWorkout
      ? `${evidenceSummary.health.workoutType || 'Workout'}`
      : 'No workout';
    const matches = rule.requiresWorkout ? evidenceSummary.health.hasWorkout : true;
    evidenceBreakdown.health = {
      matches,
      detail,
      weight,
    };
    if (rule.requiresWorkout && !evidenceSummary.health.hasWorkout) {
      discrepancies.push({
        type: 'activity',
        expected: 'Workout detected',
        actual: 'No workout data',
        severity: 'moderate',
      });
    }
  }

  if (timing?.earlyMinutes) {
    discrepancies.push({
      type: 'timing',
      expected: 'On time',
      actual: `${Math.round(timing.earlyMinutes)} min early`,
      severity: 'minor',
    });
  }
  if (timing?.lateMinutes) {
    discrepancies.push({
      type: 'timing',
      expected: 'On time',
      actual: `${Math.round(timing.lateMinutes)} min late`,
      severity: 'minor',
    });
  }
  if (timing?.shortenedMinutes) {
    discrepancies.push({
      type: 'duration',
      expected: 'Full duration',
      actual: `${Math.round(timing.shortenedMinutes)} min shorter`,
      severity: 'moderate',
    });
  }
  if (timing?.extendedMinutes) {
    discrepancies.push({
      type: 'duration',
      expected: 'Planned duration',
      actual: `${Math.round(timing.extendedMinutes)} min longer`,
      severity: 'minor',
    });
  }

  const report: VerificationReport = {
    eventId: event.id,
    status: finalStatus,
    confidence,
    evidenceBreakdown,
    discrepancies,
    suggestions,
  };

  return {
    eventId: event.id,
    status: finalStatus,
    confidence,
    evidence: evidenceSummary,
    reason: reasons.join('. ') || 'No evidence available',
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    report,
    timing,
  };
}

/**
 * Verify all planned events for a day.
 */
export function verifyPlannedEvents(
  plannedEvents: ScheduledEvent[],
  evidence: EvidenceBundle,
  ymd: string,
  appCategoryOverrides?: AppCategoryOverrides,
  thresholds: VerificationThresholds = DEFAULT_VERIFICATION_THRESHOLDS,
): Map<string, VerificationResult> {
  const results = new Map<string, VerificationResult>();

  for (const event of plannedEvents) {
    const result = verifyEvent(event, evidence, ymd, appCategoryOverrides, thresholds);
    results.set(event.id, result);
  }

  return results;
}

// ============================================================================
// Actual Block Generation
// ============================================================================

/**
 * Generate actual calendar blocks from evidence data.
 * This creates standalone blocks for activities detected but not planned.
 */
export function generateActualBlocks(
  evidence: EvidenceBundle,
  ymd: string,
  plannedEvents: ScheduledEvent[],
  appCategoryOverrides?: AppCategoryOverrides,
): ActualBlock[] {
  const blocks: ActualBlock[] = [];
  const dayStart = ymdToDate(ymd);

  // ----- LOCATION-BASED BLOCKS -----
  const locationBlocks = buildLocationBlocks(dayStart, evidence.locationHourly);
  for (const loc of locationBlocks) {
    // Check if this block is covered by a planned event
    const isPlanned = plannedEvents.some(
      (e) => e.startMinutes < loc.endMinutes && (e.startMinutes + e.duration) > loc.startMinutes
    );

    if (!isPlanned && loc.placeLabel) {
      const category = placeToCategory(loc.placeCategory);
      blocks.push({
        id: `loc_${loc.startMinutes}_${loc.endMinutes}`,
        title: loc.placeLabel,
        description: loc.placeCategory || '',
        category,
        startMinutes: loc.startMinutes,
        endMinutes: loc.endMinutes,
        source: 'location',
        confidence: loc.sampleCount >= 6 ? 0.7 : 0.55,
        evidence: {
          location: {
            placeLabel: loc.placeLabel,
            placeCategory: loc.placeCategory,
            sampleCount: loc.sampleCount,
            matchesExpected: true,
          },
        },
      });
    }
  }

  // ----- WORKOUT-BASED BLOCKS -----
  for (const workout of evidence.healthWorkouts) {
    const workoutStart = new Date(workout.started_at);
    const workoutEnd = new Date(workout.ended_at);
    const startMinutes = Math.floor(
      (workoutStart.getTime() - dayStart.getTime()) / (60 * 1000)
    );
    const endMinutes = Math.floor(
      (workoutEnd.getTime() - dayStart.getTime()) / (60 * 1000)
    );

    // Check if this workout is during a planned health event
    const coveredByHealth = plannedEvents.some(
      (e) =>
        e.category === 'health' &&
        e.startMinutes <= startMinutes &&
        (e.startMinutes + e.duration) >= endMinutes
    );

    if (!coveredByHealth) {
      blocks.push({
        id: `workout_${workout.id}`,
        title: workout.activity_type || 'Workout',
        description: `${Math.round(workout.duration_seconds / 60)} min`,
        category: 'health',
        startMinutes: Math.max(0, startMinutes),
        endMinutes: Math.min(1440, endMinutes),
        source: 'workout',
        confidence: 0.85,
        evidence: {
          health: {
            hasWorkout: true,
            workoutType: workout.activity_type,
            workoutDurationMinutes: Math.round(workout.duration_seconds / 60),
          },
        },
      });
    }
  }

  // ----- SCREEN TIME BLOCKS (unplanned digital time) -----
  // Group consecutive screen time into blocks
  const screenTimeBlocks = groupScreenTimeSessions(
    evidence.screenTimeSessions,
    dayStart,
    plannedEvents
  );

  for (const block of screenTimeBlocks) {
    if (block.durationMinutes >= MIN_SCREEN_TIME_BLOCK_MINUTES) {
      // Only show blocks >= 10 min
      const classification = classifyScreenTimeBlock(block, appCategoryOverrides);
      blocks.push({
        id: `screen_${block.startMinutes}`,
        title: classification.title,
        description: classification.description,
        category: classification.category,
        startMinutes: block.startMinutes,
        endMinutes: block.endMinutes,
        source: 'screen_time',
        confidence: classification.confidence,
        evidence: {
          screenTime: {
            totalMinutes: block.durationMinutes,
            distractionMinutes: block.distractionMinutes,
            topApps: block.topApps,
            wasDistracted: block.distractionMinutes > 10,
          },
        },
      });
    }
  }

  // Merge overlapping blocks
  return mergeOverlappingBlocks(blocks);
}

// ============================================================================
// Helpers
// ============================================================================

function ymdToDate(ymd: string): Date {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day, 0, 0, 0, 0);
}

function placeToCategory(placeCategory: string | null): EventCategory {
  switch (placeCategory?.toLowerCase()) {
    case 'home':
      return 'routine';
    case 'office':
      return 'work';
    case 'gym':
      return 'health';
    case 'restaurant':
    case 'cafe':
      return 'meal';
    default:
      return 'unknown';
  }
}

interface ScreenTimeBlock {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  distractionMinutes: number;
  topApp: string | null;
  topApps: Array<{ app: string; minutes: number }>;
}

function groupScreenTimeSessions(
  sessions: ScreenTimeSessionRow[],
  dayStart: Date,
  plannedEvents: ScheduledEvent[]
): ScreenTimeBlock[] {
  const blocks: ScreenTimeBlock[] = [];
  const GAP_THRESHOLD = SCREEN_TIME_GAP_MINUTES; // Merge sessions within 15 minutes

  let currentBlock: ScreenTimeBlock | null = null;
  const appUsage = new Map<string, number>();

  for (const session of sessions) {
    const sessionStart = new Date(session.started_at);
    const sessionEnd = new Date(session.ended_at);
    const startMinutes = Math.floor(
      (sessionStart.getTime() - dayStart.getTime()) / (60 * 1000)
    );
    const endMinutes = Math.floor(
      (sessionEnd.getTime() - dayStart.getTime()) / (60 * 1000)
    );

    // Skip if covered by planned digital/comm time
    const isPlannedDigital = plannedEvents.some(
      (e) =>
        (e.category === 'digital' || e.category === 'comm') &&
        e.startMinutes <= startMinutes &&
        (e.startMinutes + e.duration) >= endMinutes
    );

    if (isPlannedDigital) continue;

    const durationMinutes = session.duration_seconds / 60;
    const appName = session.display_name || session.app_id;
    const isDistraction = appMatchesList(appName, DISTRACTION_APPS);

    if (currentBlock && startMinutes - currentBlock.endMinutes <= GAP_THRESHOLD) {
      // Extend current block
      currentBlock.endMinutes = Math.max(currentBlock.endMinutes, endMinutes);
      currentBlock.durationMinutes += durationMinutes;
      if (isDistraction) {
        currentBlock.distractionMinutes += durationMinutes;
      }
      const existing = appUsage.get(appName) ?? 0;
      appUsage.set(appName, existing + durationMinutes);
    } else {
      // Start new block
      if (currentBlock) {
        currentBlock.topApps = Array.from(appUsage.entries())
          .map(([app, minutes]) => ({ app, minutes }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 3);
        currentBlock.topApp = currentBlock.topApps[0]?.app ?? null;
        blocks.push(currentBlock);
        appUsage.clear();
      }

      currentBlock = {
        startMinutes: Math.max(0, startMinutes),
        endMinutes: Math.min(1440, endMinutes),
        durationMinutes,
        distractionMinutes: isDistraction ? durationMinutes : 0,
        topApp: appName,
        topApps: [],
      };
      appUsage.set(appName, durationMinutes);
    }
  }

  // Don't forget the last block
  if (currentBlock) {
    currentBlock.topApps = Array.from(appUsage.entries())
      .map(([app, minutes]) => ({ app, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3);
    currentBlock.topApp = currentBlock.topApps[0]?.app ?? null;
    blocks.push(currentBlock);
  }

  return blocks;
}

interface LocationBlock {
  startMinutes: number;
  endMinutes: number;
  placeLabel: string;
  placeCategory: string | null;
  placeKey: string;
  sampleCount: number;
}

function buildLocationBlocks(dayStart: Date, rows: LocationHourlyRow[]): LocationBlock[] {
  const blocks: LocationBlock[] = [];
  const sorted = [...rows].sort((a, b) => a.hour_start.localeCompare(b.hour_start));
  let current: LocationBlock | null = null;

  for (const row of sorted) {
    const hourStart = new Date(row.hour_start);
    const startMinutes = Math.floor((hourStart.getTime() - dayStart.getTime()) / 60_000);
    if (startMinutes < 0 || startMinutes >= 24 * 60) continue;

    const placeLabel = row.place_label || row.place_category || '';
    const placeCategory = row.place_category ?? null;
    const placeKey = row.place_id ?? `${placeLabel}:${placeCategory ?? 'unknown'}`.toLowerCase();
    const nextStart = startMinutes;
    const nextEnd = startMinutes + 60;

    if (current && current.placeKey === placeKey && current.endMinutes === nextStart) {
      current.endMinutes = nextEnd;
      current.sampleCount += row.sample_count;
      continue;
    }

    current = {
      startMinutes: nextStart,
      endMinutes: nextEnd,
      placeLabel,
      placeCategory,
      placeKey,
      sampleCount: row.sample_count,
    };
    blocks.push(current);
  }

  return blocks;
}

function mergeOverlappingBlocks(blocks: ActualBlock[]): ActualBlock[] {
  if (blocks.length === 0) return [];

  // Sort by start time
  const sorted = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);
  const merged: ActualBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // If overlapping and same source/category, merge
    if (
      current.startMinutes < last.endMinutes &&
      current.source === last.source &&
      current.category === last.category
    ) {
      last.endMinutes = Math.max(last.endMinutes, current.endMinutes);
      // Combine descriptions
      if (current.description && !last.description.includes(current.description)) {
        last.description = `${last.description}, ${current.description}`;
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function classifyScreenTimeBlock(
  block: ScreenTimeBlock,
  appCategoryOverrides?: AppCategoryOverrides,
): {
  title: string;
  description: string;
  category: EventCategory;
  isDistraction: boolean;
  confidence: number;
} {
  const topApp = block.topApp ?? 'Phone usage';
  const classification = classifyAppUsage(topApp, appCategoryOverrides);
  return {
    title: classification.title,
    description: classification.description,
    category: classification.category,
    isDistraction: classification.isDistraction,
    confidence: classification.confidence,
  };
}
