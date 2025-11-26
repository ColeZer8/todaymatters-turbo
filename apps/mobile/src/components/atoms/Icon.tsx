import { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

interface IconProps {
    icon: LucideIcon;
    size?: number;
    color?: string;
    className?: string;
}

export const Icon = ({ icon: IconComponent, size = 24, color = "black", className }: IconProps) => {
    return (
        <View className={className}>
            <IconComponent size={size} color={color} />
        </View>
    );
};
