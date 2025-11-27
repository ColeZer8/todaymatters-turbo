import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Calendar, BarChart3, User } from 'lucide-react-native';
import { Icon } from '../atoms/Icon';

export const BottomToolbar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const isHome = pathname === '/home';
    const isCalendar = pathname === '/calendar';

    return (
        <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
            <View style={styles.tabContent}>
                <TouchableOpacity className="items-center justify-center p-2" onPress={() => router.replace('/home')}>
                    <Icon icon={Home} size={24} color={isHome ? '#2563EB' : '#9CA3AF'} />
                </TouchableOpacity>

                <TouchableOpacity className="items-center justify-center p-2" onPress={() => router.replace('/calendar')}>
                    <Icon icon={Calendar} size={24} color={isCalendar ? '#2563EB' : '#9CA3AF'} />
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

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(226,232,240,0.9)',
        elevation: 6,
        shadowColor: '#0f172a',
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -3 },
    },
    tabContent: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 70,
        paddingHorizontal: 10,
    }
});
