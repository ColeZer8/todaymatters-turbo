import { View, Text, Image } from "react-native";

interface AvatarProps {
  initials?: string;
  imageUrl?: string;
  size?: number;
}

export const Avatar = ({ initials, imageUrl, size = 40 }: AvatarProps) => {
  return (
    <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center overflow-hidden border border-gray-200">
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} className="w-full h-full" />
      ) : (
        <Text className="text-gray-500 font-semibold">{initials}</Text>
      )}
    </View>
  );
};
