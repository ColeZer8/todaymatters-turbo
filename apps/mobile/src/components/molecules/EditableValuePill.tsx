import { Pressable, Text, View } from "react-native";
import { MinusCircle } from "lucide-react-native";

interface EditableValuePillProps {
  label: string;
  onRemove: () => void;
}

export const EditableValuePill = ({
  label,
  onRemove,
}: EditableValuePillProps) => {
  return (
    <View className="relative">
      <View className="flex-row items-center self-start px-4 py-2 rounded-full border border-[#E5E7EB] bg-[#F2F4F7]">
        <Text className="text-sm font-semibold text-[#1F2937]">{label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        onPress={onRemove}
        className="absolute -top-2 -right-2 h-6 w-6 items-center justify-center rounded-full bg-white"
        style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
      >
        <MinusCircle size={18} color="#EF4444" fill="#FFF5F5" />
      </Pressable>
    </View>
  );
};
