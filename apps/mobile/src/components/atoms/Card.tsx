import { View, ViewProps } from "react-native";

interface CardProps extends ViewProps {
  className?: string;
}

export const Card = ({ className, children, ...props }: CardProps) => {
  return (
    <View className={`bg-white rounded-2xl p-4 ${className || ""}`} {...props}>
      {children}
    </View>
  );
};
