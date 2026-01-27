import { Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AddEventTemplate } from '../components/templates/AddEventTemplate';
import { USE_MOCK_CALENDAR } from '@/lib/config';
import { useAuthStore, useEventsStore, useUserPreferencesStore } from '@/stores';
import { useCalendarEventsSync } from '@/lib/supabase/hooks/use-calendar-events-sync';
import {
    buildPatternIndex,
    buildPatternIndexFromSlots,
    serializePatternIndex,
    type PatternIndex,
} from '@/lib/calendar/pattern-recognition';
import { fetchActivityPatterns, upsertActivityPatterns } from '@/lib/supabase/services/activity-patterns';

export default function AddEventScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ date?: string; column?: string; startMinutes?: string }>();
    const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
    const addScheduledEvent = useEventsStore((s) => s.addScheduledEvent);
    const addActualEvent = useEventsStore((s) => s.addActualEvent);
    const userId = useAuthStore((s) => s.user?.id ?? null);
    const preferences = useUserPreferencesStore((s) => s.preferences);
    const [patternIndex, setPatternIndex] = useState<PatternIndex | null>(null);
    const { createPlanned, createActual, loadActualForRange } = useCalendarEventsSync({
        onError: (error) => {
            Alert.alert('Unable to save event', error.message);
        },
    });

    const ymd = typeof params.date === 'string' ? params.date : selectedDateYmd;
    const column = params.column === 'actual' ? 'actual' : 'planned';
    const initialDate = ymdToDate(ymd);
    const initialStartMinutes = params.startMinutes ? parseInt(params.startMinutes, 10) : undefined;

    useEffect(() => {
        if (!userId || !preferences.autoSuggestEvents) {
            setPatternIndex(null);
            return;
        }
        let cancelled = false;
        const run = async () => {
            const stored = await fetchActivityPatterns(userId);
            if (cancelled) return;
            if (stored?.slots?.length) {
                setPatternIndex(buildPatternIndexFromSlots(stored.slots));
                return;
            }
            const baseDate = ymdToDate(ymd);
            const start = new Date(baseDate);
            start.setDate(start.getDate() - 14);
            const startYmd = dateToYmd(start);
            const endYmd = dateToYmd(baseDate);
            const history = await loadActualForRange(startYmd, endYmd);
            if (cancelled) return;
            const filtered = history.filter((entry) => entry.ymd !== ymd);
            const nextIndex = buildPatternIndex(filtered);
            setPatternIndex(nextIndex);
            await upsertActivityPatterns({
                userId,
                slots: serializePatternIndex(nextIndex),
                windowStartYmd: startYmd,
                windowEndYmd: endYmd,
            });
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [loadActualForRange, preferences.autoSuggestEvents, userId, ymd]);

    return (
        <AddEventTemplate
            initialDate={initialDate}
            initialStartMinutes={initialStartMinutes}
            patternIndex={patternIndex}
            patternMinConfidence={preferences.confidenceThreshold}
            allowAutoSuggestions={preferences.autoSuggestEvents}
            onClose={() => router.back()}
            onSave={async (draft) => {
                const title = draft.title.trim();
                if (!title) {
                    Alert.alert('Missing title', 'Please enter a title for your event.');
                    return;
                }

                const start = combineDateAndTime(draft.selectedDate, draft.startTime);
                const end = combineDateAndTime(draft.selectedDate, draft.endTime);
                if (end.getTime() <= start.getTime()) {
                    Alert.alert('Invalid time range', 'End time must be after start time.');
                    return;
                }

                const targetYmd = dateToYmd(draft.selectedDate);

                if (USE_MOCK_CALENDAR) {
                    const startMinutes = start.getHours() * 60 + start.getMinutes();
                    const duration = Math.max(Math.round((end.getTime() - start.getTime()) / 60_000), 1);
                    const localEvent = {
                        id: `mock_user_${column}_${targetYmd}_${Date.now()}`,
                        title,
                        description: '',
                        location: draft.location,
                        startMinutes,
                        duration,
                        category: draft.category,
                        isBig3: draft.isBig3,
                        meta: {
                            category: draft.category,
                            isBig3: draft.isBig3,
                            source: 'user',
                            value_label: draft.coreValueLabel,
                            value_subcategory: draft.subcategoryLabel,
                        },
                    };
                    if (column === 'actual') addActualEvent(localEvent, targetYmd);
                    else addScheduledEvent(localEvent, targetYmd);
                    router.back();
                    return;
                }

                try {
                    if (__DEV__) {
                        console.log(`[AddEvent] Creating ${column} event:`, {
                            title,
                            start: start.toISOString(),
                            end: end.toISOString(),
                            category: draft.category,
                            isBig3: draft.isBig3,
                            coreValue: draft.coreValueLabel,
                            subcategory: draft.subcategoryLabel,
                        });
                    }

                    const suggestionMeta =
                        draft.patternSuggestion?.applied
                            ? {
                                  suggested_category: draft.patternSuggestion.category,
                                  confidence: draft.patternSuggestion.confidence,
                              }
                            : {};

                    const created =
                        column === 'actual'
                            ? await createActual({
                                  title,
                                  description: '',
                                  location: draft.location,
                                  scheduledStartIso: start.toISOString(),
                                  scheduledEndIso: end.toISOString(),
                                meta: {
                                    category: draft.category,
                                    isBig3: draft.isBig3,
                                    source: 'user',
                                    value_label: draft.coreValueLabel,
                                    value_subcategory: draft.subcategoryLabel,
                                },
                              })
                            : await createPlanned({
                                  title,
                                  description: '',
                                  location: draft.location,
                                  scheduledStartIso: start.toISOString(),
                                  scheduledEndIso: end.toISOString(),
                                  meta: {
                                      category: draft.category,
                                      isBig3: draft.isBig3,
                                      source: 'user',
                                    value_label: draft.coreValueLabel,
                                    value_subcategory: draft.subcategoryLabel,
                                      ...suggestionMeta,
                                  },
                              });

                    if (__DEV__) {
                        console.log(`[AddEvent] ✅ Successfully saved ${column} event to Supabase:`, created.id);
                    }

                    if (column === 'actual') addActualEvent(created, targetYmd);
                    else addScheduledEvent(created, targetYmd);
                    router.back();
                } catch (error) {
                    // Error is already handled by onError callback in useCalendarEventsSync
                    // But we need to catch it here to prevent unhandled promise rejection
                    if (__DEV__) {
                        console.error(`[AddEvent] ❌ Failed to save ${column} event:`, error);
                    }
                    // Don't navigate back on error - let user see the error alert and retry
                }
            }}
        />
    );
}

function ymdToDate(ymd: string): Date {
    const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
}

function dateToYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function combineDateAndTime(day: Date, time: Date): Date {
    const combined = new Date(day);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
}








