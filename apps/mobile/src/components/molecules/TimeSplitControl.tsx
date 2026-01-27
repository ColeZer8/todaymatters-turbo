import { useState, useCallback, useMemo, useRef } from "react";
import { View, Text, Pressable, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Check, X } from "lucide-react-native";
import { Icon } from "@/components/atoms";

interface TimeSplitControlProps {
  duration: number; // total minutes
  startTime: string;
  endTime: string;
  onConfirm: (splitMinutes: number) => void;
  onCancel: () => void;
}

// Helper to parse time string "11:30 AM" -> minutes from midnight
const parseTimeToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Helper to format minutes from midnight -> "11:30 AM"
const formatMinutesToTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const formatDuration = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

export const TimeSplitControl = ({
  duration,
  startTime,
  endTime,
  onConfirm,
  onCancel,
}: TimeSplitControlProps) => {
  const trackWidth = useRef(0);
  const minSplit = 5;

  const defaultSplit = Math.round(duration / 2 / 5) * 5;
  const [splitMinutes, setSplitMinutes] = useState(
    Math.max(minSplit, Math.min(defaultSplit, duration - minSplit)),
  );
  const [isDragging, setIsDragging] = useState(false);
  const startSplitRef = useRef(splitMinutes);

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
  }, []);

  const pixelToMinutes = useCallback(
    (pixelX: number): number => {
      if (trackWidth.current === 0) return minSplit;
      const ratio = Math.max(0, Math.min(1, pixelX / trackWidth.current));
      const rawMinutes = ratio * duration;
      const snapped = Math.round(rawMinutes / 5) * 5;
      return Math.max(minSplit, Math.min(snapped, duration - minSplit));
    },
    [duration],
  );

  const handleTrackPress = useCallback(
    (event: { nativeEvent: { locationX: number } }) => {
      setSplitMinutes(pixelToMinutes(event.nativeEvent.locationX));
    },
    [pixelToMinutes],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-4, 4])
      .failOffsetY([-8, 8])
      .runOnJS(true)
      .onBegin(() => {
        startSplitRef.current = splitMinutes;
        setIsDragging(true);
      })
      .onUpdate((e) => {
        if (trackWidth.current === 0) return;
        const startPx = (startSplitRef.current / duration) * trackWidth.current;
        const nextPx = startPx + e.translationX;
        setSplitMinutes(pixelToMinutes(nextPx));
      })
      .onFinalize(() => setIsDragging(false));

    return pan;
  }, [duration, pixelToMinutes, splitMinutes]);

  const startMinutes = parseTimeToMinutes(startTime);
  const splitTime = formatMinutesToTime(startMinutes + splitMinutes);
  const splitPosition = (splitMinutes / duration) * 100;

  return (
    <View>
      {/* Minimal header */}
      <View className="flex-row items-center justify-between mb-5">
        <View>
          <Text className="text-[13px] font-medium text-[#6B7280] mb-0.5">
            Split at
          </Text>
          <Text className="text-[20px] font-bold text-[#1F2937]">
            {splitTime}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon icon={X} size={20} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={() => onConfirm(splitMinutes)}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#2563EB]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon icon={Check} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Clean timeline */}
      <Pressable onPress={handleTrackPress} onLayout={handleTrackLayout}>
        <View className="h-16 rounded-2xl overflow-hidden flex-row bg-[#F1F5F9]">
          {/* Left segment */}
          <View
            className="h-full justify-center pl-4"
            style={{
              width: `${splitPosition}%`,
              backgroundColor: "#E0F2FE",
            }}
          >
            <Text className="text-[15px] font-bold text-[#0369A1]">
              {formatDuration(splitMinutes)}
            </Text>
          </View>

          {/* Right segment */}
          <View
            className="h-full justify-center items-end pr-4 flex-1"
            style={{ backgroundColor: "#FEF9C3" }}
          >
            <Text className="text-[15px] font-bold text-[#A16207]">
              {formatDuration(duration - splitMinutes)}
            </Text>
          </View>
        </View>

        {/* Draggable handle - clean line with small knob */}
        <GestureDetector gesture={gesture}>
          <View
            style={{
              position: "absolute",
              left: `${splitPosition}%`,
              top: -4,
              bottom: -4,
              width: 44,
              marginLeft: -22,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            {/* Thin line */}
            <View
              style={{
                width: 3,
                height: "100%",
                backgroundColor: isDragging ? "#1D4ED8" : "#2563EB",
                borderRadius: 1.5,
              }}
            />
            {/* Small knob */}
            <View
              style={{
                position: "absolute",
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: "#FFFFFF",
                borderWidth: 3,
                borderColor: isDragging ? "#1D4ED8" : "#2563EB",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 3,
              }}
            />
          </View>
        </GestureDetector>
      </Pressable>

      {/* Time range labels */}
      <View className="flex-row justify-between mt-2 px-1">
        <Text className="text-[12px] text-[#9CA3AF]">{startTime}</Text>
        <Text className="text-[12px] text-[#9CA3AF]">{endTime}</Text>
      </View>
    </View>
  );
};
