/**
 * HourlySummaryList Component
 *
 * Displays a list of hourly summaries for a given day using FlatList.
 * Shows summaries in reverse chronological order (most recent first).
 * Includes loading skeleton and empty states.
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Calendar, Inbox } from "lucide-react-native";
import { HourlySummaryCard } from "./HourlySummaryCard";
import {
  type HourlySummary,
  fetchHourlySummariesForDate,
} from "@/lib/supabase/services";

// ============================================================================
// Types
// ============================================================================

export interface HourlySummaryListProps {
  /** The date to display summaries for (YYYY-MM-DD format) */
  date: string;
  /** User ID to fetch summaries for */
  userId: string;
  /** Called when user marks summary as accurate */
  onMarkAccurate?: (summaryId: string) => void;
  /** Called when user marks summary as needing correction */
  onNeedsCorrection?: (summaryId: string) => void;
  /** Called when user wants to edit the summary */
  onEdit?: (summary: HourlySummary) => void;
  /** Optional header component */
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  /** Optional footer component */
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  /** Content container style */
  contentContainerStyle?: object;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      {/* Header skeleton */}
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonTime} />
        <View style={styles.skeletonBadge} />
      </View>
      {/* Location skeleton */}
      <View style={styles.skeletonLocationRow}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonLocation} />
      </View>
      {/* Title skeleton */}
      <View style={styles.skeletonTitle} />
      {/* Description skeleton */}
      <View style={styles.skeletonDescription} />
      <View style={styles.skeletonDescriptionShort} />
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  date: string;
}

function EmptyState({ date }: EmptyStateProps) {
  // Format the date for display
  const displayDate = formatDateForDisplay(date);

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Inbox size={48} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Activity Summaries</Text>
      <Text style={styles.emptySubtitle}>
        No hourly summaries are available for {displayDate}. Summaries are
        generated from your location and screen time data.
      </Text>
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date string for display (e.g., "January 15, 2026")
 */
function formatDateForDisplay(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format date string for header (e.g., "Today", "Yesterday", or "Jan 15")
 */
function formatDateHeader(dateString: string): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (dateString === todayStr) return "Today";
  if (dateString === yesterdayStr) return "Yesterday";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Main Component
// ============================================================================

export const HourlySummaryList = ({
  date,
  userId,
  onMarkAccurate,
  onNeedsCorrection,
  onEdit,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
}: HourlySummaryListProps) => {
  const [summaries, setSummaries] = useState<HourlySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch summaries on mount and when date changes
  const fetchSummaries = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchHourlySummariesForDate(userId, date);
      setSummaries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load summaries";
      setError(message);
      if (__DEV__) {
        console.warn("[HourlySummaryList] Fetch error:", err);
      }
    }
  }, [userId, date]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    fetchSummaries().finally(() => setIsLoading(false));
  }, [fetchSummaries]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchSummaries();
    setIsRefreshing(false);
  }, [fetchSummaries]);

  // Render item
  const renderItem = useCallback(
    ({ item }: { item: HourlySummary }) => (
      <HourlySummaryCard
        summary={item}
        onMarkAccurate={onMarkAccurate}
        onNeedsCorrection={onNeedsCorrection}
        onEdit={onEdit}
      />
    ),
    [onMarkAccurate, onNeedsCorrection, onEdit],
  );

  // Key extractor
  const keyExtractor = useCallback((item: HourlySummary) => item.id, []);

  // List header with date
  const renderListHeader = () => (
    <View>
      {ListHeaderComponent}
      <View style={styles.dateHeader}>
        <View style={styles.dateIconContainer}>
          <Calendar size={16} color="#2563EB" />
        </View>
        <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
        {summaries.length > 0 && (
          <Text style={styles.summaryCount}>
            {summaries.length} {summaries.length === 1 ? "hour" : "hours"}
          </Text>
        )}
      </View>
    </View>
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        {renderListHeader()}
        <LoadingSkeleton />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        {renderListHeader()}
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Could not Load Summaries</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={summaries}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={renderListHeader}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={<EmptyState date={date} />}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#2563EB"
          colors={["#2563EB"]}
        />
      }
    />
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  dateIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateHeaderText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  summaryCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  // Loading skeleton styles
  skeletonContainer: {
    paddingTop: 8,
  },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.32)",
  },
  skeletonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  skeletonTime: {
    width: 120,
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonBadge: {
    width: 48,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  skeletonIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonLocation: {
    width: 100,
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  skeletonTitle: {
    width: "70%",
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    marginBottom: 8,
  },
  skeletonDescription: {
    width: "100%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    marginBottom: 6,
  },
  skeletonDescriptionShort: {
    width: "60%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  // Empty state styles
  emptyContainer: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
  },
  // Error state styles
  errorContainer: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#EF4444",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
  },
});
