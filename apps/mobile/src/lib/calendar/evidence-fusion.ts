import type { EventCategory } from '@/stores';
import type { VerificationResult } from './verification-engine';
import type { DataQualityMetrics } from './data-quality';
import type { PatternSummaryResult } from './pattern-recognition';

/**
 * Evidence source priority for determining actual timeline events.
 * Lower number = higher priority.
 *
 * Priority order:
 * 1. User's ideal/planned event - what the user intended to do
 * 2. Location data - physical presence is the strongest evidence of activity
 * 3. Screen time - intentionality check, confirms/adjusts based on device usage
 * 4. Pattern - historical behavior patterns
 * 5. Health data - workout/sleep data from wearables
 */
export enum EvidenceSourcePriority {
  UserPlanned = 1,
  Location = 2,
  ScreenTime = 3,
  Pattern = 4,
  Health = 5,
}

export interface EvidenceFusionSource {
  type: 'location' | 'screen_time' | 'health' | 'pattern' | 'user_history';
  weight: number;
  detail: string;
  priority: EvidenceSourcePriority;
  isContextual?: boolean; // For screen_time: true if usage is expected for the context (e.g., calculator at work)
}

export interface EvidenceFusionConflict {
  source1: 'location' | 'screen_time' | 'health' | 'pattern';
  source2: 'plan' | 'pattern';
  conflict: string;
  resolution: 'source1_wins' | 'source2_wins' | 'compromise' | 'unresolved';
}

export interface EvidenceFusionResult {
  confidence: number;
  sources: EvidenceFusionSource[];
  conflicts: EvidenceFusionConflict[];
  /**
   * The primary evidence source that determined the actual event.
   * Based on priority order: UserPlanned > Location > ScreenTime > Pattern > Health
   */
  primarySource: EvidenceFusionSource['type'] | null;
  /**
   * The priority of the primary source (lower = higher priority)
   */
  primarySourcePriority: EvidenceSourcePriority | null;
}

/**
 * Source weights for confidence calculation.
 * Higher weight = more influence on final confidence score.
 * Note: These weights are for CONFIDENCE, not priority.
 * Priority order is determined by EvidenceSourcePriority enum.
 */
const SOURCE_WEIGHTS: Record<EvidenceFusionSource['type'], number> = {
  user_history: 0.35, // User's planned events are most reliable when confirmed
  location: 0.30,     // Location is strong evidence of physical activity
  screen_time: 0.15,  // Screen time confirms/adjusts, but doesn't override location
  pattern: 0.10,      // Historical patterns provide context
  health: 0.10,       // Health data supplements other sources
};

/**
 * Maps source types to their priority values.
 */
const SOURCE_PRIORITY: Record<EvidenceFusionSource['type'], EvidenceSourcePriority> = {
  user_history: EvidenceSourcePriority.UserPlanned,
  location: EvidenceSourcePriority.Location,
  screen_time: EvidenceSourcePriority.ScreenTime,
  pattern: EvidenceSourcePriority.Pattern,
  health: EvidenceSourcePriority.Health,
};

/**
 * List of app categories that are considered "contextual" - they don't indicate
 * a change of activity when used during an expected context.
 * E.g., using a calculator or notes app while at work doesn't mean you're not working.
 */
const CONTEXTUAL_APP_CATEGORIES = [
  'productivity',
  'utilities',
  'business',
  'finance',
  'reference',
  'education',
  'developer_tools',
];

/**
 * Checks if screen time usage is contextual (expected for the planned activity).
 * Contextual usage doesn't override location-based evidence.
 */
