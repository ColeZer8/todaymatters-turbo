import { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, LayoutChangeEvent, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { X, Check, Plus } from 'lucide-react-native';
import { Icon } from '@/components/atoms';

const MIN_SEGMENT_MINUTES = 5;
const MAX_SPLIT_POINTS = 9;

// Segment colors cycle through these for visual distinction
const SEGMENT_COLORS = [
  { bg: '#E0F2FE', text: '#0369A1' }, // blue
  { bg: '#FEF9C3', text: '#A16207' }, // yellow
  { bg: '#DCFCE7', text: '#166534' }, // green
  { bg: '#FCE7F3', text: '#9D174D' }, // pink
  { bg: '#F3E8FF', text: '#6B21A8' }, // purple
  { bg: '#FEF3C7', text: '#92400E' }, // amber
  { bg: '#CCFBF1', text: '#115E59' }, // teal
  { bg: '#FFE4E6', text: '#9F1239' }, // rose
  { bg: '#E0E7FF', text: '#3730A3' }, // indigo
  { bg: '#FED7AA', text: '#9A3412' }, // orange
];

interface MultiSplitControlProps {
  duration: number; // total minutes
  startTime: string;
  endTime: string;
  onConfirm: (splitPointMinutes: number[]) => void;
  onCancel: () => void;
}

// Helper to parse time string "11:30 AM" -> minutes from midnight
const parseTimeToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Helper to format minutes from midnight -> "11:30 AM"
const formatMinutesToTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const formatDuration = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

/** Snap to 5-minute grid */
const snapTo5 = (value: number): number => Math.round(value / 5) * 5;

/** Check if adding/moving a split point would create segments smaller than MIN_SEGMENT_MINUTES */
const wouldViolateMinSegment = (
  candidateMinute: number,
  existingSplits: number[],
  duration: number,
  excludeIndex?: number,
): boolean => {
  const allPoints = [...existingSplits];
  if (excludeIndex !== undefined) {
    allPoints.splice(excludeIndex, 1);
  }
  allPoints.push(candidateMinute);
  allPoints.sort((a, b) => a - b);

  // Check first segment (0 → first split)
  if (allPoints[0] < MIN_SEGMENT_MINUTES) return true;
  // Check last segment (last split → end)
  if (duration - allPoints[allPoints.length - 1] < MIN_SEGMENT_MINUTES) return true;
  // Check interior segments
  for (let i = 1; i < allPoints.length; i++) {
    if (allPoints[i] - allPoints[i - 1] < MIN_SEGMENT_MINUTES) return true;
  }
  return false;
};

export const MultiSplitControl = ({
  duration,
  startTime,
  endTime,
  onConfirm,
  onCancel,
}: MultiSplitControlProps) => {
  const trackWidth = useRef(0);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragStartRef = useRef<number>(0);

  const startMinutes = parseTimeToMinutes(startTime);
  const sortedSplits = useMemo(() => [...splitPoints].sort((a, b) => a - b), [splitPoints]);

  // Compute segments from sorted split points
  const segments = useMemo(() => {
    const boundaries = [0, ...sortedSplits, duration];
    const result: { startMin: number; endMin: number; durationMin: number }[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const s = boundaries[i];
      const e = boundaries[i + 1];
      result.push({ startMin: s, endMin: e, durationMin: e - s });
    }
    return result;
  }, [sortedSplits, duration]);

  const canAddMore = splitPoints.length < MAX_SPLIT_POINTS;

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
  }, []);

  const pixelToMinutes = useCallback(
    (pixelX: number): number => {
      if (trackWidth.current === 0) return MIN_SEGMENT_MINUTES;
      const ratio = Math.max(0, Math.min(1, pixelX / trackWidth.current));
      const rawMinutes = ratio * duration;
      return snapTo5(Math.max(MIN_SEGMENT_MINUTES, Math.min(rawMinutes, duration - MIN_SEGMENT_MINUTES)));
    },
    [duration],
  );

  // Tap on the track adds a new split point
  const handleTrackPress = useCallback(
    (event: { nativeEvent: { locationX: number } }) => {
      if (!canAddMore) return;
      const candidate = pixelToMinutes(event.nativeEvent.locationX);
      if (!wouldViolateMinSegment(candidate, splitPoints, duration)) {
        setSplitPoints((prev) => [...prev, candidate]);
      }
    },
    [canAddMore, pixelToMinutes, splitPoints, duration],
  );

  const removeSplitPoint = useCallback((index: number) => {
    setSplitPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Build a pan gesture for each split point
  const makeGesture = useCallback(
    (pointIndex: number) => {
      return Gesture.Pan()
        .activeOffsetX([-4, 4])
        .failOffsetY([-8, 8])
        .runOnJS(true)
        .onBegin(() => {
          dragStartRef.current = splitPoints[pointIndex];
          setDraggingIndex(pointIndex);
        })
        .onUpdate((e) => {
          if (trackWidth.current === 0) return;
          const startPx = (dragStartRef.current / duration) * trackWidth.current;
          const nextPx = startPx + e.translationX;
          const candidate = pixelToMinutes(nextPx);
          if (!wouldViolateMinSegment(candidate, splitPoints, duration, pointIndex)) {
            setSplitPoints((prev) => {
              const next = [...prev];
              next[pointIndex] = candidate;
              return next;
            });
          }
        })
        .onFinalize(() => setDraggingIndex(null));
    },
    [duration, pixelToMinutes, splitPoints],
  );

  return (
    <View>
      {/* Header */}
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="mb-0.5 text-[13px] font-medium text-[#6B7280]">
            {splitPoints.length === 0 ? 'Tap the bar to add split points' : `${segments.length} segments`}
          </Text>
          <Text className="text-[16px] font-bold text-[#1F2937]">
            {splitPoints.length === 0
              ? 'No splits yet'
              : `${splitPoints.length} split ${splitPoints.length === 1 ? 'point' : 'points'}`}
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
            onPress={() => {
              if (splitPoints.length > 0) onConfirm(sortedSplits);
            }}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={({ pressed }) => ({
              opacity: splitPoints.length === 0 ? 0.4 : pressed ? 0.7 : 1,
              backgroundColor: splitPoints.length === 0 ? '#D1D5DB' : '#2563EB',
            })}
          >
            <Icon icon={Check} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Time bar */}
      <Pressable onPress={handleTrackPress} onLayout={handleTrackLayout}>
        <View className="h-16 flex-row overflow-hidden rounded-2xl bg-[#F1F5F9]">
          {segments.map((seg, i) => {
            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            const widthPct = (seg.durationMin / duration) * 100;
            return (
              <View
                key={`seg-${i}`}
                className="h-full items-center justify-center"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: color.bg,
                }}
              >
                {seg.durationMin >= 15 && (
                  <Text
                    className="text-[13px] font-bold"
                    style={{ color: color.text }}
                    numberOfLines={1}
                  >
                    {formatDuration(seg.durationMin)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Split point handles */}
        {sortedSplits.map((splitMin, i) => {
          // Find the original index in the unsorted array for the gesture
          const originalIndex = splitPoints.indexOf(splitMin);
          const position = (splitMin / duration) * 100;
          const isDragging = draggingIndex === originalIndex;

          return (
            <GestureDetector key={`handle-${i}`} gesture={makeGesture(originalIndex)}>
              <View
                style={{
                  position: 'absolute',
                  left: `${position}%`,
                  top: -6,
                  bottom: -6,
                  width: 44,
                  marginLeft: -22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}
              >
                {/* Line */}
                <View
                  style={{
                    width: 3,
                    height: '100%',
                    backgroundColor: isDragging ? '#1D4ED8' : '#2563EB',
                    borderRadius: 1.5,
                  }}
                />
                {/* Knob */}
                <View
                  style={{
                    position: 'absolute',
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 3,
                    borderColor: isDragging ? '#1D4ED8' : '#2563EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                    elevation: 3,
                  }}
                />
              </View>
            </GestureDetector>
          );
        })}
      </Pressable>

      {/* Time range labels */}
      <View className="mt-2 flex-row justify-between px-1">
        <Text className="text-[12px] text-[#9CA3AF]">{startTime}</Text>
        <Text className="text-[12px] text-[#9CA3AF]">{endTime}</Text>
      </View>

      {/* Add split point hint */}
      {canAddMore && splitPoints.length > 0 && (
        <View className="mt-3 flex-row items-center justify-center gap-1">
          <Icon icon={Plus} size={14} color="#9CA3AF" />
          <Text className="text-[12px] text-[#9CA3AF]">
            Tap the bar to add more split points (max {MAX_SPLIT_POINTS})
          </Text>
        </View>
      )}

      {/* Segment preview */}
      {splitPoints.length > 0 && (
        <View className="mt-4">
          <Text className="mb-2 text-[13px] font-semibold text-[#111827]">
            Segments ({segments.length})
          </Text>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {segments.map((seg, i) => {
              const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
              const segStartTime = formatMinutesToTime(startMinutes + seg.startMin);
              const segEndTime = formatMinutesToTime(startMinutes + seg.endMin);
              // Find split point index that ends this segment (i.e., sortedSplits[i-1] started it if i>0)
              // The split point at the END of segment i is sortedSplits[i] (if i < splitPoints.length)
              const splitPointOriginalIndex =
                i < sortedSplits.length ? splitPoints.indexOf(sortedSplits[i]) : -1;

              return (
                <View
                  key={`preview-${i}`}
                  className="mb-2 flex-row items-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5"
                >
                  {/* Color indicator */}
                  <View
                    className="mr-3 h-8 w-1.5 rounded-full"
                    style={{ backgroundColor: color.text }}
                  />
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-[#111827]">
                      Segment {i + 1}
                    </Text>
                    <Text className="text-[12px] text-[#6B7280]">
                      {segStartTime} – {segEndTime} · {formatDuration(seg.durationMin)}
                    </Text>
                  </View>
                  {/* Remove button for the split point that PRECEDES this segment (i.e., between seg i-1 and seg i) */}
                  {i > 0 && (
                    <Pressable
                      onPress={() => {
                        // Remove the split point between segment i-1 and segment i
                        // That is sortedSplits[i-1], find its original index
                        const precedingSplitOriginal = splitPoints.indexOf(sortedSplits[i - 1]);
                        if (precedingSplitOriginal !== -1) {
                          removeSplitPoint(precedingSplitOriginal);
                        }
                      }}
                      hitSlop={8}
                      className="ml-2 h-7 w-7 items-center justify-center rounded-full bg-[#FEE2E2]"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Icon icon={X} size={14} color="#DC2626" />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};
