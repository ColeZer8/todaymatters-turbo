import { View, TouchableOpacity } from 'react-native';
import { Typography } from '../atoms/Typography';
import { Icon } from '../atoms/Icon';
import { Search, Star, BookOpen, User } from 'lucide-react-native';

export const CalendarHeader = () => {
    return (
        <View className="flex-row justify-between items-center px-6 py-4">
            <View className="flex-row items-center">
                <View className="w-12 h-12 bg-blue-600 rounded-2xl items-center justify-center mr-3">
                    <Typography className="text-white font-bold text-base">TM</Typography>
                </View>
                <View>
                    <Typography variant="h3" className="text-base font-semibold">Today Matters</Typography>
                    <Typography variant="caption" className="text-blue-600 font-medium text-xs">Friday, Nov 8</Typography>
                </View>
            </View>

            <View className="flex-row items-center gap-4">
                <TouchableOpacity className="p-1">
                    <Icon icon={Search} size={22} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity className="p-1">
                    <Icon icon={Star} size={22} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity className="p-1">
                    <Icon icon={BookOpen} size={22} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity className="p-1">
                    <Icon icon={User} size={22} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        </View>
    );
};
