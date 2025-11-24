import { View } from 'react-native';
import { Typography } from '../atoms/Typography';
import { Icon } from '../atoms/Icon';
import { LucideIcon } from 'lucide-react-native';

interface ScheduleItemProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    timeOrStatus: string;
    iconBgColor?: string;
    iconColor?: string;
}

export const ScheduleItem = ({
    icon,
    title,
    subtitle,
    timeOrStatus,
    iconBgColor = "bg-gray-50",
    iconColor = "#6B7280"
}: ScheduleItemProps) => {
    return (
        <View className="flex-row items-center py-4 border-b border-gray-50 last:border-b-0">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${iconBgColor}`}>
                <Icon icon={icon} size={20} color={iconColor} />
            </View>
            <View className="flex-1">
                <Typography variant="h3" className="text-base">{title}</Typography>
                <Typography variant="body" className="text-sm text-gray-500">{subtitle}</Typography>
            </View>
            <View>
                <Typography variant="caption" className="text-gray-400 font-medium">
                    {timeOrStatus}
                </Typography>
            </View>
        </View>
    );
};
