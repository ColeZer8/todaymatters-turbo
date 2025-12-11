import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScheduleItem } from '../molecules/ScheduleItem';
import { useEventsStore, formatMinutesToDisplay, useCurrentMinutes } from '@/stores';
import { Sun, Target, Coffee, Users, Video, Smile, Heart, Moon, Briefcase, Car } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { EventCategory } from '@/stores';

// Map categories to icons
const CATEGORY_ICONS: Record<EventCategory, LucideIcon> = {
    routine: Sun,
    work: Briefcase,
    meal: Coffee,
    meeting: Users,
    health: Heart,
    family: Heart,
    social: Users,
    travel: Car,
    finance: Briefcase,
    comm: Video,
    digital: Video,
    sleep: Moon,
    unknown: Target,
    free: Smile,
};

export const ScheduleList = () => {
    const router = useRouter();
    const scheduledEvents = useEventsStore((state) => state.scheduledEvents);

    // Get current time in minutes from midnight (uses simulated time in demo mode)
    const nowMinutes = useCurrentMinutes();
    
    // Get events that are current or upcoming (not yet ended), sorted chronologically
    const relevantEvents = scheduledEvents
        .filter((e) => e.startMinutes + e.duration > nowMinutes)
        .sort((a, b) => a.startMinutes - b.startMinutes)
        .slice(0, 3); // Show top 3
    
    // Check if any Big 3 items exist (for header label)
    const hasBig3 = scheduledEvents.some((e) => e.isBig3 && e.startMinutes + e.duration > nowMinutes);
    
    // Build display items in chronological order
    const displayItems: Array<{
        id: string;
        icon: LucideIcon;
        title: string;
        subtitle: string;
        meta: string;
        isPrimary: boolean;
    }> = relevantEvents.map((event, index) => {
        const isHappening = event.startMinutes <= nowMinutes && event.startMinutes + event.duration > nowMinutes;
        
        // Determine the meta label:
        // - If event is happening AND is Big 3 → "Big 3"
        // - If event is happening AND is normal → "Now"
        // - If event hasn't started yet → show time
        let meta: string;
        if (isHappening) {
            meta = event.isBig3 ? 'Big 3' : 'Now';
        } else {
            meta = formatMinutesToDisplay(event.startMinutes);
        }
        
        // First item is primary (blue) styling
        const isPrimary = index === 0;
        
        return {
            id: event.id,
            icon: CATEGORY_ICONS[event.category] || Sun,
            title: event.title,
            subtitle: event.description,
            meta,
            isPrimary,
        };
    });

    // Determine header label based on what we have
    const headerLabel = hasBig3 ? 'YOUR BIG 3 & SCHEDULE' : 'YOUR SCHEDULE';

    return (
        <View style={styles.container}>
            <View style={styles.big3HeaderRow}>
                <Text style={styles.big3Label}>{headerLabel}</Text>
                <TouchableOpacity onPress={() => router.replace('/calendar')}>
                    <Text style={styles.big3ViewAll}>View All</Text>
                </TouchableOpacity>
            </View>

            {displayItems.map((item, index) => (
                <View key={item.id}>
                    <ScheduleItem
                        icon={item.icon}
                        title={item.title}
                        subtitle={item.subtitle}
                        timeOrStatus={item.meta}
                        isPrimary={item.isPrimary}
                    />
                    {index < displayItems.length - 1 && (
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
