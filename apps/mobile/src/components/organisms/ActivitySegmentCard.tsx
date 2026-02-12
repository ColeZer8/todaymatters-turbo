/**
 * ActivitySegmentCard Component
 *
 * Displays a single activity segment with actual start/end times.
 * Shows granular time ranges instead of hourly blocks.
 */

import { View, Text, StyleSheet } from "react-native";
import {
  MapPin,
  Clock,
  Car,
  Home,
  Briefcase,
  Dumbbell,
  Coffee,
  ShoppingBag,
  Utensils,
  Activity,
  Moon,
  Footprints,
  Bike,
  type LucideIcon,
} from "lucide-react-native";
import type {
  ActivitySegment,
  InferredActivityType,
} from "@/lib/supabase/services/activity-segments";

// ============================================================================
// Types
// ============================================================================

export interface ActivitySegmentCardProps {
  /** The activity segment data */
  segment: ActivitySegment;
  /** Whether to show a compact view */
  compact?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format actual time range (e.g., "4:12 PM - 4:47 PM")
 */
function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (d: Date): string => {
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    const minStr = minutes.toString().padStart(2, "0");
    return `${hour12}:${minStr} ${ampm}`;
  };
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Calculate duration in minutes
 */
function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 1000 / 60);
}

/**
 * Format duration string (e.g., "35 min" or "1h 20m")
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Get icon for activity type
 */
function getActivityIcon(activity: InferredActivityType, placeCategory: string | null, movementType?: string | null): LucideIcon {
  // First check if it's a commute — use movement-type-specific icons
  if (activity === "commute" || placeCategory === "commute") {
    if (movementType === "walking") return Footprints;
    if (movementType === "cycling") return Bike;
    return Car; // driving or unknown
  }
  
  // Check place category
  if (placeCategory) {
    const cat = placeCategory.toLowerCase();
    if (cat === "home") return Home;
    if (cat === "work" || cat === "office") return Briefcase;
    if (cat === "gym" || cat === "fitness") return Dumbbell;
    if (cat === "cafe" || cat === "coffee") return Coffee;
    if (cat === "shopping" || cat === "retail" || cat === "store") return ShoppingBag;
    if (cat === "restaurant" || cat === "food" || cat === "dining") return Utensils;
  }
  
  // Check activity type
  switch (activity) {
    case "workout":
      return Dumbbell;
    case "sleep":
      return Moon;
    case "deep_work":
    case "collaborative_work":
      return Briefcase;
    case "leisure":
      return Coffee;
    default:
      return Activity;
  }
}

/**
 * Get background color for activity type
 */
function getActivityColor(activity: InferredActivityType, placeCategory: string | null): string {
  if (activity === "commute" || placeCategory === "commute") {
    return "#EFF6FF"; // blue-50
  }
  
  switch (activity) {
    case "workout":
      return "#FEF3C7"; // amber-100
    case "sleep":
      return "#EDE9FE"; // violet-100
    case "deep_work":
      return "#DCFCE7"; // green-100
    case "collaborative_work":
      return "#DBEAFE"; // blue-100
    case "leisure":
      return "#FCE7F3"; // pink-100
    default:
      return "#F1F5F9"; // slate-100
  }
}

/**
 * Get icon color for activity type
 */
function getIconColor(activity: InferredActivityType, placeCategory: string | null): string {
  if (activity === "commute" || placeCategory === "commute") {
    return "#2563EB"; // blue-600
  }
  
  switch (activity) {
    case "workout":
      return "#D97706"; // amber-600
    case "sleep":
      return "#7C3AED"; // violet-600
    case "deep_work":
      return "#16A34A"; // green-600
    case "collaborative_work":
      return "#2563EB"; // blue-600
    case "leisure":
      return "#DB2777"; // pink-600
    default:
      return "#475569"; // slate-600
  }
}

/**
 * Get display label for the segment
 */
