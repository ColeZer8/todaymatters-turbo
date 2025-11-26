import { LucideIcon } from 'lucide-react-native';
import { View, StyleProp, ViewStyle } from 'react-native';

interface IconProps {
    icon: LucideIcon;
    size?: number;
    color?: string;
    className?: string;
    style?: StyleProp<ViewStyle>;
}

export const Icon = ({ icon: IconComponent, size = 24, color = "black", className, style }: IconProps) => {
    return (
        <View className={className} style={style}>
            <IconComponent size={size} color={color} />
        </View>
    );
};
