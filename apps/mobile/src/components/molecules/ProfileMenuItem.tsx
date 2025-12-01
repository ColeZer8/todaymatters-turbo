import { Pressable, Text, View } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { Icon } from '../atoms';

interface ProfileMenuItemProps {
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
}

export const ProfileMenuItem = ({ label, icon, onPress }: ProfileMenuItemProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center justify-between py-3"
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View className="flex-row items-center">
        <View className="items-center justify-center h-11 w-11 rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC]">
          <Icon icon={icon} size={18} color="#6B7280" />
        </View>
        <Text className="ml-3 text-[#111827] text-[15px] font-semibold">{label}</Text>
      </View>
      <Icon icon={ChevronRight} size={18} color="#CBD5E1" />
    </Pressable>
  );
};