function getSegmentLabel(segment: ActivitySegment): string {
  const { placeLabel, placeCategory, inferredActivity } = segment;
  
  // Commute — use movement-type-specific label
  if (inferredActivity === "commute" || placeCategory === "commute") {
    const verb = segment.movementType === "walking" ? "Walking"
      : segment.movementType === "cycling" ? "Cycling"
      : segment.movementType === "driving" ? "Driving"
      : "Traveling";
    return verb;
  }
  
  // Use place label if available
  if (placeLabel) {
    return placeLabel;
  }
  
  // Fall back to activity type
  switch (inferredActivity) {
    case "workout":
      return "Workout";
    case "sleep":
      return "Sleep";
    case "deep_work":
      return "Deep Work";
    case "collaborative_work":
      return "Collaborative Work";
    case "meeting":
      return "Meeting";
    case "leisure":
      return "Leisure";
    case "personal_time":
      return "Personal Time";
    case "away_from_desk":
      return "Away";
    default:
      return "Activity";
  }
}

/**
 * Get subtitle for the segment
 */
function getSegmentSubtitle(segment: ActivitySegment): string | null {
  const { placeCategory, inferredActivity, totalScreenSeconds, topApps } = segment;
  
  // For commute, don't show subtitle
  if (inferredActivity === "commute" || placeCategory === "commute") {
    return null;
  }
  
  // Show top app if there's screen time
  if (totalScreenSeconds > 60 && topApps && topApps.length > 0) {
    const topApp = topApps[0];
    const screenMins = Math.round(totalScreenSeconds / 60);
    return `${topApp.displayName} • ${screenMins} min screen time`;
  }
  
  // Show activity description
  if (placeCategory) {
    return placeCategory.charAt(0).toUpperCase() + placeCategory.slice(1);
  }
  
  return null;
}

// ============================================================================
// Component
// ============================================================================

export function ActivitySegmentCard({
  segment,
  compact = false,
}: ActivitySegmentCardProps) {
  const duration = getDurationMinutes(segment.startedAt, segment.endedAt);
  const Icon = getActivityIcon(segment.inferredActivity, segment.placeCategory, segment.movementType);
  const bgColor = getActivityColor(segment.inferredActivity, segment.placeCategory);
  const iconColor = getIconColor(segment.inferredActivity, segment.placeCategory);
  const label = getSegmentLabel(segment);
  const subtitle = getSegmentSubtitle(segment);
  const isCommute = segment.inferredActivity === "commute" || segment.placeCategory === "commute";

  if (compact) {
    return (
      <View style={[styles.compactCard, { backgroundColor: bgColor }]}>
        <View style={styles.compactIconContainer}>
          <Icon size={14} color={iconColor} />
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactTime}>
            {formatTimeRange(segment.startedAt, segment.endedAt)}
          </Text>
          <Text style={styles.compactLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={styles.compactDuration}>{formatDuration(duration)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      {/* Header with time and duration */}
      <View style={styles.header}>
        <View style={styles.timeContainer}>
          <Clock size={14} color="#64748B" />
          <Text style={styles.timeText}>
            {formatTimeRange(segment.startedAt, segment.endedAt)}
          </Text>
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Icon size={20} color={iconColor} />
        </View>
        <View style={styles.labelContainer}>
          <Text style={styles.label} numberOfLines={1}>
            {isCommute
              ? segment.movementType === "walking" ? "🚶 "
                : segment.movementType === "cycling" ? "🚴 "
                : segment.movementType === "driving" ? "🚗 "
                : "🚗 "
              : ""}{label}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {/* Confidence indicator */}
      {segment.activityConfidence > 0 && (
        <View style={styles.footer}>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${Math.round(segment.activityConfidence * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.confidenceText}>
            {Math.round(segment.activityConfidence * 100)}% confidence
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  durationBadge: {
    backgroundColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  durationText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  footer: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
  },
  confidenceFill: {
    height: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 11,
    color: "#64748B",
  },
  // Compact styles
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    gap: 8,
  },
  compactIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  compactContent: {
    flex: 1,
  },
  compactTime: {
    fontSize: 11,
    color: "#64748B",
  },
  compactLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1E293B",
  },
  compactDuration: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
});
