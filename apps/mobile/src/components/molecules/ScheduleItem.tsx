import { View, Text } from 'react-native';
import { Icon } from '../atoms/Icon';
import { LucideIcon } from 'lucide-react-native';

interface ScheduleItemProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    timeOrStatus: string;
    iconBgColor?: string;
    iconColor?: string;
    hasBorder?: boolean;
    isLast?: boolean;
}

export const ScheduleItem = ({
    icon,
    title,
    subtitle,
    timeOrStatus,
    iconBgColor = "#F3F4F6",
    iconColor = "#6B7280",
    hasBorder = false,
    isLast = false,
}: ScheduleItemProps) => {
    return (
        <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            paddingVertical: 16,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: '#F3F4F6',
        }}>
            <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 24, 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginRight: 16,
                backgroundColor: iconBgColor,
                borderWidth: hasBorder ? 1 : 0,
                borderColor: '#E5E7EB',
            }}>
                <Icon icon={icon} size={22} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 }}>{title}</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#9CA3AF' }}>{subtitle}</Text>
            </View>
            <View>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#9CA3AF' }}>
                    {timeOrStatus}
                </Text>
            </View>
        </View>
    );
};
