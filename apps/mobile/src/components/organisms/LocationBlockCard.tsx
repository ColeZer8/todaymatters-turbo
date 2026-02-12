/**
 * LocationBlockCard Component
 *
 * Displays a contiguous block of time at one location, grouping all
 * activity, apps, screen time, and evidence into a single card.
 *
 * Layout:
 *   Header (icon, name, time range, confidence)
 *   Horizontal timeline bar (screen time blocks colored by category)
 *   Activity inference (if available)
 *   Apps list (collapsed) / chronological timeline (expanded)
 *   Evidence row
 *   Feedback buttons
 */

import { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  Clock,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Activity,
  Car,
  Navigation,
} from "lucide-react-native";
import type { LocationBlock, BlockAppUsage } from "@/lib/types/location-block";
import {
  PlacePickerSheet,
  type PlaceSelection,
} from "@/components/molecules/PlacePickerSheet";
import type { AppCategory } from "@/lib/supabase/services/app-categories";
import {
  getPlaceIcon,
  getPlaceIconForType,
  getPlaceTypeColor,
  getConfidenceColor,
} from "@/lib/utils/place-icons";
import { formatTimeShort, formatDuration } from "@/lib/utils/time-format";

// ============================================================================
// Category Colors
// ============================================================================

const CATEGORY_COLORS: Record<AppCategory, string> = {
  work: "#22C55E",
  social: "#EF4444",
  entertainment: "#F59E0B",
  comms: "#3B82F6",
  utility: "#6B7280",
  ignore: "#D1D5DB",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as AppCategory] ?? "#9CA3AF";
}

// ============================================================================
// Types
// ============================================================================

export interface LocationBlockCardProps {
  block: LocationBlock;
  onMarkAccurate?: (summaryIds: string[]) => void;
  onNeedsCorrection?: (summaryIds: string[]) => void;
  onEdit?: (block: LocationBlock) => void;
  /** Called when user selects a place from disambiguation sheet. */
  onPlaceSelected?: (block: LocationBlock, selection: PlaceSelection) => void;
}

// ============================================================================
// Chronological Timeline
// ============================================================================

interface ChronoEntry {
  appId: string;
  displayName: string;
  category: string;
  startTime: Date;
  endTime: Date;
  minutes: number;
}

function buildChronologicalTimeline(apps: BlockAppUsage[]): ChronoEntry[] {
  const entries: ChronoEntry[] = [];
  for (const app of apps) {
    for (const session of app.sessions) {
      entries.push({
        appId: app.appId,
        displayName: app.displayName,
        category: app.category,
        startTime: session.startTime,
        endTime: session.endTime,
        minutes: session.minutes,
      });
    }
  }
  entries.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return entries;
}

// ============================================================================
// Horizontal Timeline Bar
// ============================================================================

interface BarSegment {
  left: number; // percentage 0-100
  width: number; // percentage 0-100
  color: string;
}

function buildBarSegments(block: LocationBlock): BarSegment[] {
  const segments: BarSegment[] = [];
  const blockStart = block.startTime.getTime();
  const blockDuration = block.endTime.getTime() - blockStart;
  if (blockDuration <= 0) return segments;

  for (const seg of block.segments) {
    if (seg.totalScreenSeconds < 30) continue;
    const left =
      ((seg.startedAt.getTime() - blockStart) / blockDuration) * 100;
    const right =
      ((seg.endedAt.getTime() - blockStart) / blockDuration) * 100;
    const clampedLeft = Math.max(0, Math.min(100, left));
    const clampedRight = Math.max(0, Math.min(100, right));
    const width = clampedRight - clampedLeft;
    if (width < 0.5) continue;

    // Dominant app category
    let dominantCategory = "utility";
    let maxSeconds = 0;
    if (seg.topApps && seg.topApps.length > 0) {
      for (const app of seg.topApps) {
        if (app.seconds > maxSeconds) {
          maxSeconds = app.seconds;
          dominantCategory = app.category;
        }
      }
    }
    segments.push({
      left: clampedLeft,
      width,
      color: getCategoryColor(dominantCategory),
    });
  }
  return segments;
}

