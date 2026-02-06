/**
 * LocationBanner — full-width colored banner header for a location block.
 *
 * Displays the location icon, label, time range, and duration on a
 * solid-color background matching the location type.
 */

import { View, Text, StyleSheet } from "react-native";
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
}

export const LocationBanner = ({
  locationLabel,
  icon,
  bgColor,
  textColor,
  startTime,
  endTime,
  durationMinutes,
}: LocationBannerProps) => {
  const timeStr = formatTimeRange(startTime, endTime);
  const durStr = formatDuration(durationMinutes);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Icon icon={icon} size={20} color={textColor} />
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: textColor }]}>{locationLabel}</Text>
        <Text style={[styles.meta, { color: textColor }]}>
          {timeStr} · {durStr}
        </Text>
      </View>
    </View>
  );
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
