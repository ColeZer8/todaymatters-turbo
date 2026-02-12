/**
 * HourlySummaryCard Component
 *
 * Displays an hourly summary from the CHARLIE layer data pipeline.
 * Shows time range, location, activity, app breakdown, confidence,
 * and feedback/edit buttons.
 */

import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  MapPin,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Smartphone,
  type LucideIcon,
  Home,
  Briefcase,
  Dumbbell,
  Coffee,
  Car,
  ShoppingBag,
  Utensils,
  Building2,
  Church,
  GraduationCap,
  Heart,
  Activity,
  Sparkles,
} from "lucide-react-native";
import type {
  HourlySummary,
  SummaryAppBreakdown,
  EvidenceStrength,
} from "@/lib/supabase/services";
import type { InferredPlace } from "@/lib/supabase/services/place-inference";
import {
  generateInferenceDescription,
  type InferenceContext,
  type InferenceDescription,
} from "@/lib/supabase/services/activity-inference-descriptions";
import type { ActivitySegment } from "@/lib/supabase/services/activity-segments";

// ============================================================================
// Types
// ============================================================================

export interface HourlySummaryCardProps {
  /** The hourly summary data */
  summary: HourlySummary;
  /** Called when user marks summary as accurate */
  onMarkAccurate?: (summaryId: string) => void;
  /** Called when user marks summary as needing correction */
  onNeedsCorrection?: (summaryId: string) => void;
  /** Called when user wants to edit the summary */
  onEdit?: (summary: HourlySummary) => void;
  /** Inferred place data (from place inference service) */
  inferredPlace?: InferredPlace | null;
  /** Number of location samples for this hour */
  locationSamples?: number;
  /** Previous hour's geohash (for travel detection) */
  previousGeohash?: string | null;
  /** Previous hour's place label (for travel descriptions) */
  previousPlaceLabel?: string | null;
  /** Current hour's geohash */
  currentGeohash?: string | null;
  /** Location radius in meters */
  locationRadius?: number | null;
  /** Google place types for this location */
  googlePlaceTypes?: string[] | null;
  /** Activity segments for this hour (granular time breakdown) */
  segments?: ActivitySegment[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format hour as a time range string (e.g., "9:00 AM - 10:00 AM")
 */
function formatHourRange(hourStart: Date): string {
  const startHour = hourStart.getHours();
  const endHour = (startHour + 1) % 24;

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}

/**
 * Get an icon for a place category based on label text.
 */
function getPlaceIcon(placeLabel: string | null): LucideIcon {
  if (!placeLabel) return MapPin;

  const label = placeLabel.toLowerCase();

  if (label.includes("home")) return Home;
  if (label.includes("office") || label.includes("work")) return Briefcase;
  if (label.includes("gym") || label.includes("fitness")) return Dumbbell;
  if (label.includes("cafe") || label.includes("coffee")) return Coffee;
  if (label.includes("commute") || label.includes("transit")) return Car;
  if (label.includes("store") || label.includes("shop")) return ShoppingBag;
  if (label.includes("restaurant") || label.includes("food")) return Utensils;
  if (label.includes("church")) return Church;
  if (label.includes("school") || label.includes("university")) return GraduationCap;
  if (label.includes("hospital") || label.includes("doctor")) return Heart;
  if (label.includes("building")) return Building2;

  return MapPin;
}

/**
 * Get an icon for an inferred place type.
 */
function getPlaceIconForType(type: string | null): LucideIcon {
  switch (type) {
    case "home":
      return Home;
    case "work":
      return Briefcase;
    case "frequent":
      return MapPin;
    default:
      return MapPin;
  }
}

/**
 * Get color for an inferred place type.
 */
function getPlaceTypeColor(type: string | null): string {
  switch (type) {
    case "home":
      return "#22C55E"; // Green
    case "work":
      return "#3B82F6"; // Blue
    case "frequent":
      return "#F59E0B"; // Amber
    default:
      return "#6B7280"; // Gray
  }
}

/**
 * Get color for confidence score.
 */
function getConfidenceColor(score: number): string {
  if (score >= 0.7) return "#22C55E"; // Green
  if (score >= 0.4) return "#F59E0B"; // Orange
  return "#EF4444"; // Red
}

/**
 * Get label for evidence strength.
 */
function getEvidenceLabel(strength: EvidenceStrength): string {
  switch (strength) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
    default:
      return "Unknown";
  }
}

/**
 * Get tooltip text for confidence badge.
 */
function getConfidenceTooltip(
  score: number,
  strength: EvidenceStrength,
): string {
  const label = getEvidenceLabel(strength);
  return `${Math.round(score * 100)}% - ${label}`;
}

// ============================================================================
// Sub-components
// ============================================================================

interface AppBreakdownItemProps {
  app: SummaryAppBreakdown;
}

function AppBreakdownItem({ app }: AppBreakdownItemProps) {
  if (app.minutes < 1) return null;

  return (
    <View style={styles.appItem}>
      <Smartphone size={12} color="#6B7280" />
      <Text style={styles.appName} numberOfLines={1}>
        {app.displayName}
      </Text>
      <Text style={styles.appDuration}>{app.minutes}m</Text>
    </View>
  );
}

interface ConfidenceBadgeProps {
  score: number;
  evidenceStrength: EvidenceStrength;
}

function ConfidenceBadge({ score, evidenceStrength }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);
  const color = getConfidenceColor(score);
  const tooltip = getConfidenceTooltip(score, evidenceStrength);

