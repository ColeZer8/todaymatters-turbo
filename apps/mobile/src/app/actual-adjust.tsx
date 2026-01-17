import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { ActualAdjustTemplate } from '@/components/templates/ActualAdjustTemplate';
import { useCalendarEventsSync } from '@/lib/supabase/hooks/use-calendar-events-sync';
import { requestReviewTimeSuggestion } from '@/lib/supabase/services/review-time-suggestions';
import { DERIVED_ACTUAL_PREFIX, DERIVED_EVIDENCE_PREFIX } from '@/lib/calendar/actual-display-events';
import { useEventsStore, useOnboardingStore, type EventCategory, type ScheduledEvent } from '@/stores';
import type { ReviewCategoryId } from '@/stores/review-time-store';

const REVIEW_CATEGORY_TO_EVENT: Record<ReviewCategoryId, EventCategory> = {
  faith: 'routine',
  family: 'family',
  work: 'work',
  health: 'health',
  other: 'unknown',
};

const formatMinutesToTime = (totalMinutes: number): string => {
  const minutes = Math.max(0, totalMinutes);
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
};

const ymdMinutesToDate = (ymd: string, minutes: number): Date => {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, Math.floor(minutes / 60), minutes % 60, 0, 0);
};

const formatDateLabel = (ymd: string): string => {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

export default function ActualAdjustScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    description?: string;
    category?: EventCategory;
    startMinutes?: string;
    duration?: string;
  }>();

  const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
  const actualEvents = useEventsStore((s) => s.actualEvents);
  const addActualEvent = useEventsStore((s) => s.addActualEvent);
  const updateActualEvent = useEventsStore((s) => s.updateActualEvent);
  const { createActual, updateActual } = useCalendarEventsSync();
  const coreValues = useOnboardingStore((s) => s.coreValues);
  const joySelections = useOnboardingStore((s) => s.joySelections);
  const goals = useOnboardingStore((s) => s.goals);
  const initiatives = useOnboardingStore((s) => s.initiatives);

  const event = useMemo<ScheduledEvent>(() => {
    const existing = params.id ? actualEvents.find((item) => item.id === params.id) : undefined;
    if (existing) return existing;
    const startMinutes = params.startMinutes ? Number(params.startMinutes) : 0;
    const duration = params.duration ? Number(params.duration) : 0;
    return {
      id: params.id ?? `temp_${startMinutes}_${duration}`,
      title: params.title ?? 'Actual',
      description: params.description ?? '',
      startMinutes,
      duration,
      category: (params.category as EventCategory) ?? 'unknown',
    };
  }, [actualEvents, params]);

  const timeLabel = useMemo(() => {
    const start = formatMinutesToTime(event.startMinutes);
    const end = formatMinutesToTime(event.startMinutes + event.duration);
    return `${start} – ${end}`;
  }, [event.duration, event.startMinutes]);

  const helperText = useMemo(() => {
    return `We marked this as ${event.title} because you were on your phone between ${timeLabel}. Describe what really happened and Today Matters will sort and title it!`;
  }, [event.title, timeLabel]);

  const [selectedCategory, setSelectedCategory] = useState<EventCategory>(event.category);
  const [note, setNote] = useState('');
  const [isBig3, setIsBig3] = useState(Boolean(event.isBig3));
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{
    category: EventCategory;
    title?: string;
    description?: string;
    confidence?: number;
    reason?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const valuesOptions = useMemo(() => {
    const valueLabels = coreValues.filter((value) => value.isSelected).map((value) => value.label);
    const all = [...valueLabels, ...joySelections];
    const deduped: string[] = [];
    for (const item of all) {
      const next = item.trim();
      if (!next) continue;
      if (deduped.some((value) => value.toLowerCase() === next.toLowerCase())) continue;
      deduped.push(next);
    }
    return deduped;
  }, [coreValues, joySelections]);

  const linkedGoals = useMemo(() => {
    const goalOptions = goals
      .map((goal) => goal.trim())
      .filter(Boolean)
      .map((goal) => ({ id: `goal:${goal}`, label: goal }));
    const initiativeOptions = initiatives
      .map((initiative) => initiative.trim())
      .filter(Boolean)
      .map((initiative) => ({ id: `initiative:${initiative}`, label: initiative }));
    return [...goalOptions, ...initiativeOptions];
  }, [goals, initiatives]);

  const resolveAiSuggestion = useCallback(async () => {
    if (!note.trim()) return null;
    const payload = {
      date: selectedDateYmd,
      block: {
        id: event.id,
        title: event.title,
        description: event.description ?? '',
        source: 'actual_adjust',
        startTime: formatMinutesToTime(event.startMinutes),
        endTime: formatMinutesToTime(event.startMinutes + event.duration),
        durationMinutes: event.duration,
        activityDetected: null,
        location: event.location ?? null,
        note,
      },
    };
    const ai = await requestReviewTimeSuggestion(payload);
    const mappedCategory = REVIEW_CATEGORY_TO_EVENT[ai.category] ?? selectedCategory;
    return {
      category: mappedCategory,
      title: ai.title,
      description: ai.description,
      confidence: ai.confidence,
      reason: ai.reason,
    };
  }, [event, note, selectedCategory, selectedDateYmd]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const start = ymdMinutesToDate(selectedDateYmd, event.startMinutes);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + event.duration);

      let nextSuggestion = suggestion;
      if (!nextSuggestion && note.trim()) {
        try {
          nextSuggestion = await resolveAiSuggestion();
          setSuggestion(nextSuggestion);
          if (nextSuggestion?.category) {
            setSelectedCategory(nextSuggestion.category);
          }
          if (nextSuggestion?.description) {
            setNote(nextSuggestion.description);
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('[ActualAdjust] AI suggestion failed:', error);
          }
          Alert.alert(
            'AI unavailable',
            error instanceof Error
              ? error.message
              : 'We could not analyze your note right now. Please try again in a moment.',
          );
          setIsSaving(false);
          return;
        }
      }

      if (note.trim() && !nextSuggestion) {
        Alert.alert(
          'AI needed',
          'Please add a brief note so we can classify this correctly.',
        );
        setIsSaving(false);
        return;
      }

      const didUseAi = Boolean(nextSuggestion);
      const title = didUseAi ? (nextSuggestion?.title || event.title || 'Actual') : event.title || 'Actual';
      const description = didUseAi
        ? (nextSuggestion?.description || '')
        : (note.trim() || event.description || '');
      const linkedGoal = selectedGoalId?.startsWith('goal:') ? selectedGoalId.slice(5) : null;
      const linkedInitiative = selectedGoalId?.startsWith('initiative:') ? selectedGoalId.slice(11) : null;

      const meta = {
        category: nextSuggestion?.category ?? selectedCategory,
        isBig3,
        source: 'actual_adjust',
        actual: true,
        tags: ['actual'],
        value_label: selectedValue ?? null,
        goal_title: linkedGoal,
        initiative_title: linkedInitiative,
        note: note.trim() || null,
        ai: nextSuggestion ? { confidence: nextSuggestion.confidence, reason: nextSuggestion.reason } : undefined,
      };

      const shouldCreate =
        !params.id ||
        params.id.startsWith(DERIVED_ACTUAL_PREFIX) ||
        params.id.startsWith(DERIVED_EVIDENCE_PREFIX);

      if (shouldCreate) {
        const created = await createActual({
          title,
          description,
          location: event.location,
          scheduledStartIso: start.toISOString(),
          scheduledEndIso: end.toISOString(),
          meta,
        });
        addActualEvent(created, selectedDateYmd);
      } else {
        const updated = await updateActual(params.id, {
          title,
          description,
          location: event.location,
          scheduledStartIso: start.toISOString(),
          scheduledEndIso: end.toISOString(),
          meta,
        });
        updateActualEvent(updated, selectedDateYmd);
      }
      router.back();
    } catch (error) {
      if (__DEV__) {
        console.warn('[ActualAdjust] Save failed:', error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    addActualEvent,
    createActual,
    event,
    isBig3,
    selectedGoalId,
    selectedValue,
    note,
    params.id,
    router,
    selectedCategory,
    selectedDateYmd,
    resolveAiSuggestion,
    suggestion,
    updateActual,
    updateActualEvent,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ActualAdjustTemplate
        title={event.title}
        timeLabel={timeLabel}
        selectedCategory={selectedCategory}
        isBig3={isBig3}
        values={valuesOptions}
        selectedValue={selectedValue}
        linkedGoals={linkedGoals}
        selectedGoalId={selectedGoalId}
        note={note}
        helperText={helperText}
        suggestion={suggestion}
        isSaving={isSaving}
        onCancel={() => router.back()}
        onSave={handleSave}
        onChangeNote={setNote}
        onToggleBig3={setIsBig3}
        onSelectCategory={setSelectedCategory}
        onSelectValue={setSelectedValue}
        onSelectGoal={setSelectedGoalId}
      />
    </>
  );
}
