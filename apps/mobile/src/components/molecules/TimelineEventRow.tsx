/**
 * TimelineEventRow — a single event row in the timeline feed.
 *
 * Renders a solid circle icon (type-tinted), event kind label,
 * title/subtitle, and duration. Unproductive apps get red treatment.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  Smartphone,
  Mail,
  Hash,
  Phone,
  Calendar,
  Globe,
  MessageSquare,
  type LucideIcon,
} from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { formatDuration, formatTimeRange } from "@/lib/utils/time-format";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import {
  EVENT_KIND_COLORS,
  UNPRODUCTIVE_TINT,
  type BicolorTint,
} from "@/lib/types/timeline-event";

// ============================================================================
// Icon mapping
// ============================================================================

const KIND_ICONS: Record<string, LucideIcon> = {
  app: Smartphone,
  email: Mail,
  slack_message: Hash,
  phone_call: Phone,
  meeting: Calendar,
  sms: MessageSquare,
  website: Globe,
  scheduled: Calendar,
};

function getEventIcon(kind: string): LucideIcon {
  return KIND_ICONS[kind] ?? Smartphone;
}

// ============================================================================
// Component
// ============================================================================

interface TimelineEventRowProps {
  event: TimelineEvent;
  onPress: (event: TimelineEvent) => void;
}

export const TimelineEventRow = ({ event, onPress }: TimelineEventRowProps) => {
  const isUnproductive = event.productivity === "unproductive";
  const tint: BicolorTint = isUnproductive
    ? UNPRODUCTIVE_TINT
    : EVENT_KIND_COLORS[event.kind] ?? EVENT_KIND_COLORS.app;

  const hasOverlaps = (event.overlaps?.length ?? 0) > 0;
  const isFuture = !event.isPast && event.kind === "scheduled";

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={() => onPress(event)}
      style={[
        styles.row,
        isUnproductive && styles.rowUnproductive,
        hasOverlaps && styles.rowOverlap,
        isFuture && styles.rowFuture,
      ]}
    >
      {/* Solid circle icon */}
      <View style={[styles.iconCircle, { backgroundColor: tint.dark }]}>
        <Icon icon={getEventIcon(event.kind)} size={18} color={tint.iconColor} />
      </View>

      {/* Text column */}
      <View style={styles.textCol}>
        <Text
          style={[styles.kindLabel, isFuture && styles.futureText]}
          numberOfLines={1}
        >
          {event.kindLabel}
        </Text>
        <Text
          style={[styles.title, isFuture && styles.futureText]}
          numberOfLines={1}
        >
          {event.title}
          {event.subtitle ? ` · ${event.subtitle}` : ""}
        </Text>
        <Text
          style={[styles.timeRange, isFuture && styles.futureText]}
          numberOfLines={1}
        >
          {formatTimeRange(event.startTime, event.endTime)}
        </Text>
      </View>

      {/* Right side: badge + duration */}
      <View style={styles.rightCol}>
        {isUnproductive && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Unproductive</Text>
          </View>
        )}
        <Text
          style={[
            styles.duration,
            isUnproductive && styles.durationRed,
            isFuture && styles.futureText,
          ]}
        >
          {formatDuration(event.durationMinutes)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const ICON_SIZE = 40;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  rowUnproductive: {
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  rowOverlap: {
    borderLeftWidth: 3,
    borderLeftColor: "#F97316",
  },
  rowFuture: {
    opacity: 0.55,
  },

  // Solid icon circle
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },

  // Text
  textCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  kindLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  title: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  timeRange: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  futureText: {
    color: "#9CA3AF",
  },

  // Right
  rightCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  duration: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  durationRed: {
    color: "#EF4444",
  },
});
