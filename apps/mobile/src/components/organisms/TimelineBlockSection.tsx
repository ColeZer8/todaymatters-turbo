/**
 * TimelineBlockSection — composed timeline section for a single location block.
 *
 * Renders a LocationBanner header, a collapsible summary/detail toggle,
 * chronological TimelineEventRows, a CurrentTimeLine separator (today only),
 * and future scheduled events.
 * Includes PlacePickerSheet for place disambiguation when alternatives exist.
 *
 * By default, the activity details (apps, emails, messages, meetings) are
 * collapsed into a one-line summary. Tapping the summary row expands to
 * show all events; a "Collapse" button at the bottom collapses them again.
 */

import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { LocationBlock } from "@/lib/types/location-block";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import { getPlaceIcon, getTravelIcon } from "@/lib/utils/place-icons";
import { getLocationBannerColor } from "@/lib/utils/place-icons";
import { LocationBanner } from "@/components/molecules/LocationBanner";
import { TimelineEventRow } from "@/components/molecules/TimelineEventRow";
import { CurrentTimeLine } from "@/components/molecules/CurrentTimeLine";
import {
  PlacePickerSheet,
  type PlaceSelection,
} from "@/components/molecules/PlacePickerSheet";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// Summary Builder
// ============================================================================

interface EventSummary {
  text: string;
  hasContent: boolean;
}

/**
 * Build a natural-language summary of the events in a location block.
 *
 * Examples:
 *   "30m on Instagram, 5 emails, 2 Slack messages"
 *   "1h 15m screen time, Team standup meeting"
 *   "No activity recorded"
 */
