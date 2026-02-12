/**
 * LocationPickerSheet — Bottom sheet for picking a location.
 *
 * Two modes:
 * 1. **Nearby** — shows Google Places nearby results (750m radius, up to 10)
 * 2. **Search** — Google Places Autocomplete when user types in the search box
 *
 * Uses session tokens so autocomplete requests are free.
 * Matches the dark theme of PlacePickerSheet.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  Search,
  MapPin,
  Navigation,
  Coffee,
  Utensils,
  Dumbbell,
  ShoppingBag,
  GraduationCap,
  Heart,
  Fuel,
  Briefcase,
  Church,
  Building2,
  type LucideIcon,
} from "lucide-react-native";
import {
  fetchNearbyPlaces,
  getFuzzyLocationLabel,
  getPlaceTypeLabel,
  searchPlacesAutocomplete,
  createSessionToken,
  cancelAutocomplete,
  type GooglePlaceSuggestion,
  type PlaceAutocompletePrediction,
} from "@/lib/supabase/services/google-places";

// ============================================================================
// Theme
// ============================================================================

const COLORS = {
  background: "#1A1A2E",
  cardBg: "#1E293B",
  overlay: "#16213E",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  border: "rgba(148,163,184,0.2)",
  accent: "#3B82F6",
  accentLight: "rgba(59,130,246,0.15)",
  searchBg: "#0F172A",
};

// ============================================================================
// Types
// ============================================================================

export interface LocationPickerSelection {
  /** Display label for the location */
  label: string;
  /** Google Place ID (if selected from nearby/autocomplete) */
  placeId?: string;
  /** Google place types (for category mapping) */
  types?: string[];
}

export interface LocationPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: LocationPickerSelection) => void;
  /** Current GPS latitude */
  latitude: number | null;
  /** Current GPS longitude */
  longitude: number | null;
  /** Current location label */
  currentLabel?: string;
  /** Pre-loaded nearby places (avoids re-fetch if parent already has them) */
  initialNearby?: GooglePlaceSuggestion[];
}

// ============================================================================
// Icon Mapping
// ============================================================================

