import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

interface IconChoiceCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
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

export const IconChoiceCard = ({
  title,
  description,
  icon: Icon,
  selected = false,
  onPress,
}: IconChoiceCardProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex flex-col items-center justify-center basis-[48%] min-h-[148px] gap-3 px-6 py-7 rounded-[28px] border ${
        selected ? 'border-brand-primary bg-[#F5F9FF]' : 'border-[#E4E8F0] bg-white'
      }`}
      style={({ pressed }) => [
        cardShadowStyle,
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View
        className={`flex items-center justify-center h-12 w-12 rounded-2xl ${
          selected ? 'bg-[#E1ECFF]' : 'bg-[#F3F4F6]'
        }`}
      >
        <Icon size={22} color={selected ? '#2563EB' : '#6B7280'} />
      </View>
      <View className="items-center gap-1.5">
        <Text className={`text-center ${selected ? 'text-brand-primary' : 'text-text-primary'} text-base font-semibold`}>
          {title}
        </Text>
        {description ? (
          <Text className="text-center text-text-secondary text-sm leading-[18px]">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};
