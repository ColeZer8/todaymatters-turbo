import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

interface IconListCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  selected?: boolean;
  onPress: () => void;
}

const cardShadowStyle = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const IconListCard = ({
  title,
  description,
  icon: Icon,
  selected = false,
  onPress,
}: IconListCardProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`w-full flex-row items-center gap-4 rounded-2xl border px-5 py-4 ${
        selected
          ? "border-brand-primary bg-[#F5F9FF]"
          : "border-[#E4E8F0] bg-white"
      }`}
      style={({ pressed }) => [
        cardShadowStyle,
        { opacity: pressed ? 0.96 : 1 },
      ]}
    >
      <View
        className={`h-12 w-12 items-center justify-center rounded-2xl ${
          selected ? "bg-[#E1ECFF]" : "bg-[#F3F4F6]"
        }`}
      >
        <Icon size={22} color={selected ? "#2563EB" : "#6B7280"} />
      </View>
      <View className="flex-1 gap-1">
        <Text
          className={`text-lg font-semibold ${selected ? "text-brand-primary" : "text-text-primary"}`}
        >
          {title}
        </Text>
        {description ? (
          <Text className="text-base leading-5 text-text-secondary">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};
