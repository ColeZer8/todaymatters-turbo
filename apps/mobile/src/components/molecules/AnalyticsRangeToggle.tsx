import { Pressable, PressableProps, Text, View } from 'react-native';

interface RangeOption {
  label: string;
  value: string;
}

interface AnalyticsRangeToggleProps extends Pick<PressableProps, 'accessibilityLabel'> {
  options: RangeOption[];
  value: string;
  onChange: (nextValue: string) => void;
}

export const AnalyticsRangeToggle = ({
  options,
  value,
  onChange,
  accessibilityLabel,
}: AnalyticsRangeToggleProps) => {
  return (
    <View
      className="flex-row items-center gap-1 px-1.5 py-1 border border-[#E5E7EB] rounded-full bg-white"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option.value)}
            className={`items-center justify-center px-4 py-1.5 rounded-full ${isActive ? 'bg-[#1F2937]' : 'bg-transparent'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? 'text-white' : 'text-[#6B7280]'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
