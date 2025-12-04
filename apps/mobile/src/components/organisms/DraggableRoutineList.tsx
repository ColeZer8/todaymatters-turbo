import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RoutineItemCard } from '@/components/molecules';
import type { RoutineItem } from '@/components/templates/RoutineBuilderTemplate';

// Hook for press-and-hold repeat functionality
const useRepeatPress = (
  onPress: () => void,
  initialDelay = 400,
  repeatInterval = 80,
) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const onPressIn = useCallback(() => {
    onPress(); // Fire immediately on press
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onPress, repeatInterval);
    }, initialDelay);
  }, [onPress, initialDelay, repeatInterval]);

  const onPressOut = useCallback(() => {
    clear();
  }, [clear]);

  // Cleanup on unmount
  useEffect(() => clear, [clear]);

  return { onPressIn, onPressOut };
};

const DEFAULT_HEIGHT = 96;
const ITEM_SPACING = 12;
const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };
// Higher damping = less bounce, lower stiffness = smoother
const LAYOUT_SPRING = { damping: 28, stiffness: 140, mass: 0.9 };

type DraggableRoutineListProps = {
  items: RoutineItem[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onChangeMinutes: (id: string, value: number) => void;
  onDelete: (id: string) => void;
  onReorder: (items: RoutineItem[]) => void;
  onDragStart?: () => void;
  getStartEnd: (id: string) => { start: string; end: string };
};

type Positions = Record<string, number>;
type Heights = Record<string, number>;

const buildPositions = (items: RoutineItem[]): Positions =>
  items.reduce<Positions>((acc, item, index) => {
    acc[item.id] = index;
    return acc;
  }, {});

const getSortedEntries = (positions: Positions) => {
  'worklet';
  return Object.entries(positions).sort((a, b) => a[1] - b[1]);
};

const getOffsetForId = (positions: Positions, heights: Heights, id: string) => {
  'worklet';
  const sorted = getSortedEntries(positions);
  let offset = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const [entryId] = sorted[i];
    if (entryId === id) break;
    offset += (heights[entryId] ?? DEFAULT_HEIGHT) + ITEM_SPACING;
  }
  return offset;
};

const findIndexForCenter = (positions: Positions, heights: Heights, centerY: number) => {
  'worklet';
  const sorted = getSortedEntries(positions);
  let offset = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const [entryId] = sorted[i];
    const height = heights[entryId] ?? DEFAULT_HEIGHT;
    const midpoint = offset + height / 2;
    if (centerY < midpoint) return i;
    offset += height + ITEM_SPACING;
  }
  return sorted.length - 1;
};

// Find the index where the dragged item should go, excluding itself from calculations
const findIndexForCenterExcluding = (
  positions: Positions,
  heights: Heights,
  centerY: number,
  excludeId: string,
) => {
  'worklet';
  const sorted = getSortedEntries(positions);
  // Filter out the dragged item to calculate slot positions
  const others = sorted.filter(([id]) => id !== excludeId);
  
  if (others.length === 0) return 0;
  
  // Calculate the boundaries between each slot
  let offset = 0;
  for (let i = 0; i < others.length; i += 1) {
    const [entryId] = others[i];
    const height = heights[entryId] ?? DEFAULT_HEIGHT;
    const slotEnd = offset + height + ITEM_SPACING / 2;
    
    // If center is before this slot's midpoint, insert before this item
    if (centerY < offset + height / 2) {
      return i;
    }
    offset += height + ITEM_SPACING;
  }
  // If we're past all items, go to the end
  return others.length;
};

const clampIndex = (value: number, max: number) => {
  'worklet';
  return Math.max(0, Math.min(value, max));
};

const adjustPositions = (positions: Positions, movingId: string, newIndex: number) => {
  'worklet';
  const currentIndex = positions[movingId];
  if (currentIndex === newIndex || currentIndex == null) return positions;
  const updated: Positions = { ...positions };
  Object.entries(positions).forEach(([id, index]) => {
    if (id === movingId || index == null) return;
    if (currentIndex < newIndex && index > currentIndex && index <= newIndex) {
      updated[id] = index - 1;
    } else if (currentIndex > newIndex && index < currentIndex && index >= newIndex) {
      updated[id] = index + 1;
    }
  });
  updated[movingId] = newIndex;
  return updated;
};

