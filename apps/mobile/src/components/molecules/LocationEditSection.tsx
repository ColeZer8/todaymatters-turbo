/**
 * LocationEditSection — controlled component for the full location edit experience.
 *
 * Includes label input with search, nearby suggestions, "always use" toggle,
 * category picker, radius selector, and mini-map.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { MapPin, ChevronDown } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import {
  LocationPickerSheet,
  type LocationPickerSelection,
} from "./LocationPickerSheet";
import {
  fetchNearbyPlaces,
  getFuzzyLocationLabel,
  mapPlaceTypeToCategory,
  getPlaceTypeLabel,
  getGoogleApiKey,
  type GooglePlaceSuggestion,
} from "@/lib/supabase/services/google-places";
// ============================================================================
// Types
// ============================================================================

export interface LocationEditSectionProps {
  currentLabel: string;
  geohash7: string | null;
  latitude: number | null;
  longitude: number | null;
  userId: string;
  alwaysUse: boolean;
  selectedCategory: string | null;
  selectedRadius: number;
  onLabelChange: (label: string) => void;
  onAlwaysUseChange: (value: boolean) => void;
  onCategoryChange: (category: string | null) => void;
  onRadiusChange: (radius: number) => void;
  /** If true, hide the "Always use" toggle (e.g., block rename always persists) */
  hideAlwaysUseToggle?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES = [
  "Home",
  "Office",
  "Gym",
  "Coffee Shop",
  "Restaurant",
  "Library",
  "Park",
  "Other",
] as const;

const RADIUS_OPTIONS: { label: string; value: number }[] = [
  { label: "Small (50m)", value: 50 },
  { label: "Medium (100m)", value: 100 },
  { label: "Large (200m)", value: 200 },
];

// ============================================================================
// Component
// ============================================================================

