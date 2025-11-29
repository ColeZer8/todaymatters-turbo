import { Pressable, Text, View } from 'react-native';

type PillTone = 'primary' | 'danger';

interface SelectablePillProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  tone?: PillTone;
}

export const SelectablePill = ({ 
  label, 
  selected = false, 
  onPress, 
  tone = 'primary' 
}: SelectablePillProps) => {
  
  // Base classes
  const baseContainer = "rounded-full border px-6 py-3 self-start shadow-sm";
  const baseText = "text-base font-medium";

  // Unselected state (same for both tones)
  const unselectedContainer = "bg-white border-gray-200";
  const unselectedText = "text-gray-700";

  // Selected states
  const selectedPrimaryContainer = "bg-blue-600 border-blue-600";
  const selectedDangerContainer = "bg-red-500 border-red-500";
  const selectedText = "text-white font-bold";

  // Determine active classes
  const isPrimary = tone === 'primary';
  const activeContainer = isPrimary ? selectedPrimaryContainer : selectedDangerContainer;
  
  return (
    <View 
      className={`${baseContainer} ${
        selected ? activeContainer : unselectedContainer
      }`}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className="active:opacity-80"
      >
        <Text 
          className={`${baseText} ${
            selected ? selectedText : unselectedText
          }`}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
};
