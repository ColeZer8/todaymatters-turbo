/**
 * TimelineBlockSection — composed timeline section for a single location block.
 *
 * Renders a LocationBanner header, chronological TimelineEventRows,
 * a CurrentTimeLine separator (today only), and future scheduled events.
 */

import { View, StyleSheet } from "react-native";
import type { LocationBlock } from "@/lib/types/location-block";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import { getPlaceIcon, getTravelIcon } from "@/lib/utils/place-icons";
import { getLocationBannerColor } from "@/lib/utils/place-icons";
import { LocationBanner } from "@/components/molecules/LocationBanner";
import { TimelineEventRow } from "@/components/molecules/TimelineEventRow";
import { CurrentTimeLine } from "@/components/molecules/CurrentTimeLine";

interface TimelineBlockSectionProps {
  block: LocationBlock;
  isToday: boolean;
  currentMinutes: number;
  onEventPress: (event: TimelineEvent) => void;
  onBannerPress?: (block: LocationBlock) => void;
}

export const TimelineBlockSection = ({
  block,
  isToday,
  currentMinutes,
  onEventPress,
  onBannerPress,
}: TimelineBlockSectionProps) => {
  const events = block.timelineEvents ?? [];
  const pastEvents = events.filter((e) => e.isPast);
  const futureEvents = events.filter((e) => !e.isPast);

  const bannerColors = getLocationBannerColor(block);
  const icon = block.type === "travel"
    ? getTravelIcon(block.movementType)
    : getPlaceIcon(block.locationLabel);

  // Determine if the red "now" line belongs in this block
  const blockStartMin =
    block.startTime.getHours() * 60 + block.startTime.getMinutes();
  const blockEndMin =
    block.endTime.getHours() * 60 + block.endTime.getMinutes();
  const showNowLine =
    isToday &&
    currentMinutes >= 0 &&
    currentMinutes >= blockStartMin &&
    currentMinutes < blockEndMin;

  return (
    <View style={styles.container}>
      <LocationBanner
        locationLabel={block.locationLabel}
        icon={icon}
        bgColor={bannerColors.bg}
        textColor={bannerColors.text}
        startTime={block.startTime}
        endTime={block.endTime}
        durationMinutes={block.durationMinutes}
        distanceM={block.distanceM}
        onPress={onBannerPress ? () => onBannerPress(block) : undefined}
      />

      <View style={styles.eventList}>
        {pastEvents.map((event) => (
          <TimelineEventRow
            key={event.id}
            event={event}
            onPress={onEventPress}
          />
        ))}

        {showNowLine && <CurrentTimeLine />}

        {futureEvents.map((event) => (
          <TimelineEventRow
            key={event.id}
            event={event}
            onPress={onEventPress}
          />
        ))}

        {events.length === 0 && (
          <View style={styles.emptyRow}>
            {/* intentionally blank — banner is enough for blocks with no events */}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  eventList: {
    // White background behind all event rows
  },
  emptyRow: {
    height: 8,
  },
});
