import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScheduleItem } from '../molecules/ScheduleItem';
import { Sun, CheckCircle2, Video } from 'lucide-react-native';

export const ScheduleList = () => {
    const router = useRouter();

    const items = [
        {
            id: 1,
            icon: Sun,
            title: "Prayer & Reflection",
            subtitle: "Proverbs 3:5-6",
            meta: "Now",
            isPrimary: true
        },
        {
            id: 2,
            icon: CheckCircle2,
            title: "Q4 Strategy Deck",
            subtitle: "Priority #1",
            meta: "Big 3",
            isPrimary: false
        },
        {
            id: 3,
            icon: Video,
            title: "Meeting with Cole",
            subtitle: "Strategy Sync",
            meta: "3:00 PM",
            isPrimary: false
        }
    ];

    return (
        <View style={styles.container}>
            <View style={styles.big3HeaderRow}>
                <Text style={styles.big3Label}>YOUR BIG 3 & SCHEDULE</Text>
                <TouchableOpacity onPress={() => router.replace('/calendar')}>
                    <Text style={styles.big3ViewAll}>View All</Text>
                </TouchableOpacity>
            </View>

            {items.map((item, index) => (
                <View key={item.id}>
                    <ScheduleItem
                        icon={item.icon}
                        title={item.title}
                        subtitle={item.subtitle}
                        timeOrStatus={item.meta}
                        isPrimary={item.isPrimary}
                    />
                    {index < items.length - 1 && (
                        <View style={styles.rowDivider} />
                    )}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 22,
        marginBottom: 16,
        paddingHorizontal: 6,
    },
    big3HeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    big3Label: {
        fontSize: 11.5,
        letterSpacing: 0.9,
        fontWeight: '800',
        color: '#0F172A',
    },
    big3ViewAll: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB',
    },
    rowDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(148,163,184,0.4)',
        marginLeft: 52,
    },
});
