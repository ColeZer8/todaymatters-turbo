import { Pressable, Text, View } from "react-native";
import { ChevronRight, LucideIcon } from "lucide-react-native";
import { Icon } from "../atoms";

interface ProfileMenuItemProps {
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
  value?: string;
  isDanger?: boolean;
}

export const ProfileMenuItem = ({
  label,
  icon,
  onPress,
  value,
  isDanger = false,
}: ProfileMenuItemProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center justify-between py-3"
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View className="flex-row items-center">
        <View
          className={`items-center justify-center h-11 w-11 rounded-2xl ${
            isDanger
              ? "border border-[#FEE2E2] bg-[#FEF2F2]"
              : "border border-[#E5E9F2] bg-[#F7F9FC]"
          }`}
        >
          <Icon icon={icon} size={18} color={isDanger ? "#DC2626" : "#6B7280"} />
        </View>
        <Text
          className={`ml-3 text-[15px] font-semibold ${
            isDanger ? "text-[#DC2626]" : "text-[#111827]"
          }`}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {value ? (
          <Text className="text-[14px] font-semibold text-[#64748B]">
            {value}
          </Text>
        ) : null}
        <Icon
          icon={ChevronRight}
          size={18}
          color={isDanger ? "#FCA5A5" : "#CBD5E1"}
        />
      </View>
    </Pressable>
  );
};