function getIconForTypes(types: string[]): LucideIcon {
  const typeStr = types.join(",").toLowerCase();
  if (typeStr.includes("church") || typeStr.includes("mosque") || typeStr.includes("synagogue")) return Church;
  if (typeStr.includes("restaurant") || typeStr.includes("food")) return Utensils;
  if (typeStr.includes("cafe") || typeStr.includes("coffee")) return Coffee;
  if (typeStr.includes("store") || typeStr.includes("shopping")) return ShoppingBag;
  if (typeStr.includes("school") || typeStr.includes("university")) return GraduationCap;
  if (typeStr.includes("hospital") || typeStr.includes("doctor") || typeStr.includes("pharmacy")) return Heart;
  if (typeStr.includes("gas_station") || typeStr.includes("fuel")) return Fuel;
  if (typeStr.includes("gym")) return Dumbbell;
  if (typeStr.includes("office")) return Briefcase;
  if (typeStr.includes("building") || typeStr.includes("establishment")) return Building2;
  return MapPin;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// ============================================================================
// Debounce Hook
// ============================================================================

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

// ============================================================================
// Component
// ============================================================================

export function LocationPickerSheet({
  visible,
  onClose,
  onSelect,
  latitude,
  longitude,
  currentLabel = "",
  initialNearby,
}: LocationPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;
  const searchInputRef = useRef<TextInput>(null);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [nearbyPlaces, setNearbyPlaces] = useState<GooglePlaceSuggestion[]>(
    initialNearby ?? []
  );
  const [neighborhoodLabel, setNeighborhoodLabel] = useState<string | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<
    PlaceAutocompletePrediction[]
  >([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [sessionToken] = useState(() => createSessionToken());

  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const isSearchMode = searchQuery.length > 0;
  const hasCoords = latitude != null && longitude != null;

  // ---- Animations ----
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(panelTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      panelTranslateY.setValue(1000);
    }
  }, [visible, backdropOpacity, panelTranslateY]);

  // ---- Reset on close ----
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setAutocompleteResults([]);
      cancelAutocomplete();
    }
  }, [visible]);

  // ---- Fetch nearby on open ----
  useEffect(() => {
    if (!visible || !hasCoords) return;
    if (initialNearby && initialNearby.length > 0) {
      setNearbyPlaces(initialNearby);
      return;
    }

    let cancelled = false;
    setIsLoadingNearby(true);

    Promise.all([
      fetchNearbyPlaces(latitude!, longitude!),
      getFuzzyLocationLabel(latitude!, longitude!),
    ])
      .then(([placesResult, fuzzyLabel]) => {
        if (cancelled) return;
        setNearbyPlaces(placesResult.suggestions);
        setNeighborhoodLabel(fuzzyLabel);
      })
      .catch(() => {
        if (cancelled) return;
        setNearbyPlaces([]);
        setNeighborhoodLabel(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingNearby(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, hasCoords, latitude, longitude, initialNearby]);

  // ---- Autocomplete search ----
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setAutocompleteResults([]);
      setIsLoadingSearch(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSearch(true);

    searchPlacesAutocomplete(
      debouncedQuery,
      latitude,
      longitude,
      sessionToken
    )
      .then((results) => {
        if (cancelled) return;
        setAutocompleteResults(results);
      })
      .catch(() => {
        if (cancelled) return;
        setAutocompleteResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSearch(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, latitude, longitude, sessionToken]);

  // ---- Handlers ----
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateY, {
        toValue: 1000,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [backdropOpacity, panelTranslateY, onClose]);

  const handleSelectNearby = useCallback(
    (place: GooglePlaceSuggestion) => {
      Keyboard.dismiss();
      onSelect({
        label: place.name,
        placeId: place.placeId,
        types: place.types,
      });
      handleClose();
    },
    [onSelect, handleClose]
  );

  const handleSelectAutocomplete = useCallback(
    (prediction: PlaceAutocompletePrediction) => {
      Keyboard.dismiss();
      onSelect({
        label: prediction.mainText,
        placeId: prediction.placeId,
        types: prediction.types,
      });
      handleClose();
    },
    [onSelect, handleClose]
  );

  const handleSelectNeighborhood = useCallback(() => {
    if (!neighborhoodLabel) return;
    Keyboard.dismiss();
    onSelect({ label: neighborhoodLabel });
    handleClose();
  }, [neighborhoodLabel, onSelect, handleClose]);

  const handleUseCustomText = useCallback(() => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    onSelect({ label: searchQuery.trim() });
    handleClose();
  }, [searchQuery, onSelect, handleClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <Pressable style={styles.backdropPressable} onPress={handleClose} />

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            {
              paddingTop: Platform.OS === "android" ? insets.top : 0,
              transform: [{ translateY: panelTranslateY }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>Edit Location</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Search size={18} color={COLORS.textSecondary} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search for a place..."
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  hitSlop={8}
                >
                  <X size={18} color={COLORS.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isSearchMode ? (
              <>
                {/* Autocomplete Results */}
                {isLoadingSearch && autocompleteResults.length === 0 ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color={COLORS.accent} />
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                ) : autocompleteResults.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
                    {autocompleteResults.map((prediction) => {
                      const PlaceIcon = getIconForTypes(prediction.types);
                      return (
                        <Pressable
                          key={prediction.placeId}
                          style={styles.placeOption}
                          onPress={() => handleSelectAutocomplete(prediction)}
                        >
                          <View
                            style={[
                              styles.placeIconContainer,
                              { backgroundColor: COLORS.accentLight },
                            ]}
                          >
                            <PlaceIcon size={18} color={COLORS.accent} />
                          </View>
                          <View style={styles.placeTextContainer}>
                            <Text style={styles.placeName} numberOfLines={1}>
                              {prediction.mainText}
                            </Text>
                            <Text
                              style={styles.placeVicinity}
                              numberOfLines={1}
                            >
                              {prediction.secondaryText}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : debouncedQuery.length >= 2 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No results found for "{debouncedQuery}"
                    </Text>
                  </View>
                ) : null}

                {/* "Use as custom name" option */}
                {searchQuery.trim().length > 0 && (
                  <Pressable
                    style={styles.customNameOption}
                    onPress={handleUseCustomText}
                  >
                    <View
                      style={[
                        styles.placeIconContainer,
                        { backgroundColor: "rgba(52,199,89,0.15)" },
                      ]}
                    >
                      <MapPin size={18} color="#34C759" />
                    </View>
                    <View style={styles.placeTextContainer}>
                      <Text style={styles.placeName}>
                        Use "{searchQuery.trim()}"
                      </Text>
                      <Text style={styles.placeVicinity}>
                        Enter as custom location name
                      </Text>
                    </View>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                {/* Nearby Places */}
                {hasCoords && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>NEARBY PLACES</Text>
                    {isLoadingNearby ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color={COLORS.accent} />
                        <Text style={styles.loadingText}>
                          Finding nearby places...
                        </Text>
                      </View>
                    ) : nearbyPlaces.length > 0 ? (
                      <>
                        {nearbyPlaces.map((place, index) => {
                          const PlaceIcon = getIconForTypes(place.types);
                          const isFirst = index === 0;
                          return (
                            <Pressable
                              key={place.placeId}
                              style={[
                                styles.placeOption,
                                isFirst && styles.placeOptionHighlight,
                              ]}
                              onPress={() => handleSelectNearby(place)}
                            >
                              <View
                                style={[
                                  styles.placeIconContainer,
                                  {
                                    backgroundColor: isFirst
                                      ? COLORS.accentLight
                                      : COLORS.accentLight,
                                  },
                                ]}
                              >
                                <PlaceIcon
                                  size={18}
                                  color={COLORS.accent}
                                />
                              </View>
                              <View style={styles.placeTextContainer}>
                                <View style={styles.placeNameRow}>
                                  <Text
                                    style={styles.placeName}
                                    numberOfLines={1}
                                  >
                                    {place.name}
                                  </Text>
                                  {isFirst && (
                                    <View style={styles.autoBadge}>
                                      <Text style={styles.autoBadgeText}>
                                        Closest
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.placeVicinity}>
                                  {getPlaceTypeLabel(place.types)} ·{" "}
                                  {formatDistance(place.distanceM)}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}

                        {/* Neighborhood fallback */}
                        {neighborhoodLabel && (
                          <Pressable
                            style={styles.neighborhoodOption}
                            onPress={handleSelectNeighborhood}
                          >
                            <View
                              style={[
                                styles.placeIconContainer,
                                { backgroundColor: "rgba(148,163,184,0.15)" },
                              ]}
                            >
                              <Navigation
                                size={18}
                                color={COLORS.textSecondary}
                              />
                            </View>
                            <View style={styles.placeTextContainer}>
                              <Text
                                style={[
                                  styles.placeName,
                                  { color: COLORS.textSecondary },
                                ]}
                              >
                                {neighborhoodLabel}
                              </Text>
                              <Text style={styles.placeVicinity}>
                                Neighborhood
                              </Text>
                            </View>
                          </Pressable>
                        )}
                      </>
                    ) : (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                          No nearby places found. Try searching instead.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* No coordinates hint */}
                {!hasCoords && (
                  <View style={styles.emptyContainer}>
                    <MapPin size={32} color={COLORS.textSecondary} />
                    <Text style={styles.emptyText}>
                      No GPS coordinates available.{"\n"}
                      Use the search bar to find a place.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  closeButton: {
    width: 40,
    alignItems: "flex-end",
  },

  // Search Bar
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.searchBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    padding: 0,
  },

  // ScrollView
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  // Section
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },

  // Place options
  placeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  placeOptionHighlight: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  placeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  placeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  placeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  placeName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  placeVicinity: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Auto badge
  autoBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.accent,
  },

  // Neighborhood option
  neighborhoodOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },

  // Custom name option
  customNameOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(52,199,89,0.3)",
  },

  // Loading
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
