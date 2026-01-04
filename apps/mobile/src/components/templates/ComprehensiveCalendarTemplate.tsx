import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react-native';
import { FloatingActionButton } from '../atoms/FloatingActionButton';
import { BottomToolbar } from '../organisms/BottomToolbar';
import { Icon } from '../atoms/Icon';
import { useReviewTimeStore, useEventsStore, useDemoStore } from '@/stores';
import type { ScheduledEvent } from '@/stores';
import { EventEditorModal } from '../molecules/EventEditorModal';

// Configuration
const START_HOUR = 0; // 12 AM
const END_HOUR = 23; // Last start hour of the day (11 PM), grid spans to midnight
const HOUR_HEIGHT = 72; // Slightly reduced for better proportions
const TIME_COLUMN_WIDTH = 56;
const GRID_TOP_PADDING = 0;
const GRID_BOTTOM_PADDING = 12; // base bottom padding; we add insets inside component
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;
const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const GRID_LINE_COLOR = 'rgba(148,163,184,0.28)';
const DAY_END_MINUTES = 24 * 60;
const VISIBILITY_DELAY_MINUTES = 10; // buffer before showing Actual events after the line passes

// Theme Colors - Matching Home Page
const COLORS = {
    primary: '#2563EB',
    background: '#F7FAFF', // App background - matches Home
    cardBg: '#FFFFFF',
    textDark: '#111827',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    border: 'rgba(148,163,184,0.25)',
    borderLight: 'rgba(148,163,184,0.12)',
    red: '#EF4444',
};

// Category Styling System - Softened colors for premium feel
const CATEGORY_STYLES: Record<string, { bg: string; accent: string; text: string; dashed?: boolean }> = {
    routine: { bg: '#EFF6FF', accent: '#3B82F6', text: '#1D4ED8' },
    work: { bg: '#F8FAFC', accent: '#64748B', text: '#475569' },
    meal: { bg: '#FFF8F3', accent: '#FB923C', text: '#C2410C' },
    meeting: { bg: '#FAF5FF', accent: '#A855F7', text: '#7C3AED' },
    health: { bg: '#F0FDF4', accent: '#22C55E', text: '#16A34A' },
    family: { bg: '#FDF2F8', accent: '#EC4899', text: '#DB2777' },
    error: { bg: '#FEF2F2', accent: '#F87171', text: '#DC2626' },
    social: { bg: '#ECFEFF', accent: '#22D3EE', text: '#0891B2' },
    travel: { bg: '#FFFBEB', accent: '#FBBF24', text: '#D97706' },
    finance: { bg: '#ECFDF5', accent: '#34D399', text: '#059669' },
    comm: { bg: '#F8FAFC', accent: '#94A3B8', text: '#64748B' },
    digital: { bg: '#F0F9FF', accent: '#38BDF8', text: '#0284C7' },
    sleep: { bg: '#EEF2FF', accent: '#818CF8', text: '#4F46E5' }, // Soft indigo - much lighter
    unknown: { bg: '#FAFAFA', accent: '#CBD5E1', text: '#64748B', dashed: true },
    free: { bg: '#F0FDFA', accent: '#2DD4BF', text: '#0D9488' },
};

// Helper to calculate position
const getCurrentMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
};

const formatMinutesLabel = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const suffix = hrs >= 12 ? 'p' : 'a';
    const hourDisplay = hrs % 12 === 0 ? 12 : hrs % 12;
    return `${hourDisplay}${mins === 0 ? '' : `:${mins.toString().padStart(2, '0')}`}${suffix}`;
};

const getPosition = (startMinutes: number, duration: number) => {
    const startOffset = startMinutes - START_HOUR * 60;
    const rawTop = (startOffset / 60) * HOUR_HEIGHT;
    const rawHeight = (duration / 60) * HOUR_HEIGHT;

    const clampedTop = Math.max(rawTop, 0);
    const clampedBottom = Math.min(rawTop + rawHeight, GRID_HEIGHT);
    const height = Math.max(clampedBottom - clampedTop, 12);

    return { top: clampedTop, height };
};

// Event type for the calendar (matches store structure)
type CalendarEvent = {
    id: string;
    title: string;
    description: string;
    startMinutes: number;
    duration: number;
    category: string;
    isBig3?: boolean;
};

interface TimeEventBlockProps {
    event: CalendarEvent;
    visibleUntilMinutes?: number;
    onPress?: (event: CalendarEvent) => void;
}

