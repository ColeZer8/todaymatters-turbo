import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, MessageSquare, Mail, Hash } from 'lucide-react-native';
import { Icon } from '../atoms/Icon';
import { CommunicationItem, CommunicationSource } from '../molecules/CommunicationItem';

interface Communication {
    id: string;
    name: string;
    message: string;
    time: string;
    timestamp: number; // For sorting
    unread: boolean;
    initials: string;
    source: CommunicationSource;
    channel?: string; // For Slack
}

// Mock data - mixed communications sorted by recency
const COMMUNICATIONS = ([
    {
        id: '1',
        name: 'Connor',
        message: 'Hey, are we still on for the meeting tomorrow? I want to make sure we have all the documents ready.',
        time: '10:30 AM',
        timestamp: 1030,
        unread: true,
        initials: 'C',
        source: 'sms',
    },
    {
        id: '2',
        name: 'Sarah Chen',
        message: 'Q4 Budget Review - Please review the attached spreadsheet and let me know your thoughts before EOD.',
        time: '10:15 AM',
        timestamp: 1015,
        unread: true,
        initials: 'SC',
        source: 'outlook',
    },
    {
        id: '3',
        name: 'Grady',
        message: 'I sent over the designs you asked for. Let me know if you need any revisions!',
        time: '9:15 AM',
        timestamp: 915,
        unread: true,
        initials: 'G',
        source: 'sms',
    },
    {
        id: '4',
        name: 'Mike Thompson',
        message: 'Just pushed the latest updates to the feature branch. Ready for review when you have a moment.',
        time: '9:02 AM',
        timestamp: 902,
        unread: true,
        initials: 'MT',
        source: 'slack',
        channel: 'engineering',
    },
    {
        id: '5',
        name: 'Newsletter',
        message: 'Your weekly digest is here! Top stories: AI developments, market trends, and more...',
        time: '8:30 AM',
        timestamp: 830,
        unread: false,
        initials: 'N',
        source: 'gmail',
    },
    {
        id: '6',
        name: 'Emily Rodriguez',
        message: 'Great meeting yesterday! Here are the action items we discussed. Let me know if I missed anything.',
        time: '8:12 AM',
        timestamp: 812,
        unread: false,
        initials: 'ER',
        source: 'slack',
        channel: 'product',
    },
    {
        id: '7',
        name: 'Mom',
        message: 'Don\'t forget dinner on Sunday! Dad is making his famous lasagna 🍝',
        time: 'Yesterday',
        timestamp: 700,
        unread: false,
        initials: 'M',
        source: 'sms',
    },
    {
        id: '8',
        name: 'David Park',
        message: 'Invoice #4521 - Please find attached the invoice for last month\'s services.',
        time: 'Yesterday',
        timestamp: 600,
        unread: false,
        initials: 'DP',
        source: 'outlook',
    },
    {
        id: '9',
        name: 'Team Updates',
        message: 'Weekly sync notes are posted. Key highlights: New feature launch, team OKRs progress.',
        time: 'Yesterday',
        timestamp: 500,
        unread: false,
        initials: 'TU',
        source: 'slack',
        channel: 'general',
    },
    {
        id: '10',
        name: 'AWS',
        message: 'Your monthly bill is ready. Total charges: $127.43. View your detailed billing...',
        time: 'Yesterday',
        timestamp: 400,
        unread: false,
        initials: 'A',
        source: 'gmail',
    },
] satisfies Communication[]).sort((a, b) => b.timestamp - a.timestamp);

// Count unread by source
const getUnreadCounts = () => {
    const counts = { sms: 0, outlook: 0, gmail: 0, slack: 0, total: 0 };
    COMMUNICATIONS.forEach(c => {
        if (c.unread) {
            counts[c.source]++;
            counts.total++;
        }
    });
    return counts;
};

export const CommunicationTemplate = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const unreadCounts = getUnreadCounts();

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
                data={COMMUNICATIONS}
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
});