function HorizontalTimelineBar({ block }: { block: LocationBlock }) {
  const barSegments = useMemo(() => buildBarSegments(block), [block]);

  return (
    <View style={styles.timelineBarContainer}>
      <Text style={styles.timelineBarLabel}>
        {formatTimeShort(block.startTime)}
      </Text>
      <View style={styles.timelineBarTrack}>
        <View style={styles.timelineBarBg} />
        {barSegments.map((seg, idx) => (
          <View
            key={idx}
            style={[
              styles.timelineBarBlock,
              {
                left: `${seg.left.toFixed(1)}%`,
                width: `${seg.width.toFixed(1)}%`,
                backgroundColor: seg.color,
              } as Record<string, unknown>,
            ]}
          />
        ))}
      </View>
      <Text style={styles.timelineBarLabel}>
        {formatTimeShort(block.endTime)}
      </Text>
    </View>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function AppSummaryRow({ app }: { app: BlockAppUsage }) {
  return (
    <View style={styles.appRow}>
      <View
        style={[
          styles.appCategoryDot,
          { backgroundColor: getCategoryColor(app.category) },
        ]}
      />
      <Text style={styles.appName} numberOfLines={1}>
        {app.displayName}
      </Text>
      <Text style={styles.appDuration}>{app.totalMinutes}m</Text>
    </View>
  );
}

function ChronoTimelineRow({ entry }: { entry: ChronoEntry }) {
  const color = getCategoryColor(entry.category);
  return (
    <View style={styles.chronoRow}>
      <View style={[styles.chronoDot, { backgroundColor: color }]} />
      <Text style={styles.chronoTime}>
        {formatTimeShort(entry.startTime)} – {formatTimeShort(entry.endTime)}
      </Text>
      <Text style={styles.chronoAppName} numberOfLines={1}>
        {entry.displayName}
      </Text>
      <Text style={styles.chronoDuration}>{entry.minutes}m</Text>
    </View>
  );
}

function SegmentEditorRow({
  segment,
}: {
  segment: LocationBlock["segments"][number];
}) {
  const startStr = segment.startedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endStr = segment.endedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const durationMin = Math.round(
    (segment.endedAt.getTime() - segment.startedAt.getTime()) / 60000,
  );
  const isCommute =
    segment.inferredActivity === "commute" ||
    segment.placeCategory === "commute";
  // Use movement-type-specific label for commutes
  const commuteVerb = isCommute
    ? segment.movementType === "walking" ? "Walking"
      : segment.movementType === "cycling" ? "Cycling"
      : segment.movementType === "driving" ? "Driving"
      : "Traveling"
    : null;
  const label = isCommute
    ? commuteVerb!
    : segment.placeLabel ?? segment.inferredActivity ?? "Activity";

  return (
    <View style={styles.segmentEditorRow}>
      <Text style={styles.segmentEditorTime}>
        {startStr} – {endStr}
      </Text>
      <Text style={styles.segmentEditorLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.segmentEditorDuration}>{durationMin}m</Text>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LocationBlockCard({
  block,
  onMarkAccurate,
  onNeedsCorrection,
  onEdit,
  onPlaceSelected,
}: LocationBlockCardProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSegmentEditor, setShowSegmentEditor] = useState(false);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const chronoTimeline = useMemo(
    () => buildChronologicalTimeline(block.apps),
    [block.apps],
  );

  // Place disambiguation: show picker when alternatives exist
  const hasAlternatives =
    !block.type || block.type === "stationary"
      ? (block.placeAlternatives?.length ?? 0) > 0
      : false;

  const handlePlaceSave = useCallback(
    (selection: PlaceSelection) => {
      setShowPlacePicker(false);
      onPlaceSelected?.(block, selection);
    },
    [block, onPlaceSelected],
  );

  // Icon & color
  const isTravel = block.type === "travel";
  const PlaceIcon = isTravel
    ? Car
    : block.isPlaceInferred && block.inferredPlace
      ? getPlaceIconForType(block.inferredPlace.inferredType)
      : getPlaceIcon(block.locationLabel);

  const placeColor = isTravel
    ? "#3B82F6"
    : block.isPlaceInferred && block.inferredPlace
      ? getPlaceTypeColor(block.inferredPlace.inferredType)
      : "#2563EB";

  const confidenceColor = getConfidenceColor(block.confidenceScore);
  const confidencePercent = Math.round(block.confidenceScore * 100);
  const topApps = block.apps.slice(0, 5);

  const containerStyle = isTravel
    ? [styles.container, styles.travelContainer]
    : styles.container;

  return (
    <View style={containerStyle}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View
          style={[
            styles.placeIconContainer,
            { backgroundColor: `${placeColor}15` },
          ]}
        >
          <PlaceIcon size={18} color={placeColor} />
        </View>

        <View style={styles.headerTextContainer}>
          <View style={styles.headerTopRow}>
            {hasAlternatives ? (
              <TouchableOpacity
                onPress={() => setShowPlacePicker(true)}
                style={styles.placeNameTappable}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.locationName, { color: placeColor }]}
                  numberOfLines={1}
                >
                  {block.locationLabel}
                </Text>
                <Navigation size={10} color="#94A3B8" style={{ marginLeft: 4, transform: [{ rotate: "90deg" }] }} />
              </TouchableOpacity>
            ) : (
              <Text
                style={[styles.locationName, { color: placeColor }]}
                numberOfLines={1}
              >
                {block.locationLabel}
              </Text>
            )}
            {block.isPlaceInferred && (
              <View style={styles.inferredBadge}>
                <Sparkles size={9} color="#D97706" />
              </View>
            )}
          </View>
          <Text style={styles.headerTimeText}>
            {formatDuration(block.durationMinutes)}
          </Text>
        </View>

        {/* Confidence badge */}
        <View style={styles.confidenceBadge}>
          <Activity size={10} color={confidenceColor} />
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {confidencePercent}%
          </Text>
        </View>
      </View>

      {/* ─── Horizontal Timeline Bar ─── */}
      <HorizontalTimelineBar block={block} />

      {/* ─── Activity Inference ─── */}
      {block.activityInference && (
        <View style={styles.inferenceRow}>
          <Sparkles size={11} color="#2563EB" />
          <Text style={styles.inferenceText} numberOfLines={2}>
            {block.activityInference.primary}
          </Text>
        </View>
      )}

      {/* ─── Apps Section ─── */}
      {topApps.length > 0 && (
        <View style={styles.appsSection}>
          <TouchableOpacity
            style={styles.appsSectionHeader}
            onPress={() => setShowTimeline((v) => !v)}
            activeOpacity={0.6}
          >
            <Text style={styles.sectionLabel}>APPS</Text>
            <View style={styles.appsSectionRight}>
              {block.totalScreenMinutes > 0 && (
                <Text style={styles.screenTimeBadge}>
                  {block.totalScreenMinutes}m screen
                </Text>
              )}
              {chronoTimeline.length > 0 &&
                (showTimeline ? (
                  <ChevronUp size={14} color="#9CA3AF" />
                ) : (
                  <ChevronDown size={14} color="#9CA3AF" />
                ))}
            </View>
          </TouchableOpacity>

          {!showTimeline && (
            <>
              {topApps.map((app) => (
                <AppSummaryRow key={app.appId} app={app} />
              ))}
            </>
          )}

          {showTimeline && chronoTimeline.length > 0 && (
            <View style={styles.chronoSection}>
              {chronoTimeline.map((entry, idx) => (
                <ChronoTimelineRow
                  key={`${entry.appId}-${idx}`}
                  entry={entry}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ─── Evidence Row ─── */}
      {block.totalLocationSamples > 0 && (
        <View style={styles.evidenceRow}>
          <MapPin size={11} color="#9CA3AF" />
          <Text style={styles.evidenceText}>
            {block.totalLocationSamples} location samples
          </Text>
        </View>
      )}

      {/* ─── Feedback Section ─── */}
      {!block.hasUserFeedback && !block.isLocked && (
        <View style={styles.feedbackSection}>
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => onMarkAccurate?.(block.summaryIds)}
            accessibilityLabel="Mark as accurate"
          >
            <ThumbsUp size={14} color="#22C55E" />
            <Text style={[styles.feedbackButtonText, styles.feedbackAccurate]}>
              Accurate
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => onNeedsCorrection?.(block.summaryIds)}
            accessibilityLabel="Needs correction"
          >
            <ThumbsDown size={14} color="#EF4444" />
            <Text
              style={[styles.feedbackButtonText, styles.feedbackCorrection]}
            >
              Incorrect
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setShowSegmentEditor((v) => !v)}
            accessibilityLabel="Edit block"
          >
            <Pencil size={14} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Feedback status if already provided */}
      {block.hasUserFeedback && (
        <View style={styles.feedbackStatusRow}>
          <ThumbsUp size={12} color="#22C55E" />
          <Text style={styles.feedbackStatusText}>Feedback submitted</Text>
          <TouchableOpacity
            style={styles.editButtonSmall}
            onPress={() => setShowSegmentEditor((v) => !v)}
          >
            <Pencil size={12} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Per-Segment Editor ─── */}
      {showSegmentEditor && block.segments.length > 0 && (
        <View style={styles.segmentEditorSection}>
          <View style={styles.segmentEditorHeader}>
            <Clock size={11} color="#64748B" />
            <Text style={styles.segmentEditorHeaderText}>
              Segments ({block.segments.length})
            </Text>
          </View>
          {block.segments.map((seg, idx) => (
            <SegmentEditorRow key={seg.id ?? idx} segment={seg} />
          ))}
        </View>
      )}

      {/* ─── Place Picker Bottom Sheet ─── */}
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
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.32)",
  },
  travelContainer: {
    backgroundColor: "rgba(59,130,246,0.04)",
    borderColor: "rgba(59,130,246,0.2)",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  placeIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationName: {
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  placeNameTappable: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    paddingVertical: 2,
    paddingRight: 4,
    borderRadius: 6,
    backgroundColor: "rgba(59,130,246,0.06)",
  },
  inferredBadge: {
    padding: 2,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 4,
  },
  headerTimeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 1,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(148,163,184,0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ── Horizontal Timeline Bar ──
  timelineBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  timelineBarLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94A3B8",
    width: 38,
    textAlign: "center",
  },
  timelineBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    position: "relative",
    overflow: "hidden",
  },
  timelineBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
  },
  timelineBarBlock: {
    position: "absolute",
    top: 0,
    height: 6,
    borderRadius: 3,
  },

  // ── Activity Inference ──
  inferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(37, 99, 235, 0.05)",
    borderRadius: 8,
    marginBottom: 8,
  },
  inferenceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
  },

  // ── Apps Section ──
  appsSection: {
    marginBottom: 6,
  },
  appsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  appsSectionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  screenTimeBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 6,
  },
  appCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  appName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  appDuration: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    minWidth: 28,
    textAlign: "right",
  },

  // ── Chronological Timeline ──
  chronoSection: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.15)",
  },
  chronoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 6,
  },
  chronoDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  chronoTime: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    width: 95,
  },
  chronoAppName: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: "#374151",
  },
  chronoDuration: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    minWidth: 22,
    textAlign: "right",
  },

  // ── Evidence Row ──
  evidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  evidenceText: {
    fontSize: 11,
    color: "#9CA3AF",
  },

  // ── Feedback ──
  feedbackSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
    gap: 6,
  },
  feedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(148,163,184,0.06)",
    gap: 5,
  },
  feedbackButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  feedbackAccurate: {
    color: "#22C55E",
  },
  feedbackCorrection: {
    color: "#EF4444",
  },
  editButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(148,163,184,0.06)",
    marginLeft: "auto",
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  feedbackStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
    gap: 5,
  },
  feedbackStatusText: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
  },
  editButtonSmall: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: "rgba(148,163,184,0.08)",
  },

  // ── Per-Segment Editor ──
  segmentEditorSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
  },
  segmentEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  segmentEditorHeaderText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  segmentEditorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "rgba(148,163,184,0.06)",
    borderRadius: 8,
    marginBottom: 3,
  },
  segmentEditorTime: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    width: 110,
  },
  segmentEditorLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: "#1E293B",
  },
  segmentEditorDuration: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    minWidth: 28,
    textAlign: "right",
  },
});
