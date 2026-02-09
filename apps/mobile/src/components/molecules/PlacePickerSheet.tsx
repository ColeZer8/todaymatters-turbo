/**
 * PlacePickerSheet Component
 *
 * Bottom sheet for disambiguating between multiple place options from
 * the location-place-lookup edge function. Allows users to:
 * - Select the correct place from alternatives
 * - Label the place with a category (Home, Work, Gym, Other)
 * - Enter a custom name for "Other"
 * - Save the selection to user_places
 */

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  MapPin,
  Check,
  Home,
  Briefcase,
  Dumbbell,
  Coffee,
  ShoppingBag,
  Utensils,
  Church,
  GraduationCap,
  Heart,
  Building2,
  Fuel,
  type LucideIcon,
} from "lucide-react-native";

// ============================================================================
// Theme Colors
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
};

// ============================================================================
// Type Definitions
// ============================================================================

export interface PlaceAlternative {
  placeName: string;
  googlePlaceId: string | null;
  vicinity: string | null;
  types: string[] | null;
  distanceMeters: number | null;
}

export interface PlaceSelection {
  placeName: string;
  googlePlaceId: string | null;
  category: "home" | "work" | "gym" | "other" | null;
  isCustom: boolean;
}

export interface PlacePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (selection: PlaceSelection) => void;
  /** The auto-selected place name */
  currentPlace: string;
  /** Alternative places from edge function */
  alternatives: PlaceAlternative[];
  /** Location coordinates for creating user_place */
  latitude: number;
  longitude: number;
  /** Time range for context */
  startTime: Date;
  endTime: Date;
}

// ============================================================================
// Category Pills
// ============================================================================

type PlaceCategory = "home" | "work" | "gym" | "other";

interface CategoryOption {
  key: PlaceCategory;
  label: string;
  emoji: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { key: "home", label: "Home", emoji: "🏠" },
  { key: "work", label: "Work", emoji: "💼" },
  { key: "gym", label: "Gym", emoji: "🏋️" },
  { key: "other", label: "Other", emoji: "📌" },
];

// ============================================================================
// Place Type Icon Mapping
// ============================================================================

/**
 * Map Google place types to Lucide icons.
 * Priority: first matching type wins.
 */
function getIconForPlaceTypes(types: string[] | null): LucideIcon {
  if (!types || types.length === 0) return MapPin;

  const typeStr = types.join(",").toLowerCase();

  // Religious
  if (typeStr.includes("church") || typeStr.includes("mosque") || typeStr.includes("synagogue")) {
    return Church;
  }

  // Food & Drink
  if (typeStr.includes("restaurant") || typeStr.includes("food")) {
    return Utensils;
  }
  if (typeStr.includes("cafe") || typeStr.includes("coffee")) {
    return Coffee;
  }

  // Shopping
  if (typeStr.includes("store") || typeStr.includes("shopping")) {
    return ShoppingBag;
  }

  // Education
  if (typeStr.includes("school") || typeStr.includes("university")) {
    return GraduationCap;
  }

  // Health
  if (typeStr.includes("hospital") || typeStr.includes("doctor") || typeStr.includes("pharmacy")) {
    return Heart;
  }

  // Gas
  if (typeStr.includes("gas_station") || typeStr.includes("fuel")) {
    return Fuel;
  }

  // Gym
  if (typeStr.includes("gym")) {
    return Dumbbell;
  }

  // Work/Office
  if (typeStr.includes("office")) {
    return Briefcase;
  }

  // Generic building
  if (typeStr.includes("building") || typeStr.includes("establishment")) {
    return Building2;
  }

  return MapPin;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  if (meters < 1000) {
    return `${Math.round(meters)}m away`;
  }
  return `${(meters / 1000).toFixed(1)}km away`;
}

// ============================================================================
// Main Component
// ============================================================================

