import { View, TouchableOpacity } from 'react-native';
import { Typography } from '../atoms/Typography';
import { Avatar } from '../atoms/Avatar';

interface CommunicationItemProps {
    name: string;
    message: string;
    time: string;
    unread?: boolean;
    initials: string;
    onPress?: () => void;
}

export const CommunicationItem = ({
    name,
    message,
    time,
    unread = false,
    initials,
    onPress
}: CommunicationItemProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-row items-center p-4 rounded-2xl border ${unread ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}
        >
            <View className="mr-4">
                <Avatar initials={initials} size={40} />
                {unread && (
                    <View className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                )}
            </View>

            <View className="flex-1">
                <View className="flex-row justify-between items-center mb-1">
                    <Typography variant="h3" className="text-base font-semibold text-gray-900">
                        {name}
                    </Typography>
                    <Typography variant="caption" className={`text-xs ${unread ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {time}
                    </Typography>
                </View>
                <Typography variant="body" className="text-sm text-gray-600" numberOfLines={1}>
                    {message}
                </Typography>
            </View>
        </TouchableOpacity>
    );
};
