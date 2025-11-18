import React from "react";
import { Image, ImageStyle, Text, View } from "react-native";

interface AvatarProps {
  name: string;
  imageUri?: string;
  size?: number;
  className?: string;
  textClassName?: string;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

export function Avatar({
  name,
  imageUri,
  size = 48,
  className,
  textClassName = "text-[#1d4ed8]",
}: AvatarProps) {
  const dimension: ImageStyle = { width: size, height: size, borderRadius: size / 2 };

  if (imageUri) {
    return (
      <Image
        accessibilityLabel={`${name} avatar`}
        source={{ uri: imageUri }}
        className={className}
        style={dimension}
      />
    );
  }

  return (
    <View
      className={`items-center justify-center bg-[#dbe8ff] border border-white/40 ${className || ""}`}
      style={dimension}
    >
      <Text className={`${textClassName} text-base font-semibold`.trim()}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
