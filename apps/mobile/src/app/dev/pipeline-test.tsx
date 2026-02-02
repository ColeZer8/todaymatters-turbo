/**
 * Pipeline Test Screen
 *
 * Development screen to view and test the new CHARLIE layer hourly summaries.
 * Access via: /dev/pipeline-test
 */

import { useState, useCallback } from "react";
import { View, StyleSheet, SafeAreaView, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react-native";
import { HourlySummaryList } from "@/components/organisms";
import type { HourlySummary } from "@/lib/supabase/services";
import {
  submitAccurateFeedback,
  submitInaccurateFeedback,
} from "@/lib/supabase/services/activity-feedback";
import { useAuthStore } from "@/stores";

// ============================================================================
// Helpers
// ============================================================================

function getTodayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(dateYmd: string): string {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const todayYmd = getTodayYmd();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayYmd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (dateYmd === todayYmd) return "Today";
  if (dateYmd === yesterdayYmd) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function addDays(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ============================================================================
// Main Component
// ============================================================================

export default function PipelineTestScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [selectedDate, setSelectedDate] = useState(getTodayYmd());
  const [refreshKey, setRefreshKey] = useState(0);

  const userId = user?.id ?? "";

  // Date navigation
  const goToPreviousDay = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(getTodayYmd());
  }, []);

  // Force refresh
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Feedback handlers
  const handleMarkAccurate = useCallback(
    async (summaryId: string) => {
      try {
        await submitAccurateFeedback(userId, summaryId);
        Alert.alert("✅ Feedback Submitted", "Marked as accurate. Thank you!");
        setRefreshKey((k) => k + 1);
      } catch (error) {
        Alert.alert("Error", "Failed to submit feedback");
        if (__DEV__) console.error(error);
      }
    },
    [userId],
  );

  const handleNeedsCorrection = useCallback(
    async (summaryId: string) => {
      try {
        await submitInaccurateFeedback(userId, summaryId, "needs_review");
        Alert.alert("📝 Feedback Submitted", "Marked for correction. We'll improve!");
        setRefreshKey((k) => k + 1);
      } catch (error) {
        Alert.alert("Error", "Failed to submit feedback");
        if (__DEV__) console.error(error);
      }
    },
    [userId],
  );

  const handleEdit = useCallback((summary: HourlySummary) => {
    Alert.alert(
      "Edit Summary",
      `Editing: ${summary.title}\n\nThis would open an edit modal in the full implementation.`,
    );
  }, []);

  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Not logged in</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Pipeline Test</Text>
          <Text style={styles.headerSubtitle}>CHARLIE Layer Summaries</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <RefreshCw size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateNavButton}>
          <ChevronLeft size={20} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday} style={styles.dateDisplay}>
          <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
          <Text style={styles.dateYmd}>{selectedDate}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToNextDay}
          style={styles.dateNavButton}
          disabled={selectedDate === getTodayYmd()}
        >
          <ChevronRight
            size={20}
            color={selectedDate === getTodayYmd() ? "#CBD5E1" : "#64748B"}
          />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          🧪 This shows data from the <Text style={styles.bold}>new pipeline</Text>{" "}
          (tm.hourly_summaries). Compare with the main calendar to see the difference.
        </Text>
      </View>

      {/* Summary List */}
      <HourlySummaryList
        key={`${selectedDate}-${refreshKey}`}
        date={selectedDate}
        userId={userId}
        onMarkAccurate={handleMarkAccurate}
        onNeedsCorrection={handleNeedsCorrection}
        onEdit={handleEdit}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  dateNavButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  dateDisplay: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  dateText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  dateYmd: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 2,
  },
  infoBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.15)",
  },
  infoBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#1E40AF",
  },
  bold: {
    fontWeight: "700",
  },
  listContent: {
    paddingTop: 8,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
  },
});
