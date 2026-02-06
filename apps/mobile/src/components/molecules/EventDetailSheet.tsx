/**
 * EventDetailSheet — slide-up modal for viewing timeline event details
 * and submitting feedback.
 *
 * Follows the same animated slide-up pattern as SessionDetailModal.
 */

import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  Clock,
  Smartphone,
  Mail,
  Hash,
  Phone,
  Calendar,
  Globe,
  MessageSquare,
  CheckCircle,
  XCircle,
  Layers,
  type LucideIcon,
} from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { formatTimeRange, formatDuration } from "@/lib/utils/time-format";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import {
  EVENT_KIND_COLORS,
  UNPRODUCTIVE_TINT,
} from "@/lib/types/timeline-event";

// ============================================================================
// Helpers
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

interface EventDetailSheetProps {
  event: TimelineEvent | null;
  visible: boolean;
  onClose: () => void;
  onMarkAccurate?: (summaryIds: string[]) => void;
  onNeedsCorrection?: (summaryIds: string[]) => void;
}

export const EventDetailSheet = ({
  event,
  visible,
  onClose,
  onMarkAccurate,
  onNeedsCorrection,
}: EventDetailSheetProps) => {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;

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

  if (!event) return null;

  const isUnproductive = event.productivity === "unproductive";
  const tint = isUnproductive
    ? UNPRODUCTIVE_TINT
    : EVENT_KIND_COLORS[event.kind] ?? EVENT_KIND_COLORS.app;
  const iconComponent = KIND_ICONS[event.kind] ?? Smartphone;

  // Scheduled vs actual comparison
  const showScheduledComparison =
    event.scheduledEvent && event.actualEvent;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

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
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>Event Details</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Icon icon={X} size={24} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          >
            {/* Icon + Title */}
            <View style={styles.section}>
              <View style={styles.card}>
                <View style={styles.titleRow}>
                  {/* Solid circle icon */}
                  <View style={[styles.iconCircle, { backgroundColor: tint.dark }]}>
                    <Icon icon={iconComponent} size={20} color={tint.iconColor} />
                  </View>
                  <View style={styles.titleText}>
                    <Text style={styles.kindLabel}>{event.kindLabel}</Text>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.subtitle ? (
                      <Text style={styles.subtitle}>{event.subtitle}</Text>
                    ) : null}
                  </View>
                </View>

                {isUnproductive && (
                  <View style={styles.unproductiveBanner}>
                    <Text style={styles.unproductiveText}>Unproductive</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Time */}
            <View style={styles.section}>
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Icon icon={Clock} size={18} color="#64748B" />
                  <View style={styles.infoTextCol}>
                    <Text style={styles.infoLabel}>
                      {formatTimeRange(event.startTime, event.endTime)}
                    </Text>
                    <Text style={styles.infoSub}>
                      {formatDuration(event.durationMinutes)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Overlaps */}
            {(event.overlaps?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.card}>
                  <View style={styles.infoRow}>
                    <Icon icon={Layers} size={18} color="#F97316" />
                    <Text style={[styles.infoLabel, { marginLeft: 12 }]}>
                      Overlaps with {event.overlaps!.length} other event
                      {event.overlaps!.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Category / Productivity */}
            {event.appCategory && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>CATEGORY</Text>
                <View style={styles.card}>
                  <View style={styles.infoRow}>
                    <View
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isUnproductive
                            ? "#FEE2E2"
                            : "#F1F5F9",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          {
                            color: isUnproductive ? "#DC2626" : "#475569",
                          },
                        ]}
                      >
                        {event.appCategory.charAt(0).toUpperCase() +
                          event.appCategory.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Scheduled vs Actual comparison */}
            {showScheduledComparison && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SCHEDULED VS ACTUAL</Text>
                <View style={styles.card}>
                  <View style={styles.compRow}>
                    <Text style={styles.compLabel}>Scheduled</Text>
                    <Text style={styles.compValue}>
                      {event.scheduledEvent!.title} · {formatDuration(event.scheduledEvent!.duration)}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.compRow}>
                    <Text style={styles.compLabel}>Actual</Text>
                    <Text style={styles.compValue}>
                      {event.actualEvent!.title} · {formatDuration(event.actualEvent!.duration)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Feedback Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FEEDBACK</Text>
              <View style={styles.card}>
                <View style={styles.feedbackRow}>
                  <Pressable
                    style={styles.feedbackBtn}
                    onPress={() => onMarkAccurate?.(event.summaryIds)}
                  >
                    <Icon icon={CheckCircle} size={20} color="#16A34A" />
                    <Text style={[styles.feedbackLabel, { color: "#16A34A" }]}>
                      Accurate
                    </Text>
                  </Pressable>

                  <View style={styles.feedbackDivider} />

                  <Pressable
                    style={styles.feedbackBtn}
                    onPress={() => onNeedsCorrection?.(event.summaryIds)}
                  >
                    <Icon icon={XCircle} size={20} color="#DC2626" />
                    <Text style={[styles.feedbackLabel, { color: "#DC2626" }]}>
                      Incorrect
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: "#94A3B8",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },

  // Title
  titleRow: {
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
  titleText: {
    flex: 1,
    marginLeft: 14,
  },
  kindLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },

  // Unproductive banner
  unproductiveBanner: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    alignItems: "center",
  },
  unproductiveText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },

  // Info rows
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  infoTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 15,
    color: "#111827",
  },
  infoSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },

  // Category
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Comparison
  compRow: {
    padding: 14,
  },
  compLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 4,
  },
  compValue: {
    fontSize: 15,
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginLeft: 14,
  },

  // Feedback
  feedbackRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  feedbackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  feedbackLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  feedbackDivider: {
    width: 1,
    backgroundColor: "#E5E5EA",
  },
});
