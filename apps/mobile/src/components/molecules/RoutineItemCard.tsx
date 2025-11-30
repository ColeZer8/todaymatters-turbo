import type { LucideIcon } from 'lucide-react-native';
import { Clock4, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

interface RoutineItemCardProps {
  title: string;
  minutes: number;
  icon: LucideIcon;
  onPress?: () => void;
  onDelete: () => void;
  minutesLabel?: string;
  dragHandle?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const RoutineItemCard = ({
  title,
  minutes,
  icon: Icon,
  onPress,
  onDelete,
  minutesLabel,
  dragHandle,
  style,
}: RoutineItemCardProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="w-full flex-row items-center gap-3 rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
      style={({ pressed }) => [
        cardShadowStyle,
        style,
        {
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF5FF]">
        <Icon size={22} color="#2563EB" />
      </View>

      <View className="flex-1 gap-2">
        <Text className="text-base font-semibold text-text-primary">{title}</Text>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Clock4 size={14} color="#6B7280" />
            <Text className="text-sm text-text-secondary">{minutesLabel ?? `${minutes}m`}</Text>
          </View>
        </View>
      </View>

      {dragHandle ? <View className="mr-1 items-center justify-center">{dragHandle}</View> : null}

      <Pressable
        accessibilityLabel={`Delete ${title}`}
        onPress={(event: GestureResponderEvent) => {
          event.stopPropagation();
          onDelete();
        }}
        className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]"
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
      >
        <Trash2 size={16} color="#6B7280" />
      </Pressable>
    </Pressable>
  );
};
