import { Icon } from "@/components/atoms/Icon";
import type { LucideIcon } from "lucide-react-native";
import {
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

interface AuthInputProps extends Omit<TextInputProps, "className"> {
  label: string;
  icon: LucideIcon;
  onToggleSecureEntry?: () => void;
  secureTextEntry?: boolean;
  rightIcon?: LucideIcon;
}

export const AuthInput = ({
  label,
  icon,
  onToggleSecureEntry,
  secureTextEntry,
  rightIcon,
  ...props
}: AuthInputProps) => {
  const RightIconComponent = rightIcon;

  return (
    <View className="w-full">
      <Text className="text-base font-semibold text-text-primary">{label}</Text>
      <View className="flex-row items-center mt-2 px-4 py-3 rounded-3xl border border-slate-200 bg-white shadow-sm shadow-blue-100">
        <Icon icon={icon} size={20} color="#9CA3AF" />
        <TextInput
          placeholderTextColor="#9CA3AF"
          className="flex-1 ml-3 text-base text-text-primary"
          {...props}
          secureTextEntry={secureTextEntry}
        />
        {RightIconComponent && (
          <TouchableOpacity
            accessibilityRole="button"
            className="ml-3"
            onPress={onToggleSecureEntry}
            hitSlop={8}
          >
            <Icon icon={RightIconComponent} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
