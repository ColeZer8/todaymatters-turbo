import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, MessageSquare, Mail, Hash } from 'lucide-react-native';
import { Icon } from '../atoms/Icon';
import { CommunicationItem, CommunicationSource } from '../molecules/CommunicationItem';

export interface Communication {
    id: string;
    name: string;
    message: string;
    time: string;
    unread: boolean;
    initials: string;
    source: CommunicationSource;
    channel?: string; // For Slack
}

export interface CommunicationTemplateProps {
    communications: Communication[];
    isLoading?: boolean;
    errorMessage?: string | null;
}

// Count unread by source
const getUnreadCounts = (communications: Communication[]) => {
    const counts = { sms: 0, outlook: 0, gmail: 0, slack: 0, total: 0 };
    communications.forEach(c => {
        if (c.unread) {
            counts[c.source]++;
            counts.total++;
        }
    });
    return counts;
};

export const CommunicationTemplate = ({
    communications,
    isLoading = false,
    errorMessage = null,
}: CommunicationTemplateProps) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const unreadCounts = getUnreadCounts(communications);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft} />
                <Text style={styles.headerTitle}>Communications</Text>
                <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [
                        styles.closeButton,
                        { opacity: pressed ? 0.7 : 1 }
                    ]}
                    hitSlop={10}
                >
                    <Icon icon={X} size={20} color="#64748B" />
                </Pressable>
            </View>

            {/* Source Summary Pills */}
            <View style={styles.summaryContainer}>
                <View style={styles.summaryPills}>
                    <View style={[styles.pill, styles.pillSms]}>
                        <Icon icon={MessageSquare} size={14} color="#10B981" />
                        <Text style={styles.pillText}>
                            {unreadCounts.sms} Texts
                        </Text>
                    </View>
                    <View style={[styles.pill, styles.pillOutlook]}>
                        <Icon icon={Mail} size={14} color="#0078D4" />
                        <Text style={styles.pillText}>
                            {unreadCounts.outlook} Outlook
                        </Text>
                    </View>
                    <View style={[styles.pill, styles.pillGmail]}>
                        <Icon icon={Mail} size={14} color="#EA4335" />
                        <Text style={styles.pillText}>
                            {unreadCounts.gmail} Gmail
                        </Text>
                    </View>
                    <View style={[styles.pill, styles.pillSlack]}>
                        <Icon icon={Hash} size={14} color="#611f69" />
                        <Text style={styles.pillText}>
                            {unreadCounts.slack} Slack
                        </Text>
                    </View>
                </View>
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>ALL MESSAGES</Text>
                <Text style={styles.sectionCount}>
                    {unreadCounts.total} unread
                </Text>
            </View>

            {/* Communications List */}
            <FlatList
                data={communications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <CommunicationItem
                        name={item.name}
                        message={item.message}
                        time={item.time}
                        unread={item.unread}
                        initials={item.initials}
                        source={item.source}
                        channel={item.channel}
                    />
                )}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + 24 }
                ]}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>
                            {isLoading ? 'Loading Gmail…' : errorMessage ? 'Couldn’t load Gmail' : 'No Gmail messages yet'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {isLoading
                                ? 'Fetching your latest emails from Supabase.'
                                : errorMessage
                                    ? errorMessage
                                    : 'When Gmail sync runs, your emails will show up here.'}
                        </Text>
                    </View>
                )}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7FAFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#F7FAFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(148, 163, 184, 0.3)',
    },
    headerLeft: {
        width: 36,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0F172A',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    summaryPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
    },
    pillSms: {
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    pillOutlook: {
        backgroundColor: 'rgba(0, 120, 212, 0.08)',
        borderColor: 'rgba(0, 120, 212, 0.2)',
    },
    pillGmail: {
        backgroundColor: 'rgba(234, 67, 53, 0.08)',
        borderColor: 'rgba(234, 67, 53, 0.2)',
    },
    pillSlack: {
        backgroundColor: 'rgba(97, 31, 105, 0.08)',
        borderColor: 'rgba(97, 31, 105, 0.2)',
    },
    pillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontSize: 11.5,
        letterSpacing: 0.9,
        fontWeight: '800',
        color: '#0F172A',
    },
    sectionCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2563EB',
    },
    listContent: {
        paddingHorizontal: 20,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(148, 163, 184, 0.3)',
        marginLeft: 64,
    },
    emptyState: {
        paddingTop: 28,
        paddingHorizontal: 4,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: '#64748B',
    },
});
