/**
 * Pipeline Test Screen
 *
 * Development screen to view and test the new CHARLIE layer hourly summaries.
 * Now includes Place Inference Timeline that matches the HTML mockup.
 * Access via: /dev/pipeline-test
 */

import { useState, useCallback } from "react";
import { View, StyleSheet, SafeAreaView, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, RefreshCw, MapPin, LayoutList, Zap, Layers } from "lucide-react-native";
import { HourlySummaryList, PlaceInferenceTimeline } from "@/components/organisms";
import { LocationBlockList } from "@/components/organisms/LocationBlockList";
import type { HourlySummary } from "@/lib/supabase/services";
import type { LocationBlock } from "@/lib/types/location-block";
import {
  submitAccurateFeedback,
  submitInaccurateFeedback,
} from "@/lib/supabase/services/activity-feedback";
import { reprocessDayWithPlaceLookup } from "@/lib/supabase/services/activity-segments";
import { useAuthStore } from "@/stores";

type ViewMode = "blocks" | "summaries" | "places";

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
  const [viewMode, setViewMode] = useState<ViewMode>("blocks"); // Default to location blocks view
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);

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

  // Block-level feedback handlers
  const handleBlockMarkAccurate = useCallback(
    async (summaryIds: string[]) => {
      try {
        await Promise.all(
          summaryIds.map((id) => submitAccurateFeedback(userId, id)),
        );
        Alert.alert("Feedback Submitted", "Marked as accurate. Thank you!");
        setRefreshKey((k) => k + 1);
      } catch (error) {
        Alert.alert("Error", "Failed to submit feedback");
        if (__DEV__) console.error(error);
      }
    },
    [userId],
  );

  const handleBlockNeedsCorrection = useCallback(
    async (summaryIds: string[]) => {
      try {
        await Promise.all(
          summaryIds.map((id) =>
            submitInaccurateFeedback(userId, id, "needs_review"),
          ),
        );
        Alert.alert("Feedback Submitted", "Marked for correction. We'll improve!");
        setRefreshKey((k) => k + 1);
      } catch (error) {
        Alert.alert("Error", "Failed to submit feedback");
        if (__DEV__) console.error(error);
      }
    },
    [userId],
  );

  const handleBlockEdit = useCallback((block: LocationBlock) => {
    Alert.alert(
      "Edit Block",
      `Editing: ${block.locationLabel}\n${block.summaryIds.length} hour(s)\n\nThis would open a block edit modal in the full implementation.`,
    );
  }, []);

  // Reprocess day with place lookups
  const handleReprocessDay = useCallback(async () => {
    if (!userId) return;
    
    Alert.alert(
      "Reprocess Day",
      `This will delete and regenerate all activity segments for ${formatDateDisplay(selectedDate)} with fresh place lookups.\n\nThis may take a moment.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reprocess",
          style: "destructive",
          onPress: async () => {
            setIsReprocessing(true);
            setReprocessStatus("Starting...");
            
            try {
              const result = await reprocessDayWithPlaceLookup(
                userId,
                selectedDate,
                (msg) => setReprocessStatus(msg),
              );
              
              if (result.success) {
                Alert.alert(
                  "✅ Reprocess Complete",
                  `Processed ${result.hoursProcessed} hours\n` +
                  `Created ${result.segmentsCreated} segments\n` +
                  `Looked up ${result.placesLookedUp} places\n` +
                  `Generated ${result.summariesGenerated ?? 0} summaries`,
                );
                setRefreshKey((k) => k + 1);
              } else {
                Alert.alert("Error", result.error ?? "Unknown error");
              }
            } catch (error) {
              Alert.alert("Error", error instanceof Error ? error.message : "Failed to reprocess");
            } finally {
              setIsReprocessing(false);
              setReprocessStatus(null);
            }
          },
        },
      ],
    );
  }, [userId, selectedDate]);

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
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={handleReprocessDay} 
            style={[styles.reprocessButton, isReprocessing && styles.buttonDisabled]}
            disabled={isReprocessing}
          >
            <Zap size={18} color={isReprocessing ? "#94A3B8" : "#F59E0B"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <RefreshCw size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Reprocess Status Banner */}
      {isReprocessing && reprocessStatus && (
        <View style={styles.reprocessBanner}>
          <Text style={styles.reprocessBannerText}>⚡ {reprocessStatus}</Text>
        </View>
      )}

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

      {/* View Mode Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "blocks" && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode("blocks")}
        >
          <Layers size={14} color={viewMode === "blocks" ? "#FFFFFF" : "#64748B"} />
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === "blocks" && styles.toggleButtonTextActive,
            ]}
          >
            Location Blocks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "places" && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode("places")}
        >
          <MapPin size={14} color={viewMode === "places" ? "#FFFFFF" : "#64748B"} />
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === "places" && styles.toggleButtonTextActive,
            ]}
          >
            Places
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "summaries" && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode("summaries")}
        >
          <LayoutList size={14} color={viewMode === "summaries" ? "#FFFFFF" : "#64748B"} />
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === "summaries" && styles.toggleButtonTextActive,
            ]}
          >
            Hourly
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          {viewMode === "blocks" ? (
            <>
              📍 <Text style={styles.bold}>Location Blocks</Text> — Groups your day by
              location. Consecutive hours at the same place merge into a single block.
            </>
          ) : viewMode === "places" ? (
            <>
              🏠 <Text style={styles.bold}>Place Inference</Text> — Automatically detects
              Home, Work, and frequent locations from your patterns. Tap any hour to set or confirm.
            </>
          ) : (
            <>
              🧪 This shows data from the <Text style={styles.bold}>new pipeline</Text>{" "}
              (tm.hourly_summaries). Compare with the main calendar to see the difference.
            </>
          )}
        </Text>
      </View>

      {/* Content based on view mode */}
      {viewMode === "blocks" ? (
        <LocationBlockList
          key={`blocks-${selectedDate}-${refreshKey}`}
          date={selectedDate}
          userId={userId}
          onMarkAccurate={handleBlockMarkAccurate}
          onNeedsCorrection={handleBlockNeedsCorrection}
          onEdit={handleBlockEdit}
          contentContainerStyle={styles.listContent}
        />
      ) : viewMode === "places" ? (
        <PlaceInferenceTimeline
          key={`places-${selectedDate}-${refreshKey}`}
          userId={userId}
          date={selectedDate}
        />
      ) : (
        <HourlySummaryList
          key={`summaries-${selectedDate}-${refreshKey}`}
          date={selectedDate}
          userId={userId}
          onMarkAccurate={handleMarkAccurate}
          onNeedsCorrection={handleNeedsCorrection}
          onEdit={handleEdit}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  reprocessButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  reprocessBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(245, 158, 11, 0.3)",
  },
  reprocessBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    textAlign: "center",
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
  viewToggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 4,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: 10,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: "#2563EB",
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  toggleButtonTextActive: {
    color: "#FFFFFF",
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