export function PlacePickerSheet({
  visible,
  onClose,
  onSave,
  currentPlace,
  alternatives,
  startTime,
  endTime,
}: PlacePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;

  // Selection state
  const [selectedPlace, setSelectedPlace] = useState<string>(currentPlace);
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | null>(null);
  const [customName, setCustomName] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Animation
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

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedPlace(currentPlace);
      setSelectedGooglePlaceId(null);
      setSelectedCategory(null);
      setCustomName("");
      setShowCustomInput(false);
    }
  }, [visible, currentPlace]);

  // Build options list: current place + alternatives + "Other"
  const placeOptions = [
    {
      placeName: currentPlace,
      googlePlaceId: null,
      vicinity: null,
      types: null,
      distanceMeters: null,
      isAuto: true,
    },
    ...alternatives.map((alt) => ({ ...alt, isAuto: false })),
  ];

  const handlePlaceSelect = (
    placeName: string,
    googlePlaceId: string | null,
    isOther: boolean,
  ) => {
    setSelectedPlace(placeName);
    setSelectedGooglePlaceId(googlePlaceId);
    setShowCustomInput(isOther);
    if (isOther) {
      setCustomName("");
    }
  };

  const handleSave = () => {
    const finalName = showCustomInput && customName.trim() ? customName.trim() : selectedPlace;

    const selection: PlaceSelection = {
      placeName: finalName,
      googlePlaceId: selectedGooglePlaceId,
      category: selectedCategory,
      isCustom: showCustomInput,
    };

    onSave(selection);
  };

  const canSave = showCustomInput ? customName.trim().length > 0 : true;

  const timeRange = `${formatTime(startTime)} – ${formatTime(endTime)}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <Pressable style={styles.backdropPressable} onPress={onClose} />

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
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Where were you?</Text>
              <Text style={styles.headerSubtitle}>{timeRange}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Place Options */}
            <View style={styles.section}>
              {placeOptions.map((option, index) => {
                const isSelected = selectedPlace === option.placeName && !showCustomInput;
                const Icon = getIconForPlaceTypes(option.types);

                return (
                  <Pressable
                    key={`${option.placeName}-${index}`}
                    style={[
                      styles.placeOption,
                      isSelected && styles.placeOptionSelected,
                    ]}
                    onPress={() =>
                      handlePlaceSelect(option.placeName, option.googlePlaceId, false)
                    }
                  >
                    <View
                      style={[
                        styles.placeIconContainer,
                        { backgroundColor: COLORS.accentLight },
                      ]}
                    >
                      <Icon size={18} color={COLORS.accent} />
                    </View>

                    <View style={styles.placeTextContainer}>
                      <View style={styles.placeNameRow}>
                        <Text style={styles.placeName} numberOfLines={1}>
                          {option.placeName}
                        </Text>
                        {option.isAuto && (
                          <View style={styles.autoBadge}>
                            <Text style={styles.autoBadgeText}>Auto</Text>
                          </View>
                        )}
                      </View>
                      {option.vicinity && (
                        <Text style={styles.placeVicinity} numberOfLines={1}>
                          {option.vicinity}
                        </Text>
                      )}
                      {option.distanceMeters !== null && (
                        <Text style={styles.placeDistance}>
                          {formatDistance(option.distanceMeters)}
                        </Text>
                      )}
                    </View>

                    {isSelected && (
                      <View style={styles.checkContainer}>
                        <Check size={20} color={COLORS.accent} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* "Other" Option */}
              <Pressable
                style={[
                  styles.placeOption,
                  showCustomInput && styles.placeOptionSelected,
                ]}
                onPress={() => handlePlaceSelect("Other", null, true)}
              >
                <View
                  style={[
                    styles.placeIconContainer,
                    { backgroundColor: COLORS.accentLight },
                  ]}
                >
                  <MapPin size={18} color={COLORS.accent} />
                </View>

                <View style={styles.placeTextContainer}>
                  <Text style={styles.placeName}>Other</Text>
                  <Text style={styles.placeVicinity}>Enter a custom name</Text>
                </View>

                {showCustomInput && (
                  <View style={styles.checkContainer}>
                    <Check size={20} color={COLORS.accent} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            </View>

            {/* Custom Name Input (shown when "Other" is selected) */}
            {showCustomInput && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>CUSTOM NAME</Text>
                <TextInput
                  style={styles.customInput}
                  placeholder="Enter place name..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={customName}
                  onChangeText={setCustomName}
                  autoFocus
                  returnKeyType="done"
                />
              </View>
            )}

            {/* Category Pills (shown when a place is selected) */}
            {(selectedPlace || showCustomInput) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>LABEL AS (OPTIONAL)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScrollContent}
                >
                  {CATEGORY_OPTIONS.map((cat) => {
                    const isSelected = selectedCategory === cat.key;
                    return (
                      <Pressable
                        key={cat.key}
                        style={[
                          styles.categoryPill,
                          isSelected && styles.categoryPillSelected,
                        ]}
                        onPress={() =>
                          setSelectedCategory(isSelected ? null : cat.key)
                        }
                      >
                        <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                        <Text
                          style={[
                            styles.categoryLabel,
                            isSelected && styles.categoryLabelSelected,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Save Button */}
            <Pressable
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
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
    paddingBottom: 12,
  },
  headerSpacer: {
    width: 40,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    alignItems: "flex-end",
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },

  // Place Options
  placeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  placeOptionSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.overlay,
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
  placeVicinity: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  placeDistance: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  checkContainer: {
    marginLeft: 12,
  },

  // Custom Input
  customInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Category Pills
  categoryScrollContent: {
    gap: 10,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  categoryPillSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.overlay,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  categoryLabelSelected: {
    color: COLORS.textPrimary,
  },

  // Save Button
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
});
