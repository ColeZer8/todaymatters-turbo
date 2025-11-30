import type { LucideIcon } from 'lucide-react-native';
import { Clock4, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

interface RoutineItemCardProps {
  title: string;
  minutes: number;
  icon: LucideIcon;
  onPress?: () => void;
  onDelete: () => void;
  minutesLabel?: string;
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
}: RoutineItemCardProps) => {
  return (
    <View
      className="w-full flex-row items-center gap-3 rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
      style={cardShadowStyle}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF5FF]"
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon size={22} color="#2563EB" />
      </Pressable>

      <View className="flex-1 gap-2">
        <Text className="text-base font-semibold text-text-primary">{title}</Text>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Clock4 size={14} color="#6B7280" />
            <Text className="text-sm text-text-secondary">{minutesLabel ?? `${minutes}m`}</Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityLabel={`Delete ${title}`}
        onPress={onDelete}
        className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]"
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
      >
        <Trash2 size={16} color="#6B7280" />
      </Pressable>
    </View>
  );
};
