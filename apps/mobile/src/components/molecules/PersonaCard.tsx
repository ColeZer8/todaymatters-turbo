import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

interface PersonaCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  selected?: boolean;
  selectedLabel?: string;
  onPress: () => void;
}

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const PersonaCard = ({
  title,
  description,
  icon: Icon,
  selected = false,
  selectedLabel = 'Selected',
  onPress,
}: PersonaCardProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`w-full rounded-3xl border px-5 py-6 ${
        selected ? 'border-brand-primary bg-[#F5F9FF]' : 'border-[#E4E8F0] bg-white'
      }`}
      style={({ pressed }) => [
        cardShadowStyle,
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View className="flex-row items-start gap-4">
        <View
          className={`h-12 w-12 items-center justify-center rounded-2xl ${
            selected ? 'bg-[#E1ECFF]' : 'bg-[#F3F4F6]'
          }`}
        >
          <Icon size={22} color={selected ? '#2563EB' : '#6B7280'} />
        </View>
        <View className="flex-1 gap-2">
          <View className="flex-row items-start justify-between gap-2">
            <Text
              className={`text-lg font-semibold ${
                selected ? 'text-brand-primary' : 'text-text-primary'
              }`}
            >
              {title}
            </Text>
            {selected ? (
              <View className="rounded-lg bg-[#E1ECFF] px-2.5 py-1 border border-brand-primary/30">
                <Text className="text-xs font-semibold uppercase tracking-[0.5px] text-brand-primary">
                  {selectedLabel}
                </Text>
              </View>
            ) : null}
          </View>
          {description ? (
            <Text className="text-base leading-5 text-text-secondary">
              {description}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};
