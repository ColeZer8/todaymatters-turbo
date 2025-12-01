import { Text, View } from 'react-native';

interface ProfilePillProps {
  label: string;
}

export const ProfilePill = ({ label }: ProfilePillProps) => {
  return (
    <View className="flex-row items-center self-start px-4 py-2 rounded-full border border-[#E5E7EB] bg-[#F2F4F7]">
      <Text className="text-[#1F2937] text-sm font-semibold">{label}</Text>
    </View>
  );
};
