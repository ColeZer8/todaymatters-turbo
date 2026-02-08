/**
 * LocationBanner — full-width colored banner header for a location block.
 *
 * Displays the location icon, label, time range, and duration on a
 * solid-color background matching the location type.
 */

import { View, Text, Pressable, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { formatTimeRange, formatDuration } from "@/lib/utils/time-format";

interface LocationBannerProps {
  locationLabel: string;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  /** Optional distance in meters for travel blocks. */
  distanceM?: number | null;
  onPress?: () => void;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 0.1 ? `${Math.round(meters)} ft` : `${miles.toFixed(1)} mi`;
}

export const LocationBanner = ({
  locationLabel,
  icon,
  bgColor,
  textColor,
  startTime,
  endTime,
  durationMinutes,
  distanceM,
  onPress,
}: LocationBannerProps) => {
  const timeStr = formatTimeRange(startTime, endTime);
  const durStr = formatDuration(durationMinutes);
  const distStr = distanceM && distanceM > 0 ? formatDistance(distanceM) : null;

  const content = (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Icon icon={icon} size={20} color={textColor} />
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: textColor }]}>{locationLabel}</Text>
        <Text style={[styles.meta, { color: textColor }]}>
          {timeStr} · {durStr}{distStr ? ` · ${distStr}` : ""}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  textCol: {
    marginLeft: 10,
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.85,
  },
});
