import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from '../molecules/SectionHeader';
import { ScheduleItem } from '../molecules/ScheduleItem';
import { Sun, CheckCircle2, Video } from 'lucide-react-native';

export const ScheduleList = () => {
    const router = useRouter();
    return (
        <View style={{ marginBottom: 8 }}>
            <SectionHeader title="YOUR BIG 3 & SCHEDULE" actionText="View All" onActionPress={() => router.push('/calendar')} />
            <View style={{ 
                backgroundColor: 'white',
                borderRadius: 24,
                paddingHorizontal: 20,
                paddingVertical: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 2,
            }}>
                <ScheduleItem
                    icon={Sun}
                    title="Prayer & Reflection"
                    subtitle="Proverbs 3:5-6"
                    timeOrStatus="Now"
                    iconBgColor="#3B82F6"
                    iconColor="white"
                />
                <ScheduleItem
                    icon={CheckCircle2}
                    title="Q4 Strategy Deck"
                    subtitle="Priority #1"
                    timeOrStatus="Big 3"
                    iconBgColor="#F9FAFB"
                    iconColor="#9CA3AF"
                    hasBorder
                />
                <ScheduleItem
                    icon={Video}
                    title="Meeting with Cole"
                    subtitle="Strategy Sync"
                    timeOrStatus="3:00 PM"
                    iconBgColor="#F9FAFB"
                    iconColor="#9CA3AF"
                    hasBorder
                    isLast
                />
            </View>
        </View>
    );
};
