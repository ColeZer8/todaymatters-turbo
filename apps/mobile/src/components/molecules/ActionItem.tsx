import { View, TouchableOpacity, Text } from 'react-native';
import { Icon } from '../atoms/Icon';
import { LucideIcon, ChevronRight } from 'lucide-react-native';

interface ActionItemProps {
    icon: LucideIcon;
    title: string;
    description: string;
    iconBgColor?: string;
    iconColor?: string;
    onPress?: () => void;
}

export const ActionItem = ({
    icon,
    title,
    description,
    iconBgColor = "#FEF2F2",
    iconColor = "#EF4444",
    onPress
}: ActionItemProps) => {
    return (
        <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}>
            <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 16, 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginRight: 16,
                backgroundColor: iconBgColor,
            }}>
                <Icon icon={icon} size={22} color={iconColor} />
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 }}>{title}</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#9CA3AF', lineHeight: 20 }} numberOfLines={2}>
                    {description}
                </Text>
            </View>
            <Icon icon={ChevronRight} size={22} color="#D1D5DB" />
        </TouchableOpacity>
    );
};
