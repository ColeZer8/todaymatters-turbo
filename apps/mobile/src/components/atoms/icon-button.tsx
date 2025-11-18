import React from "react";
import { Pressable, ViewProps } from "react-native";

type IconButtonIntent = "primary" | "surface";
type IconButtonTone = "dark" | "light";

interface IconButtonProps extends Pick<ViewProps, "className"> {
  icon: React.ReactNode;
  accessibilityLabel: string;
  intent?: IconButtonIntent;
  tone?: IconButtonTone;
  onPress?: () => void;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  intent = "surface",
  tone = "dark",
  className = "",
}: IconButtonProps) {
  const base = "items-center justify-center";
  const variant =
    intent === "primary"
      ? "bg-blue-500"
      : tone === "light"
        ? "border border-gray-200 bg-white"
        : "border border-white/40 bg-white/10 dark:border-blue-900/40 dark:bg-blue-900/30";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      onPress={onPress}
      className={`${base} ${variant} w-10 h-10 rounded-full ${className}`.trim()}
    >
      {icon}
    </Pressable>
  );
}
