/**
 * TimelineBlockSection — composed timeline section for a single location block.
 *
 * Renders a LocationBanner header, chronological TimelineEventRows,
 * a CurrentTimeLine separator (today only), and future scheduled events.
 * Includes PlacePickerSheet for place disambiguation when alternatives exist.
 */

import { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import type { LocationBlock } from "@/lib/types/location-block";
import type { TimelineEvent } from "@/lib/types/timeline-event";
import { getPlaceIcon, getTravelIcon } from "@/lib/utils/place-icons";
import { getLocationBannerColor } from "@/lib/utils/place-icons";
import { LocationBanner } from "@/components/molecules/LocationBanner";
import { TimelineEventRow } from "@/components/molecules/TimelineEventRow";
import { CurrentTimeLine } from "@/components/molecules/CurrentTimeLine";
import {
  PlacePickerSheet,
  type PlaceSelection,
} from "@/components/molecules/PlacePickerSheet";

interface TimelineBlockSectionProps {
  block: LocationBlock;
  isToday: boolean;
  currentMinutes: number;
  onEventPress: (event: TimelineEvent) => void;
  onBannerPress?: (block: LocationBlock) => void;
  /** Called when user selects a place from disambiguation sheet. */
  onPlaceSelected?: (block: LocationBlock, selection: PlaceSelection) => void;
}

export const TimelineBlockSection = ({
  block,
  isToday,
  currentMinutes,
  onEventPress,
  onBannerPress,
  onPlaceSelected,
}: TimelineBlockSectionProps) => {
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const events = block.timelineEvents ?? [];
  const pastEvents = events.filter((e) => e.isPast);
  const futureEvents = events.filter((e) => !e.isPast);

  const bannerColors = getLocationBannerColor(block);
  const icon = block.type === "travel"
    ? getTravelIcon(block.movementType)
    : getPlaceIcon(block.locationLabel);

  // Place disambiguation: show picker when alternatives exist on stationary blocks
  const hasAlternatives =
    block.type !== "travel" && (block.placeAlternatives?.length ?? 0) > 0;

  const handleBannerPress = useCallback(() => {
    if (hasAlternatives) {
      setShowPlacePicker(true);
    } else if (onBannerPress) {
      onBannerPress(block);
    }
  }, [hasAlternatives, onBannerPress, block]);

  const handlePlaceSave = useCallback(
    (selection: PlaceSelection) => {
      setShowPlacePicker(false);
      onPlaceSelected?.(block, selection);
    },
    [block, onPlaceSelected],
  );

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
        onPress={hasAlternatives || onBannerPress ? handleBannerPress : undefined}
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

      {/* Place Picker Sheet for disambiguation */}
      {hasAlternatives && (
        <PlacePickerSheet
          visible={showPlacePicker}
          onClose={() => setShowPlacePicker(false)}
          onSave={handlePlaceSave}
          currentPlace={block.locationLabel}
          alternatives={block.placeAlternatives!}
          latitude={block.latitude ?? 0}
          longitude={block.longitude ?? 0}
          startTime={block.startTime}
          endTime={block.endTime}
        />
      )}
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