function isContextualScreenTime(
  screenTimeDetail: string | undefined,
  plannedCategory: EventCategory,
): boolean {
  if (!screenTimeDetail) return false;

  // If the planned activity is work-related and screen time is productive
  if (plannedCategory === 'work' || plannedCategory === 'digital' || plannedCategory === 'meeting') {
    // Look for indicators of productive/contextual app usage in the detail
    const lowerDetail = screenTimeDetail.toLowerCase();
    const productiveIndicators = [
      'productive',
      'work',
      'email',
      'calendar',
      'slack',
      'teams',
      'zoom',
      'meet',
      'notes',
      'docs',
      'sheets',
      'excel',
      'word',
      'code',
      'terminal',
      'calculator',
      'browser',
      'chrome',
      'safari',
      'firefox',
    ];
    return productiveIndicators.some((indicator) => lowerDetail.includes(indicator));
  }

  // For health/exercise activities, short phone checks are expected
  if (plannedCategory === 'health') {
    const lowerDetail = screenTimeDetail.toLowerCase();
    // Music/podcast apps are expected during exercise
    const expectedApps = ['spotify', 'music', 'podcast', 'fitness', 'workout', 'strava', 'nike'];
    return expectedApps.some((app) => lowerDetail.includes(app));
  }

  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveConflict(options: {
  source: EvidenceFusionConflict['source1'];
  verification: VerificationResult | null;
  patternSummary: PatternSummaryResult | null;
  plannedCategory: EventCategory;
  isScreenTimeContextual: boolean;
}): EvidenceFusionConflict['resolution'] {
  const { source, verification, patternSummary, plannedCategory, isScreenTimeContextual } = options;

  // Priority order for conflict resolution:
  // 1. User planned (highest)
  // 2. Location
  // 3. Screen time (only if not contextual)
  // 4. Pattern
  // 5. Health

  if (source === 'location') {
    // Location always wins against plan if it contradicts (e.g., user planned gym but is at McDonald's)
    if (verification?.evidence.location && !verification.evidence.location.matchesExpected) {
      return 'source1_wins';
    }
    // Location confirms the plan
    return 'compromise';
  }

  if (source === 'screen_time') {
    // Screen time only overrides plan if:
    // 1. It's significant distraction (>= 20 min)
    // 2. AND it's NOT contextual usage (not expected for the activity)
    const distraction = verification?.evidence.screenTime?.distractionMinutes ?? 0;
    if (distraction >= 20 && !isScreenTimeContextual) {
      return 'source1_wins';
    }
    // Contextual screen time or low distraction doesn't override
    return 'source2_wins'; // Plan wins
  }

  if (source === 'health') {
    // Health data (like workout detection) confirms physical activity
    // But location takes precedence if available
    const hasLocationData = verification?.evidence.location != null;
    if (hasLocationData) {
      return 'compromise'; // Use both health and location together
    }
    return 'source1_wins';
  }

  if (source === 'pattern') {
    // Patterns only win with very high confidence
    if (patternSummary?.confidence && patternSummary.confidence >= 0.8) {
      return 'source1_wins';
    }
    return 'source2_wins'; // Plan wins
  }

  return 'unresolved';
}

export function buildEvidenceFusion(options: {
  verification: VerificationResult | null;
  dataQuality: DataQualityMetrics;
  patternSummary: PatternSummaryResult | null;
  conflicts: Array<{ source: EvidenceFusionConflict['source1']; detail: string }>;
  plannedCategory: EventCategory;
}): EvidenceFusionResult {
  const { verification, dataQuality, patternSummary, conflicts, plannedCategory } = options;
  const sources: EvidenceFusionSource[] = [];

  // Build screen time detail for contextual check
  const screenTimeDetail = verification?.evidence.screenTime
    ? `${Math.round(verification.evidence.screenTime.totalMinutes)} min phone use${
        verification.evidence.screenTime.topApps[0]?.app
          ? ` on ${verification.evidence.screenTime.topApps[0].app}`
          : ''
      }`
    : undefined;

  // Check if screen time is contextual (expected for the planned activity)
  const screenTimeIsContextual = isContextualScreenTime(screenTimeDetail, plannedCategory);

  // Add user_history (planned event) source first - highest priority
  if (plannedCategory) {
    sources.push({
      type: 'user_history',
      weight: SOURCE_WEIGHTS.user_history,
      detail: `Planned ${plannedCategory}`,
      priority: SOURCE_PRIORITY.user_history,
    });
  }

  // Add location source - second highest priority
  if (verification?.evidence.location) {
    sources.push({
      type: 'location',
      weight: SOURCE_WEIGHTS.location,
      detail: verification.evidence.location.placeLabel ?? 'Location data',
      priority: SOURCE_PRIORITY.location,
    });
  }

  // Add screen time source - with contextual flag
  if (verification?.evidence.screenTime) {
    sources.push({
      type: 'screen_time',
      weight: SOURCE_WEIGHTS.screen_time,
      detail: screenTimeDetail ?? 'Screen time data',
      priority: SOURCE_PRIORITY.screen_time,
      isContextual: screenTimeIsContextual,
    });
  }

  // Add pattern source
  if (patternSummary) {
    sources.push({
      type: 'pattern',
      weight: SOURCE_WEIGHTS.pattern,
      detail: patternSummary.typicalCategory
        ? `Typical ${patternSummary.typicalCategory}`
        : 'Pattern history',
      priority: SOURCE_PRIORITY.pattern,
    });
  }

  // Add health source - lowest priority
  if (verification?.evidence.health) {
    sources.push({
      type: 'health',
      weight: SOURCE_WEIGHTS.health,
      detail: verification.evidence.health.workoutType ?? 'Health data',
      priority: SOURCE_PRIORITY.health,
    });
  }

  // Determine primary source based on priority (lowest number = highest priority)
  // If location conflicts with plan, location wins
  // If screen time is non-contextual and significant, it can override
  let primarySource: EvidenceFusionSource | null = null;

  // Sort sources by priority to find the primary one
  const sortedSources = [...sources].sort((a, b) => a.priority - b.priority);

  // Check if location contradicts the plan
  const locationContradicts =
    verification?.evidence.location && !verification.evidence.location.matchesExpected;

  // Check if screen time is significant and non-contextual
  const screenTimeSignificant =
    verification?.evidence.screenTime &&
    verification.evidence.screenTime.distractionMinutes >= 20 &&
    !screenTimeIsContextual;

  if (locationContradicts) {
    // Location takes precedence when it contradicts the plan
    primarySource = sources.find((s) => s.type === 'location') ?? null;
  } else if (screenTimeSignificant) {
    // Significant non-contextual screen time can override
    primarySource = sources.find((s) => s.type === 'screen_time') ?? null;
  } else if (sortedSources.length > 0) {
    // Otherwise, use the highest priority source
    primarySource = sortedSources[0] ?? null;
  }

  const baseConfidence = verification?.confidence ?? 0.6;
  const reliability = dataQuality.reliability ?? 1;
  const patternPenalty = patternSummary?.deviation ? 0.85 : 1;
  const conflictPenalty = conflicts.length > 0 ? clamp(1 - conflicts.length * 0.08, 0.6, 1) : 1;

  // Boost confidence if location confirms the plan
  const locationConfirmsBoost =
    verification?.evidence.location?.matchesExpected ? 1.1 : 1;

  const confidence = clamp(
    baseConfidence * reliability * patternPenalty * conflictPenalty * locationConfirmsBoost,
    0,
    1
  );

  const resolvedConflicts: EvidenceFusionConflict[] = conflicts.map((conflict) => ({
    source1: conflict.source,
    source2: conflict.source === 'pattern' ? 'plan' : 'plan',
    conflict: conflict.detail,
    resolution: resolveConflict({
      source: conflict.source,
      verification,
      patternSummary,
      plannedCategory,
      isScreenTimeContextual: screenTimeIsContextual,
    }),
  }));

  return {
    confidence,
    sources,
    conflicts: resolvedConflicts,
    primarySource: primarySource?.type ?? null,
    primarySourcePriority: primarySource?.priority ?? null,
  };
}