  return (
    <View style={styles.confidenceBadge} accessibilityLabel={tooltip}>
      <Activity size={12} color={color} />
      <Text style={[styles.confidenceText, { color }]}>{percentage}%</Text>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const HourlySummaryCard = ({
  summary,
  onMarkAccurate,
  onNeedsCorrection,
  onEdit,
  inferredPlace,
  locationSamples,
  previousGeohash,
  previousPlaceLabel,
  currentGeohash,
  locationRadius,
  googlePlaceTypes,
  segments,
}: HourlySummaryCardProps) => {
  // Determine if place is inferred (no user-defined place but we have inference)
  const isPlaceInferred = !summary.primaryPlaceId && !!inferredPlace;
  const placeLabel = summary.primaryPlaceLabel ?? "Unknown Location";

  // Generate activity inference description
  const inferenceContext: InferenceContext = {
    activity: summary.primaryActivity,
    apps: summary.appBreakdown,
    screenMinutes: summary.totalScreenMinutes,
    hourOfDay: summary.hourOfDay,
    placeLabel: summary.primaryPlaceLabel,
    previousPlaceLabel,
    inferredPlace,
    locationSamples: locationSamples ?? 0,
    confidence: summary.confidenceScore,
    previousGeohash,
    currentGeohash,
    locationRadius,
    googlePlaceTypes,
  };
  const inferenceDescription = generateInferenceDescription(inferenceContext);
  
  // Get icon based on inferred type if available, otherwise use label matching
  const PlaceIcon = isPlaceInferred && inferredPlace
    ? getPlaceIconForType(inferredPlace.inferredType)
    : getPlaceIcon(placeLabel);
  
  // Get color based on inferred type
  const placeColor = isPlaceInferred && inferredPlace
    ? getPlaceTypeColor(inferredPlace.inferredType)
    : "#2563EB";

  const isLocked = !!summary.lockedAt;
  const hasUserFeedback = !!summary.userFeedback;
  const topApps = summary.appBreakdown.slice(0, 3).filter((a) => a.minutes >= 1);

  return (
    <View style={styles.container}>
      {/* Header: Time range + Confidence */}
      <View style={styles.header}>
        <View style={styles.timeRow}>
          <Clock size={14} color="#6B7280" />
          <Text style={styles.timeText}>{formatHourRange(summary.hourStart)}</Text>
        </View>
        <ConfidenceBadge
          score={summary.confidenceScore}
          evidenceStrength={summary.evidenceStrength}
        />
      </View>

      {/* Location Row */}
      <View style={styles.locationRow}>
        <View style={[styles.placeIconContainer, { backgroundColor: `${placeColor}15` }]}>
          <PlaceIcon size={18} color={placeColor} />
        </View>
        <View style={styles.placeLabelContainer}>
          <Text style={[styles.placeLabel, { color: placeColor }]} numberOfLines={1}>
            {placeLabel}
          </Text>
          {isPlaceInferred && (
            <View style={styles.inferredBadge}>
              <Sparkles size={10} color="#D97706" />
              <Text style={styles.inferredBadgeText}>Inferred</Text>
            </View>
          )}
        </View>
      </View>

      {/* Title + Description */}
      <Text style={styles.title}>{summary.title}</Text>
      {summary.description && (
        <Text style={styles.description} numberOfLines={2}>
          {summary.description}
        </Text>
      )}

      {/* App Breakdown */}
      {topApps.length > 0 && (
        <View style={styles.appBreakdownSection}>
          <Text style={styles.appBreakdownLabel}>Apps</Text>
          <View style={styles.appBreakdownRow}>
            {topApps.map((app) => (
              <AppBreakdownItem key={app.appId} app={app} />
            ))}
          </View>
        </View>
      )}

      {/* Screen Time + Location Samples */}
      {(summary.totalScreenMinutes > 0 || (typeof locationSamples === 'number' && locationSamples > 0)) && (
        <View style={styles.screenTimeRow}>
          {summary.totalScreenMinutes > 0 && (
            <>
              <Smartphone size={12} color="#9CA3AF" />
              <Text style={styles.screenTimeText}>
                {String(summary.totalScreenMinutes)} min screen time
              </Text>
            </>
          )}
          {typeof locationSamples === 'number' && locationSamples > 0 && (
            <>
              {summary.totalScreenMinutes > 0 && <Text style={styles.screenTimeDivider}>·</Text>}
              <MapPin size={12} color="#9CA3AF" />
              <Text style={styles.screenTimeText}>
                {String(locationSamples)} location samples
              </Text>
            </>
          )}
        </View>
      )}

      {/* Activity Inference Description */}
      {inferenceDescription && (
        <View style={styles.activityInferenceContainer}>
          <View style={styles.activityInferenceHeader}>
            <Sparkles size={12} color="#2563EB" />
            <Text style={styles.activityInferencePrimary}>
              {inferenceDescription.primary}
            </Text>
          </View>
          {inferenceDescription.secondary && (
            <Text style={styles.activityInferenceSecondary}>
              {inferenceDescription.secondary}
            </Text>
          )}
        </View>
      )}

      {/* Place Inference Reasoning (only show if different from activity inference) */}
      {isPlaceInferred && inferredPlace?.reasoning && !inferenceDescription && (
        <View style={styles.inferenceReasoningContainer}>
          <Sparkles size={12} color="#D97706" />
          <Text style={styles.inferenceReasoningText}>
            <Text style={styles.inferenceReasoningLabel}>Place inference: </Text>
            {inferredPlace.reasoning}
          </Text>
        </View>
      )}

      {/* Time Breakdown (Activity Segments) */}
      {segments && segments.length > 0 && (
        <View style={styles.segmentsSection}>
          <View style={styles.segmentsHeader}>
            <Clock size={12} color="#64748B" />
            <Text style={styles.segmentsHeaderText}>Time Breakdown</Text>
          </View>
          {segments.map((seg, idx) => {
            const startTime = seg.startedAt.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            const endTime = seg.endedAt.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            const durationMin = Math.round((seg.endedAt.getTime() - seg.startedAt.getTime()) / 60000);
            const isCommute = seg.inferredActivity === "commute" || seg.placeCategory === "commute";
            // Use movement-type-specific labels and emojis
            const commuteLabel = isCommute
              ? seg.movementType === "walking" ? "🚶 Walking"
                : seg.movementType === "cycling" ? "🚴 Cycling"
                : seg.movementType === "driving" ? "🚗 Driving"
                : "🚗 Traveling"
              : null;
            const label = isCommute ? commuteLabel! : (seg.placeLabel ?? "Activity");
            
            return (
              <View key={seg.id ?? idx} style={styles.segmentRow}>
                <Text style={styles.segmentTime}>{startTime} - {endTime}</Text>
                <Text style={styles.segmentLabel} numberOfLines={1}>{label}</Text>
                <Text style={styles.segmentDuration}>{durationMin}m</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Feedback Buttons */}
      {!hasUserFeedback && !isLocked && (
        <View style={styles.feedbackSection}>
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => onMarkAccurate?.(summary.id)}
            accessibilityLabel="Mark as accurate"
          >
            <ThumbsUp size={16} color="#22C55E" />
            <Text style={[styles.feedbackButtonText, styles.feedbackAccurate]}>
              Accurate
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => onNeedsCorrection?.(summary.id)}
            accessibilityLabel="Needs correction"
          >
            <ThumbsDown size={16} color="#EF4444" />
            <Text style={[styles.feedbackButtonText, styles.feedbackCorrection]}>
              Needs Correction
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEdit?.(summary)}
            accessibilityLabel="Edit summary"
          >
            <Pencil size={16} color="#6B7280" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feedback Status (if already provided) */}
      {hasUserFeedback && (
        <View style={styles.feedbackStatusRow}>
          {summary.userFeedback === "accurate" ? (
            <>
              <ThumbsUp size={14} color="#22C55E" />
              <Text style={styles.feedbackStatusText}>Marked as accurate</Text>
            </>
          ) : (
            <>
              <ThumbsDown size={14} color="#EF4444" />
              <Text style={styles.feedbackStatusText}>Correction submitted</Text>
            </>
          )}
          {isLocked && (
            <TouchableOpacity
              style={styles.editButtonSmall}
              onPress={() => onEdit?.(summary)}
            >
              <Pencil size={12} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.32)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(148,163,184,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  placeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(37,99,235,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  placeLabelContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  placeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
  inferredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 6,
  },
  inferredBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#D97706",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 8,
  },
  appBreakdownSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
  },
  appBreakdownLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  appBreakdownRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  appItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  appName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4B5563",
    maxWidth: 80,
  },
  appDuration: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  screenTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    flexWrap: "wrap",
  },
  screenTimeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  screenTimeDivider: {
    fontSize: 12,
    color: "#9CA3AF",
    marginHorizontal: 4,
  },
  activityInferenceContainer: {
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(37, 99, 235, 0.06)",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(37, 99, 235, 0.15)",
  },
  activityInferenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activityInferencePrimary: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
  },
  activityInferenceSecondary: {
    marginTop: 4,
    marginLeft: 18,
    fontSize: 12,
    lineHeight: 17,
    color: "#3B82F6",
  },
  inferenceReasoningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  inferenceReasoningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: "#92400E",
  },
  inferenceReasoningLabel: {
    fontWeight: "700",
  },
  feedbackSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
    gap: 8,
  },
  feedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(148,163,184,0.06)",
    gap: 6,
  },
  feedbackButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  feedbackAccurate: {
    color: "#22C55E",
  },
  feedbackCorrection: {
    color: "#EF4444",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(148,163,184,0.06)",
    gap: 6,
    marginLeft: "auto",
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  feedbackStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
    gap: 6,
  },
  feedbackStatusText: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  editButtonSmall: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  // Segments section styles
  segmentsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
  },
  segmentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  segmentsHeaderText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  segmentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(148,163,184,0.06)",
    borderRadius: 8,
    marginBottom: 4,
  },
  segmentTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    width: 110,
  },
  segmentLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: "#1E293B",
  },
  segmentDuration: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    minWidth: 30,
    textAlign: "right",
  },
});
