import { Pressable, Text, View } from "react-native";

interface ChoicePanelProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export const ChoicePanel = ({
  label,
  selected = false,
  onPress,
}: ChoicePanelProps) => {
  return (
    <View
      className={`w-full rounded-xl border bg-white ${
        selected
          ? "border-blue-600 bg-blue-50 shadow-sm"
          : "border-gray-200 shadow-sm"
      }`}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className="w-full px-6 py-3.5 active:opacity-80 justify-center"
      >
        <Text
          className={`text-lg ${
            selected ? "text-blue-600 font-bold" : "text-gray-900 font-medium"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
};
