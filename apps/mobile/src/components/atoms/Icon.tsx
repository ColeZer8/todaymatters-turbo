import { LucideIcon } from "lucide-react-native";
import { View, StyleProp, ViewStyle } from "react-native";

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const Icon = ({
  icon: IconComponent,
  size = 24,
  color = "black",
  fill,
  strokeWidth,
  className,
  style,
}: IconProps) => {
  // IMPORTANT: don't pass `fill`/`strokeWidth` when undefined.
  // Lucide icons default to `fill="none"`, but explicitly passing `undefined`
  // can drop the default and cause icons to render with a black fill.
  const iconProps: Record<string, unknown> = { size, color };
  if (fill !== undefined) iconProps.fill = fill;
  if (strokeWidth !== undefined) iconProps.strokeWidth = strokeWidth;

  return (
    <View className={className} style={style}>
      <IconComponent {...iconProps} />
    </View>
  );
};
