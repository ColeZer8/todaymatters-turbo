import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

interface ProfileSummaryCardProps {
  name: string;
  role: string;
  badgeLabel: string;
  initials?: string;
}

const avatarShadow = {
  shadowColor: "#111827",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export const ProfileSummaryCard = ({
  name,
  role,
  badgeLabel,
  initials,
}: ProfileSummaryCardProps) => {
  const safeInitials = initials || name.charAt(0).toUpperCase();

  return (
    <View className="items-center">
      <View
        className="items-center justify-center h-16 w-16 rounded-full bg-[#3655F2]"
        style={avatarShadow}
      >
        <Text className="text-white text-lg font-semibold">{safeInitials}</Text>
      </View>

      <Text className="mt-3 text-[#0F172A] text-[19px] font-semibold">
        {name}
      </Text>
      <Text className="mt-1 text-[#6B7280] text-sm font-medium">{role}</Text>

      <View className="flex-row items-center justify-center mt-2">
        <View className="flex-row items-center justify-center px-3 py-1.5 rounded-full border border-[#DDE7FF] bg-[#EEF2FF]">
          <Sparkles size={14} color="#3056D3" />
          <Text className="ml-1 text-[#3056D3] text-xs font-semibold">
            {badgeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};
