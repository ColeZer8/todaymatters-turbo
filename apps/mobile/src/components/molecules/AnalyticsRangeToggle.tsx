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
      className="flex-row items-center p-1 border border-[#D1D9E6] rounded-full bg-white"
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
            className={`flex-1 items-center justify-center py-2 rounded-full ${isActive ? 'bg-brand-primary' : 'bg-transparent'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? 'text-white' : 'text-text-secondary'
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
