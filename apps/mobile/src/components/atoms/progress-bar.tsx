import React from "react";
import { View } from "react-native";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className = "" }: ProgressBarProps) {
  const progress = Math.min(Math.max(value, 0), 1);

  return (
    <View
      className={`h-2 w-full rounded-full bg-[#e7e9f2] ${className}`.trim()}
      accessible={false}
    >
      <View
        className="h-full rounded-full bg-[#316CFF]"
        style={{ width: `${progress * 100}%` }}
      />
    </View>
  );
}
