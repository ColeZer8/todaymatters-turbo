/**
 * ActivitySegmentTimeline Component
 *
 * Displays a list of activity segments for a given date.
 * Shows actual segment times instead of hourly blocks.
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Calendar, AlertCircle, Clock } from "lucide-react-native";
import { ActivitySegmentCard } from "./ActivitySegmentCard";
import {
  fetchActivitySegmentsForDate,
  type ActivitySegment,
} from "@/lib/supabase/services/activity-segments";

// ============================================================================
// Types
// ============================================================================

export interface ActivitySegmentTimelineProps {
  /** User ID to fetch segments for */
  userId: string;
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Whether to group segments by hour (optional collapsed view) */
  groupByHour?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Group segments by hour for optional collapsed view
 */
function groupSegmentsByHour(segments: ActivitySegment[]): Map<number, ActivitySegment[]> {
  const groups = new Map<number, ActivitySegment[]>();
  
  for (const segment of segments) {
    const hour = segment.startedAt.getHours();
    const existing = groups.get(hour) ?? [];
    groups.set(hour, [...existing, segment]);
  }
  
  return groups;
}

/**
 * Calculate total duration of segments
 */
function getTotalDuration(segments: ActivitySegment[]): number {
  return segments.reduce((acc, seg) => {
    const duration = seg.endedAt.getTime() - seg.startedAt.getTime();
    return acc + duration;
  }, 0);
}

/**
 * Format hour as display string (e.g., "4 PM")
 */
function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/**
 * Format total duration in milliseconds to readable string
 */
function formatTotalDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 1000 / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min tracked`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return `${hours}h tracked`;
  }
  return `${hours}h ${mins}m tracked`;
}

// ============================================================================
// Component
// ============================================================================

export function ActivitySegmentTimeline({
  userId,
  date,
  groupByHour = false,
  compact = false,
}: ActivitySegmentTimelineProps) {
  const [segments, setSegments] = useState<ActivitySegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSegments = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchActivitySegmentsForDate(userId, date);
      setSegments(data);
    } catch (err) {
      console.error("[ActivitySegmentTimeline] Failed to load segments:", err);
      setError(err instanceof Error ? err.message : "Failed to load segments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, date]);

  useEffect(() => {
    setLoading(true);
    loadSegments();
  }, [loadSegments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSegments();
  }, [loadSegments]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading segments...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={32} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Empty state
  if (segments.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Calendar size={32} color="#94A3B8" />
        <Text style={styles.emptyText}>No activity segments for this date</Text>
        <Text style={styles.emptySubtext}>
          Segments are generated from location and app usage data
        </Text>
      </View>
    );
  }

  // Calculate summary stats
  const totalDuration = getTotalDuration(segments);
  const commuteSegments = segments.filter(
    (s) => s.inferredActivity === "commute" || s.placeCategory === "commute"
  );
  const commuteDuration = getTotalDuration(commuteSegments);

  // Group by hour if requested
  if (groupByHour) {
    const hourGroups = groupSegmentsByHour(segments);
    const sortedHours = Array.from(hourGroups.keys()).sort((a, b) => a - b);

    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Summary header */}
        <View style={styles.summaryHeader}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{segments.length}</Text>
            <Text style={styles.summaryLabel}>Segments</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatTotalDuration(totalDuration)}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          {commuteDuration > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {formatTotalDuration(commuteDuration)}
              </Text>
              <Text style={styles.summaryLabel}>Commute</Text>
            </View>
          )}
        </View>

        {/* Grouped segments */}
        {sortedHours.map((hour) => {
          const hourSegments = hourGroups.get(hour) ?? [];
          return (
            <View key={hour} style={styles.hourGroup}>
              <View style={styles.hourHeader}>
                <Clock size={14} color="#64748B" />
                <Text style={styles.hourLabel}>{formatHour(hour)}</Text>
                <Text style={styles.hourCount}>
                  {hourSegments.length} segment{hourSegments.length !== 1 ? "s" : ""}
                </Text>
              </View>
              {hourSegments.map((segment) => (
                <ActivitySegmentCard
                  key={segment.id}
                  segment={segment}
                  compact={compact}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // Flat list of all segments
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Summary header */}
      <View style={styles.summaryHeader}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{segments.length}</Text>
          <Text style={styles.summaryLabel}>Segments</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatTotalDuration(totalDuration)}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        {commuteDuration > 0 && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {formatTotalDuration(commuteDuration)}
            </Text>
            <Text style={styles.summaryLabel}>Commute</Text>
          </View>
        )}
      </View>

      {/* Flat segment list */}
      <View style={styles.segmentList}>
        {segments.map((segment) => (
          <ActivitySegmentCard
            key={segment.id}
            segment={segment}
            compact={compact}
          />
        ))}
      </View>
    </ScrollView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#F8FAFC",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  hourGroup: {
    marginBottom: 16,
  },
  hourHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  hourLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  hourCount: {
    fontSize: 12,
    color: "#94A3B8",
    marginLeft: "auto",
  },
  segmentList: {
    gap: 0,
  },
});
