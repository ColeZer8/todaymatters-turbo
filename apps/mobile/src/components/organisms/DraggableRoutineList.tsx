import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RoutineItemCard } from '@/components/molecules';
import type { RoutineItem } from '@/components/templates/RoutineBuilderTemplate';

const DEFAULT_HEIGHT = 96;
const ITEM_SPACING = 12;
const SPRING_CONFIG = { damping: 20, stiffness: 220 };

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

type DraggableItemProps = {
  item: RoutineItem;
  positions: Animated.SharedValue<Positions>;
  heights: Animated.SharedValue<Heights>;
  activeId: Animated.SharedValue<string | null>;
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
  const translateY = useSharedValue(0);

  const commitReorder = useCallback(
    (newPositions: Positions) => {
      onReorder(newPositions);
    },
    [onReorder],
  );

  const gesture = Gesture.Pan()
    .activateAfterLongPress(120)
    .onBegin(() => {
      activeId.value = item.id;
      translateY.value = 0;
      if (onDragStart) {
        runOnJS(onDragStart)();
      }
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
      const currentHeight = heights.value[item.id] ?? DEFAULT_HEIGHT;
      const startOffset = getOffsetForId(positions.value, heights.value, item.id);
      const centerY = startOffset + event.translationY + currentHeight / 2;
      const maxIndex = (itemCount.value ?? 1) - 1;
      const nextIndex = clampIndex(
        findIndexForCenter(positions.value, heights.value, centerY),
        maxIndex,
      );
      if (nextIndex !== positions.value[item.id]) {
        positions.value = adjustPositions(positions.value, item.id, nextIndex);
      }
    })
    .onEnd(() => {
      translateY.value = withSpring(0, SPRING_CONFIG);
      activeId.value = null;
      runOnJS(commitReorder)({ ...positions.value });
    })
    .onFinalize(() => {
      translateY.value = withSpring(0, SPRING_CONFIG);
      activeId.value = null;
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeId.value === item.id;
    const y = getOffsetForId(positions.value, heights.value, item.id);
    return {
      position: 'absolute',
      left: 0,
      right: 0,
      shadowColor: '#0f172a',
      transform: [
        { translateY: isActive ? y + translateY.value : withSpring(y, SPRING_CONFIG) },
        { scale: withTiming(isActive ? 1.02 : 1, { duration: 120 }) },
      ],
      zIndex: isActive ? 10 : 0,
      shadowOpacity: withTiming(isActive ? 0.12 : 0.05, { duration: 120 }),
      elevation: isActive ? 8 : 3,
    };
  }, [item.id, positions, heights, activeId, translateY]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={(event) => {
          const measuredHeight = event.nativeEvent.layout.height;
          heights.value = { ...heights.value, [item.id]: measuredHeight };
          onMeasure(item.id, measuredHeight);
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
        />

        {expanded ? (
          <View className="mt-3 rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4 shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
            <View className="flex-row justify-between">
              <Text className="text-sm font-semibold text-text-secondary">Start</Text>
              <Text className="text-sm font-semibold text-text-secondary">End</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xl font-bold text-text-primary">{getStartEnd(item.id).start}</Text>
              <Text className="text-xl font-bold text-text-primary">{getStartEnd(item.id).end}</Text>
            </View>

            <View className="mt-3 gap-3">
              <Text className="text-base font-semibold text-text-primary">Time allotted</Text>
              <View className="flex-row items-center justify-center gap-3">
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onChangeMinutes(item.id, Math.max(1, item.minutes - 5));
                  }}
                  className="h-10 w-10 items-center justify-center rounded-full bg-[#EEF5FF]"
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <Minus size={18} color="#2563EB" />
                </Pressable>
                <Text className="text-2xl font-bold text-text-primary">{item.minutes}m</Text>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onChangeMinutes(item.id, item.minutes + 5);
                  }}
                  className="h-10 w-10 items-center justify-center rounded-full bg-[#EEF5FF]"
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <Plus size={18} color="#2563EB" />
                </Pressable>
              </View>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleExpand(item.id);
                }}
                className="items-center"
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <Text className="text-sm font-semibold text-text-secondary">Done</Text>
              </Pressable>
            </View>
          </View>
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
  const itemCount = useSharedValue(items.length);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
    positions.value = buildPositions(items);
    itemCount.value = items.length;
  }, [items, positions, itemCount]);

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
      if (prev[id] === height) return prev;
      return { ...prev, [id]: height };
    });
  }, []);

  const containerHeight = useMemo(() => listHeight(items, heightsState), [items, heightsState]);

  return (
    <View style={{ height: containerHeight }} className="relative">
      {items.map((item) => (
        <DraggableItem
          key={item.id}
          item={item}
          positions={positions}
          heights={heights}
          activeId={activeId}
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
    </View>
  );
};
