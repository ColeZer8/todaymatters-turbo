import { View } from 'react-native';
import { Typography } from '../atoms/Typography';
import { Icon } from '../atoms/Icon';
import { Avatar } from '../atoms/Avatar';
import { Search, Sparkles, BookOpen } from 'lucide-react-native';

export const HomeHeader = () => {
    return (
        <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
                <View className="w-10 h-10 bg-brand-primary rounded-xl items-center justify-center mr-3 shadow-sm shadow-blue-200">
                    <Typography className="text-white font-bold text-sm">TM</Typography>
                </View>
                <View>
                    <Typography variant="h3" className="text-base leading-5">Today Matters</Typography>
                    <Typography variant="caption" className="text-brand-primary font-medium">Friday, Nov 8</Typography>
                </View>
            </View>

            <View className="flex-row items-center space-x-4 gap-4">
                <Icon icon={Search} size={24} color="#9CA3AF" />
                <Icon icon={Sparkles} size={24} color="#2563EB" />
                <Icon icon={BookOpen} size={24} color="#9CA3AF" />
                <Avatar initials="P" />
            </View>
        </View>
    );
};
