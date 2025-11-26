import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Calendar, BarChart3, User } from 'lucide-react-native';
import { Icon } from '../atoms/Icon';

export const BottomToolbar = () => {
    const router = useRouter();

    return (
        <View
            className="bg-white border-t border-gray-100"
        >
            <View className="flex-row justify-around items-center px-6 py-2">
                <TouchableOpacity className="items-center justify-center p-2" onPress={() => router.push('/')}>
                    <Icon icon={Home} size={24} color="#2563EB" />
                </TouchableOpacity>

                <TouchableOpacity className="items-center justify-center p-2">
                    <Icon icon={Calendar} size={24} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity className="items-center justify-center p-2">
                    <Icon icon={BarChart3} size={24} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity className="items-center justify-center p-2">
                    <Icon icon={User} size={24} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        </View>
    );
};
