/**
 * LocationEditSection — controlled component for the full location edit experience.
 *
 * Includes:
 * - Tappable label with inline dropdown for nearby places
 * - Editable text input with autocomplete suggestions
 * - Nearby suggestion pills (horizontal row)
 * - "Always use" toggle, category picker, radius selector, mini-map
 *
 * NO modals or bottom sheets — everything renders inline within the existing card.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  Keyboard,
  StyleSheet,
} from "react-native";
import {
  MapPin,
  ChevronDown,
  Check,
  Pencil,
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
import { Icon } from "../atoms/Icon";
import {
  fetchNearbyPlacesSecure,
  getFuzzyLocationLabel,
  reverseGeocode,
  mapPlaceTypeToCategory,
  getPlaceTypeLabel,
  getGoogleApiKey,
  searchPlacesAutocompleteSecure,
  createSessionToken,
  cancelAutocomplete,
  type GooglePlaceSuggestion,
  type PlaceAutocompletePrediction,
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

/** Maximum items in nearby dropdown */
const DROPDOWN_MAX_NEARBY = 10;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Debounce hook — delays value updates by `delayMs`.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Map Google place types to a LucideIcon for display.
 */
function getIconForTypes(types: string[]): LucideIcon {
  const typeStr = types.join(",").toLowerCase();
  if (
    typeStr.includes("church") ||
    typeStr.includes("mosque") ||
    typeStr.includes("synagogue")
  )
    return Church;
  if (typeStr.includes("restaurant") || typeStr.includes("food"))
    return Utensils;
  if (typeStr.includes("cafe") || typeStr.includes("coffee")) return Coffee;
  if (typeStr.includes("store") || typeStr.includes("shopping"))
    return ShoppingBag;
  if (typeStr.includes("school") || typeStr.includes("university"))
    return GraduationCap;
  if (
    typeStr.includes("hospital") ||
    typeStr.includes("doctor") ||
    typeStr.includes("pharmacy")
  )
    return Heart;
  if (typeStr.includes("gas_station") || typeStr.includes("fuel")) return Fuel;
  if (typeStr.includes("gym")) return Dumbbell;
  if (typeStr.includes("office")) return Briefcase;
  if (typeStr.includes("building") || typeStr.includes("establishment"))
    return Building2;
  return MapPin;
}

