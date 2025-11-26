import { View, TouchableOpacity } from 'react-native';
import { Typography } from '../atoms/Typography';
import { Icon } from '../atoms/Icon';
import { LucideIcon } from 'lucide-react-native';

interface CalendarEventItemProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    time: string;
    iconBgColor?: string;
    iconColor?: string;
    onPress?: () => void;
}

export const CalendarEventItem = ({
    icon,
    title,
    subtitle,
    time,
    iconBgColor = "bg-gray-100",
    iconColor = "#6B7280",
    onPress
}: CalendarEventItemProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center py-4 border-b border-gray-50 last:border-b-0"
        >
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${iconBgColor}`}>
                <Icon icon={icon} size={20} color={iconColor} />
            </View>

            <View className="flex-1">
                <Typography variant="h3" className="text-base">{title}</Typography>
                <Typography variant="body" className="text-sm text-gray-500">
                    {subtitle}
                </Typography>
            </View>

            <Typography variant="caption" className="text-sm text-gray-400 font-medium">
                {time}
            </Typography>
        </TouchableOpacity>
    );
};