export const LocationEditSection = ({
  currentLabel,
  geohash7,
  latitude,
  longitude,
  userId,
  alwaysUse,
  selectedCategory,
  selectedRadius,
  onLabelChange,
  onAlwaysUseChange,
  onCategoryChange,
  onRadiusChange,
  hideAlwaysUseToggle,
}: LocationEditSectionProps) => {
  // Internal state
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<GooglePlaceSuggestion[]>([]);
  const [neighborhoodName, setNeighborhoodName] = useState<string | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Fetch nearby places and neighborhood name when lat/lng change
  useEffect(() => {
    if (latitude == null || longitude == null) return;

    let cancelled = false;
    setIsLoadingSuggestions(true);

    Promise.all([
      fetchNearbyPlaces(latitude, longitude),
      getFuzzyLocationLabel(latitude, longitude),
    ])
      .then(([placesResult, fuzzyLabel]) => {
        if (cancelled) return;
        setNearbyPlaces(placesResult.suggestions);
        setNeighborhoodName(fuzzyLabel);
      })
      .catch(() => {
        if (cancelled) return;
        setNearbyPlaces([]);
        setNeighborhoodName(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuggestions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  const handlePickerSelect = useCallback(
    (selection: LocationPickerSelection) => {
      onLabelChange(selection.label);
      if (selection.types && selection.types.length > 0) {
        const category = mapPlaceTypeToCategory(selection.types);
        onCategoryChange(category);
      }
      setShowPickerSheet(false);
    },
    [onLabelChange, onCategoryChange],
  );

  // Build static map URL
  const apiKey = getGoogleApiKey();
  const hasCoords = latitude != null && longitude != null;
  const staticMapUrl =
    hasCoords && apiKey && !mapError
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=16&size=600x200&scale=2&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${apiKey}`
      : null;

  return (
    <View>
      {/* 1. Location Label — Tappable row to open picker sheet */}
      <Pressable
        style={styles.card}
        onPress={() => setShowPickerSheet(true)}
      >
        <View style={styles.labelRow}>
          <Icon icon={MapPin} size={18} color="#94A3B8" />
          <Text
            style={[
              styles.labelText,
              !currentLabel && styles.labelPlaceholder,
            ]}
            numberOfLines={1}
          >
            {currentLabel || "Tap to pick a location..."}
          </Text>
          <Icon icon={ChevronDown} size={18} color="#64748B" />
        </View>
      </Pressable>

      {/* 2. Nearby Quick Picks — small horizontal row for fastest pick */}
      {hasCoords && nearbyPlaces.length > 0 && !isLoadingSuggestions && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NEARBY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {nearbyPlaces.slice(0, 5).map((place) => (
              <Pressable
                key={place.placeId}
                onPress={() =>
                  handlePickerSelect({
                    label: place.name,
                    placeId: place.placeId,
                    types: place.types,
                  })
                }
                style={styles.suggestionPill}
              >
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.suggestionType}>
                  {" \u00B7 "}
                  {getPlaceTypeLabel(place.types)}
                </Text>
              </Pressable>
            ))}
            {neighborhoodName && (
              <Pressable
                onPress={() => onLabelChange(neighborhoodName)}
                style={styles.neighborhoodPill}
              >
                <Text style={styles.neighborhoodText} numberOfLines={1}>
                  {neighborhoodName}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
      {hasCoords && isLoadingSuggestions && (
        <ActivityIndicator
          color="#64748B"
          style={styles.loadingIndicator}
        />
      )}

      {/* 3. "Always use this name" Toggle */}
      {!hideAlwaysUseToggle && geohash7 != null && (
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Always use this name</Text>
              <Switch
                value={alwaysUse}
                onValueChange={onAlwaysUseChange}
                trackColor={{ false: "#D1D1D6", true: "#34C759" }}
              />
            </View>
          </View>
        </View>
      )}

      {/* 4. Category Picker */}
      {alwaysUse && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PLACE TYPE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    const newCat = isActive ? null : cat;
                    onCategoryChange(newCat);
                    if (newCat) {
                      onLabelChange(newCat); // Update label to match category
                    }
                  }}
                  style={[
                    styles.pill,
                    isActive ? styles.pillActive : styles.pillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      isActive
                        ? styles.pillTextActive
                        : styles.pillTextInactive,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 5. Radius Toggle */}
      {alwaysUse && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DETECTION RADIUS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {RADIUS_OPTIONS.map((opt) => {
              const isActive = selectedRadius === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onRadiusChange(opt.value)}
                  style={[
                    styles.pill,
                    isActive ? styles.pillActive : styles.pillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      isActive
                        ? styles.pillTextActive
                        : styles.pillTextInactive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 6. Mini-Map */}
      {staticMapUrl && (
        <Image
          source={{ uri: staticMapUrl }}
          style={styles.miniMap}
          onError={() => setMapError(true)}
        />
      )}

      {/* Location Picker Sheet */}
      <LocationPickerSheet
        visible={showPickerSheet}
        onClose={() => setShowPickerSheet(false)}
        onSelect={handlePickerSelect}
        latitude={latitude}
        longitude={longitude}
        currentLabel={currentLabel}
        initialNearby={nearbyPlaces}
      />
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.88,
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 8,
  },

  // Label row
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
  },
  labelText: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 12,
  },
  labelPlaceholder: {
    color: "#94A3B8",
  },

  // Loading
  loadingIndicator: {
    paddingVertical: 12,
  },

  // Pill row
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },

  // Nearby suggestion pills
  suggestionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    flexShrink: 1,
  },
  suggestionType: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
  },

  // Neighborhood fallback pill
  neighborhoodPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  neighborhoodText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
  },

  // Toggle row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  toggleLabel: {
    fontSize: 15,
    color: "#64748B",
  },

  // Category / Radius pills
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: "#1F2937",
  },
  pillInactive: {
    backgroundColor: "#F1F5F9",
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  pillTextInactive: {
    color: "#64748B",
  },

  // Mini-map
  miniMap: {
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
  },
});
