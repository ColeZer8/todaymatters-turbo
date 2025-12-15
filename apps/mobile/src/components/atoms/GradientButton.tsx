import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  rightIcon?: LucideIcon;
}

export const GradientButton = ({ label, onPress, disabled = false, loading = false, rightIcon }: GradientButtonProps) => {
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
      <LinearGradient
        colors={['#3B82F6', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full rounded-2xl"
      >
        <View className="flex-row items-center justify-center px-4 py-4 rounded-2xl shadow-lg shadow-blue-200">
          <Text className="text-base font-semibold text-white">
            {loading ? 'Continuing...' : label}
          </Text>
          {rightIcon ? <Icon icon={rightIcon} size={18} color="#fff" className="ml-2" /> : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
};
