import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateNavigator } from '../molecules/DateNavigator';
import { CalendarEventItem } from '../molecules/CalendarEventItem';
import { FloatingActionButton } from '../atoms/FloatingActionButton';
import { BottomToolbar } from '../organisms/BottomToolbar';
import { Sun, Target, Coffee, Users, Video, Smile, Heart } from 'lucide-react-native';

// Mock event data
const EVENTS = [
    {
        id: '1',
        icon: Sun,
        title: 'Intentional Start',
        subtitle: 'Morning Routine',
        time: '8:00 AM',
        iconBgColor: 'bg-blue-100',
        iconColor: '#3B82F6'
    },
    {
        id: '2',
        icon: Target,
        title: 'Deep Work: Strategy',
        subtitle: 'Q4 Planning',
        time: '9:30 AM',
        iconBgColor: 'bg-gray-100',
        iconColor: '#6B7280'
    },
    {
        id: '3',
        icon: Coffee,
        title: 'Lunch Break',
        subtitle: 'Disconnect',
        time: '12:00 PM',
        iconBgColor: 'bg-orange-100',
        iconColor: '#F97316'
    },
    {
        id: '4',
        icon: Users,
        title: 'Team Sync',
        subtitle: 'Weekly Standup',
        time: '1:00 PM',
        iconBgColor: 'bg-purple-100',
        iconColor: '#A855F7'
    },
    {
        id: '5',
        icon: Video,
        title: 'Meeting with Cole',
        subtitle: 'Strategy Sync',
        time: '3:00 PM',
        iconBgColor: 'bg-gray-100',
        iconColor: '#6B7280'
    },
    {
        id: '6',
        icon: Smile,
        title: 'Shutdown Ritual',
        subtitle: 'Clear inbox & plan tomorrow',
        time: '5:00 PM',
        iconBgColor: 'bg-green-100',
        iconColor: '#10B981'
    },
    {
        id: '7',
        icon: Heart,
        title: 'Family Dinner',
        subtitle: 'Quality time',
        time: '6:30 PM',
        iconBgColor: 'bg-pink-100',
        iconColor: '#EC4899'
    }
];

export const CalendarTemplate = () => {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white">
            <DateNavigator date="Friday, Nov 8" />

            <ScrollView className="flex-1 px-6">
                <View className="bg-white rounded-3xl px-4 py-2 shadow-sm shadow-gray-100 mb-6">
                    {EVENTS.map((event) => (
                        <CalendarEventItem
                            key={event.id}
                            icon={event.icon}
                            title={event.title}
                            subtitle={event.subtitle}
                            time={event.time}
                            iconBgColor={event.iconBgColor}
                            iconColor={event.iconColor}
                        />
                    ))}
                </View>
            </ScrollView>

            <FloatingActionButton />
            <BottomToolbar />
        </View>
    );
};
