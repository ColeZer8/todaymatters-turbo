/**
 * Discover Frequent Places Screen
 *
 * Shows auto-detected frequent places and allows users to save them
 * as labeled user places for future reference.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, MapPin, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores";
import {
  suggestPlacesToLabel,
  type PlaceSuggestion,
} from "@/lib/supabase/services/frequent-places";
import { saveLocationLabel } from "@/lib/supabase/services/location-labels";

// ============================================================================
// Component
// ============================================================================

export default function DiscoverPlacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Load suggestions on mount
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const results = await suggestPlacesToLabel(userId, {
          minVisits: 5,
          daysBack: 14,
          limit: 10,
        });

        if (cancelled) return;
        setSuggestions(results);
      } catch (error) {
        if (__DEV__) {
          console.error("[DiscoverPlaces] Failed to load suggestions:", error);
        }
        if (!cancelled) {
          Alert.alert("Error", "Failed to load place suggestions");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Save a place
  const handleSavePlace = useCallback(
    async (suggestion: PlaceSuggestion, customLabel?: string, customCategory?: string) => {
      if (!userId) return;

      const placeId = suggestion.place.placeLabel; // Use as temp ID
      setSavingIds((prev) => new Set(prev).add(placeId));

      try {
        const label = customLabel ?? suggestion.suggestedLabel;
        const category = customCategory ?? suggestion.suggestedCategory ?? undefined;

        // We need geohash7 to save properly
        // For now, we'll calculate it client-side or pass null
        // The service should handle generating geohash7 from lat/lng

        await saveLocationLabel(
          userId,
          suggestion.place.geohash7 ?? "", // Will be generated from coords if null
          label,
          {
            category,
            latitude: suggestion.place.avgLat,
            longitude: suggestion.place.avgLng,
            radius_m: 150, // Default radius
          },
        );

        // Remove from suggestions list
        setSuggestions((prev) => prev.filter((s) => s.place.placeLabel !== placeId));

        Alert.alert("Saved!", `"${label}" has been saved as a place.`);
      } catch (error) {
        if (__DEV__) {
          console.error("[DiscoverPlaces] Failed to save place:", error);
        }
        Alert.alert("Error", "Failed to save place. Please try again.");
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(placeId);
          return next;
        });
      }
    },
    [userId],
  );

  // Skip a suggestion
  const handleSkipPlace = useCallback((suggestion: PlaceSuggestion) => {
    setSuggestions((prev) =>
      prev.filter((s) => s.place.placeLabel !== suggestion.place.placeLabel),
    );
  }, []);

  if (!userId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Not logged in</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#64748B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Discover Places</Text>
          <Text style={styles.headerSubtitle}>
            Based on your recent activity
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {isLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Finding frequent places...</Text>
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Places Found</Text>
            <Text style={styles.emptySubtitle}>
              We'll suggest places after you visit them a few times
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Found {suggestions.length} frequent {suggestions.length === 1 ? "place" : "places"}
            </Text>
            {suggestions.map((suggestion) => (
              <PlaceSuggestionCard
                key={suggestion.place.placeLabel}
                suggestion={suggestion}
                isSaving={savingIds.has(suggestion.place.placeLabel)}
                onSave={() => handleSavePlace(suggestion)}
                onSkip={() => handleSkipPlace(suggestion)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Place Suggestion Card
// ============================================================================

interface PlaceSuggestionCardProps {
  suggestion: PlaceSuggestion;
  isSaving: boolean;
  onSave: () => void;
  onSkip: () => void;
}

function PlaceSuggestionCard({
  suggestion,
  isSaving,
  onSave,
  onSkip,
}: PlaceSuggestionCardProps) {
  const { place, suggestedLabel, suggestedCategory, reason } = suggestion;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <MapPin size={20} color="#2563EB" />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{suggestedLabel}</Text>
          <Text style={styles.cardSubtitle}>{reason}</Text>
        </View>
      </View>

      {suggestedCategory && (
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {suggestedCategory.charAt(0).toUpperCase() + suggestedCategory.slice(1)}
          </Text>
        </View>
      )}

      <View style={styles.cardStats}>
        <Text style={styles.statText}>
          {place.visitCount} visits • {Math.round(place.totalHours)}h total
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          activeOpacity={0.7}
          disabled={isSaving}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={onSave}
          activeOpacity={0.7}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Check size={18} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Place</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 15,
    color: "#64748B",
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
    textAlign: "center",
    maxWidth: 280,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  cardStats: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
    marginBottom: 12,
  },
  statText: {
    fontSize: 13,
    color: "#64748B",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
