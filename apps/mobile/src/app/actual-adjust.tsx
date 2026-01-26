import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { ActualAdjustTemplate } from '@/components/templates/ActualAdjustTemplate';
import type { Big3Priorities } from '@/components/templates/ActualAdjustTemplate';
import { TimePickerModal } from '@/components/organisms';
import { useCalendarEventsSync } from '@/lib/supabase/hooks/use-calendar-events-sync';
import { requestReviewTimeSuggestion } from '@/lib/supabase/services/review-time-suggestions';
import { DERIVED_ACTUAL_PREFIX, DERIVED_EVIDENCE_PREFIX } from '@/lib/calendar/actual-display-events';
import { applyUserAppCategoryFeedback } from '@/lib/supabase/services/user-app-categories';
import { fetchActivityCategories } from '@/lib/supabase/services/activity-categories';
import type { ActivityCategory } from '@/lib/supabase/services/activity-categories';
import { fetchBig3ForDate, upsertBig3ForDate } from '@/lib/supabase/services/daily-big3';
import type { CategoryPath } from '@/components/molecules/HierarchicalCategoryPicker';
import {
  useAppCategoryOverridesStore,
  useAuthStore,
  useEventsStore,
  useOnboardingStore,
  useUserPreferencesStore,
  type CalendarEventMeta,
  type EventCategory,
  type ScheduledEvent,
} from '@/stores';
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
    meta?: string;
  }>();

  const userId = useAuthStore((s) => s.user?.id ?? null);
  const big3Enabled = useUserPreferencesStore((s) => s.preferences.big3Enabled);
  const selectedDateYmd = useEventsStore((s) => s.selectedDateYmd);
  const actualEvents = useEventsStore((s) => s.actualEvents);
  const addActualEvent = useEventsStore((s) => s.addActualEvent);
  const updateActualEvent = useEventsStore((s) => s.updateActualEvent);
  const upsertAppOverride = useAppCategoryOverridesStore((s) => s.upsertOverride);
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
    let meta: CalendarEventMeta | undefined;
    if (params.meta) {
      try {
        meta = JSON.parse(params.meta) as CalendarEventMeta;
      } catch {
        meta = undefined;
      }
    }
    return {
      id: params.id ?? `temp_${startMinutes}_${duration}`,
      title: params.title ?? 'Actual',
      description: params.description ?? '',
      startMinutes,
      duration,
      category: (params.category as EventCategory) ?? 'unknown',
      meta,
    };
  }, [actualEvents, params]);

  const [startMinutes, setStartMinutes] = useState(() => Math.max(0, Math.round(event.startMinutes)));
  const [durationMinutes, setDurationMinutes] = useState(() => Math.max(1, Math.round(event.duration)));
  const [isSleepStartPickerOpen, setIsSleepStartPickerOpen] = useState(false);
  const [isSleepEndPickerOpen, setIsSleepEndPickerOpen] = useState(false);

  const timeLabel = useMemo(() => {
    const start = formatMinutesToTime(startMinutes);
    const end = formatMinutesToTime(startMinutes + durationMinutes);
    return `${start} – ${end}`;
  }, [durationMinutes, startMinutes]);

  const helperText = useMemo(() => {
    const kind = event.meta?.kind;
    const topApp = event.meta?.evidence?.topApp;
    const interruptions = event.meta?.evidence?.sleep?.interruptions;
    const interruptionMinutes = event.meta?.evidence?.sleep?.interruptionMinutes;

    if (kind === 'sleep_interrupted') {
      const interruptionLabel =
        interruptions !== undefined
          ? `${interruptions} ${interruptions === 1 ? 'time' : 'times'}`
          : 'multiple times';
      const minutesLabel =
        interruptionMinutes !== undefined ? `${interruptionMinutes} min` : 'some time';
      return `We marked this as Sleep because your rest was interrupted ${interruptionLabel} (${minutesLabel}). Describe what really happened and Today Matters will sort and title it!`;
    }

    if (kind === 'screen_time') {
      const appLabel = topApp ? ` on ${topApp}` : '';
      const minutesLabel = `${durationMinutes} min`;
      return `We marked this as ${event.title} because you were on your phone${appLabel} for ${minutesLabel} between ${timeLabel}. Describe what really happened and Today Matters will sort and title it!`;
    }

    if (kind === 'unknown_gap') {
      return `We marked this as Unknown because we didn't have enough data between ${timeLabel}. Describe what really happened and Today Matters will sort and title it!`;
    }

    return `We marked this as ${event.title} between ${timeLabel}. Describe what really happened and Today Matters will sort and title it!`;
  }, [durationMinutes, event.meta, event.title, timeLabel]);

  const evidenceRows = useMemo(() => {
    const meta = event.meta;
    if (!meta) return [];
    const rows: Array<{ label: string; value: string }> = [];
    if (typeof meta.confidence === 'number') {
      rows.push({ label: 'Confidence', value: `${Math.round(meta.confidence * 100)}%` });
    } else if (meta.ai?.confidence !== undefined) {
      rows.push({ label: 'AI confidence', value: `${Math.round(meta.ai.confidence * 100)}%` });
    }
    if (meta.kind) rows.push({ label: 'Kind', value: meta.kind.replace(/_/g, ' ') });
    if (meta.source) rows.push({ label: 'Source', value: meta.source });
    if (meta.evidence?.locationLabel) {
      rows.push({ label: 'Location', value: meta.evidence.locationLabel });
    }
    if (meta.evidence?.screenTimeMinutes !== undefined) {
      rows.push({ label: 'Screen time', value: `${Math.round(meta.evidence.screenTimeMinutes)} min` });
    }
    if (meta.evidence?.topApp) {
      rows.push({ label: 'Top app', value: meta.evidence.topApp });
    }
    if (meta.evidence?.sleep?.interruptions !== undefined) {
      rows.push({ label: 'Interruptions', value: `${meta.evidence.sleep.interruptions}` });
    }
    if (meta.evidence?.sleep?.interruptionMinutes !== undefined) {
      rows.push({ label: 'Awake time', value: `${meta.evidence.sleep.interruptionMinutes} min` });
    }
    if (meta.evidence?.sleep?.asleepMinutes !== undefined) {
      rows.push({ label: 'Asleep', value: `${meta.evidence.sleep.asleepMinutes} min` });
    }
    if (meta.evidence?.sleep?.deepMinutes !== undefined && meta.evidence.sleep.deepMinutes !== null) {
      rows.push({ label: 'Deep sleep', value: `${meta.evidence.sleep.deepMinutes} min` });
    }
    if (meta.evidence?.sleep?.remMinutes !== undefined && meta.evidence.sleep.remMinutes !== null) {
      rows.push({ label: 'REM sleep', value: `${meta.evidence.sleep.remMinutes} min` });
    }
    if (meta.evidence?.sleep?.awakeMinutes !== undefined && meta.evidence.sleep.awakeMinutes !== null) {
      rows.push({ label: 'Awake', value: `${meta.evidence.sleep.awakeMinutes} min` });
    }
    if (meta.evidence?.sleep?.inBedMinutes !== undefined && meta.evidence.sleep.inBedMinutes !== null) {
      rows.push({ label: 'In bed', value: `${meta.evidence.sleep.inBedMinutes} min` });
    }
    if (meta.evidence?.sleep?.wakeTimeMinutes !== undefined && meta.evidence.sleep.wakeTimeMinutes !== null) {
      rows.push({ label: 'Wake time', value: formatMinutesToTime(meta.evidence.sleep.wakeTimeMinutes) });
    }
    if (meta.evidence?.sleep?.qualityScore !== undefined && meta.evidence.sleep.qualityScore !== null) {
      rows.push({ label: 'Sleep quality', value: `${meta.evidence.sleep.qualityScore}%` });
    }
    if (meta.evidence?.sleep?.hrvMs !== undefined && meta.evidence.sleep.hrvMs !== null) {
      rows.push({ label: 'HRV', value: `${meta.evidence.sleep.hrvMs} ms` });
    }
    if (
      meta.evidence?.sleep?.restingHeartRateBpm !== undefined &&
      meta.evidence.sleep.restingHeartRateBpm !== null
    ) {
      rows.push({ label: 'Resting HR', value: `${meta.evidence.sleep.restingHeartRateBpm} bpm` });
    }
    if (meta.evidence?.sleep?.heartRateAvgBpm !== undefined && meta.evidence.sleep.heartRateAvgBpm !== null) {
      rows.push({ label: 'Avg HR', value: `${meta.evidence.sleep.heartRateAvgBpm} bpm` });
    }
    if (meta.evidence?.conflicts && meta.evidence.conflicts.length > 0) {
      rows.push({
        label: 'Conflicts',
        value: meta.evidence.conflicts.map((item) => item.detail).join(', '),
      });
    }
    if (meta.verificationReport?.status) {
      rows.push({ label: 'Verification', value: meta.verificationReport.status.replace(/_/g, ' ') });
    }
    if (meta.verificationReport?.discrepancies && meta.verificationReport.discrepancies.length > 0) {
      rows.push({
        label: 'Discrepancies',
        value: meta.verificationReport.discrepancies.map((item) => item.actual).join(', '),
      });
    }
    if (meta.evidenceFusion?.sources && meta.evidenceFusion.sources.length > 0) {
      rows.push({
        label: 'Evidence sources',
        value: meta.evidenceFusion.sources.map((item) => item.type.replace(/_/g, ' ')).join(', '),
      });
    }
    if (meta.dataQuality) {
      if (meta.dataQuality.freshnessMinutes !== undefined && meta.dataQuality.freshnessMinutes !== null) {
        rows.push({ label: 'Data freshness', value: `${meta.dataQuality.freshnessMinutes} min` });
      }
      rows.push({
        label: 'Data completeness',
        value: `${Math.round(meta.dataQuality.completeness * 100)}%`,
      });
      rows.push({
        label: 'Data reliability',
        value: `${Math.round(meta.dataQuality.reliability * 100)}%`,
      });
    }
    return rows;
  }, [event.meta]);

  const [selectedCategory, setSelectedCategory] = useState<EventCategory>(event.category);
  const [note, setNote] = useState('');
  const [isBig3, setIsBig3] = useState(Boolean(event.isBig3));
  const [titleInput, setTitleInput] = useState(event.title || 'Actual');
  const [selectedValue, setSelectedValue] = useState<string | null>(
    typeof event.meta?.value_label === 'string' ? event.meta.value_label : null,
  );
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(() => {
    if (typeof event.meta?.goal_title === 'string' && event.meta.goal_title.trim()) {
      return `goal:${event.meta.goal_title}`;
    }
    if (typeof event.meta?.initiative_title === 'string' && event.meta.initiative_title.trim()) {
      return `initiative:${event.meta.initiative_title}`;
    }
    return null;
  });
  const [goalContribution, setGoalContribution] = useState<number | null>(
    typeof event.meta?.goal_contribution === 'number' ? event.meta.goal_contribution : null,
  );
  const [suggestion, setSuggestion] = useState<{
    category: EventCategory;
    title?: string;
    description?: string;
    confidence?: number;
    reason?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activityCategories, setActivityCategories] = useState<ActivityCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    event.meta?.category_id ?? null,
  );
  const [big3Priority, setBig3Priority] = useState<1 | 2 | 3 | null>(
    event.meta?.big3_priority ?? null,
  );
  const [big3Priorities, setBig3Priorities] = useState<Big3Priorities | null>(null);

  useEffect(() => {
    setTitleInput(event.title || 'Actual');
    setStartMinutes(Math.max(0, Math.round(event.startMinutes)));
    setDurationMinutes(Math.max(1, Math.round(event.duration)));
    setSelectedValue(typeof event.meta?.value_label === 'string' ? event.meta.value_label : null);
    if (typeof event.meta?.goal_title === 'string' && event.meta.goal_title.trim()) {
      setSelectedGoalId(`goal:${event.meta.goal_title}`);
    } else if (typeof event.meta?.initiative_title === 'string' && event.meta.initiative_title.trim()) {
      setSelectedGoalId(`initiative:${event.meta.initiative_title}`);
    } else {
      setSelectedGoalId(null);
    }
    setGoalContribution(
      typeof event.meta?.goal_contribution === 'number' ? event.meta.goal_contribution : null,
    );
  }, [event.duration, event.meta, event.startMinutes, event.title]);

  // Load user's hierarchical activity categories on mount
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchActivityCategories(userId)
      .then((cats) => {
        if (!cancelled) setActivityCategories(cats);
      })
      .catch((err) => {
        if (__DEV__) console.warn('[ActualAdjust] Failed to load activity categories:', err);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Load today's Big 3 priorities if Big 3 is enabled
  useEffect(() => {
    if (!userId || !big3Enabled) return;
    let cancelled = false;
    fetchBig3ForDate(userId, selectedDateYmd)
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setBig3Priorities({
            priority_1: row.priority_1 ?? '',
            priority_2: row.priority_2 ?? '',
            priority_3: row.priority_3 ?? '',
          });
        } else {
          setBig3Priorities(null);
        }
      })
      .catch((err) => {
        if (__DEV__) console.warn('[ActualAdjust] Failed to load Big 3:', err);
      });
    return () => { cancelled = true; };
  }, [userId, big3Enabled, selectedDateYmd]);

  const handleSelectActivityCategory = useCallback(
    (categoryId: string, _path: CategoryPath) => {
      setSelectedCategoryId(categoryId);
    },
    [],
  );

  const handleSelectBig3Priority = useCallback(
    (priority: 1 | 2 | 3 | null) => {
      setBig3Priority(priority);
      setIsBig3(priority !== null);
    },
    [],
  );

  const handleSetBig3Inline = useCallback(
    (p1: string, p2: string, p3: string) => {
      if (!userId) return;
      const newPriorities: Big3Priorities = {
        priority_1: p1,
        priority_2: p2,
        priority_3: p3,
      };
      setBig3Priorities(newPriorities);
      // Persist to Supabase (fire-and-forget)
      void upsertBig3ForDate({
        user_id: userId,
        date: selectedDateYmd,
        priority_1: p1,
        priority_2: p2,
        priority_3: p3,
      }).catch((err) => {
        console.warn('[ActualAdjust] Failed to save Big 3:', err);
      });
    },
    [userId, selectedDateYmd],
  );

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
        startTime: formatMinutesToTime(startMinutes),
        endTime: formatMinutesToTime(startMinutes + durationMinutes),
        durationMinutes: durationMinutes,
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
  }, [event, note, durationMinutes, startMinutes, selectedCategory, selectedDateYmd]);

  const handleSelectGoal = useCallback(
    (value: string | null) => {
      setSelectedGoalId(value);
      if (!value || value !== selectedGoalId) {
        setGoalContribution(null);
      }
    },
    [selectedGoalId]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const start = ymdMinutesToDate(selectedDateYmd, startMinutes);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + durationMinutes);

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

      const didUseAi = Boolean(nextSuggestion);
      const title =
        didUseAi ? (nextSuggestion?.title || titleInput || 'Actual') : titleInput || 'Actual';
      const description = didUseAi
        ? (nextSuggestion?.description || '')
        : (note.trim() || '');
      const finalCategory = nextSuggestion?.category ?? selectedCategory;
      const linkedGoal = selectedGoalId?.startsWith('goal:') ? selectedGoalId.slice(5) : null;
      const linkedInitiative = selectedGoalId?.startsWith('initiative:') ? selectedGoalId.slice(11) : null;

      const meta = {
        category: finalCategory,
        category_id: selectedCategoryId ?? null,
        isBig3,
        big3_priority: big3Priority,
        source: 'actual_adjust' as const,
        actual: true,
        tags: ['actual'],
        value_label: selectedValue ?? null,
        goal_title: linkedGoal,
        initiative_title: linkedInitiative,
        goal_contribution: goalContribution ?? null,
        note: note.trim() || null,
        ai: nextSuggestion ? { confidence: nextSuggestion.confidence, reason: nextSuggestion.reason } : undefined,
        learnedFrom:
          event.meta?.source && event.meta.source !== 'user'
            ? {
                originalId: event.id,
                kind: event.meta.kind,
                source: event.meta.source,
                title: event.title,
                category: event.category,
                confidence: event.meta.confidence ?? null,
                topApp: event.meta.evidence?.topApp ?? null,
              }
            : undefined,
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

      if (
        userId &&
        event.meta?.source &&
        event.meta.source !== 'user' &&
        finalCategory !== event.category &&
        finalCategory !== 'sleep' &&
        finalCategory !== 'unknown'
      ) {
        const topApp = event.meta.evidence?.topApp ?? event.meta.learnedFrom?.topApp;
        if (topApp) {
          const feedback = await applyUserAppCategoryFeedback({
            userId,
            appName: topApp,
            category: finalCategory,
          });
          if (feedback) {
            upsertAppOverride(feedback.appKey, {
              category: feedback.category,
              confidence: feedback.confidence,
            });
          }
        }
      }

      router.back();
    } catch (error) {
      console.warn('[ActualAdjust] Save failed:', error);
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Your edits could not be saved. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    addActualEvent,
    big3Priority,
    createActual,
    event,
    isBig3,
    durationMinutes,
    startMinutes,
    goalContribution,
    selectedGoalId,
    selectedCategoryId,
    selectedValue,
    note,
    params.id,
    router,
    selectedCategory,
    selectedDateYmd,
    upsertAppOverride,
    userId,
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
        titleValue={titleInput}
        timeLabel={timeLabel}
        sleepStartLabel={formatMinutesToTime(startMinutes)}
        sleepEndLabel={formatMinutesToTime(startMinutes + durationMinutes)}
        isSleep={selectedCategory === 'sleep'}
        selectedCategory={selectedCategory}
        isBig3={isBig3}
        big3Priority={big3Priority}
        big3Enabled={big3Enabled}
        big3Priorities={big3Priorities}
        values={valuesOptions}
        selectedValue={selectedValue}
        linkedGoals={linkedGoals}
        selectedGoalId={selectedGoalId}
        goalContribution={goalContribution}
        note={note}
        helperText={helperText}
        evidenceRows={evidenceRows}
        suggestion={suggestion}
        isSaving={isSaving}
        activityCategories={activityCategories}
        selectedCategoryId={selectedCategoryId}
        onSelectActivityCategory={handleSelectActivityCategory}
        onCancel={() => router.back()}
        onSave={handleSave}
        onSplit={() => {
          router.push({
            pathname: '/actual-split',
            params: {
              id: event.id,
              title: titleInput,
              description: event.description,
              category: event.category,
              startMinutes: String(startMinutes),
              duration: String(durationMinutes),
              meta: event.meta ? JSON.stringify(event.meta) : undefined,
              location: event.location ?? undefined,
            },
          });
        }}
        onEditSleepStart={() => setIsSleepStartPickerOpen(true)}
        onEditSleepEnd={() => setIsSleepEndPickerOpen(true)}
        onChangeTitle={setTitleInput}
        onChangeNote={setNote}
        onToggleBig3={setIsBig3}
        onSelectBig3Priority={handleSelectBig3Priority}
        onSetBig3Inline={handleSetBig3Inline}
        onSelectCategory={setSelectedCategory}
        onSelectValue={setSelectedValue}
        onSelectGoal={handleSelectGoal}
        onSelectGoalContribution={setGoalContribution}
      />
      <TimePickerModal
        visible={isSleepStartPickerOpen}
        label="Sleep start"
        initialTime={ymdMinutesToDate(selectedDateYmd, startMinutes)}
        onConfirm={(time) => {
          const nextMinutes = time.getHours() * 60 + time.getMinutes();
          const currentEnd = startMinutes + durationMinutes;
          if (nextMinutes >= currentEnd) {
            setStartMinutes(nextMinutes);
            setDurationMinutes(60);
            setIsSleepStartPickerOpen(false);
            return;
          }
          setStartMinutes(nextMinutes);
          setDurationMinutes(Math.max(1, currentEnd - nextMinutes));
          setIsSleepStartPickerOpen(false);
        }}
        onClose={() => setIsSleepStartPickerOpen(false)}
      />
      <TimePickerModal
        visible={isSleepEndPickerOpen}
        label="Sleep end"
        initialTime={ymdMinutesToDate(selectedDateYmd, startMinutes + durationMinutes)}
        onConfirm={(time) => {
          const nextMinutes = time.getHours() * 60 + time.getMinutes();
          if (nextMinutes <= startMinutes) {
            Alert.alert('Sleep end time must be after the start time.');
            return;
          }
          setDurationMinutes(Math.max(1, nextMinutes - startMinutes));
          setIsSleepEndPickerOpen(false);
        }}
        onClose={() => setIsSleepEndPickerOpen(false)}
      />
    </>
  );
}
