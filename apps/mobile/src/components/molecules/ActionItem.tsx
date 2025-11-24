import { View, TouchableOpacity } from 'react-native';
import { Typography } from '../atoms/Typography';
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
    iconBgColor = "bg-red-50",
    iconColor = "#EF4444",
    onPress
}: ActionItemProps) => {
    return (
        <TouchableOpacity onPress={onPress} className="flex-row items-center py-4">
            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${iconBgColor}`}>
                <Icon icon={icon} size={20} color={iconColor} />
            </View>
            <View className="flex-1 pr-4">
                <Typography variant="h3" className="text-base">{title}</Typography>
                <Typography variant="body" className="text-sm text-gray-500 leading-5" numberOfLines={2}>
                    {description}
                </Typography>
            </View>
            <Icon icon={ChevronRight} size={20} color="#D1D5DB" />
        </TouchableOpacity>
    );
};
