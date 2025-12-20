import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type ViewStyle } from 'react-native';
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
    onPress();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onPress, repeatInterval);
    }, initialDelay);
  }, [onPress, initialDelay, repeatInterval]);

  const onPressOut = useCallback(() => {
    clear();
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { onPressIn, onPressOut };
};

const ITEM_SPACING = 12;
const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.8 };

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

// Time edit panel component
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
  const minutesRef = useRef(item.minutes);
  minutesRef.current = item.minutes;

  const [localMinutes, setLocalMinutes] = useState(String(item.minutes));

  useEffect(() => {
    setLocalMinutes(String(item.minutes));
  }, [item.minutes]);

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
        marginTop: -1,
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

type RoutineItemWithDragProps = {
  item: RoutineItem;
  index: number;
  expanded: boolean;
  draggedIndex: number | null;
  targetIndex: number | null;
  draggedItemHeight: number;
  onToggleExpand: (id: string) => void;
  onChangeMinutes: (id: string, value: number) => void;
  onDelete: (id: string) => void;
  getStartEnd: (id: string) => { start: string; end: string };
  onDragStart: (index: number, height: number) => void;
  onDragMove: (translationY: number) => void;
  onDragEnd: () => void;
  onMeasure: (index: number, height: number) => void;
};

const RoutineItemWithDrag = ({
  item,
  index,
  expanded,
  draggedIndex,
  targetIndex,
  draggedItemHeight,
  onToggleExpand,
  onChangeMinutes,
  onDelete,
  getStartEnd,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMeasure,
}: RoutineItemWithDragProps) => {
  const isDragged = draggedIndex === index;
  const isDraggingAny = draggedIndex !== null;
  
  // Animated values
  const dragTranslateY = useSharedValue(0);
  const displaceY = useSharedValue(0);
  const scale = useSharedValue(1);
  
  const itemHeightRef = useRef(88);

  // Calculate displacement for non-dragged items when target changes
  useEffect(() => {
    if (isDragged || draggedIndex === null || targetIndex === null) {
      // Dragged item or no drag happening - no displacement
      displaceY.value = withSpring(0, SPRING_CONFIG);
      return;
    }

    const moveAmount = draggedItemHeight + ITEM_SPACING;

    if (draggedIndex < targetIndex) {
      // Dragging down: items between (draggedIndex, targetIndex] move UP
      if (index > draggedIndex && index <= targetIndex) {
        displaceY.value = withSpring(-moveAmount, SPRING_CONFIG);
      } else {
        displaceY.value = withSpring(0, SPRING_CONFIG);
      }
    } else if (draggedIndex > targetIndex) {
      // Dragging up: items in [targetIndex, draggedIndex) move DOWN
      if (index >= targetIndex && index < draggedIndex) {
        displaceY.value = withSpring(moveAmount, SPRING_CONFIG);
      } else {
        displaceY.value = withSpring(0, SPRING_CONFIG);
      }
    } else {
      // Target same as dragged - no displacement
      displaceY.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isDragged, draggedIndex, targetIndex, index, draggedItemHeight, displaceY]);

  // Reset displacement when drag ends - use instant reset to avoid glitchy animation
  useEffect(() => {
    if (!isDraggingAny) {
      // Instant reset - no spring animation to avoid conflict with reorder
      displaceY.value = 0;
      dragTranslateY.value = 0;
      scale.value = 1;
    }
  }, [isDraggingAny, displaceY, dragTranslateY, scale]);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .enabled(!expanded)
    .onStart(() => {
      scale.value = withTiming(1.03, { duration: 100 });
      runOnJS(onDragStart)(index, itemHeightRef.current);
    })
    .onUpdate((event) => {
      dragTranslateY.value = event.translationY;
      runOnJS(onDragMove)(event.translationY);
    })
    .onEnd(() => {
      // Reset scale immediately for snappy feel
      scale.value = withTiming(1, { duration: 100 });
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      scale.value = 1;
    });

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => {
    // Dragged item uses dragTranslateY, others use displaceY
    const translateY = isDragged ? dragTranslateY.value : displaceY.value;

    const transform = [{ translateY }, { scale: scale.value }] as const;

    return {
      // RN's Transform type is extremely strict; this is a safe runtime shape.
      transform: transform as unknown as ViewStyle['transform'],
      zIndex: isDragged ? 100 : 0,
      shadowOpacity: isDragged ? 0.15 : 0.05,
      elevation: isDragged ? 12 : 3,
    };
  });

  return (
    <View
      style={{ marginBottom: ITEM_SPACING }}
      onLayout={(e) => {
        const height = e.nativeEvent.layout.height;
        itemHeightRef.current = height;
        onMeasure(index, height);
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            {
              shadowColor: '#0f172a',
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 3 },
            },
            animatedStyle,
          ]}
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
    </View>
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
  const [dragState, setDragState] = useState<{
    draggedIndex: number | null;
    targetIndex: number | null;
    draggedItemHeight: number;
  }>({
    draggedIndex: null,
    targetIndex: null,
    draggedItemHeight: 88,
  });

  const itemHeights = useRef<number[]>(new Array(items.length).fill(88));
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Keep heights array in sync with items count
  useEffect(() => {
    if (itemHeights.current.length !== items.length) {
      const newHeights = new Array(items.length).fill(88);
      // Preserve existing measurements
      for (let i = 0; i < Math.min(itemHeights.current.length, items.length); i++) {
        newHeights[i] = itemHeights.current[i];
      }
      itemHeights.current = newHeights;
    }
  }, [items.length]);

  const handleMeasure = useCallback((index: number, height: number) => {
    if (itemHeights.current[index] !== height) {
      itemHeights.current[index] = height;
    }
  }, []);

  const handleDragStart = useCallback((index: number, height: number) => {
    itemHeights.current[index] = height;
    setDragState({
      draggedIndex: index,
      targetIndex: index,
      draggedItemHeight: height,
    });
    onDragStart?.();
  }, [onDragStart]);

  const handleDragMove = useCallback((translationY: number) => {
    setDragState((prev) => {
      if (prev.draggedIndex === null) return prev;

      const heights = itemHeights.current;
      
      // Calculate the Y position of each slot boundary
      // A "slot" is the space where an item can be dropped
      const draggedOriginalTop = heights
        .slice(0, prev.draggedIndex)
        .reduce((sum, h) => sum + h + ITEM_SPACING, 0);
      
      // Current center Y of the dragged item
      const draggedCenter = draggedOriginalTop + translationY + prev.draggedItemHeight / 2;

      // Find which slot the dragged item's center is over
      let accumulatedY = 0;
      let newTargetIndex = 0;
      
      for (let i = 0; i < items.length; i++) {
        const slotCenter = accumulatedY + heights[i] / 2;
        
        if (draggedCenter > slotCenter) {
          newTargetIndex = i;
          // If we're past the center of this item, target should be after it
          if (i !== prev.draggedIndex) {
            newTargetIndex = i;
          }
        }
        
        accumulatedY += heights[i] + ITEM_SPACING;
      }

      // Clamp to valid range
      newTargetIndex = Math.max(0, Math.min(newTargetIndex, items.length - 1));

      // More intuitive: if dragging down past an item's center, take its place
      // if dragging up past an item's center, take its place
      accumulatedY = 0;
      for (let i = 0; i < items.length; i++) {
        const itemTop = accumulatedY;
        const itemBottom = accumulatedY + heights[i];
        const itemCenter = itemTop + heights[i] / 2;
        
        if (i < prev.draggedIndex && draggedCenter < itemCenter) {
          // Dragging up: if our center is above this item's center, target this slot
          newTargetIndex = i;
          break;
        } else if (i > prev.draggedIndex && draggedCenter > itemCenter) {
          // Dragging down: if our center is below this item's center, target this slot
          newTargetIndex = i;
        }
        
        accumulatedY += heights[i] + ITEM_SPACING;
      }

      if (newTargetIndex !== prev.targetIndex) {
        return { ...prev, targetIndex: newTargetIndex };
      }
      return prev;
    });
  }, [items.length]);

  const handleDragEnd = useCallback(() => {
    const { draggedIndex, targetIndex } = dragState;
    
    // First, reorder the items if needed (this updates parent state)
    if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
      const newItems = [...itemsRef.current];
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, removed);
      onReorder(newItems);
    }

    // Then reset drag state - items are already in new positions from reorder
    setDragState({
      draggedIndex: null,
      targetIndex: null,
      draggedItemHeight: 88,
    });
  }, [dragState, onReorder]);

  return (
    <View>
      {items.map((item, index) => (
        <RoutineItemWithDrag
          key={item.id}
          item={item}
          index={index}
          expanded={expandedId === item.id}
          draggedIndex={dragState.draggedIndex}
          targetIndex={dragState.targetIndex}
          draggedItemHeight={dragState.draggedItemHeight}
          onToggleExpand={onToggleExpand}
          onChangeMinutes={onChangeMinutes}
          onDelete={onDelete}
          getStartEnd={getStartEnd}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onMeasure={handleMeasure}
        />
      ))}
    </View>
  );
};
