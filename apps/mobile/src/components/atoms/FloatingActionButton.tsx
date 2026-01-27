import { View, TouchableOpacity } from "react-native";
import { Plus } from "lucide-react-native";
import { Icon } from "./Icon";

interface FloatingActionButtonProps {
  onPress?: () => void;
  bottomOffset?: number;
}

export const FloatingActionButton = ({
  onPress,
  bottomOffset = 80,
}: FloatingActionButtonProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-300"
      style={{ elevation: 5, bottom: bottomOffset }}
    >
      <Icon icon={Plus} size={28} color="white" />
    </TouchableOpacity>
  );
};
