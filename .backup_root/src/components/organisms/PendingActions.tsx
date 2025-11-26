import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from '../molecules/SectionHeader';
import { ActionItem } from '../molecules/ActionItem';
import { MessageSquare } from 'lucide-react-native';

export const PendingActions = () => {
    const router = useRouter();
    return (
        <View className="mb-8">
            <SectionHeader title="PENDING ACTIONS" />
            <View className="bg-white rounded-3xl px-4 py-2 shadow-sm shadow-gray-100">
                <ActionItem
                    icon={MessageSquare}
                    title="4 Communications"
                    description="Connor, Grady, and 2 others need attention."
                    iconBgColor="bg-red-50"
                    iconColor="#EF4444"
                    onPress={() => router.push('/communication')}
                />
            </View>
        </View>
    );
};
