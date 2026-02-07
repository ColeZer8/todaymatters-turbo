import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { MapPin } from "lucide-react-native";
import type { ScheduledEvent } from "@/stores";
import { formatMinutesToDisplay } from "@/stores";

export interface FutureEventSlotProps {
  event: ScheduledEvent;
  onPress?: (event: ScheduledEvent) => void;
}

const ACCENT_COLORS: Record<string, string> = {
  meeting: "#2563EB",
  travel: "#F97316",
};
const DEFAULT_ACCENT = "#7C3AED";

function getAccentColor(event: ScheduledEvent): string {
  if (event.meta?.kind === "travel" || event.category === "travel") {
    return ACCENT_COLORS.travel;
  }
  if (event.category === "meeting") {
    return ACCENT_COLORS.meeting;
  }
  return DEFAULT_ACCENT;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function FutureEventSlot({ event, onPress }: FutureEventSlotProps) {
  const accent = getAccentColor(event);
  const endMinutes = event.startMinutes + event.duration;
  const timeRange = `${formatMinutesToDisplay(event.startMinutes)} - ${formatMinutesToDisplay(endMinutes)}`;
  const durationLabel = formatDuration(event.duration);
  const location = event.location ?? event.meta?.location;

  return (
    <Pressable
      style={[styles.container, { borderLeftColor: accent }]}
      onPress={onPress ? () => onPress(event) : undefined}
    >
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{timeRange}</Text>
        <Text style={styles.durationText}>{durationLabel}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>
      {location ? (
        <View style={styles.locationRow}>
          <MapPin size={14} color="#94A3B8" />
          <Text style={styles.locationText} numberOfLines={1}>
            {location}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  durationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: "#94A3B8",
  },
});
