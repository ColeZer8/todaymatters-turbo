/**
 * EventEditModal — slide-up modal for editing timeline event properties.
 *
 * Follows the same animated slide-up pattern as SessionDetailModal.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  Alert,
  Switch,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  Smartphone,
  Mail,
  Hash,
  Phone,
  Calendar,
  Globe,
  MessageSquare,
  ChevronRight,
  MapPin,
  type LucideIcon,
} from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { formatTimeShort, formatDuration, formatTimeRange } from "@/lib/utils/time-format";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import { EVENT_KIND_COLORS, UNPRODUCTIVE_TINT } from "@/lib/types/timeline-event";
import { TimePickerModal } from "@/components/organisms/TimePickerModal";
import {
  fetchTopLevelCategories,
  fetchSubcategories,
  type ActivityCategory,
} from "@/lib/supabase/services/activity-categories";
import { useGoalsStore } from "@/stores/goals-store";

// ============================================================================
// Types
// ============================================================================

export interface EventUpdates {
  title?: string;
  category?: string;
  subcategory?: string;
  goal?: string;
  startTime?: Date;
  endTime?: Date;
  locationLabel?: string;
}

export interface EventEditModalProps {
  event: TimelineEvent | null;
  visible: boolean;
  onClose: () => void;
  onSave: (eventId: string, updates: EventUpdates) => void;
  onLocationRename?: (geohash7: string, newLabel: string, alwaysUse: boolean) => void;
  userId?: string;
  allBlockEvents?: TimelineEvent[];
  locationLabel?: string;
  geohash7?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const KIND_ICONS: Record<string, LucideIcon> = {
  app: Smartphone,
  email: Mail,
  slack_message: Hash,
  phone_call: Phone,
  meeting: Calendar,
  sms: MessageSquare,
  website: Globe,
  scheduled: Calendar,
};

// ============================================================================
// Component
// ============================================================================

export const EventEditModal = ({
  event,
  visible,
  onClose,
  onSave,
  onLocationRename,
  userId,
  allBlockEvents,
  locationLabel,
  geohash7,
}: EventEditModalProps) => {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;

  // Editable state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [goal, setGoal] = useState("");

  // Time editing state
  const [editedStartTime, setEditedStartTime] = useState<Date | null>(null);
  const [editedEndTime, setEditedEndTime] = useState<Date | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Category data
  const [topCategories, setTopCategories] = useState<ActivityCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ActivityCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Goal data
  const goals = useGoalsStore((s) => s.goals);

  // Location editing state
  const [editedLocation, setEditedLocation] = useState("");
  const [alwaysUseLocation, setAlwaysUseLocation] = useState(false);

  // Reset state when event changes
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setCategory(event.appCategory ?? "");
      setSubcategory("");
      setGoal("");
      setEditedStartTime(null);
      setEditedEndTime(null);
      setSelectedCategoryId(null);
      setSubcategories([]);
      setEditedLocation(locationLabel ?? "");
      setAlwaysUseLocation(false);
    }
  }, [event, locationLabel]);

  // Fetch top-level categories when modal opens
  useEffect(() => {
    if (visible && userId) {
      fetchTopLevelCategories(userId)
        .then(setTopCategories)
        .catch(() => setTopCategories([]));
    }
  }, [visible, userId]);

  // Fetch subcategories when a top-level category is selected
  useEffect(() => {
    if (!selectedCategoryId || !userId) {
      setSubcategories([]);
      return;
    }
    fetchSubcategories(userId, selectedCategoryId)
      .then(setSubcategories)
      .catch(() => setSubcategories([]));
  }, [selectedCategoryId, userId]);

  // Animation
  useEffect(() => {
    if (visible && event) {
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
  }, [visible, event, backdropOpacity, panelTranslateY]);

  // Derived display times
  const displayStartTime = editedStartTime ?? event?.startTime ?? new Date();
  const displayEndTime = editedEndTime ?? event?.endTime ?? new Date();
  const durationMin = Math.max(
    0,
    Math.round((displayEndTime.getTime() - displayStartTime.getTime()) / 60000),
  );

  // Determine what changed
  const hasChanges = useMemo(() => {
    if (!event) return false;
    if (title !== event.title) return true;
    if (category !== (event.appCategory ?? "")) return true;
    if (subcategory !== "") return true;
    if (goal !== "") return true;
    if (editedStartTime !== null) return true;
    if (editedEndTime !== null) return true;
    if (editedLocation !== (locationLabel ?? "")) return true;
    return false;
  }, [event, title, category, subcategory, goal, editedStartTime, editedEndTime, editedLocation, locationLabel]);

  // Build updates object with only changed fields
  const buildUpdates = useCallback((): EventUpdates => {
    if (!event) return {};
    const updates: EventUpdates = {};
    if (title !== event.title) updates.title = title;
    if (category !== (event.appCategory ?? "")) updates.category = category;
    if (subcategory !== "") updates.subcategory = subcategory;
    if (goal !== "") updates.goal = goal;
    if (editedStartTime !== null) updates.startTime = editedStartTime;
    if (editedEndTime !== null) updates.endTime = editedEndTime;
    if (editedLocation !== (locationLabel ?? "")) updates.locationLabel = editedLocation;
    return updates;
  }, [event, title, category, subcategory, goal, editedStartTime, editedEndTime, editedLocation, locationLabel]);

  // Close with reverse animation
  const handleClose = useCallback(() => {
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

  // Save handler
  const handleSave = useCallback(() => {
    if (!event || !hasChanges) return;

    const updates = buildUpdates();
    const categoryChanged = updates.category !== undefined;

    // Handle location rename
    if (alwaysUseLocation && geohash7 && editedLocation && onLocationRename) {
      onLocationRename(geohash7, editedLocation, true);
    }

    if (categoryChanged) {
      Alert.alert(
        "Always use these settings?",
        "Apply this category to all similar events?",
        [
          {
            text: "Just this time",
            style: "cancel",
            onPress: () => {
              onSave(event.id, updates);
              handleClose();
            },
          },
          {
            text: "Yes",
            onPress: () => {
              onSave(event.id, updates);
              handleClose();
            },
          },
        ]
      );
    } else {
      onSave(event.id, updates);
      handleClose();
    }
  }, [event, hasChanges, buildUpdates, onSave, handleClose, alwaysUseLocation, geohash7, editedLocation, onLocationRename]);

  // Category select handler
  const handleCategorySelect = useCallback(
    (cat: ActivityCategory) => {
      setCategory(cat.name);
      if (selectedCategoryId === cat.id) {
        // Deselect: clear subcategory row
        setSelectedCategoryId(null);
        setSubcategory("");
        setSubcategories([]);
      } else {
        setSelectedCategoryId(cat.id);
        setSubcategory("");
      }
    },
    [selectedCategoryId],
  );

  // Overlap event lookup
  const overlappingEvents = useMemo(() => {
    if (!event?.overlaps?.length || !allBlockEvents?.length) return [];
    const overlapSet = new Set(event.overlaps);
    return allBlockEvents.filter((e) => overlapSet.has(e.id));
  }, [event?.overlaps, allBlockEvents]);

  if (!event) return null;

  const isUnproductive = event.productivity === "unproductive";
  const tint = isUnproductive
    ? UNPRODUCTIVE_TINT
    : EVENT_KIND_COLORS[event.kind] ?? EVENT_KIND_COLORS.app;
  const iconComponent = KIND_ICONS[event.kind] ?? Smartphone;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{ translateY: panelTranslateY }],
              paddingTop: Platform.OS === "android" ? insets.top : 0,
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleRow}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>Edit Event</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Icon icon={X} size={24} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Icon + Kind */}
            <View style={styles.section}>
              <View style={styles.card}>
                <View style={styles.iconKindRow}>
                  <View style={[styles.iconCircle, { backgroundColor: tint.dark }]}>
                    <Icon icon={iconComponent} size={20} color={tint.iconColor} />
                  </View>
                  <Text style={styles.kindLabel}>{event.kindLabel?.toUpperCase() ?? event.kind.toUpperCase()}</Text>
                </View>
              </View>
            </View>

            {/* Title Field */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TITLE</Text>
              <View style={styles.card}>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Event title"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Time Range */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TIME</Text>
              <View style={styles.card}>
                <Pressable
                  style={styles.timeRow}
                  onPress={() => {
                    setShowStartTimePicker(true);
                    setShowEndTimePicker(false);
                  }}
                >
                  <Text style={styles.timeLabel}>Start</Text>
                  <View style={styles.timeValueRow}>
                    <Text style={styles.timeValue}>
                      {formatTimeShort(displayStartTime)}
                    </Text>
                    <Icon icon={ChevronRight} size={16} color="#94A3B8" />
                  </View>
                </Pressable>
                <View style={styles.divider} />
                <Pressable
                  style={styles.timeRow}
                  onPress={() => {
                    setShowEndTimePicker(true);
                    setShowStartTimePicker(false);
                  }}
                >
                  <Text style={styles.timeLabel}>End</Text>
                  <View style={styles.timeValueRow}>
                    <Text style={styles.timeValue}>
                      {formatTimeShort(displayEndTime)}
                    </Text>
                    <Icon icon={ChevronRight} size={16} color="#94A3B8" />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Duration */}
            <View style={styles.section}>
              <View style={styles.card}>
                <View style={styles.durationRow}>
                  <Text style={styles.durationText}>
                    Duration: {formatDuration(durationMin)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Overlaps Banner */}
            {overlappingEvents.length > 0 && (
              <View style={styles.section}>
                <View style={styles.overlapBanner}>
                  <Text style={styles.overlapTitle}>
                    Overlaps with {overlappingEvents.length} other event
                    {overlappingEvents.length > 1 ? "s" : ""}
                  </Text>
                  {overlappingEvents.map((oe) => {
                    const oeIcon = KIND_ICONS[oe.kind] ?? Smartphone;
                    return (
                      <View key={oe.id} style={styles.overlapItem}>
                        <Icon icon={oeIcon} size={14} color="#92400E" />
                        <Text style={styles.overlapItemText} numberOfLines={1}>
                          {oe.title} - {formatTimeRange(oe.startTime, oe.endTime)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Category Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CATEGORY</Text>
              {topCategories.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {topCategories.map((cat) => {
                    const isActive = category === cat.name;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => handleCategorySelect(cat)}
                        style={[
                          styles.pill,
                          isActive ? styles.pillActive : styles.pillInactive,
                        ]}
                      >
                        {cat.color && (
                          <View
                            style={[
                              styles.pillColorDot,
                              { backgroundColor: isActive ? "#FFFFFF" : cat.color },
                            ]}
                          />
                        )}
                        <Text
                          style={[
                            styles.pillText,
                            isActive ? styles.pillTextActive : styles.pillTextInactive,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  <View style={[styles.pill, styles.pillInactive]}>
                    <Text style={[styles.pillText, styles.pillTextInactive]}>
                      {category || "No categories"}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Subcategory */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SUBCATEGORY</Text>
              {selectedCategoryId && subcategories.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {subcategories.map((sub) => {
                    const isActive = subcategory === sub.name;
                    return (
                      <Pressable
                        key={sub.id}
                        onPress={() => setSubcategory(isActive ? "" : sub.name)}
                        style={[
                          styles.pill,
                          isActive ? styles.pillActive : styles.pillInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            isActive ? styles.pillTextActive : styles.pillTextInactive,
                          ]}
                        >
                          {sub.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : selectedCategoryId && subcategories.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyHint}>No subcategories</Text>
                </View>
              ) : (
                <View style={styles.card}>
                  <TextInput
                    style={styles.textInput}
                    value={subcategory}
                    onChangeText={setSubcategory}
                    placeholder="Select a category first, or type here..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              )}
            </View>

            {/* Goal */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>GOAL</Text>
              {goals.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {goals.map((g) => {
                    const isActive = goal === g.title;
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => setGoal(isActive ? "" : g.title)}
                        style={[
                          styles.pill,
                          isActive ? styles.pillActive : styles.pillInactive,
                        ]}
                      >
                        <View
                          style={[
                            styles.goalColorDot,
                            { backgroundColor: isActive ? "#FFFFFF" : g.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.pillText,
                            isActive ? styles.pillTextActive : styles.pillTextInactive,
                          ]}
                          numberOfLines={1}
                        >
                          {g.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.card}>
                  <TextInput
                    style={styles.textInput}
                    value={goal}
                    onChangeText={setGoal}
                    placeholder="Associate with a goal..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              )}
            </View>

            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LOCATION</Text>
              <View style={styles.card}>
                <View style={styles.locationRow}>
                  <Icon icon={MapPin} size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.locationInput}
                    value={editedLocation}
                    onChangeText={setEditedLocation}
                    placeholder="Location name..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {geohash7 && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.alwaysUseRow}>
                      <Text style={styles.alwaysUseLabel}>Always use this name</Text>
                      <Switch
                        value={alwaysUseLocation}
                        onValueChange={setAlwaysUseLocation}
                        trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Save Button */}
            <View style={styles.section}>
              <Pressable
                onPress={handleSave}
                disabled={!hasChanges}
                style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
              >
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>

      {/* Time Picker Modals */}
      <TimePickerModal
        visible={showStartTimePicker}
        label="Start Time"
        initialTime={displayStartTime}
        onConfirm={(time) => {
          setEditedStartTime(time);
          setShowStartTimePicker(false);
        }}
        onClose={() => setShowStartTimePicker(false)}
      />
      <TimePickerModal
        visible={showEndTimePicker}
        label="End Time"
        initialTime={displayEndTime}
        onConfirm={(time) => {
          setEditedEndTime(time);
          setShowEndTimePicker(false);
        }}
        onClose={() => setShowEndTimePicker(false)}
      />
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const ICON_SIZE = 44;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    backgroundColor: "#F2F2F7",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  dragHandleRow: {
    alignItems: "center",
    paddingTop: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  closeBtn: {
    width: 40,
    alignItems: "flex-end",
  },

  // Sections
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.88,
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },

  // Icon + Kind
  iconKindRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  kindLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.88,
    color: "#94A3B8",
    marginLeft: 14,
  },

  // Text inputs
  textInput: {
    fontSize: 16,
    color: "#111827",
    padding: 16,
  },

  // Time rows
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  timeLabel: {
    fontSize: 15,
    color: "#64748B",
  },
  timeValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginLeft: 16,
  },

  // Duration
  durationRow: {
    padding: 16,
  },
  durationText: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },

  // Overlaps
  overlapBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
  },
  overlapTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 8,
  },
  overlapItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  overlapItemText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#92400E",
    flex: 1,
  },

  // Category / Goal pills
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
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
  pillColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  goalColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Empty hint text
  emptyHint: {
    fontSize: 14,
    color: "#94A3B8",
    padding: 16,
  },

  // Location
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 12,
  },
  alwaysUseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alwaysUseLabel: {
    fontSize: 15,
    color: "#64748B",
  },

  // Save button
  saveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