const TimeEventBlock = ({ event, visibleUntilMinutes, onPress }: TimeEventBlockProps) => {
    const router = useRouter();
    const setHighlightedBlockId = useReviewTimeStore((state) => state.setHighlightedBlockId);
    const eventStart = event.startMinutes;
    const eventEnd = event.startMinutes + event.duration;
    const effectiveVisibleEnd = visibleUntilMinutes ? Math.min(eventEnd, visibleUntilMinutes) : eventEnd;
    const visibleDuration = Math.max(effectiveVisibleEnd - eventStart, 0);
    const shouldRender = visibleDuration > 0;
    const { top, height } = getPosition(eventStart, visibleDuration || 1);
    const catStyles = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.work;
    const isUnknown = event.category === 'unknown';
    const extendsAbove = eventStart <= START_HOUR * 60;
    const extendsBelow = eventEnd >= DAY_END_MINUTES;
    const hasHiddenTail = !!visibleUntilMinutes && visibleUntilMinutes < eventEnd;
    
    if (!shouldRender) {
        return null;
    }
    
    const isSmall = event.duration < 30;
    const isTiny = event.duration < 20;

    const handlePress = () => {
        if (isUnknown) {
            // Set which block to highlight before navigating
            setHighlightedBlockId(event.id);
            router.push('/review-time');
            return;
        }

        onPress?.(event);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.75}
            style={[
                styles.eventBlock,
                {
                    top,
                    height: Math.max(height - 2, 16),
                    backgroundColor: catStyles.bg,
                    borderLeftColor: catStyles.accent,
                    borderStyle: isUnknown ? 'dashed' : 'solid',
                    borderColor: isUnknown ? catStyles.accent : 'transparent',
                    borderWidth: isUnknown ? 1 : 0,
                    borderLeftWidth: 3,
                    paddingVertical: isTiny ? 1 : 4,
                    justifyContent: isTiny ? 'center' : 'flex-start',
                    borderTopLeftRadius: extendsAbove ? 0 : 6,
                    borderTopRightRadius: extendsAbove ? 0 : 6,
                    borderBottomLeftRadius: extendsBelow || hasHiddenTail ? 0 : 6,
                    borderBottomRightRadius: extendsBelow || hasHiddenTail ? 0 : 6,
                    // Subtle shadow for depth
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 2,
                    elevation: 1,
                },
            ]}
        >
            <View style={styles.eventContent}>
                {isUnknown && !isTiny && (
                    <Icon icon={HelpCircle} size={10} color={catStyles.text} style={{ marginRight: 3, opacity: 0.7 }} />
                )}
                <Text 
                    numberOfLines={1} 
                    style={[
                        styles.eventTitle,
                        { 
                            color: catStyles.text,
                            fontSize: isTiny ? 9 : 11,
                            lineHeight: isTiny ? 11 : 14,
                        }
                    ]}
                >
                    {event.title}
                </Text>
            </View>
            {!isSmall && event.description && (
                <Text 
                    numberOfLines={1} 
                    style={[
                        styles.eventDescription,
                        { color: catStyles.text }
                    ]}
                >
                    {event.description}
                </Text>
            )}
        </TouchableOpacity>
    );
};

