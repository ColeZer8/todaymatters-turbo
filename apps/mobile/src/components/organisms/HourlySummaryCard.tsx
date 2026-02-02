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
} from "lucide-react-native";
import type {
  HourlySummary,
  SummaryAppBreakdown,
  EvidenceStrength,
} from "@/lib/supabase/services";

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
 * Get an icon for a place category.
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
}: HourlySummaryCardProps) => {
  const PlaceIcon = getPlaceIcon(summary.primaryPlaceLabel);
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
        <View style={styles.placeIconContainer}>
          <PlaceIcon size={18} color="#2563EB" />
        </View>
        <Text style={styles.placeLabel} numberOfLines={1}>
          {summary.primaryPlaceLabel ?? "Unknown Location"}
        </Text>
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

      {/* Screen Time */}
      {summary.totalScreenMinutes > 0 && (
        <View style={styles.screenTimeRow}>
          <Smartphone size={12} color="#9CA3AF" />
          <Text style={styles.screenTimeText}>
            {summary.totalScreenMinutes} min screen time
          </Text>
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
  placeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
    flex: 1,
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
  },
  screenTimeText: {
    fontSize: 12,
    color: "#9CA3AF",
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
});
