import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from '../molecules/SectionHeader';
import { ActionItem } from '../molecules/ActionItem';
import { MessageSquare } from 'lucide-react-native';

export const PendingActions = () => {
    const router = useRouter();
    return (
        <View style={{ marginBottom: 24 }}>
            <SectionHeader title="PENDING ACTIONS" />
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
                <ActionItem
                    icon={MessageSquare}
                    title="4 Communications"
                    description="Connor, Grady, and 2 others need attention."
                    iconBgColor="#FEF2F2"
                    iconColor="#F87171"
                    onPress={() => router.push('/communication')}
                />
            </View>
        </View>
    );
};