function buildEventSummary(events: TimelineEvent[]): EventSummary {
  if (events.length === 0) {
    return { text: "No activity recorded", hasContent: false };
  }

  const parts: string[] = [];

  // ── Apps: show top app by duration, total screen time ──
  const appEvents = events.filter((e) => e.kind === "app");
  if (appEvents.length > 0) {
    // Group by title (app name) and sum duration
    const appMap = new Map<string, number>();
    for (const e of appEvents) {
      appMap.set(e.title, (appMap.get(e.title) ?? 0) + e.durationMinutes);
    }
    // Sort by total duration descending
    const sorted = [...appMap.entries()].sort((a, b) => b[1] - a[1]);
    const [topApp, topMinutes] = sorted[0];
    const totalAppMinutes = sorted.reduce((sum, [, m]) => sum + m, 0);

    if (sorted.length === 1) {
      parts.push(`${formatMinutes(topMinutes)} on ${topApp}`);
    } else {
      // Show top app + total
      parts.push(
        `${formatMinutes(totalAppMinutes)} screen time (${topApp} ${formatMinutes(topMinutes)})`,
      );
    }
  }

  // ── Emails ──
  const emailCount = events.filter((e) => e.kind === "email").length;
  if (emailCount > 0) {
    parts.push(`${emailCount} email${emailCount !== 1 ? "s" : ""}`);
  }

  // ── Slack messages ──
  const slackCount = events.filter((e) => e.kind === "slack_message").length;
  if (slackCount > 0) {
    parts.push(`${slackCount} Slack message${slackCount !== 1 ? "s" : ""}`);
  }

  // ── Meetings / Scheduled ──
  const meetingEvents = events.filter(
    (e) => e.kind === "meeting" || e.kind === "scheduled",
  );
  if (meetingEvents.length > 0) {
    if (meetingEvents.length === 1) {
      // Show meeting title directly
      parts.push(meetingEvents[0].title);
    } else {
      parts.push(
        `${meetingEvents.length} meeting${meetingEvents.length !== 1 ? "s" : ""}`,
      );
    }
  }

  // ── Phone calls ──
  const callCount = events.filter((e) => e.kind === "phone_call").length;
  if (callCount > 0) {
    parts.push(`${callCount} call${callCount !== 1 ? "s" : ""}`);
  }

  // ── SMS ──
  const smsCount = events.filter((e) => e.kind === "sms").length;
  if (smsCount > 0) {
    parts.push(`${smsCount} text${smsCount !== 1 ? "s" : ""}`);
  }

  if (parts.length === 0) {
    return { text: "No activity recorded", hasContent: false };
  }

  return { text: parts.join(", "), hasContent: true };
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ============================================================================
// Component
// ============================================================================

interface TimelineBlockSectionProps {
  block: LocationBlock;
  isToday: boolean;
  currentMinutes: number;
  onEventPress: (event: TimelineEvent) => void;
  onBannerPress?: (block: LocationBlock) => void;
  /** Called when user selects a place from disambiguation sheet. */
  onPlaceSelected?: (block: LocationBlock, selection: PlaceSelection) => void;
}

export const TimelineBlockSection = ({
  block,
  isToday,
  currentMinutes,
  onEventPress,
  onBannerPress,
  onPlaceSelected,
}: TimelineBlockSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showPlacePicker, setShowPlacePicker] = useState(false);

  const events = block.timelineEvents ?? [];
  const pastEvents = events.filter((e) => e.isPast);
  const futureEvents = events.filter((e) => !e.isPast);

  const bannerColors = getLocationBannerColor(block);
  const icon =
    block.type === "travel"
      ? getTravelIcon(block.movementType)
      : getPlaceIcon(block.locationLabel);

  // Place disambiguation: show picker when alternatives exist on stationary blocks
  const hasAlternatives =
    block.type !== "travel" && (block.placeAlternatives?.length ?? 0) > 0;

  const handleBannerPress = useCallback(() => {
    if (hasAlternatives) {
      setShowPlacePicker(true);
    } else if (onBannerPress) {
      onBannerPress(block);
    }
  }, [hasAlternatives, onBannerPress, block]);

  const handlePlaceSave = useCallback(
    (selection: PlaceSelection) => {
      setShowPlacePicker(false);
      onPlaceSelected?.(block, selection);
    },
    [block, onPlaceSelected],
  );

  // Build summary
  const summary = useMemo(() => buildEventSummary(events), [events]);

  // Toggle expand/collapse with animation
  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
    setExpanded((v) => !v);
  }, []);

  // Determine if the red "now" line belongs in this block
  const blockStartMin =
    block.startTime.getHours() * 60 + block.startTime.getMinutes();
  const blockEndMin =
    block.endTime.getHours() * 60 + block.endTime.getMinutes();
  const showNowLine =
    isToday &&
    currentMinutes >= 0 &&
    currentMinutes >= blockStartMin &&
    currentMinutes < blockEndMin;

  // If there are no events at all, don't show the collapsible toggle
  const hasEvents = events.length > 0;

  return (
    <View style={styles.container}>
      <LocationBanner
        locationLabel={block.locationLabel}
        icon={icon}
        bgColor={bannerColors.bg}
        textColor={bannerColors.text}
        startTime={block.startTime}
        endTime={block.endTime}
        durationMinutes={block.durationMinutes}
        distanceM={block.distanceM}
        onPress={
          hasAlternatives || onBannerPress ? handleBannerPress : undefined
        }
      />

      {/* ─── Collapsible Summary / Expand Toggle ─── */}
      {hasEvents && (
        <TouchableOpacity
          style={styles.summaryRow}
          onPress={toggleExpanded}
          activeOpacity={0.6}
          accessibilityLabel={
            expanded ? "Collapse activity details" : "Expand activity details"
          }
          accessibilityRole="button"
        >
          {expanded ? (
            <ChevronUp size={16} color="#2563EB" />
          ) : (
            <ChevronDown size={16} color="#64748B" />
          )}
          <Text
            style={[
              styles.summaryText,
              expanded && styles.summaryTextExpanded,
            ]}
            numberOfLines={1}
          >
            {expanded ? "Activity Details" : summary.text}
          </Text>
          <Text style={styles.eventCount}>
            {events.length} {events.length === 1 ? "item" : "items"}
          </Text>
        </TouchableOpacity>
      )}

      {/* ─── Expanded Event List ─── */}
      {expanded && (
        <View style={styles.eventList}>
          {pastEvents.map((event) => (
            <TimelineEventRow
              key={event.id}
              event={event}
              onPress={onEventPress}
            />
          ))}

          {showNowLine && <CurrentTimeLine />}

          {futureEvents.map((event) => (
            <TimelineEventRow
              key={event.id}
              event={event}
              onPress={onEventPress}
            />
          ))}

          {/* ─── Collapse Button at Bottom ─── */}
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={toggleExpanded}
            activeOpacity={0.6}
            accessibilityLabel="Collapse activity details"
            accessibilityRole="button"
          >
            <Text style={styles.collapseButtonText}>Collapse</Text>
            <ChevronUp size={14} color="#64748B" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Collapsed: still show NOW line if applicable ─── */}
      {!expanded && showNowLine && (
        <View style={styles.collapsedNowLine}>
          <CurrentTimeLine />
        </View>
      )}

      {/* ─── Empty: no events at all ─── */}
      {!hasEvents && (
        <View style={styles.emptyRow}>
          {/* intentionally blank — banner is enough for blocks with no events */}
        </View>
      )}

      {/* Place Picker Sheet for disambiguation */}
      {hasAlternatives && (
        <PlacePickerSheet
          visible={showPlacePicker}
          onClose={() => setShowPlacePicker(false)}
          onSave={handlePlaceSave}
          currentPlace={block.locationLabel}
          alternatives={block.placeAlternatives!}
          latitude={block.latitude ?? 0}
          longitude={block.longitude ?? 0}
          startTime={block.startTime}
          endTime={block.endTime}
        />
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },

  // ── Summary Toggle Row ──
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.15)",
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  summaryTextExpanded: {
    fontWeight: "700",
    color: "#2563EB",
  },
  eventCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },

  // ── Event List ──
  eventList: {
    // White background behind all event rows
  },

  // ── Collapse Button ──
  collapseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.15)",
  },
  collapseButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },

  // ── Collapsed NOW line ──
  collapsedNowLine: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  // ── Empty ──
  emptyRow: {
    height: 8,
  },
});
