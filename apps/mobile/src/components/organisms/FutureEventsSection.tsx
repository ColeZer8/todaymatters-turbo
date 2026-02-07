import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ScheduledEvent } from "@/stores";
import { FutureEventSlot } from "@/components/molecules/FutureEventSlot";

export interface FutureEventsSectionProps {
  events: ScheduledEvent[];
  onEventPress?: (event: ScheduledEvent) => void;
}

export function FutureEventsSection({
  events,
  onEventPress,
}: FutureEventsSectionProps) {
  return (
    <View>
      <Text style={styles.sectionHeader}>UPCOMING</Text>
      {events.length === 0 ? (
        <Text style={styles.emptyText}>No upcoming events</Text>
      ) : (
        <View style={styles.list}>
          {events.map((event) => (
            <FutureEventSlot
              key={event.id}
              event={event}
              onPress={onEventPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#64748B",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 24,
  },
});
