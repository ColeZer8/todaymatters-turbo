/**
 * Activity Timeline Screen
 *
 * Production page for viewing the day's activity as location blocks
 * with an Actual / Scheduled / Both filter toggle.
 * Migrated from dev/pipeline-test with dev-specific UI removed.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { produce } from "immer";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Plus, Zap } from "lucide-react-native";
import { LocationBlockList, type EventPressContext } from "@/components/organisms/LocationBlockList";
import type { LocationBlock } from "@/lib/types/location-block";
import { FutureEventsSection } from "@/components/organisms/FutureEventsSection";
import {
  TimelineFilterToggle,
  type TimelineFilter,
} from "@/components/molecules/TimelineFilterToggle";
import {
  EventEditModal,
  type EventUpdates,
} from "@/components/molecules/EventEditModal";
import { LocationEditSection } from "@/components/molecules/LocationEditSection";
import { reprocessDayWithPlaceLookup } from "@/lib/supabase/services/activity-segments";
import {
  fetchPlannedCalendarEventsForDay,
  updatePlannedCalendarEvent,
  updateActualCalendarEvent,
  type PlannedCalendarMeta,
} from "@/lib/supabase/services/calendar-events";
import { formatLocalIso } from "@/lib/calendar/local-time";
import { saveLocationLabel, getLocationLabels, type LocationLabelEntry } from "@/lib/supabase/services/location-labels";
import { useAuthStore } from "@/stores";
import type { ScheduledEvent } from "@/stores";
import type { TimelineEvent } from "@/lib/types/timeline-event";

// ============================================================================
// Helpers
// ============================================================================

function getTodayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayName(dateYmd: string): string {
  const today = getTodayYmd();
  if (dateYmd === today) return "Today";

  const yesterday = addDays(today, -1);
  if (dateYmd === yesterday) return "Yesterday";

  const tomorrow = addDays(today, 1);
  if (dateYmd === tomorrow) return "Tomorrow";

  const [year, month, day] = dateYmd.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function formatDateStr(dateYmd: string): string {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatBlockTimeRange(block: LocationBlock): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt(block.startTime)} – ${fmt(block.endTime)}`;
}

// ============================================================================
// Main Component
// ============================================================================

export default function ActivityTimelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";

  const [selectedDate, setSelectedDate] = useState(getTodayYmd());
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<TimelineFilter>("both");
  const [isReprocessing, setIsReprocessing] = useState(false);

  // User-defined location labels (client-side overlay for immediate feedback)
  const [userLabels, setUserLabels] = useState<Record<string, LocationLabelEntry>>({});

  // Edit modal state
  const [editEvent, setEditEvent] = useState<TimelineEvent | null>(null);
  const [editContext, setEditContext] = useState<EventPressContext | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Future planned events (for Upcoming section)
  const [futureEvents, setFutureEvents] = useState<ScheduledEvent[]>([]);

  const isToday = useMemo(() => selectedDate === getTodayYmd(), [selectedDate]);

  // Fetch user-defined location labels on mount and when userId changes
  useEffect(() => {
    if (!userId) {
      setUserLabels({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (__DEV__) {
          console.log('[ActivityTimeline] 🏷️ Fetching user location labels...');
        }
        const labels = await getLocationLabels(userId);
        if (cancelled) return;
        
        if (__DEV__) {
          console.log('[ActivityTimeline] 🏷️ Loaded', Object.keys(labels).length, 'user labels');
        }
        setUserLabels(labels);
      } catch (err) {
        if (__DEV__) {
          console.warn('[ActivityTimeline] Failed to fetch user labels:', err);
        }
        if (!cancelled) setUserLabels({});
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // Fetch future planned events when date changes
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const planned = await fetchPlannedCalendarEventsForDay(userId, selectedDate);
        if (cancelled) return;

        // Filter out derived/sleep events from upcoming
        const isDerived = (e: ScheduledEvent) => {
          const meta = e.meta as unknown as Record<string, unknown> | null;
          if (!meta) return false;
          const kind = typeof meta.kind === "string" ? meta.kind : "";
          const source = typeof meta.source === "string" ? meta.source : "";
          return (
            kind === "sleep_schedule" ||
            kind === "session_block" ||
            kind === "sleep_interrupted" ||
            source === "derived" ||
            source === "evidence"
          );
        };

        const realEvents = planned.filter((e) => !isDerived(e) && !e.isAllDay);

        if (isToday) {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          setFutureEvents(realEvents.filter((e) => e.startMinutes > currentMinutes));
        } else {
          setFutureEvents(realEvents);
        }
      } catch {
        if (!cancelled) setFutureEvents([]);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, selectedDate, refreshKey, isToday]);

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

  // Force refresh — also reloads user labels
  const handleRefresh = useCallback(async () => {
    setRefreshKey((k) => k + 1);
    // Reload user labels to pick up any new saves
    if (userId) {
      try {
        if (__DEV__) {
          console.log('[ActivityTimeline] 🔄 Refreshing user labels...');
        }
        const labels = await getLocationLabels(userId);
        setUserLabels(labels);
        if (__DEV__) {
          console.log('[ActivityTimeline] ✅ User labels refreshed:', Object.keys(labels).length, 'labels');
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[ActivityTimeline] Failed to refresh user labels:', err);
        }
      }
    }
  }, [userId]);

  // Reprocess (lightning bolt)
  const handleReprocess = useCallback(async () => {
    if (!userId) return;

    Alert.alert(
      "Reprocess Day",
      `Regenerate activity data for ${formatDayName(selectedDate)} with fresh place lookups?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reprocess",
          style: "destructive",
          onPress: async () => {
            setIsReprocessing(true);
            try {
              const result = await reprocessDayWithPlaceLookup(userId, selectedDate);

              if (result.success) {
                Alert.alert(
                  "Reprocess Complete",
                  `Processed ${result.hoursProcessed} hours, ${result.segmentsCreated} segments`,
                );
                setRefreshKey((k) => k + 1);
              } else {
                Alert.alert("Error", result.error ?? "Unknown error");
              }
            } catch (error) {
              Alert.alert("Error", error instanceof Error ? error.message : "Failed");
            } finally {
              setIsReprocessing(false);
            }
          },
        },
      ],
    );
  }, [userId, selectedDate]);

  // Event press -> open edit modal with block context
  const handleEventPress = useCallback((_event: TimelineEvent, ctx: EventPressContext) => {
    setEditEvent(_event);
    setEditContext(ctx);
    setShowEditModal(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setShowEditModal(false);
    setEditEvent(null);
    setEditContext(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (eventId: string, updates: EventUpdates) => {
      try {
        // Find the original event to determine if it's scheduled or actual
        const event = editEvent;
        const isScheduled = !!event?.scheduledEvent;
        const isActual = !!event?.actualEvent;

        // Build update payload
        const updateInput: {
          eventId: string;
          title?: string;
          scheduledStartIso?: string;
          scheduledEndIso?: string;
          location?: string;
          meta?: PlannedCalendarMeta;
        } = { eventId };

        if (updates.title) updateInput.title = updates.title;
        if (updates.startTime) updateInput.scheduledStartIso = formatLocalIso(updates.startTime);
        if (updates.endTime) updateInput.scheduledEndIso = formatLocalIso(updates.endTime);
        if (updates.locationLabel) updateInput.location = updates.locationLabel;

        // Build meta from category/subcategory/goal merged with existing
        if (updates.category || updates.subcategory || updates.goal) {
          const existingMeta = (isScheduled
            ? event?.scheduledEvent?.meta
            : event?.actualEvent?.meta) as PlannedCalendarMeta | undefined;
          updateInput.meta = {
            ...(existingMeta ?? {}),
            ...(updates.category ? { category: updates.category } : {}),
            ...(updates.subcategory ? { subcategory: updates.subcategory } : {}),
            ...(updates.goal ? { goal: updates.goal } : {}),
          } as PlannedCalendarMeta;
        }

        if (isScheduled) {
          await updatePlannedCalendarEvent(updateInput);
        } else if (isActual) {
          await updateActualCalendarEvent(updateInput);
        } else {
          // Fallback: try planned update
          await updatePlannedCalendarEvent(updateInput);
        }

        handleRefresh();
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to save edit");
      }
    },
    [editEvent, handleRefresh],
  );

  // Location rename -> persist via location-labels service
  const handleLocationRename = useCallback(
    async (geohash7: string, newLabel: string, alwaysUse: boolean, category?: string | null, radiusM?: number) => {
      if (!userId || !alwaysUse) return;
      try {
        await saveLocationLabel(userId, geohash7, newLabel, {
          category: category ?? undefined,
          radius_m: radiusM,
          latitude: editContext?.latitude ?? undefined,
          longitude: editContext?.longitude ?? undefined,
        });
        // Refresh the timeline to show the new label
        handleRefresh();
      } catch (err) {
        if (__DEV__) console.warn("Failed to save location label:", err);
      }
    },
    [userId, editContext, handleRefresh],
  );

  // Block rename modal state
  const [renameBlock, setRenameBlock] = useState<LocationBlock | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renameCategory, setRenameCategory] = useState<string | null>(null);
  const [renameRadius, setRenameRadius] = useState(100);
  const [isSavingRename, setIsSavingRename] = useState(false);

  // Banner press -> open block rename modal
  const handleBannerPress = useCallback(
    (block: LocationBlock) => {
      if (!userId) return;
      
      if (__DEV__) {
        console.log('[ActivityTimeline] Banner pressed:', block.locationLabel);
      }
      
      // Use requestAnimationFrame to ensure any scroll gestures have finished
      requestAnimationFrame(() => {
        setRenameBlock(block);
        setRenameText(block.locationLabel);
        setRenameCategory(null);
        setRenameRadius(100);
      });
    },
    [userId],
  );

  const handleCloseRename = useCallback(() => {
    setRenameBlock(null);
    setRenameText("");
    setRenameCategory(null);
    setRenameRadius(100);
  }, []);

  const handleSaveRename = useCallback(async () => {
    // Need either geohash7 OR valid lat/lng coordinates to save
    const hasGeohash = !!renameBlock?.geohash7;
    const lat = renameBlock?.latitude ?? renameBlock?.inferredPlace?.latitude ?? undefined;
    const lng = renameBlock?.longitude ?? renameBlock?.inferredPlace?.longitude ?? undefined;
    const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
    
    if (__DEV__) {
      console.log('🔍 [ActivityTimeline] handleSaveRename - block data:', {
        blockId: renameBlock?.id?.substring(0, 12),
        hasGeohash,
        geohash7: renameBlock?.geohash7 || '(null)',
        hasCoords,
        lat,
        lng,
        locationLabel: renameBlock?.locationLabel,
        newLabel: renameText.trim(),
      });
    }
    
    if ((!hasGeohash && !hasCoords) || !renameText.trim() || !userId) {
      if (__DEV__) {
        console.warn('[ActivityTimeline] ❌ Cannot save - missing data:', {
          hasGeohash,
          hasCoords,
          hasText: !!renameText.trim(),
          hasUserId: !!userId,
        });
      }
      Alert.alert('Cannot Save', 'Missing location data. This block might not have GPS coordinates.');
      return;
    }
    
    setIsSavingRename(true);
    
    // Store previous state for rollback (Immer safety)
    const previousLabels = userLabels;
    
    // Optimistic update with Immer - update UI immediately
    if (renameBlock?.geohash7) {
      setUserLabels(
        produce(draft => {
          draft[renameBlock.geohash7!] = {
            label: renameText.trim(),
            category: renameCategory ?? undefined,
          };
        })
      );
      
      if (__DEV__) {
        console.log('[ActivityTimeline] 🚀 Optimistic update applied with Immer');
      }
    }
    
    try {
      if (__DEV__) {
        console.log('[ActivityTimeline] 📝 Saving location label:', {
          geohash7: renameBlock?.geohash7,
          willGenerateFromCoords: !renameBlock?.geohash7 && hasCoords,
          label: renameText.trim(),
          category: renameCategory,
          radius: renameRadius,
          lat,
          lng,
        });
      }
      
      await saveLocationLabel(userId, renameBlock?.geohash7 ?? null, renameText.trim(), {
        category: renameCategory ?? undefined,
        radius_m: renameRadius,
        latitude: lat,
        longitude: lng,
      });
      
      if (__DEV__) {
        console.log('[ActivityTimeline] ✅ Location label saved successfully, refreshing...');
      }
      
      // Close modal first for better UX
      handleCloseRename();
      
      // Then refresh to show the new label
      handleRefresh();
    } catch (err) {
      // Rollback optimistic update on error (Immer safety)
      setUserLabels(previousLabels);
      
      if (__DEV__) {
        console.error('[ActivityTimeline] ❌ Save failed, rolled back optimistic update');
      }
      
      Alert.alert("Error", "Failed to save location name");
      if (__DEV__) console.error("[ActivityTimeline] Failed to save location label:", err);
    } finally {
      setIsSavingRename(false);
    }
  }, [renameBlock, renameText, renameCategory, renameRadius, userId, userLabels, handleRefresh, handleCloseRename]);

  // Render future events section as list footer — show on today and future dates
  const isFutureDate = useMemo(() => selectedDate > getTodayYmd(), [selectedDate]);
  const renderFooter = useMemo(() => {
    if (!isToday && !isFutureDate) return undefined;
    return (
      <View style={styles.futureSection}>
        <FutureEventsSection events={futureEvents} />
      </View>
    );
  }, [isToday, isFutureDate, futureEvents]);

  if (!userId) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>Not logged in</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Premium Header - Matching Calendar Style */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={goToToday} activeOpacity={0.7}>
              <View style={styles.dateSection}>
                <Text style={styles.dayText}>{formatDayName(selectedDate)}</Text>
                <Text style={styles.dateText}>{formatDateStr(selectedDate)}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerRight}>
              {/* Top row: zap + nav arrows */}
              <View style={styles.headerControls}>
                <TouchableOpacity
                  onPress={handleReprocess}
                  style={[styles.zapButton, isReprocessing && styles.buttonDisabled]}
                  disabled={isReprocessing}
                  activeOpacity={0.7}
                >
                  <Zap size={18} color={isReprocessing ? "#94A3B8" : "#F59E0B"} />
                </TouchableOpacity>

                <View style={styles.navButtons}>
                  <TouchableOpacity
                    style={styles.navButton}
                    activeOpacity={0.7}
                    onPress={goToPreviousDay}
                  >
                    <ChevronLeft size={22} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.navButton}
                    activeOpacity={0.7}
                    onPress={goToNextDay}
                  >
                    <ChevronRight size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filter toggle below controls */}
              <TimelineFilterToggle value={filter} onChange={setFilter} />
            </View>
          </View>
        </View>

      {/* Reprocess status */}
      {isReprocessing && (
        <View style={styles.reprocessBanner}>
          <Text style={styles.reprocessText}>Reprocessing...</Text>
        </View>
      )}

      {/* Location Blocks */}
      <LocationBlockList
        key={`blocks-${selectedDate}-${refreshKey}`}
        date={selectedDate}
        userId={userId}
        filter={filter}
        userLabels={userLabels}
        onEventPress={handleEventPress}
        onBannerPress={handleBannerPress}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
      />

      {/* Edit Modal */}
      <EventEditModal
        event={editEvent}
        visible={showEditModal}
        onClose={handleCloseEdit}
        onSave={handleSaveEdit}
        onLocationRename={handleLocationRename}
        userId={userId}
        allBlockEvents={editContext?.allBlockEvents}
        locationLabel={editContext?.locationLabel}
        geohash7={editContext?.geohash7}
        latitude={editContext?.latitude}
        longitude={editContext?.longitude}
      />

      {/* FAB — Add Event */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => router.push(`/add-event?date=${selectedDate}`)}
      >
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Block Rename Modal */}
      <Modal
        visible={!!renameBlock}
        transparent
        animationType="fade"
        onRequestClose={handleCloseRename}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseRename}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardView}
          >
            <Pressable style={styles.renameCard} onPress={() => {}}>
              <Text style={styles.renameTitle}>Edit Location</Text>
              {renameBlock && (
                <Text style={styles.renameSubtitle}>
                  {formatBlockTimeRange(renameBlock)} · {renameBlock.durationMinutes} min
                </Text>
              )}
              <LocationEditSection
                currentLabel={renameText}
                geohash7={renameBlock?.geohash7 ?? null}
                latitude={renameBlock?.latitude ?? renameBlock?.inferredPlace?.latitude ?? null}
                longitude={renameBlock?.longitude ?? renameBlock?.inferredPlace?.longitude ?? null}
                userId={userId}
                alwaysUse={true}
                selectedCategory={renameCategory}
                selectedRadius={renameRadius}
                onLabelChange={setRenameText}
                onAlwaysUseChange={() => {}}
                onCategoryChange={setRenameCategory}
                onRadiusChange={setRenameRadius}
                hideAlwaysUseToggle
              />
              <View style={styles.renameActions}>
                <Pressable style={styles.renameCancelBtn} onPress={handleCloseRename}>
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.renameSaveBtn, isSavingRename && styles.buttonDisabled]}
                  onPress={handleSaveRename}
                  disabled={isSavingRename || !renameText.trim()}
                >
                  <Text style={styles.renameSaveText}>
                    {isSavingRename ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
    </>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
    backgroundColor: "#FFFFFF",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  dateSection: {
    flex: 1,
  },
  dayText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: -0.5,
    marginTop: -2,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 8,
    marginTop: 2,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  navButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  reprocessBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  reprocessText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    textAlign: "center",
  },
  listContent: {
    paddingTop: 4,
  },
  futureSection: {
    marginTop: 16,
    paddingBottom: 24,
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

  // FAB
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Block rename modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalKeyboardView: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  renameCard: {
    width: "85%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  renameSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 16,
  },
  renameActions: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  renameCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  renameCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  renameSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  renameSaveText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
