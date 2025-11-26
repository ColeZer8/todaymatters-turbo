import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from '../molecules/SectionHeader';
import { ScheduleItem } from '../molecules/ScheduleItem';
import { Sun, CheckCircle2, Video } from 'lucide-react-native';

export const ScheduleList = () => {
    const router = useRouter();
    return (
        <View className="mb-6">
            <SectionHeader title="YOUR BIG 3 & SCHEDULE" actionText="View All" onActionPress={() => router.push('/calendar')} />
            <View className="bg-white rounded-3xl px-4 py-2 shadow-sm shadow-gray-100">
                <ScheduleItem
                    icon={Sun}
                    title="Prayer & Reflection"
                    subtitle="Proverbs 3:5-6"
                    timeOrStatus="Now"
                    iconBgColor="bg-blue-600"
                    iconColor="white"
                />
                <ScheduleItem
                    icon={CheckCircle2}
                    title="Q4 Strategy Deck"
                    subtitle="Priority #1"
                    timeOrStatus="Big 3"
                    iconBgColor="bg-white border border-gray-100"
                    iconColor="#D1D5DB"
                />
                <ScheduleItem
                    icon={Video}
                    title="Meeting with Cole"
                    subtitle="Strategy Sync"
                    timeOrStatus="3:00 PM"
                    iconBgColor="bg-white border border-gray-100"
                    iconColor="#D1D5DB"
                />
            </View>
        </View>
    );
};
