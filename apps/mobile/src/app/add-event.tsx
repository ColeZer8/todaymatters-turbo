import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AddEventTemplate } from '../components/templates/AddEventTemplate';
import { USE_MOCK_CALENDAR } from '@/lib/config';
import { useEventsStore } from '@/stores';
import { useCalendarEventsSync } from '@/lib/supabase/hooks/use-calendar-events-sync';

export default function AddEventScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ date?: string; column?: string }>();
    const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
    const addScheduledEvent = useEventsStore((s) => s.addScheduledEvent);
    const addActualEvent = useEventsStore((s) => s.addActualEvent);
    const { createPlanned, createActual } = useCalendarEventsSync({
        onError: (error) => {
            Alert.alert('Unable to save event', error.message);
        },
    });

    const ymd = typeof params.date === 'string' ? params.date : selectedDateYmd;
    const column = params.column === 'actual' ? 'actual' : 'planned';
    const initialDate = ymdToDate(ymd);

    return (
        <AddEventTemplate
            initialDate={initialDate}
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
                        startMinutes,
                        duration,
                        category: draft.category,
                        isBig3: draft.isBig3,
                    };
                    if (column === 'actual') addActualEvent(localEvent, targetYmd);
                    else addScheduledEvent(localEvent, targetYmd);
                    router.back();
                    return;
                }

                const created =
                    column === 'actual'
                        ? await createActual({
                              title,
                              description: '',
                              scheduledStartIso: start.toISOString(),
                              scheduledEndIso: end.toISOString(),
                              meta: { category: draft.category, isBig3: draft.isBig3, source: 'user' },
                          })
                        : await createPlanned({
                              title,
                              description: '',
                              scheduledStartIso: start.toISOString(),
                              scheduledEndIso: end.toISOString(),
                              meta: { category: draft.category, isBig3: draft.isBig3, source: 'user' },
                          });

                if (column === 'actual') addActualEvent(created, targetYmd);
                else addScheduledEvent(created, targetYmd);
                router.back();
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








