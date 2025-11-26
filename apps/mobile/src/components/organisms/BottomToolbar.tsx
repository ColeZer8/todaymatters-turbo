import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Calendar, BarChart3, User } from 'lucide-react-native';
import { Icon } from '../atoms/Icon';

export const BottomToolbar = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={{ 
            backgroundColor: 'white', 
            borderTopWidth: 1, 
            borderTopColor: '#F3F4F6',
            paddingBottom: insets.bottom,
        }}>
            <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-around', 
                alignItems: 'center', 
                paddingHorizontal: 24, 
                paddingTop: 12,
                paddingBottom: 8,
            }}>
                <TouchableOpacity style={{ alignItems: 'center', justifyContent: 'center', padding: 8 }} onPress={() => router.push('/')}>
                    <Icon icon={Home} size={24} color="#3B82F6" />
                </TouchableOpacity>

                <TouchableOpacity style={{ alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                    <Icon icon={Calendar} size={24} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={{ alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                    <Icon icon={BarChart3} size={24} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={{ alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                    <Icon icon={User} size={24} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        </View>
    );
};