const listHeight = (items: RoutineItem[], heightMap: Heights) =>
  items.reduce((sum, item, index) => {
    const height = heightMap[item.id] ?? DEFAULT_HEIGHT;
    const spacing = index === items.length - 1 ? 0 : ITEM_SPACING;
    return sum + height + spacing;
  }, 0);

// Extracted time edit panel component for cleaner code
type TimeEditPanelProps = {
  item: RoutineItem;
  getStartEnd: (id: string) => { start: string; end: string };
  onChangeMinutes: (id: string, value: number) => void;
  onToggleExpand: (id: string) => void;
};

const TimeEditPanel = ({
  item,
  getStartEnd,
  onChangeMinutes,
  onToggleExpand,
}: TimeEditPanelProps) => {
  // Get current minutes from item (needs to be accessed fresh for repeat)
  const minutesRef = useRef(item.minutes);
  minutesRef.current = item.minutes;

  // Simple controlled state for the input
  const [localMinutes, setLocalMinutes] = useState(String(item.minutes));

  // Sync when item.minutes changes externally (from +/- buttons)
  useEffect(() => {
    setLocalMinutes(String(item.minutes));
  }, [item.minutes]);

  // Auto-save on every valid change
  const handleChangeText = useCallback((text: string) => {
    setLocalMinutes(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      onChangeMinutes(item.id, parsed);
    }
  }, [item.id, onChangeMinutes]);

  const decrementMinutes = useCallback(() => {
    const newValue = Math.max(1, minutesRef.current - 1);
    onChangeMinutes(item.id, newValue);
  }, [item.id, onChangeMinutes]);

  const incrementMinutes = useCallback(() => {
    onChangeMinutes(item.id, minutesRef.current + 1);
  }, [item.id, onChangeMinutes]);

  const decrementPress = useRepeatPress(decrementMinutes);
  const incrementPress = useRepeatPress(incrementMinutes);

  const times = getStartEnd(item.id);

  return (
    <View
      className="rounded-b-2xl border border-t-0 border-[#E4E8F0] bg-white px-4 pb-4 pt-3"
      style={{
        marginTop: -1, // Overlap the border perfectly
        shadowColor: '#0f172a',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      <View className="flex-row justify-between">
        <Text className="text-sm font-semibold text-text-secondary">Start</Text>
        <Text className="text-sm font-semibold text-text-secondary">End</Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-xl font-bold text-text-primary">{times.start}</Text>
        <Text className="text-xl font-bold text-text-primary">{times.end}</Text>
      </View>

      <View className="mt-3 gap-3">
        <Text className="text-base font-semibold text-text-primary">Time allotted</Text>
        <View className="flex-row items-center justify-center gap-4">
          <Pressable
            onPressIn={decrementPress.onPressIn}
            onPressOut={decrementPress.onPressOut}
            className="h-11 w-11 items-center justify-center rounded-full bg-[#EEF5FF]"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Minus size={20} color="#2563EB" />
          </Pressable>
          <View className="min-w-[64px] flex-row items-center justify-center rounded-lg bg-[#F0F6FF] px-2 py-1">
            <TextInput
              value={localMinutes}
              onChangeText={handleChangeText}
              keyboardType="number-pad"
              selectTextOnFocus
              maxLength={3}
              className="text-center text-2xl font-bold text-brand-primary"
              style={{ minWidth: 28, padding: 0 }}
            />
            <Text className="text-2xl font-bold text-brand-primary">m</Text>
          </View>
          <Pressable
            onPressIn={incrementPress.onPressIn}
            onPressOut={incrementPress.onPressOut}
            className="h-11 w-11 items-center justify-center rounded-full bg-[#EEF5FF]"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Plus size={20} color="#2563EB" />
          </Pressable>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleExpand(item.id);
          }}
          className="items-center py-1"
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <Text className="text-sm font-semibold text-brand-primary">Done</Text>
        </Pressable>
      </View>
    </View>
  );
};

