import React from "react";
import { Text, View } from "react-native";

interface TextBadgeProps {
  label: string;
  className?: string;
  textClassName?: string;
}

export function TextBadge({
  label,
  className = "",
  textClassName = "text-white",
}: TextBadgeProps) {
  return (
    <View
      className={`flex-row items-center px-3 py-1 rounded-full border border-white/30 bg-white/10 ${className}`.trim()}
    >
      <Text className={`text-xs font-semibold ${textClassName}`.trim()}>{label}</Text>
    </View>
  );
}
