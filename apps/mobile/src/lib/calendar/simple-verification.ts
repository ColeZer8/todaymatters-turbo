/**
 * Simple Verification Engine
 *
 * Cross-references planned events against BRAVO/CHARLIE location blocks.
 * Intentionally simple — 4 statuses, location-focused, under 150 lines.
 */

import type { ScheduledEvent } from "@/stores";
import type { LocationBlock } from "@/lib/types/location-block";

// ============================================================================
// Types
// ============================================================================

export type SimpleVerificationStatus =
  | "verified" // Location + timing match the plan
  | "partial" // Some overlap but incomplete match
  | "unverified" // No location data covers this window
  | "contradicted"; // User was clearly somewhere else

export interface SimpleVerificationResult {
  eventId: string;
  status: SimpleVerificationStatus;
  /** Did location match the expected category? */
  locationMatch: boolean;
  /** Where the user actually was (best match). */
  locationLabel: string | null;
  /** 0–1 confidence score. */
  confidence: number;
  /** Fraction of the planned window covered by overlapping blocks. */
  overlapRatio: number;
}

// ============================================================================
// Category → expected location mapping
// ============================================================================

const CATEGORY_LOCATION_MAP: Record<string, string[]> = {
  work: ["office", "coworking"],
  health: ["gym", "fitness", "park", "recreation"],
  meal: ["restaurant", "cafe", "bar", "home"],
  routine: ["home"],
  faith: ["church", "temple", "mosque"],
  sleep: ["home"],
};

// ============================================================================
// Core logic
// ============================================================================

/**
 * Find all location blocks that overlap a given minute-window.
 * Returns them sorted by overlap duration descending.
 */
function findOverlapping(
  startMin: number,
  endMin: number,
  blocks: LocationBlock[],
): { block: LocationBlock; overlapMinutes: number }[] {
  const results: { block: LocationBlock; overlapMinutes: number }[] = [];

  for (const block of blocks) {
    const bStart = minutesFromMidnight(block.startTime);
    const bEnd = minutesFromMidnight(block.endTime);
    const overlap = Math.max(
      0,
      Math.min(endMin, bEnd) - Math.max(startMin, bStart),
    );
    if (overlap > 0) {
      results.push({ block, overlapMinutes: overlap });
    }
  }

  return results.sort((a, b) => b.overlapMinutes - a.overlapMinutes);
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function locationMatchesCategory(
  block: LocationBlock,
  category: string,
): boolean {
  const expected = CATEGORY_LOCATION_MAP[category];
  if (!expected) return true; // No expectation → can't contradict

  const cat = block.locationCategory?.toLowerCase() ?? "";
  const label = block.locationLabel?.toLowerCase() ?? "";

  return expected.some((exp) => cat.includes(exp) || label.includes(exp));
}

function computeConfidence(
  overlapRatio: number,
  block: LocationBlock | null,
): number {
  if (!block) return 0;

  // Base: how much of the planned window is covered
  let score = overlapRatio * 0.6;

  // Location sample density (more samples → more confident)
  const sampleBonus = Math.min(block.totalLocationSamples / 12, 1) * 0.2;
  score += sampleBonus;

  // Inference confidence from the block itself
  score += block.confidenceScore * 0.2;

  return Math.min(1, Math.max(0, score));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Verify all planned events against location blocks for the same day.
 *
 * Returns a Map keyed by event ID → SimpleVerificationResult.
 */
export function verifyPlannedAgainstBlocks(
  plannedEvents: ScheduledEvent[],
  blocks: LocationBlock[],
): Map<string, SimpleVerificationResult> {
  const results = new Map<string, SimpleVerificationResult>();

  for (const event of plannedEvents) {
    const endMin = event.startMinutes + event.duration;
    const overlapping = findOverlapping(event.startMinutes, endMin, blocks);

    // No overlapping blocks → unverified
    if (overlapping.length === 0) {
      results.set(event.id, {
        eventId: event.id,
        status: "unverified",
        locationMatch: false,
        locationLabel: null,
        confidence: 0,
        overlapRatio: 0,
      });
      continue;
    }

    const totalOverlap = overlapping.reduce(
      (sum, o) => sum + o.overlapMinutes,
      0,
    );
    const overlapRatio = Math.min(1, totalOverlap / event.duration);
    const primary = overlapping[0];
    const locMatch = locationMatchesCategory(primary.block, event.category);
    const confidence = computeConfidence(overlapRatio, primary.block);

    let status: SimpleVerificationStatus;

    if (!locMatch && overlapRatio >= 0.5) {
      // User was clearly somewhere else for most of the window
      status = "contradicted";
    } else if (locMatch && overlapRatio >= 0.6) {
      status = "verified";
    } else if (overlapRatio >= 0.3 || (locMatch && overlapRatio > 0)) {
      status = "partial";
    } else {
      status = "unverified";
    }

    results.set(event.id, {
      eventId: event.id,
      status,
      locationMatch: locMatch,
      locationLabel: primary.block.locationLabel,
      confidence,
      overlapRatio,
    });
  }

  return results;
}
