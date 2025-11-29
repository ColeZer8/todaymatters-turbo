import { Pressable, Text, View } from 'react-native';

interface RadioOptionCardProps {
  label: string;
  description?: string;
  badge?: string;
  selected?: boolean;
  onPress: () => void;
}

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const RadioOptionCard = ({
  label,
  description,
  badge,
  selected = false,
  onPress,
}: RadioOptionCardProps) => {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`w-full flex-row items-center justify-between rounded-2xl border px-5 py-5 ${
        selected ? 'border-brand-primary bg-[#F5F9FF]' : 'border-[#E4E8F0] bg-white'
      }`}
      style={({ pressed }) => [
        cardShadowStyle,
        { opacity: pressed ? 0.96 : 1 },
      ]}
    >
      <View className="flex-1 flex-row items-center gap-3">
        {badge ? (
          <View
            className={`min-w-[58px] items-center justify-center rounded-xl border px-3 py-2 ${
              selected ? 'border-brand-primary bg-[#E1ECFF]' : 'border-[#E5E7EB] bg-[#F9FAFB]'
            }`}
          >
            <Text
              className={`text-base font-bold ${
                selected ? 'text-brand-primary' : 'text-text-secondary'
              }`}
            >
              {badge}
            </Text>
          </View>
        ) : null}

        <View className="flex-1 gap-1">
          <Text className={`text-lg font-semibold ${selected ? 'text-brand-primary' : 'text-text-primary'}`}>
            {label}
          </Text>
          {description ? (
            <Text className="text-base leading-5 text-text-secondary">{description}</Text>
          ) : null}
        </View>
      </View>

      <View
        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
          selected ? 'border-brand-primary bg-[#E1ECFF]' : 'border-[#D1DBEC] bg-white'
        }`}
      >
        {selected ? <View className="h-[10px] w-[10px] rounded-full bg-brand-primary" /> : null}
      </View>
    </Pressable>
  );
};
