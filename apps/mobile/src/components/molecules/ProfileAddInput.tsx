import { Pressable, Text, TextInput, View } from 'react-native';

type AccentTone = 'blue' | 'purple';

interface ProfileAddInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onAdd?: () => void;
  accent?: AccentTone;
}

const accentStyles: Record<AccentTone, { button: string }> = {
  blue: { button: '#2563EB' },
  purple: { button: '#A855F7' },
};

export const ProfileAddInput = ({
  placeholder,
  value,
  onChangeText,
  onAdd,
  accent = 'blue',
}: ProfileAddInputProps) => {
  const accentStyle = accentStyles[accent];
  const isDisabled = !value.trim() || !onAdd;

  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (!isDisabled) {
            onAdd?.();
          }
        }}
        className="flex-1 h-12 px-4 rounded-2xl border border-[#E8EDF5] bg-[#F7F9FC] text-[15px] font-semibold text-[#111827]"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        disabled={isDisabled}
        onPress={onAdd}
        className="items-center justify-center h-12 px-4 rounded-2xl"
        style={({ pressed }) => [
          {
            backgroundColor: isDisabled ? '#B7C8EB' : accentStyle.button,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text className="text-[14px] font-semibold text-white">Add</Text>
      </Pressable>
    </View>
  );
};
