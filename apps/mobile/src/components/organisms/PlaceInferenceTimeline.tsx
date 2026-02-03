/**
 * PlaceInferenceTimeline Component
 *
 * Displays hourly location data with smart place inference.
 * Matches the HTML mockup: shows inferred Home/Work/etc with reasoning.
 * Users can tap to confirm or change inferred places.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import {
  MapPin,
  Home,
  Briefcase,
  Pin,
  Clock,
  Sparkles,
  ChevronRight,
  Check,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase/client";
import {
  inferPlacesFromHistory,
  type InferredPlace,
  type PlaceInferenceResult,
} from "@/lib/supabase/services/place-inference";

// ============================================================================
// Types
// ============================================================================

interface LocationHourlyRow {
  hour_start: string;
  geohash7: string | null;
  sample_count: number;
  place_label: string | null;
  google_place_name: string | null;
  centroid_latitude: number | null;
  centroid_longitude: number | null;
}

interface HourlyBlock {
  hourStart: Date;
  hourLabel: string;
  geohash7: string | null;
  sampleCount: number;
  userPlaceLabel: string | null;
  googlePlaceName: string | null;
  inferredPlace: InferredPlace | null;
  latitude: number | null;
  longitude: number | null;
}

interface PlaceInferenceTimelineProps {
  userId: string;
  date: string; // YYYY-MM-DD
  onPlaceSelected?: (block: HourlyBlock, inferredPlace: InferredPlace | null) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHourLabel(date: Date): string {
  const hour = date.getHours();
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatHourRange(date: Date): string {
  const startHour = date.getHours();
  const endHour = (startHour + 1) % 24;
  
  const format = (h: number) => {
    if (h === 0) return "12:00 AM";
    if (h === 12) return "12:00 PM";
    if (h < 12) return `${h}:00 AM`;
    return `${h - 12}:00 PM`;
  };
  
  return `${format(startHour)} - ${format(endHour)}`;
}

function getPlaceTypeColor(type: InferredPlace["inferredType"] | null): string {
  switch (type) {
    case "home":
      return "#22C55E";
    case "work":
      return "#3B82F6";
    case "frequent":
      return "#F59E0B";
    default:
      return "#6B7280";
  }
}

function getPlaceTypeIcon(type: InferredPlace["inferredType"] | null) {
  switch (type) {
    case "home":
      return Home;
    case "work":
      return Briefcase;
    case "frequent":
      return Pin;
    default:
      return MapPin;
  }
}

function getPlaceTypeBgColor(type: InferredPlace["inferredType"] | null): string {
  switch (type) {
    case "home":
      return "rgba(34, 197, 94, 0.1)";
    case "work":
      return "rgba(59, 130, 246, 0.1)";
    case "frequent":
      return "rgba(245, 158, 11, 0.1)";
    default:
      return "rgba(107, 114, 128, 0.08)";
  }
}

// ============================================================================
// Sub-components
// ============================================================================

interface HourBlockCardProps {
  block: HourlyBlock;
  onPress?: () => void;
}

function HourBlockCard({ block, onPress }: HourBlockCardProps) {
  const inferredType = block.inferredPlace?.inferredType ?? null;
  const PlaceIcon = getPlaceTypeIcon(inferredType);
  const color = getPlaceTypeColor(inferredType);
  const bgColor = getPlaceTypeBgColor(inferredType);
  
  // Determine what label to show
  // Priority: user place > google place name > meaningful inference > fallback
  const inferredLabel = block.inferredPlace?.suggestedLabel;
  const hasMeaningfulInference = inferredLabel && 
    inferredLabel !== "Unknown Location" && 
    inferredLabel !== "Location" &&
    inferredLabel !== "Frequent Location";
  
  const displayLabel = block.userPlaceLabel 
    || (hasMeaningfulInference ? inferredLabel : null)  // Home/Work take priority
    || block.googlePlaceName  // Prefer actual Google place name (e.g. "Target")
    || inferredLabel  // Fall back to any inference
    || "Unknown Location";
  
  // Show "Inferred" badge only when displaying a meaningful inference (not Google name)
  const isShowingInference = !block.userPlaceLabel && hasMeaningfulInference;
  // Show "Google" indicator when displaying Google place name
  const isShowingGoogle = !block.userPlaceLabel && !hasMeaningfulInference && !!block.googlePlaceName;
  const confidence = block.inferredPlace?.confidence ?? 0;

  return (
    <TouchableOpacity 
      style={[styles.hourBlock, { borderLeftColor: color, backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header: Time Range + Confidence */}
      <View style={styles.blockHeader}>
        <View style={styles.timeRow}>
          <Clock size={12} color="#64748B" />
          <Text style={styles.timeText}>{formatHourRange(block.hourStart)}</Text>
        </View>
        {block.inferredPlace && (
          <View style={[styles.confidenceBadge, { backgroundColor: `${color}20` }]}>
            <Text style={[styles.confidenceText, { color }]}>
              {Math.round(confidence * 100)}%
            </Text>
          </View>
        )}
      </View>

      {/* Place Row */}
      <View style={styles.placeRow}>
        <View style={[styles.placeIconContainer, { backgroundColor: `${color}15` }]}>
          <PlaceIcon size={18} color={color} />
        </View>
        <View style={styles.placeInfo}>
          <View style={styles.placeLabelRow}>
            <Text style={[styles.placeLabel, { color }]}>{displayLabel}</Text>
            {isShowingInference && (
              <View style={styles.inferredBadge}>
                <Sparkles size={10} color="#F59E0B" />
                <Text style={styles.inferredText}>Inferred</Text>
              </View>
            )}
            {isShowingGoogle && (
              <View style={[styles.inferredBadge, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                <MapPin size={10} color="#3B82F6" />
                <Text style={[styles.inferredText, { color: "#3B82F6" }]}>Google</Text>
              </View>
            )}
            {block.userPlaceLabel && (
              <View style={styles.confirmedBadge}>
                <Check size={10} color="#22C55E" />
                <Text style={styles.confirmedText}>Set</Text>
              </View>
            )}
          </View>
          <Text style={styles.sampleCount}>
            {block.sampleCount} location samples
            {block.geohash7 && ` · ${block.geohash7.slice(0, 5)}...`}
          </Text>
        </View>
        <ChevronRight size={16} color="#94A3B8" />
      </View>

      {/* Inference Reasoning */}
      {block.inferredPlace && block.inferredPlace.reasoning && (
        <View style={styles.reasoningContainer}>
          <Sparkles size={12} color="#D97706" />
          <Text style={styles.reasoningText}>
            <Text style={styles.reasoningLabel}>Place inference: </Text>
            {block.inferredPlace.reasoning}
          </Text>
        </View>
      )}

      {/* Google Place Name (if different from display) */}
      {block.googlePlaceName && block.googlePlaceName !== displayLabel && (
        <Text style={styles.googlePlaceName}>
          Google: {block.googlePlaceName}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PlaceInferenceTimeline({
  userId,
  date,
  onPlaceSelected,
}: PlaceInferenceTimelineProps) {
  const [hourlyBlocks, setHourlyBlocks] = useState<HourlyBlock[]>([]);
  const [inferenceResult, setInferenceResult] = useState<PlaceInferenceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a map of geohash -> inferred place for quick lookups
  const inferenceMap = useMemo(() => {
    const map = new Map<string, InferredPlace>();
    if (inferenceResult) {
      for (const place of inferenceResult.inferredPlaces) {
        map.set(place.geohash7, place);
      }
    }
    return map;
  }, [inferenceResult]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch hourly location data for the date
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const { data: rows, error: fetchError } = await supabase
        .schema("tm")
        .from("location_hourly")
        .select("hour_start, geohash7, sample_count, place_label, google_place_name, centroid_latitude, centroid_longitude")
        .eq("user_id", userId)
        .gte("hour_start", startOfDay)
        .lte("hour_start", endOfDay)
        .order("hour_start", { ascending: false });

      if (fetchError) throw fetchError;

      // Run place inference (uses last 14 days of data)
      const inference = await inferPlacesFromHistory(userId, 14);
      setInferenceResult(inference);

      // Build hourly blocks with inference lookups
      const blocks: HourlyBlock[] = (rows || []).map((row: LocationHourlyRow) => {
        // Use explicit lat/lng columns from the updated view
        const latitude = row.centroid_latitude ?? null;
        const longitude = row.centroid_longitude ?? null;
        const geohash7 = row.geohash7 || null;
        
        return {
          hourStart: new Date(row.hour_start),
          hourLabel: formatHourLabel(new Date(row.hour_start)),
          geohash7,
          sampleCount: row.sample_count || 0,
          userPlaceLabel: row.place_label || null,
          googlePlaceName: row.google_place_name || null,
          inferredPlace: geohash7 ? (inference.inferredPlaces.find(p => p.geohash7 === geohash7) || null) : null,
          latitude,
          longitude,
        };
      });

      setHourlyBlocks(blocks);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
      if (__DEV__) console.error("[PlaceInferenceTimeline] Error:", err);
    }
  }, [userId, date]);

  useEffect(() => {
    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const handleBlockPress = useCallback((block: HourlyBlock) => {
    if (onPlaceSelected) {
      onPlaceSelected(block, block.inferredPlace);
    } else {
      // Default: show alert with options
      const options = ["Set as Home", "Set as Work", "Set Custom Name", "Cancel"];
      Alert.alert(
        block.inferredPlace?.suggestedLabel || "Unknown Location",
        `${formatHourRange(block.hourStart)}\n${block.sampleCount} samples\n\n${block.inferredPlace?.reasoning || "No inference available"}`,
        options.map((opt, idx) => ({
          text: opt,
          style: idx === options.length - 1 ? "cancel" : "default",
          onPress: idx < options.length - 1 ? () => {
            Alert.alert("Coming Soon", "Place setting will be implemented with tm.user_places integration.");
          } : undefined,
        })),
      );
    }
  }, [onPlaceSelected]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Analyzing location patterns...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading Data</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#2563EB"
        />
      }
    >
      {/* Inference Summary Header */}
      {inferenceResult && inferenceResult.inferredPlaces.length > 0 && (
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconRow}>
            <Sparkles size={16} color="#D97706" />
            <Text style={styles.summaryTitle}>Place Inference Active</Text>
          </View>
          <Text style={styles.summarySubtitle}>
            Analyzed {inferenceResult.stats.hoursAnalyzed}h across {inferenceResult.stats.daysAnalyzed} days
            {" · "}Found {inferenceResult.inferredPlaces.filter(p => p.inferredType !== "unknown").length} known places
          </Text>
          
          {/* Quick summary of inferred places */}
          <View style={styles.inferredPlacesSummary}>
            {inferenceResult.inferredPlaces
              .filter(p => p.inferredType !== "unknown")
              .slice(0, 3)
              .map((place, idx) => {
                const Icon = getPlaceTypeIcon(place.inferredType);
                const color = getPlaceTypeColor(place.inferredType);
                return (
                  <View key={idx} style={[styles.summaryChip, { borderColor: color }]}>
                    <Icon size={12} color={color} />
                    <Text style={[styles.summaryChipText, { color }]}>
                      {place.suggestedLabel}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>
      )}

      {/* Hourly Blocks */}
      {hourlyBlocks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MapPin size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No Location Data</Text>
          <Text style={styles.emptySubtitle}>
            No location samples recorded for this day.
          </Text>
        </View>
      ) : (
        <View style={styles.blocksList}>
          {hourlyBlocks.map((block, idx) => (
            <HourBlockCard
              key={`${block.hourStart.toISOString()}-${idx}`}
              block={block}
              onPress={() => handleBlockPress(block)}
            />
          ))}
        </View>
      )}
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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#EF4444",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  summaryHeader: {
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  summaryIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400E",
  },
  summarySubtitle: {
    fontSize: 12,
    color: "#A16207",
    marginBottom: 10,
  },
  inferredPlacesSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  blocksList: {
    gap: 12,
  },
  hourBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  placeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  placeInfo: {
    flex: 1,
  },
  placeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  placeLabel: {
    fontSize: 15,
    fontWeight: "700",
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
  inferredText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#D97706",
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 6,
  },
  confirmedText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#22C55E",
  },
  sampleCount: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  reasoningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
  },
  reasoningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: "#92400E",
  },
  reasoningLabel: {
    fontWeight: "700",
  },
  googlePlaceName: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 6,
  },
});

export default PlaceInferenceTimeline;
