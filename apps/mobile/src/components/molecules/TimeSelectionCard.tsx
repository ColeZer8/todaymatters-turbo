import type { LucideIcon } from 'lucide-react-native';
import { Clock3 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../atoms';

interface TimeSelectionCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accentColor: string;
  accentBackground: string;
  onPress: () => void;
}

export const TimeSelectionCard = ({
  label,
  value,
  icon,
  accentColor,
  accentBackground,
  onPress,
}: TimeSelectionCardProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center justify-between w-full px-4 py-4 rounded-3xl border border-[#E1E7F5] bg-white shadow-sm"
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.997 : 1 }] }]}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center rounded-2xl"
          style={{ backgroundColor: accentBackground, height: 44, width: 44 }}
        >
          <Icon icon={icon} size={20} color={accentColor} />
        </View>
        <View className="gap-1">
          <Text className="text-sm font-semibold text-text-primary">{label}</Text>
          <Text className="text-3xl font-extrabold text-text-primary tracking-tight">{value}</Text>
        </View>
      </View>
      <View className="items-center justify-center h-10 w-10 rounded-2xl border border-[#E1E7F5] bg-[#F6F8FD]">
        <Icon icon={Clock3} size={18} color="#0f172a" />
      </View>
    </Pressable>
  );
};
