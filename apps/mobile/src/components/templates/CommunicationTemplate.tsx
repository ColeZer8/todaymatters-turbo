import { View, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Typography } from '../atoms/Typography';
import { Icon } from '../atoms/Icon';
import { CommunicationItem } from '../molecules';

// Mock data for now
const COMMUNICATIONS = [
    {
        id: '1',
        name: 'Connor',
        message: 'Hey, are we still on for the meeting tomorrow?',
        time: '10:30 AM',
        unread: true,
        avatar: 'C'
    },
    {
        id: '2',
        name: 'Grady',
        message: 'I sent over the designs you asked for.',
        time: '9:15 AM',
        unread: true,
        avatar: 'G'
    },
    {
        id: '3',
        name: 'Sarah',
        message: 'Can you review the PR when you get a chance?',
        time: 'Yesterday',
        unread: false,
        avatar: 'S'
    },
    {
        id: '4',
        name: 'Team Updates',
        message: 'Weekly sync notes are posted.',
        time: 'Yesterday',
        unread: false,
        avatar: 'T'
    }
];

export const CommunicationTemplate = () => {
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b border-gray-100">
                <Typography variant="h2" className="text-xl">Communications</Typography>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 items-center justify-center bg-gray-100 rounded-full"
                >
                    <Icon icon={X} size={20} color="#374151" />
                </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
                data={COMMUNICATIONS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <CommunicationItem
                        name={item.name}
                        message={item.message}
                        time={item.time}
                        unread={item.unread}
                        initials={item.avatar}
                    />
                )}
                contentContainerStyle={{ padding: 24 }}
                ItemSeparatorComponent={() => <View className="h-4" />}
            />
        </View>
    );
};
