import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { HomeTemplate } from '@/components/templates';
import { buildHomeBriefContext, generateHomeBriefDraft, getNextScheduleBoundary, getNextTimeOfDayBoundary } from '@/lib/home-brief';
import { fetchProfile, generateHomeBriefLlm } from '@/lib/supabase/services';
import {
  useAuthStore,
  useCurrentMinutes,
  useDemoStore,
  useEventsStore,
  useGoalsStore,
  useHomeBriefStore,
  useOnboardingStore,
  useReviewTimeStore,
} from '@/stores';

export default function HomeScreen() {
  const scheduledEvents = useEventsStore((s) => s.scheduledEvents);
  const unassignedCount = useReviewTimeStore((s) => s.unassignedCount);
  const goals = useGoalsStore((s) => s.goals);

  const coachPersona = useOnboardingStore((s) => s.coachPersona);
  const morningMindset = useOnboardingStore((s) => s.morningMindset);
  const focusStyle = useOnboardingStore((s) => s.focusStyle);
  const wakeTimeIso = useOnboardingStore((s) => s.wakeTime);
  const sleepTimeIso = useOnboardingStore((s) => s.sleepTime);

  const nowMinutesFromMidnight = useCurrentMinutes();
  const isDemoActive = useDemoStore((s) => s.isActive);
  const getSimulatedDate = useDemoStore((s) => s.getSimulatedDate);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const enableLlmInDev = process.env.EXPO_PUBLIC_ENABLE_HOME_BRIEF_LLM === 'true';

  const cachedBrief = useHomeBriefStore((s) => s.brief);
  const setBrief = useHomeBriefStore((s) => s.setBrief);
  const setLastEvaluatedAt = useHomeBriefStore((s) => s.setLastEvaluatedAt);
  const lastLlmAt = useHomeBriefStore((s) => s.lastLlmAt);
  const setLastLlmAt = useHomeBriefStore((s) => s.setLastLlmAt);

  const [profileFullName, setProfileFullName] = useState<string | null>(null);
  const [profileBirthday, setProfileBirthday] = useState<string | null>(null);

  const timersRef = useRef<{ debounce?: ReturnType<typeof setTimeout>; boundary?: ReturnType<typeof setTimeout> }>({});
  const llmRequestIdRef = useRef(0);

  const nowDate = useMemo(() => {
    return isDemoActive ? getSimulatedDate() : new Date();
  }, [getSimulatedDate, isDemoActive, nowMinutesFromMidnight]);

  const goalsSummary = useMemo(() => {
    let completedTasksCount = 0;
    let pendingTasksCount = 0;
    let topGoalTitle: string | undefined;

    for (const goal of goals) {
      for (const task of goal.tasks) {
        if (task.done) completedTasksCount += 1;
        else pendingTasksCount += 1;
      }
      if (!topGoalTitle && goal.tasks.some((t) => !t.done)) {
        topGoalTitle = goal.title;
      }
    }

    return { completedTasksCount, pendingTasksCount, topGoalTitle };
  }, [goals]);

  // Load profile fields we need for the brief (birthday, name) when authenticated.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchProfile(user.id);
        if (cancelled) return;
        setProfileFullName(profile?.full_name ?? null);
        setProfileBirthday(profile?.birthday ?? null);
      } catch {
        // Non-blocking: brief works without profile fields.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const evaluateBrief = useMemo(() => {
    return (trigger: string) => {
      const ctx = buildHomeBriefContext({
        nowDate,
        nowMinutesFromMidnight,
        rhythm: { wakeTimeIso, sleepTimeIso },
        profile: { fullName: profileFullName, birthday: profileBirthday },
        persona: { coachPersona, morningMindset, focusStyle },
        scheduledEvents,
        goals: goalsSummary,
        reviewTime: { unassignedCount },
      });

      const draft = generateHomeBriefDraft(ctx, nowDate);
      const nowIso = nowDate.toISOString();
      setLastEvaluatedAt(nowIso);

      const cachedExpiresAtMs = cachedBrief ? Date.parse(cachedBrief.expiresAt) : 0;
      const isCacheValid = !!cachedBrief && cachedExpiresAtMs > nowDate.getTime();

      // Only change copy if the “moment” changes or the cache has expired.
      if (isCacheValid && cachedBrief.momentKey === draft.momentKey) {
        scheduleNextBoundary();
        return;
      }

      setBrief({ ...draft, source: 'rules' });
      maybePolishWithLlm(ctx, draft);
      scheduleNextBoundary();

      // eslint-disable-next-line no-console
      console.log('🧠 Home brief updated (rules):', trigger, draft.reason);
    };

    function maybePolishWithLlm(ctx: unknown, draft: { line1: string; line2: string; line3?: string; reason: string; momentKey: string; expiresAt: string; contextHash: string }) {
      if (!(isAuthenticated && user?.id) && !enableLlmInDev) return;
      if (isDemoActive) return;

      // Only call the LLM for higher-value moments.
      const llmWorthy =
        draft.reason === 'morningWake' ||
        draft.reason === 'eventStarting' ||
        draft.reason === 'nextEventSoon' ||
        draft.reason === 'dayWrap';
      if (!llmWorthy) return;

      const nowMs = nowDate.getTime();
      const lastMs = lastLlmAt ? Date.parse(lastLlmAt) : 0;
      const MIN_LLM_INTERVAL_MS = 15 * 60_000;
      if (lastMs && nowMs - lastMs < MIN_LLM_INTERVAL_MS) return;

      const requestId = ++llmRequestIdRef.current;

      (async () => {
        try {
          const res = await generateHomeBriefLlm(ctx as Record<string, unknown>, {
            line1: draft.line1,
            line2: draft.line2,
            line3: draft.line3,
            reason: draft.reason,
            momentKey: draft.momentKey,
          });

          // Ignore if a newer request superseded this.
          if (requestId !== llmRequestIdRef.current) return;

          setBrief({
            line1: res.line1,
            line2: res.line2,
            line3: res.line3,
            expiresAt: res.expiresAt,
            reason: draft.reason,
            momentKey: draft.momentKey,
            contextHash: draft.contextHash,
            source: 'llm',
          });
          setLastLlmAt(new Date().toISOString());
        } catch {
          // Non-blocking: stick with rules draft.
        }
      })();
    }

    function scheduleNextBoundary() {
      if (isDemoActive) return;

      if (timersRef.current.boundary) clearTimeout(timersRef.current.boundary);

      const timeBoundary = getNextTimeOfDayBoundary(nowDate);
      const scheduleBoundary = getNextScheduleBoundary(nowDate, nowMinutesFromMidnight, scheduledEvents);

      const candidates = [timeBoundary, scheduleBoundary].filter(Boolean) as Array<{
        at: Date;
        reason: string;
      }>;

      if (candidates.length === 0) return;
      const next = candidates.sort((a, b) => a.at.getTime() - b.at.getTime())[0];

      const ms = Math.max(250, next.at.getTime() - nowDate.getTime() + 250);
      timersRef.current.boundary = setTimeout(() => {
        // Re-evaluate when a meaningful boundary occurs.
        // (We don't pass `next.reason` directly because state may have changed since scheduling.)
        evaluateBrief('boundaryTimer');
      }, ms);
    }
  }, [
    cachedBrief,
    coachPersona,
    focusStyle,
    goalsSummary,
    isDemoActive,
    morningMindset,
    nowDate,
    nowMinutesFromMidnight,
    profileBirthday,
    profileFullName,
    scheduledEvents,
    setBrief,
    setLastEvaluatedAt,
    lastLlmAt,
    setLastLlmAt,
    sleepTimeIso,
    unassignedCount,
    user?.id,
    isAuthenticated,
    wakeTimeIso,
  ]);

  // Evaluate on mount and when dependencies shift (debounced).
  useEffect(() => {
    if (timersRef.current.debounce) clearTimeout(timersRef.current.debounce);
    timersRef.current.debounce = setTimeout(() => {
      evaluateBrief('dependencyChange');
    }, 250);

    return () => {
      if (timersRef.current.debounce) clearTimeout(timersRef.current.debounce);
    };
  }, [evaluateBrief]);

  // Evaluate when app becomes active (resume).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        evaluateBrief('appActive');
      }
    });
    return () => sub.remove();
  }, [evaluateBrief]);

  const displayBrief = cachedBrief ?? {
    line1: 'This is your day.',
    line2: 'What matters most right now?',
    line3: undefined,
    reason: 'default',
    momentKey: 'default',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    contextHash: 'default',
    source: 'rules' as const,
  };

  const name = (profileFullName?.split(' ')[0] || 'Paul').trim();
  const date = formatHomeDate(nowDate);

  return (
    <HomeTemplate
      dailyBrief={{
        name,
        date,
        unassignedCount,
        line1: displayBrief.line1,
        line2: displayBrief.line2,
        line3: displayBrief.line3,
      }}
    />
  );
}

function formatHomeDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(d);
}
