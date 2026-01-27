import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "./Icon";

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  rightIcon?: LucideIcon;
}

export const GradientButton = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  rightIcon,
}: GradientButtonProps) => {
  const isDisabled = disabled || loading;
  const handlePress = () => {
    if (isDisabled) return;
    // Hide the keyboard before navigating to avoid iOS layout flicker on physical devices
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      onPress();
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={handlePress}
      className="w-full"
      style={({ pressed }) => [{ opacity: pressed && !isDisabled ? 0.96 : 1 }]}
    >
      <View
        style={
          Platform.OS === "android" ? styles.androidOuter : styles.iosOuter
        }
      >
        <LinearGradient
          colors={["#3B82F6", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View className="flex-row items-center justify-center px-4 py-4">
            <Text className="text-base font-semibold text-white">
              {loading ? "Continuing..." : label}
            </Text>
            {rightIcon ? (
              <Icon icon={rightIcon} size={18} color="#fff" className="ml-2" />
            ) : null}
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  gradient: {
    width: "100%",
    borderRadius: 16,
  },
  iosOuter: {
    width: "100%",
    borderRadius: 16,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  androidOuter: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#2563EB",
    elevation: 6,
  },
});
