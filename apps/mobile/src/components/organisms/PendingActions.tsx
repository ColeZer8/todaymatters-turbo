import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionItem } from '../molecules/ActionItem';
import { MessageSquare } from 'lucide-react-native';

export interface PendingActionsProps {
    communicationsCount: number;
    communicationsDescription: string;
}

export const PendingActions = ({ communicationsCount, communicationsDescription }: PendingActionsProps) => {
    const router = useRouter();
    return (
        <View style={styles.container}>
            <Text style={styles.label}>PENDING ACTIONS</Text>
            <View style={styles.row}>
                <ActionItem
                    icon={MessageSquare}
                    title={`${communicationsCount} Communications`}
                    description={communicationsDescription}
                    onPress={() => router.push('/communication')}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 36,
        marginBottom: 38,
    },
    label: {
        fontSize: 11.5,
        letterSpacing: 0.9,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 10,
    },
    row: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148,163,184,0.32)',
        paddingTop: 4,
        paddingBottom: 4,
    },
});
