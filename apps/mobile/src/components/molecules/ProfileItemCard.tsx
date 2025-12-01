import { Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { Icon } from '../atoms';

type AccentTone = 'blue' | 'purple';

interface ProfileItemCardProps {
  label: string;
  icon: LucideIcon;
  accent?: AccentTone;
}

const accentStyles: Record<AccentTone, { icon: string; background: string; ring: string }> = {
  blue: {
    icon: '#3B82F6',
    background: '#E9F1FF',
    ring: '#DDE7FF',
  },
  purple: {
    icon: '#A855F7',
    background: '#F3E9FF',
    ring: '#E8D8FF',
  },
};

const cardShadow = {
  shadowColor: '#111827',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const ProfileItemCard = ({
  label,
  icon,
  accent = 'blue',
}: ProfileItemCardProps) => {
  const accentStyle = accentStyles[accent];

  return (
    <View
      className="flex-row items-center px-4 py-4 rounded-2xl border border-[#E8EDF5] bg-white"
      style={cardShadow}
    >
      <View
        className="items-center justify-center h-12 w-12 mr-3 rounded-full border"
        style={{ backgroundColor: accentStyle.background, borderColor: accentStyle.ring }}
      >
        <Icon icon={icon} size={22} color={accentStyle.icon} />
      </View>
      <Text className="flex-1 text-[#111827] text-[15px] font-semibold">{label}</Text>
    </View>
  );
};