type DraggableItemProps = {
  item: RoutineItem;
  positions: Animated.SharedValue<Positions>;
  heights: Animated.SharedValue<Heights>;
  activeId: Animated.SharedValue<string | null>;
  isDragging: Animated.SharedValue<boolean>;
  itemCount: Animated.SharedValue<number>;
  onReorder: (positions: Positions) => void;
  onToggleExpand: (id: string) => void;
  getStartEnd: (id: string) => { start: string; end: string };
  expanded: boolean;
  onChangeMinutes: (id: string, value: number) => void;
  onDelete: (id: string) => void;
  onDragStart?: () => void;
  onMeasure: (id: string, height: number) => void;
};

const DraggableItem = ({
  item,
  positions,
  heights,
  activeId,
  isDragging,
  itemCount,
  onReorder,
  onToggleExpand,
  getStartEnd,
  expanded,
  onChangeMinutes,
  onDelete,
  onDragStart,
  onMeasure,
}: DraggableItemProps) => {
  // absoluteY tracks the exact visual Y position during drag
  const absoluteY = useSharedValue(0);
  // startY captures where the item was when drag began
  const startY = useSharedValue(0);

  const commitReorder = useCallback(
    (newPositions: Positions) => {
      onReorder(newPositions);
    },
    [onReorder],
  );

  const gesture = Gesture.Pan()
    .activateAfterLongPress(150)
    .enabled(!expanded)
    .onStart(() => {
      // onStart fires AFTER the long press delay - this is when drag actually begins
      isDragging.value = true;
      activeId.value = item.id;
      // Capture starting position - this never changes during drag
      const currentOffset = getOffsetForId(positions.value, heights.value, item.id);
      startY.value = currentOffset;
      absoluteY.value = currentOffset;
      if (onDragStart) {
        runOnJS(onDragStart)();
      }
    })
    .onUpdate((event) => {
      // Directly follow the finger - absoluteY = start position + how far finger moved
      absoluteY.value = startY.value + event.translationY;
      
      // Calculate where the CENTER of the dragged item currently is
      const currentHeight = heights.value[item.id] ?? DEFAULT_HEIGHT;
      const itemCenterY = absoluteY.value + currentHeight / 2;
      
      // Find what index this center position corresponds to
      const maxIndex = (itemCount.value ?? 1) - 1;
      const targetIndex = clampIndex(
        findIndexForCenterExcluding(positions.value, heights.value, itemCenterY, item.id),
        maxIndex,
      );
      
      // Update positions if needed (this moves OTHER items, not the dragged one)
      if (targetIndex !== positions.value[item.id]) {
        positions.value = adjustPositions(positions.value, item.id, targetIndex);
      }
    })
    .onEnd(() => {
      // Animate from current position to final slot position
      const finalY = getOffsetForId(positions.value, heights.value, item.id);
      absoluteY.value = withSpring(finalY, SPRING_CONFIG, () => {
        activeId.value = null;
        isDragging.value = false;
      });
      runOnJS(commitReorder)({ ...positions.value });
    })
    .onFinalize(() => {
      if (activeId.value === item.id) {
        const finalY = getOffsetForId(positions.value, heights.value, item.id);
        absoluteY.value = withSpring(finalY, SPRING_CONFIG, () => {
          activeId.value = null;
          isDragging.value = false;
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeId.value === item.id;
    
    if (isActive) {
      // Active item: follows finger exactly via absoluteY
      return {
        position: 'absolute',
        left: 0,
        right: 0,
        shadowColor: '#0f172a',
        transform: [
          { translateY: absoluteY.value },
          { scale: withTiming(1.03, { duration: 100 }) },
        ],
        zIndex: 100,
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 12,
      };
    }
    
    // Non-active items: spring to their calculated positions
    const targetY = getOffsetForId(positions.value, heights.value, item.id);
    return {
      position: 'absolute',
      left: 0,
      right: 0,
      shadowColor: '#0f172a',
      transform: [
        { translateY: withSpring(targetY, LAYOUT_SPRING) },
        { scale: withTiming(1, { duration: 100 }) },
      ],
      zIndex: 0,
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={(event) => {
          const measuredHeight = event.nativeEvent.layout.height;
          // Only update if significantly different to avoid layout thrashing
          const currentHeight = heights.value[item.id];
          if (currentHeight === undefined || Math.abs(currentHeight - measuredHeight) > 1) {
            heights.value = { ...heights.value, [item.id]: measuredHeight };
            onMeasure(item.id, measuredHeight);
          }
        }}
        style={animatedStyle}
      >
        <RoutineItemCard
          title={item.title}
          minutes={item.minutes}
          icon={item.icon}
          onPress={() => onToggleExpand(item.id)}
          onDelete={() => onDelete(item.id)}
          minutesLabel={`${item.minutes}m`}
          expanded={expanded}
        />

        {expanded ? (
          <TimeEditPanel
            item={item}
            getStartEnd={getStartEnd}
            onChangeMinutes={onChangeMinutes}
            onToggleExpand={onToggleExpand}
          />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
};

export const DraggableRoutineList = ({
  items,
  expandedId,
  onToggleExpand,
  onChangeMinutes,
  onDelete,
  onReorder,
  onDragStart,
  getStartEnd,
}: DraggableRoutineListProps) => {
  const [heightsState, setHeightsState] = useState<Heights>({});
  const positions = useSharedValue<Positions>(buildPositions(items));
  const heights = useSharedValue<Heights>({});
  const activeId = useSharedValue<string | null>(null);
  const isDragging = useSharedValue(false);
  const itemCount = useSharedValue(items.length);
  const itemsRef = useRef(items);
  const prevItemIds = useRef<string[]>(items.map((i) => i.id));

  useEffect(() => {
    itemsRef.current = items;
    itemCount.value = items.length;

    // Only reset positions if items were added/removed, not during reorder
    const currentIds = items.map((i) => i.id);
    const idsChanged =
      currentIds.length !== prevItemIds.current.length ||
      currentIds.some((id, idx) => !prevItemIds.current.includes(id));

    if (idsChanged && !isDragging.value) {
      positions.value = buildPositions(items);
      // Clean up heights for removed items
      const heightsCopy = { ...heights.value };
      Object.keys(heightsCopy).forEach((id) => {
        if (!currentIds.includes(id)) {
          delete heightsCopy[id];
        }
      });
      heights.value = heightsCopy;
    }
    prevItemIds.current = currentIds;
  }, [items, positions, itemCount, isDragging, heights]);

  const commitOrder = useCallback(
    (positionsMap: Positions) => {
      const sorted = [...itemsRef.current].sort(
        (a, b) => (positionsMap[a.id] ?? 0) - (positionsMap[b.id] ?? 0),
      );
      onReorder(sorted);
    },
    [onReorder],
  );

  const handleMeasure = useCallback((id: string, height: number) => {
    setHeightsState((prev) => {
      if (Math.abs((prev[id] ?? 0) - height) < 2) return prev;
      return { ...prev, [id]: height };
    });
  }, []);

  const containerHeight = useMemo(() => listHeight(items, heightsState), [items, heightsState]);

  // Animated container height for smooth transitions
  const animatedContainerHeight = useDerivedValue(() => {
    return withSpring(containerHeight, LAYOUT_SPRING);
  }, [containerHeight]);

  const containerStyle = useAnimatedStyle(() => ({
    height: animatedContainerHeight.value,
  }));

  return (
    <Animated.View style={containerStyle} className="relative">
      {items.map((item) => (
        <DraggableItem
          key={item.id}
          item={item}
          positions={positions}
          heights={heights}
          activeId={activeId}
          isDragging={isDragging}
          itemCount={itemCount}
          onReorder={commitOrder}
          onToggleExpand={onToggleExpand}
          getStartEnd={getStartEnd}
          expanded={expandedId === item.id}
          onChangeMinutes={onChangeMinutes}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onMeasure={handleMeasure}
        />
      ))}
    </Animated.View>
  );
};