export const ComprehensiveCalendarTemplate = () => {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView | null>(null);
    const [scrollViewHeight, setScrollViewHeight] = useState(0);
    const [hasAutoCentered, setHasAutoCentered] = useState(false);
    const bottomPadding = GRID_BOTTOM_PADDING + insets.bottom + 16; // small cushion while keeping end tight
    const contentHeight = GRID_HEIGHT + GRID_TOP_PADDING + bottomPadding;
    const [realMinutes, setRealMinutes] = useState(getCurrentMinutes());
    const [editorEvent, setEditorEvent] = useState<ScheduledEvent | null>(null);
    const [editorColumn, setEditorColumn] = useState<'planned' | 'actual'>('planned');
    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const scheduledEvents = useEventsStore((state) => state.scheduledEvents);
    const actualEvents = useEventsStore((state) => state.derivedActualEvents ?? state.actualEvents);

    // Demo mode support - use simulated time when active
    const isDemoActive = useDemoStore((state) => state.isActive);
    const simulatedHour = useDemoStore((state) => state.simulatedHour);
    const simulatedMinute = useDemoStore((state) => state.simulatedMinute);
    
    // Use simulated time in demo mode, real time otherwise
    const currentMinutes = isDemoActive 
        ? (simulatedHour * 60 + simulatedMinute) 
        : realMinutes;

    const handleAddEvent = () => {
        router.push('/add-event');
    };

    const hours = [];
    for (let i = START_HOUR; i <= END_HOUR; i++) {
        hours.push(i);
    }

    useEffect(() => {
        // Only update real time when not in demo mode
        if (isDemoActive) return;
        
        const interval = setInterval(() => {
            setRealMinutes(getCurrentMinutes());
        }, 30000);

        return () => clearInterval(interval);
    }, [isDemoActive]);

    // Calculate current time indicator position
    const currentIndicatorTop = getPosition(currentMinutes, 0).top;
    const shouldShowCurrentIndicator = currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60;
    const clampedIndicatorTop = Math.min(Math.max(currentIndicatorTop, 0), GRID_HEIGHT);
    const currentIndicatorOffset = GRID_TOP_PADDING + clampedIndicatorTop;
    const visibilityCutoff = currentMinutes - VISIBILITY_DELAY_MINUTES;

    const handleOpenEditor = (event: CalendarEvent, column: 'planned' | 'actual') => {
        // Find the full event from the store to get isBig3 status
        const fullEvent = column === 'planned' 
            ? scheduledEvents.find(e => e.id === event.id)
            : actualEvents.find(e => e.id === event.id);
        
        if (fullEvent) {
            setEditorEvent(fullEvent);
            setEditorColumn(column);
            setIsEditorVisible(true);
        }
    };

    const handleCloseEditor = () => {
        setIsEditorVisible(false);
        setEditorEvent(null);
    };

    useEffect(() => {
        if (!shouldShowCurrentIndicator || !scrollViewHeight || hasAutoCentered) {
            return;
        }

        const maxScroll = Math.max(contentHeight - scrollViewHeight, 0);
        const desiredOffset = currentIndicatorOffset - scrollViewHeight / 2;
        const clampedOffset = Math.min(Math.max(desiredOffset, 0), maxScroll);

        scrollViewRef.current?.scrollTo({ y: clampedOffset, animated: false });
        setHasAutoCentered(true);
    }, [contentHeight, currentIndicatorOffset, hasAutoCentered, scrollViewHeight, shouldShowCurrentIndicator]);

    // Format date like Home page
    const dayName = 'Friday,';
    const dateStr = 'November 8';

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            {/* Premium Header - Matching Home Style */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.dateSection}>
                        <Text style={styles.dayText}>{dayName}</Text>
                        <Text style={styles.dateText}>{dateStr}</Text>
                    </View>
                    <View style={styles.navButtons}>
                        <TouchableOpacity style={styles.navButton} activeOpacity={0.7}>
                            <Icon icon={ChevronLeft} size={22} color={COLORS.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navButton} activeOpacity={0.7}>
                            <Icon icon={ChevronRight} size={22} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Calendar Card Container */}
            <View style={styles.calendarCard}>
                {/* Column Headers */}
                <View style={styles.columnHeaders}>
                    <View style={{ width: TIME_COLUMN_WIDTH }} />
                    <View style={styles.headerLabelContainer}>
                        <Text style={styles.headerLabel}>PLANNED</Text>
                    </View>
                    <View style={styles.headerDivider} />
                    <View style={styles.headerLabelContainer}>
                        <Text style={styles.headerLabel}>ACTUAL</Text>
                    </View>
                </View>

                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={{
                        height: contentHeight,
                        paddingTop: GRID_TOP_PADDING,
                        paddingBottom: bottomPadding,
                    }}
                    bounces={false}
                    alwaysBounceVertical={false}
                    overScrollMode="never"
                    onLayout={(event) => setScrollViewHeight(event.nativeEvent.layout.height)}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.gridRow, { height: GRID_HEIGHT }]}>
                        {/* Time Column */}
                        <View style={styles.timeColumn}>
                {hours.map((hour) => (
                    <View key={hour} style={styles.timeSlot}>
                        <Text style={styles.timeLabel}>
                            {hour === 0
                                ? '12a'
                                : hour === 12
                                    ? '12p'
                                    : hour > 12
                                        ? `${hour - 12}p`
                                        : `${hour}a`}
                        </Text>
                    </View>
                ))}
                        </View>

                        {/* Grid Container */}
                        <View style={styles.gridContainer}>
                            {/* Base grid for spacing */}
                            {hours.map((hour) => (
                                <View key={`grid-${hour}`} style={styles.gridLine} />
                            ))}

                            {/* Events Layer */}
                            <View style={styles.eventsContainer}>
                                <View style={styles.column}>
                                    {scheduledEvents.map(event => (
                                        <TimeEventBlock
                                            key={event.id}
                                            event={event}
                                            onPress={(evt) => handleOpenEditor(evt, 'planned')}
                                        />
                                    ))}
                                </View>
                                <View style={styles.columnDivider} />
                                <View style={styles.column}>
                                    {actualEvents.map(event => {
                                        if (!shouldShowCurrentIndicator) {
                                            return <TimeEventBlock key={event.id} event={event} />;
                                        }

                                        const hasStarted = currentMinutes >= event.startMinutes;
                                        const pastDelay = currentMinutes >= event.startMinutes + VISIBILITY_DELAY_MINUTES;
                                        if (!pastDelay) {
                                            return null;
                                        }

                                        const visibleUntil = hasStarted
                                            ? Math.min(event.startMinutes + event.duration, currentMinutes)
                                            : undefined;

                                        return (
                                            <TimeEventBlock
                                                key={event.id}
                                                event={event}
                                                visibleUntilMinutes={visibleUntil}
                                                onPress={(evt) => handleOpenEditor(evt, 'actual')}
                                            />
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Overlay grid lines so they sit above events */}
                            <View pointerEvents="none" style={styles.gridLinesOverlay}>
                                {hours.map((hour) => (
                                    <View key={`grid-overlay-${hour}`} style={styles.gridLineOverlay} />
                                ))}
                            </View>
                        </View>

                        {/* Current Time Indicator */}
                        {shouldShowCurrentIndicator && (
                            <View style={[styles.currentTimeIndicator, { top: clampedIndicatorTop }]}>
                                <View style={styles.currentTimeDot} />
                                <View style={styles.currentTimeLine} />
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>

            <EventEditorModal
                event={editorEvent}
                visible={isEditorVisible}
                onClose={handleCloseEditor}
                column={editorColumn}
            />

            <FloatingActionButton bottomOffset={insets.bottom + 82} onPress={handleAddEvent} />
            <BottomToolbar />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    dateSection: {
        flex: 1,
    },
    dayText: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.textDark,
        letterSpacing: -0.5,
    },
    dateText: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.5,
        marginTop: -4,
    },
    navButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    navButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(148,163,184,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarCard: {
        flex: 1,
        backgroundColor: COLORS.cardBg,
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    columnHeaders: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.cardBg,
    },
    headerLabelContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 0.8,
    },
    headerDivider: {
        width: 1,
        height: 16,
        backgroundColor: COLORS.border,
    },
    scrollView: {
        flex: 1,
    },
    gridRow: {
        flexDirection: 'row',
        flex: 1,
        position: 'relative',
    },
    timeColumn: {
        width: TIME_COLUMN_WIDTH,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: COLORS.borderLight,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: GRID_LINE_COLOR,
    },
    timeSlot: {
        height: HOUR_HEIGHT,
        justifyContent: 'flex-start',
        paddingTop: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: GRID_LINE_COLOR,
    },
    timeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSubtle,
        textAlign: 'right',
        paddingRight: 10,
        marginTop: -2,
    },
    gridContainer: {
        flex: 1,
        position: 'relative',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: GRID_LINE_COLOR,
    },
    gridLine: {
        height: HOUR_HEIGHT,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: GRID_LINE_COLOR,
    },
    gridLinesOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-start',
    },
    gridLineOverlay: {
        height: HOUR_HEIGHT,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: GRID_LINE_COLOR,
    },
    eventsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
    },
    column: {
        flex: 1,
        position: 'relative',
        paddingHorizontal: 3,
    },
    columnDivider: {
        width: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.border,
    },
    eventBlock: {
        position: 'absolute',
        left: 2,
        right: 2,
        borderRadius: 6,
        paddingHorizontal: 6,
        overflow: 'hidden',
    },
    eventContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    eventTitle: {
        fontWeight: '700',
        letterSpacing: -0.2,
        flex: 1,
    },
    eventDescription: {
        fontSize: 10,
        fontWeight: '500',
        opacity: 0.75,
        marginTop: 1,
    },
    currentTimeIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 100,
    },
    currentTimeDot: {
        position: 'absolute',
        left: TIME_COLUMN_WIDTH - 5,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.red,
        shadowColor: COLORS.red,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 3,
    },
    currentTimeLine: {
        position: 'absolute',
        left: TIME_COLUMN_WIDTH + 5,
        right: 0,
        height: 2,
        backgroundColor: COLORS.red,
        borderRadius: 1,
    },
});
