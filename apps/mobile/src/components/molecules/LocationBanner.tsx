/**
 * LocationBanner — full-width colored banner header for a location block.
 *
 * Displays the location icon, label, time range, and duration on a
 * solid-color background matching the location type.
 */

import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { formatTimeRange, formatDuration } from "@/lib/utils/time-format";
import { useRef, useEffect } from "react";

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

  // Animated scale for press feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const chevronOpacity = useRef(new Animated.Value(0.6)).current;

  // Subtle pulse animation for chevron to hint at interactivity
  useEffect(() => {
    if (onPress) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(chevronOpacity, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(chevronOpacity, {
            toValue: 0.6,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [onPress, chevronOpacity]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const content = (
    <Animated.View style={[
      styles.container, 
      { backgroundColor: bgColor },
      onPress && styles.pressableContainer,
      { transform: [{ scale: scaleAnim }] }
    ]}>
      <Icon icon={icon} size={20} color={textColor} />
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: textColor }]}>{locationLabel}</Text>
        <Text style={[styles.meta, { color: textColor }]}>
          {timeStr} · {durStr}{distStr ? ` · ${distStr}` : ""}
        </Text>
      </View>
      {onPress && (
        <Animated.View style={{ opacity: chevronOpacity }}>
          <ChevronRight size={18} color={textColor} style={{ opacity: 0.7 }} />
        </Animated.View>
      )}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' }}
      >
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
  pressableContainer: {
    // Subtle shadow/elevation to hint at interactivity
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
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