/**
 * Format distance in meters to a readable string.
 */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

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
  // ---- Existing state (nearby places, neighborhood, map) ----
  const [nearbyPlaces, setNearbyPlaces] = useState<GooglePlaceSuggestion[]>(
    [],
  );
  const [neighborhoodName, setNeighborhoodName] = useState<string | null>(
    null,
  );
  /** Raw neighborhood name without "Near " prefix (e.g., "Crestwood") */
  const [neighborhoodRaw, setNeighborhoodRaw] = useState<string | null>(null);
  /** Street name from reverse geocoding (e.g., "Oak Street") */
  const [streetName, setStreetName] = useState<string | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [mapError, setMapError] = useState(false);

  // ---- NEW: Dropdown state ----
  const [showDropdown, setShowDropdown] = useState(false);

  // ---- NEW: Inline editing + autocomplete state ----
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState<
    PlaceAutocompletePrediction[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const sessionTokenRef = useRef(createSessionToken());
  const textInputRef = useRef<TextInput>(null);

  // ---- NEW: Custom place type naming state ----
  const [showCustomNameInput, setShowCustomNameInput] = useState(
    selectedCategory === "Other" && currentLabel !== "Other",
  );
  const [customName, setCustomName] = useState(
    selectedCategory === "Other" && currentLabel !== "Other" ? currentLabel : "",
  );
  const customNameInputRef = useRef<TextInput>(null);

  // Debounced search text for autocomplete (300ms)
  const debouncedEditText = useDebouncedValue(editText, 300);

  const hasCoords = latitude != null && longitude != null;

  // ======================================================================
  // Effects
  // ======================================================================

  // Fetch nearby places and neighborhood name when lat/lng change
  useEffect(() => {
    if (latitude == null || longitude == null) {
      if (__DEV__) {
        console.log("[LocationEditSection] Skipping fetch — no coords", {
          latitude,
          longitude,
        });
      }
      return;
    }

    let cancelled = false;
    setIsLoadingSuggestions(true);

    if (__DEV__) {
      console.log("[LocationEditSection] Fetching nearby places via Edge Function", {
        latitude,
        longitude,
      });
    }

    // Use secure Edge Function proxy (API key stays server-side)
    // reverseGeocode uses client-side key — it will gracefully
    // return null if unavailable, which is fine (street/neighborhood are fallbacks).
    Promise.all([
      fetchNearbyPlacesSecure(latitude, longitude),
      reverseGeocode(latitude, longitude).catch(() => null),
    ])
      .then(([placesResult, geocodeResult]) => {
        if (cancelled) return;

        // Build fuzzy label from geocode result
        let fuzzyLabel: string | null = null;
        let rawNeighborhood: string | null = null;
        let rawStreetName: string | null = null;

        if (geocodeResult && geocodeResult.success) {
          rawNeighborhood = geocodeResult.neighborhood;
          rawStreetName = geocodeResult.streetName;

          // Build the fuzzy label (same logic as getFuzzyLocationLabel)
          if (rawStreetName && rawNeighborhood) {
            fuzzyLabel = `${rawStreetName}, ${rawNeighborhood}`;
          } else if (geocodeResult.areaName) {
            fuzzyLabel = `Near ${geocodeResult.areaName}`;
          }
        }

        if (__DEV__) {
          console.log("[LocationEditSection] Nearby places result:", {
            success: placesResult.success,
            count: placesResult.suggestions.length,
            fromCache: placesResult.fromCache,
            error: placesResult.error,
            fuzzyLabel,
            streetName: rawStreetName,
            neighborhood: rawNeighborhood,
          });
        }

        if (!placesResult.success && placesResult.error) {
          console.warn("[LocationEditSection] Nearby places error:", placesResult.error);
        }

        setNearbyPlaces(placesResult.suggestions);
        setNeighborhoodName(fuzzyLabel);
        setNeighborhoodRaw(rawNeighborhood);
        setStreetName(rawStreetName);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[LocationEditSection] Failed to fetch nearby places:", err);
        setNearbyPlaces([]);
        setNeighborhoodName(null);
        setNeighborhoodRaw(null);
        setStreetName(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuggestions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  // Autocomplete search when user types in edit mode (via secure Edge Function)
  useEffect(() => {
    if (!isEditing || !debouncedEditText || debouncedEditText.length < 2) {
      setAutocompleteResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    if (__DEV__) {
      console.log("[LocationEditSection] Autocomplete search via Edge Function:", debouncedEditText);
    }

    searchPlacesAutocompleteSecure(
      debouncedEditText,
      latitude,
      longitude,
      sessionTokenRef.current,
    )
      .then((results) => {
        if (!cancelled) {
          if (__DEV__) {
            console.log("[LocationEditSection] Autocomplete results:", results.length);
          }
          setAutocompleteResults(results);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[LocationEditSection] Autocomplete error:", err);
          setAutocompleteResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedEditText, isEditing, latitude, longitude]);

  // Cleanup autocomplete on unmount
  useEffect(() => {
    return () => cancelAutocomplete();
  }, []);

  // ======================================================================
  // Handlers
  // ======================================================================

  /** Select a place from dropdown (nearby or autocomplete). */
  const selectPlace = useCallback(
    (label: string, types?: string[]) => {
      onLabelChange(label);
      if (types && types.length > 0) {
        onCategoryChange(mapPlaceTypeToCategory(types));
      }
      setShowDropdown(false);
      setIsEditing(false);
      setEditText("");
      setAutocompleteResults([]);
      cancelAutocomplete();
      Keyboard.dismiss();
    },
    [onLabelChange, onCategoryChange],
  );

  /** Toggle the dropdown (chevron press). */
  const toggleDropdown = useCallback(() => {
    if (showDropdown) {
      // Closing dropdown
      setShowDropdown(false);
      setIsEditing(false);
      setEditText("");
      setAutocompleteResults([]);
      cancelAutocomplete();
      Keyboard.dismiss();
    } else {
      // Opening dropdown (nearby mode)
      setShowDropdown(true);
    }
  }, [showDropdown]);

  /** Switch to text editing mode (tap label or "Other..."). */
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setEditText(currentLabel);
    setShowDropdown(true);
    // New session token for this editing session
    sessionTokenRef.current = createSessionToken();
    // Focus the input after render
    setTimeout(() => textInputRef.current?.focus(), 100);
  }, [currentLabel]);

  /** Cancel editing, revert to label display. */
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditText("");
    setAutocompleteResults([]);
    cancelAutocomplete();
    Keyboard.dismiss();
    setShowDropdown(false);
  }, []);

  /** Handle submit from TextInput (return key). */
  const handleSubmitEditing = useCallback(() => {
    if (editText.trim()) {
      selectPlace(editText.trim());
    } else {
      cancelEditing();
    }
  }, [editText, selectPlace, cancelEditing]);

  /** Backward-compatible handler for pill row selections. */
  const handlePillSelect = useCallback(
    (selection: {
      label: string;
      placeId?: string;
      types?: string[];
    }) => {
      selectPlace(selection.label, selection.types);
    },
    [selectPlace],
  );

  // Build static map URL
  const apiKey = getGoogleApiKey();
  const staticMapUrl =
    hasCoords && apiKey && !mapError
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=16&size=600x200&scale=2&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${apiKey}`
      : null;

  // ======================================================================
  // Render
  // ======================================================================

  return (
    <View>
      {/* ================================================================
          1. Location Label Card + Inline Dropdown
          ================================================================ */}
      <View style={styles.card}>
        {/* Label Row */}
        <Pressable onPress={toggleDropdown} style={styles.labelRow}>
          <Icon icon={MapPin} size={18} color="#94A3B8" />

          {isEditing ? (
            <TextInput
              ref={textInputRef}
              style={styles.labelInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Search for a place..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmitEditing}
              onBlur={() => {
                // Small delay to allow dropdown item press to fire first
                setTimeout(() => {
                  if (isEditing && !showDropdown) {
                    cancelEditing();
                  }
                }, 200);
              }}
            />
          ) : (
            <View style={styles.labelTextWrapper}>
              <Text
                style={[
                  styles.labelText,
                  !currentLabel && styles.labelPlaceholder,
                ]}
                numberOfLines={1}
              >
                {currentLabel || "Tap to pick a location..."}
              </Text>
            </View>
          )}

          <Icon
            icon={ChevronDown}
            size={18}
            color="#64748B"
            style={
              showDropdown
                ? { transform: [{ rotate: "180deg" }] }
                : undefined
            }
          />
        </Pressable>

        {/* ---- Inline Dropdown ---- */}
        {showDropdown && (
          <View style={styles.dropdown}>
            <View style={styles.dropdownDivider} />

            <ScrollView
              style={styles.dropdownScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {isEditing ? (
                /* ======== Autocomplete Mode ======== */
                <>
                  {/* Loading spinner */}
                  {isSearching &&
                    autocompleteResults.length === 0 &&
                    debouncedEditText.length >= 2 && (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator color="#64748B" size="small" />
                        <Text style={styles.dropdownLoadingText}>
                          Searching...
                        </Text>
                      </View>
                    )}

                  {/* Autocomplete results */}
                  {autocompleteResults.map((prediction) => {
                    const PlaceIcon = getIconForTypes(prediction.types);
                    return (
                      <Pressable
                        key={prediction.placeId}
                        style={styles.dropdownItem}
                        onPress={() =>
                          selectPlace(prediction.mainText, prediction.types)
                        }
                      >
                        <View style={styles.dropdownItemIconWrap}>
                          <PlaceIcon size={16} color="#64748B" />
                        </View>
                        <View style={styles.dropdownItemBody}>
                          <Text
                            style={styles.dropdownItemName}
                            numberOfLines={1}
                          >
                            {prediction.mainText}
                          </Text>
                          <Text
                            style={styles.dropdownItemDetail}
                            numberOfLines={1}
                          >
                            {prediction.secondaryText}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}

                  {/* No results message */}
                  {debouncedEditText.length >= 2 &&
                    !isSearching &&
                    autocompleteResults.length === 0 && (
                      <Text style={styles.dropdownEmptyText}>
                        No results for &ldquo;{debouncedEditText}&rdquo;
                      </Text>
                    )}

                  {/* "Use as-is" custom text option */}
                  {editText.trim().length > 0 && (
                    <>
                      <View style={styles.dropdownDivider} />
                      <Pressable
                        style={styles.dropdownItem}
                        onPress={() => selectPlace(editText.trim())}
                      >
                        <View
                          style={[
                            styles.dropdownItemIconWrap,
                            styles.dropdownItemIconGreen,
                          ]}
                        >
                          <Check size={16} color="#34C759" />
                        </View>
                        <Text style={styles.dropdownItemNameGreen}>
                          Use &ldquo;{editText.trim()}&rdquo;
                        </Text>
                      </Pressable>
                    </>
                  )}
                </>
              ) : (
                /* ======== Nearby Places Mode ======== */
                <>
                  {/* Current selection (highlighted) */}
                  {currentLabel ? (
                    <View
                      style={[
                        styles.dropdownItem,
                        styles.dropdownItemSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.dropdownItemIconWrap,
                          styles.dropdownItemIconBlue,
                        ]}
                      >
                        <MapPin size={16} color="#3B82F6" />
                      </View>
                      <Text
                        style={[styles.dropdownItemName, styles.dropdownItemNameBlue]}
                        numberOfLines={1}
                      >
                        {currentLabel}
                      </Text>
                      <Check size={16} color="#3B82F6" />
                    </View>
                  ) : null}

                  {/* Nearby places */}
                  {nearbyPlaces
                    .slice(0, DROPDOWN_MAX_NEARBY)
                    .map((place) => {
                      // Skip if same as current label
                      if (place.name === currentLabel) return null;
                      const PlaceIcon = getIconForTypes(place.types);
                      return (
                        <Pressable
                          key={place.placeId}
                          style={styles.dropdownItem}
                          onPress={() =>
                            selectPlace(place.name, place.types)
                          }
                        >
                          <View style={styles.dropdownItemIconWrap}>
                            <PlaceIcon size={16} color="#64748B" />
                          </View>
                          <View style={styles.dropdownItemBody}>
                            <Text
                              style={styles.dropdownItemName}
                              numberOfLines={1}
                            >
                              {place.name}
                            </Text>
                            <Text style={styles.dropdownItemDetail}>
                              {getPlaceTypeLabel(place.types)} ·{" "}
                              {formatDistance(place.distanceM)}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}

                  {/* Street name option */}
                  {streetName && streetName !== currentLabel && (
                    <Pressable
                      style={styles.dropdownItem}
                      onPress={() => selectPlace(streetName)}
                    >
                      <View style={styles.dropdownItemIconWrap}>
                        <Text style={styles.dropdownItemEmoji}>🛣️</Text>
                      </View>
                      <View style={styles.dropdownItemBody}>
                        <Text
                          style={styles.dropdownItemName}
                          numberOfLines={1}
                        >
                          {streetName}
                        </Text>
                        <Text style={styles.dropdownItemDetail}>Street</Text>
                      </View>
                    </Pressable>
                  )}

                  {/* Neighborhood option */}
                  {neighborhoodRaw && neighborhoodRaw !== currentLabel && (
                    <Pressable
                      style={styles.dropdownItem}
                      onPress={() => selectPlace(neighborhoodRaw)}
                    >
                      <View style={styles.dropdownItemIconWrap}>
                        <Text style={styles.dropdownItemEmoji}>🏘️</Text>
                      </View>
                      <View style={styles.dropdownItemBody}>
                        <Text
                          style={styles.dropdownItemName}
                          numberOfLines={1}
                        >
                          {neighborhoodRaw}
                        </Text>
                        <Text style={styles.dropdownItemDetail}>
                          Neighborhood
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {/* Combined fuzzy label fallback (e.g., "Oak Street, Crestwood" or "Near Downtown") */}
                  {neighborhoodName &&
                    neighborhoodName !== currentLabel &&
                    neighborhoodName !== streetName &&
                    neighborhoodName !== neighborhoodRaw && (
                    <Pressable
                      style={styles.dropdownItem}
                      onPress={() => selectPlace(neighborhoodName)}
                    >
                      <View style={styles.dropdownItemIconWrap}>
                        <MapPin size={16} color="#94A3B8" />
                      </View>
                      <Text
                        style={[
                          styles.dropdownItemName,
                          { color: "#94A3B8" },
                        ]}
                        numberOfLines={1}
                      >
                        {neighborhoodName}
                      </Text>
                    </Pressable>
                  )}

                  {/* Loading state */}
                  {isLoadingSuggestions && (
                    <View style={styles.dropdownLoading}>
                      <ActivityIndicator color="#64748B" size="small" />
                      <Text style={styles.dropdownLoadingText}>
                        Finding places...
                      </Text>
                    </View>
                  )}

                  {/* Empty state (no nearby places, not loading) */}
                  {!isLoadingSuggestions &&
                    nearbyPlaces.length === 0 &&
                    !neighborhoodName && (
                      <Text style={styles.dropdownEmptyText}>
                        No nearby places found
                      </Text>
                    )}

                  {/* Divider + "Other..." */}
                  <View style={styles.dropdownDivider} />
                  <Pressable
                    style={styles.dropdownItem}
                    onPress={startEditing}
                  >
                    <View
                      style={[
                        styles.dropdownItemIconWrap,
                        styles.dropdownItemIconMuted,
                      ]}
                    >
                      <Pencil size={16} color="#6B7280" />
                    </View>
                    <Text
                      style={[
                        styles.dropdownItemName,
                        { color: "#6B7280" },
                      ]}
                    >
                      Other...
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ================================================================
          2. Nearby Quick Picks — horizontal pill row
          ================================================================ */}
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
                  handlePillSelect({
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
                  {" · "}
                  {getPlaceTypeLabel(place.types)}
                </Text>
              </Pressable>
            ))}
            {streetName && (
              <Pressable
                onPress={() => onLabelChange(streetName)}
                style={styles.streetPill}
              >
                <Text style={styles.streetPillEmoji}>🛣️</Text>
                <Text style={styles.streetPillText} numberOfLines={1}>
                  {streetName}
                </Text>
              </Pressable>
            )}
            {neighborhoodRaw && (
              <Pressable
                onPress={() => onLabelChange(neighborhoodRaw)}
                style={styles.neighborhoodPill}
              >
                <Text style={styles.streetPillEmoji}>🏘️</Text>
                <Text style={styles.neighborhoodText} numberOfLines={1}>
                  {neighborhoodRaw}
                </Text>
              </Pressable>
            )}
            {neighborhoodName && !streetName && !neighborhoodRaw && (
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

      {/* ================================================================
          3. "Always use this name" Toggle
          ================================================================ */}
      {!hideAlwaysUseToggle && geohash7 != null && (
        <View style={styles.section}>
          <View style={styles.toggleCard}>
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

      {/* ================================================================
          4. Category Picker
          ================================================================ */}
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
                    if (cat === "Other") {
                      if (isActive) {
                        // Deselecting "Other" — clear custom name input
                        onCategoryChange(null);
                        setShowCustomNameInput(false);
                        setCustomName("");
                      } else {
                        // Selecting "Other" — show custom name input, don't set label to "Other"
                        onCategoryChange("Other");
                        setShowCustomNameInput(true);
                        // Pre-fill with current label if it's not a standard category
                        const isStandardCategory = CATEGORIES.some(
                          (c) => c !== "Other" && c === currentLabel,
                        );
                        setCustomName(isStandardCategory ? "" : currentLabel);
                        setTimeout(() => customNameInputRef.current?.focus(), 100);
                      }
                    } else {
                      const newCat = isActive ? null : cat;
                      onCategoryChange(newCat);
                      if (newCat) {
                        onLabelChange(newCat);
                      }
                      // Hide custom name input when selecting a standard category
                      setShowCustomNameInput(false);
                      setCustomName("");
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
                    {cat === "Other" ? "Other..." : cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Custom name input — shown when "Other" is selected */}
          {showCustomNameInput && (
            <View style={styles.customNameContainer}>
              <TextInput
                ref={customNameInputRef}
                style={styles.customNameInput}
                value={customName}
                onChangeText={(text) => {
                  setCustomName(text);
                  if (text.trim()) {
                    onLabelChange(text.trim());
                  }
                }}
                placeholder='Enter custom name (e.g., Grandma&apos;s House)'
                placeholderTextColor="#94A3B8"
                returnKeyType="done"
                autoCapitalize="words"
                onSubmitEditing={() => {
                  if (customName.trim()) {
                    onLabelChange(customName.trim());
                  }
                  Keyboard.dismiss();
                }}
              />
              {customName.trim().length > 0 && (
                <View style={styles.customNameCheckWrap}>
                  <Check size={18} color="#34C759" />
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ================================================================
          5. Radius Toggle
          ================================================================ */}
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

      {/* ================================================================
          6. Mini-Map
          ================================================================ */}
      {staticMapUrl && (
        <Image
          source={{ uri: staticMapUrl }}
          style={styles.miniMap}
          onError={() => setMapError(true)}
        />
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // ---- Card ----
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

  // ---- Label Row ----
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
  },
  labelTextWrapper: {
    flex: 1,
  },
  labelText: {
    fontSize: 16,
    color: "#111827",
    paddingVertical: 12,
  },
  labelPlaceholder: {
    color: "#94A3B8",
  },
  labelInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 12,
    padding: 0,
  },

  // ---- Inline Dropdown ----
  dropdown: {
    paddingBottom: 4,
  },
  dropdownScroll: {
    maxHeight: 320,
    paddingHorizontal: 8,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 8,
    marginVertical: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  dropdownItemSelected: {
    backgroundColor: "#EFF6FF",
  },
  dropdownItemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownItemIconBlue: {
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  dropdownItemIconGreen: {
    backgroundColor: "rgba(52,199,89,0.1)",
  },
  dropdownItemIconMuted: {
    backgroundColor: "rgba(107,114,128,0.1)",
  },
  dropdownItemBody: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    flexShrink: 1,
  },
  dropdownItemNameBlue: {
    color: "#3B82F6",
    flex: 1,
  },
  dropdownItemNameGreen: {
    fontSize: 15,
    fontWeight: "600",
    color: "#34C759",
  },
  dropdownItemDetail: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 1,
  },
  dropdownLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  dropdownLoadingText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  dropdownEmptyText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 16,
  },

  // ---- Loading ----
  loadingIndicator: {
    paddingVertical: 12,
  },

  // ---- Pill Row ----
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },

  // ---- Nearby suggestion pills ----
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

  // ---- Street name pill ----
  streetPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 4,
  },
  streetPillEmoji: {
    fontSize: 12,
  },
  streetPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
  },

  // ---- Neighborhood fallback pill ----
  neighborhoodPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  neighborhoodText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
  },

  // ---- Dropdown emoji icon ----
  dropdownItemEmoji: {
    fontSize: 16,
    textAlign: "center" as const,
  },

  // ---- Toggle ----
  toggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
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

  // ---- Category / Radius pills ----
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

  // ---- Custom Name Input ----
  customNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  customNameInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingVertical: 10,
    padding: 0,
  },
  customNameCheckWrap: {
    marginLeft: 8,
    opacity: 0.8,
  },

  // ---- Mini-map ----
  miniMap: {
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
  },
});
