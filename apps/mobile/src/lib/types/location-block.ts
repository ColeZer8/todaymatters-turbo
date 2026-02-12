/**
 * Location Block types.
 *
 * A LocationBlock represents a contiguous period of time spent at one
 * location (or traveling between locations). It is created by grouping
 * consecutive hourly summaries that share the same place.
 */

import type { EnrichedSummary } from "@/components/organisms/HourlySummaryList";
import type {
  ActivitySegment,
  InferredActivityType,
} from "@/lib/supabase/services/activity-segments";
import type { MovementType } from "@/lib/supabase/services/actual-ingestion";
import type { InferredPlace } from "@/lib/supabase/services/place-inference";
import type { InferenceDescription } from "@/lib/supabase/services/activity-inference-descriptions";
import type { TimelineEvent } from "@/lib/types/timeline-event";

// ============================================================================
// Place Alternatives (for disambiguation UI)
// ============================================================================

/** A candidate place near the user's location, returned by location-place-lookup. */
export interface PlaceAlternative {
  placeName: string;
  googlePlaceId: string | null;
  vicinity: string | null;
  types: string[] | null;
  placeLatitude: number | null;
  placeLongitude: number | null;
  distanceMeters: number | null;
}

// ============================================================================
// App Usage
// ============================================================================

/** A single contiguous session of app usage within a block. */
export interface AppSession {
  startTime: Date;
  endTime: Date;
  minutes: number;
}

/** Aggregated app usage across all hours in a location block. */
export interface BlockAppUsage {
  appId: string;
  displayName: string;
  category: string;
  /** Total minutes across all hours in the block. */
  totalMinutes: number;
  /** Chronological sessions for the expandable detail view. */
  sessions: AppSession[];
}

// ============================================================================
// Location Block
// ============================================================================

export type LocationBlockType = "stationary" | "travel";

/** A contiguous block of time at one location. */
export interface LocationBlock {
  /** Unique ID (derived from first summary ID). */
  id: string;
  /** Whether this is a stationary block or a travel block. */
  type: LocationBlockType;
  /** Movement type for travel blocks (walking, cycling, driving). */
  movementType?: MovementType | null;
  /** Approximate distance traveled in meters (travel blocks). */
  distanceM?: number | null;

  // -- Location --
  /** Location label (e.g., "Home", "Work", "In Transit"). */
  locationLabel: string;
  /** Location category for icon selection. */
  locationCategory: string | null;
  /** Inferred place data if available. */
  inferredPlace: InferredPlace | null;
  /** Whether the place was inferred rather than user-defined. */
  isPlaceInferred: boolean;
  /** Geohash7 for this block's location. */
  geohash7: string | null;

  // -- Time --
  /** Earliest time in this block. */
  startTime: Date;
  /** Latest time in this block. */
  endTime: Date;
  /** Total duration in minutes. */
  durationMinutes: number;

  // -- Content --
  /** Aggregated app usage sorted by total minutes descending. */
  apps: BlockAppUsage[];
  /** Total screen time in minutes. */
  totalScreenMinutes: number;
  /** Dominant activity type across the block. */
  dominantActivity: InferredActivityType | null;
  /** Activity inference description for display. */
  activityInference: InferenceDescription | null;

  // -- Evidence --
  /** Average confidence score (duration-weighted). */
  confidenceScore: number;
  /** Total location samples across all hours. */
  totalLocationSamples: number;

  // -- Underlying data --
  /** All underlying hourly summaries in chronological order. */
  summaries: EnrichedSummary[];
  /** All activity segments across all hours, chronological. */
  segments: ActivitySegment[];

  // -- Feedback --
  /** Summary IDs for feedback submission. */
  summaryIds: string[];
  /** Whether any summary in this block has user feedback. */
  hasUserFeedback: boolean;
  /** Whether any summary in this block is locked. */
  isLocked: boolean;

  // -- Place Disambiguation --
  /** Alternative places near this location (for user selection). */
  placeAlternatives?: PlaceAlternative[];
  /** Latitude of the block's location centroid. */
  latitude?: number | null;
  /** Longitude of the block's location centroid. */
  longitude?: number | null;

  // -- Timeline --
  /** Merged chronological timeline events for rendering. */
  timelineEvents?: TimelineEvent[];

  // -- Location Carry-Forward --
  /** Whether this block was synthetically created by carrying forward a previous location. */
  isCarriedForward?: boolean;

  // -- User-defined Labels --
  /** Whether this block's label was set by the user (from user_places table). */
  isUserDefined?: boolean;
}
