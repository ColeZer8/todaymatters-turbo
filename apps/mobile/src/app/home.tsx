import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import { HomeTemplate } from '@/components/templates';
import type { ConversationStatus, StartConversationOptions } from '@/lib/elevenlabs/types';
import {
  buildHomeBriefContext,
  generateHomeBriefDraft,
  getNextScheduleBoundary,
  getNextTimeOfDayBoundary,
  type HomeBriefDraft,
} from '@/lib/home-brief';
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
import { deriveFullNameFromEmail, getFirstName } from '@/lib/user-name';

// Voice features require native modules and do not run in Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically load ElevenLabsProvider only when native modules are available.
// String concatenation avoids Metro static analysis in Expo Go builds.
let ElevenLabsProvider: React.ComponentType<{ children: ReactNode }> | null = null;
if (!isExpoGo) {
  try {
    const pkg = '@elevenlabs' + '/react-native';
    ElevenLabsProvider = require(pkg).ElevenLabsProvider;
  } catch {
    ElevenLabsProvider = null;
  }
}

// Dynamically load `useVoiceCoach` only when native modules are available.
// String concatenation avoids Metro static analysis in Expo Go builds.
let useVoiceCoach: typeof import('@/hooks/use-voice-coach').useVoiceCoach | null = null;
if (!isExpoGo) {
  try {
    const hookPath = '@/hooks' + '/use-voice-coach';
    useVoiceCoach = require(hookPath).useVoiceCoach;
  } catch {
    useVoiceCoach = null;
  }
}

interface VoiceCoachApi {
  status: ConversationStatus;
  startConversation: (options?: StartConversationOptions) => Promise<void>;
  endConversation: () => Promise<void>;
}

function HomeScreenInner() {
  const scheduledEvents = useEventsStore((s) => s.scheduledEvents);
  const unassignedCount = useReviewTimeStore((s) => s.unassignedCount);
  const goals = useGoalsStore((s) => s.goals);

  const coachPersona = useOnboardingStore((s) => s.coachPersona);
  const morningMindset = useOnboardingStore((s) => s.morningMindset);
  const focusStyle = useOnboardingStore((s) => s.focusStyle);
  const wakeTimeIso = useOnboardingStore((s) => s.wakeTime);
  const sleepTimeIso = useOnboardingStore((s) => s.sleepTime);
  const fullName = useOnboardingStore((s) => s.fullName);
  const setFullName = useOnboardingStore((s) => s.setFullName);

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

  const [profileBirthday, setProfileBirthday] = useState<string | null>(null);

  const timersRef = useRef<{ debounce?: ReturnType<typeof setTimeout>; boundary?: ReturnType<typeof setTimeout> }>({});
  const llmRequestIdRef = useRef(0);

  // Stable callback to avoid re-creating voice hook options every render
  const onVoiceError = useCallback((error: Error) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[Home] Voice coach error:', error.message);
    }
  }, []);

  const isVoiceAvailable = !!useVoiceCoach && !!ElevenLabsProvider;
  const voiceApiRef = useRef<VoiceCoachApi | null>(null);
  const setVoiceApi = useCallback((voice: VoiceCoachApi | null) => {
    voiceApiRef.current = voice;
  }, []);

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
        if (profile?.full_name) {
          setFullName(profile.full_name);
        }
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
        profile: { fullName, birthday: profileBirthday },
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

    function maybePolishWithLlm(ctx: unknown, draft: HomeBriefDraft) {
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
    fullName,
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

  const derivedFromEmail = deriveFullNameFromEmail(user?.email);
  const firstName =
    getFirstName(fullName) ?? getFirstName(derivedFromEmail) ?? 'there';
  const name = firstName.trim();
  const date = formatHomeDate(nowDate);

  // Use refs to keep handler stable and prevent re-renders
  const nameRef = useRef(name);
  nameRef.current = name;

  const lastToggleAtRef = useRef(0);

  // Stable handler that doesn't change when voice/name changes (prevents re-renders)
  const handlePressGreeting = useCallback(() => {
    const v = voiceApiRef.current;
    if (!v) return;

    const now = Date.now();
    if (now - lastToggleAtRef.current < 120) return; // debounce fast double-taps
    lastToggleAtRef.current = now;

    const run = async () => {
      try {
        // Treat anything that's not fully disconnected as "stop"
        // (covers connected/connecting/disconnecting so we never get stuck)
        if (v.status !== 'disconnected' && v.status !== 'error') {
          await v.endConversation();
          return;
        }

        await v.startConversation({
          dynamicVariables: {
            user_name: nameRef.current,
            current_screen: 'home',
          },
        });
      } catch (error: unknown) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error('[Home] Voice toggle failed:', error);
        }
      }
    };

    void run();
  }, []); // Empty deps = stable reference

  // Safety: if the user leaves Home, end the session so the mic isn't running "invisibly".
  useEffect(() => {
    return () => {
      const v = voiceApiRef.current;
      if (v && (v.status === 'connected' || v.status === 'connecting')) {
        void v.endConversation().catch(() => undefined);
      }
    };
  }, []);

  return (
    <>
      {isVoiceAvailable ? (
        // Put the voice hook in its own tiny component so status changes
        // don't force a full Home rerender (eliminates the "white flash").
        <VoiceCoachController useVoiceCoachHook={useVoiceCoach!} onError={onVoiceError} onVoiceChange={setVoiceApi} />
      ) : null}
      <HomeTemplate
        dailyBrief={{
          name,
          date,
          unassignedCount,
          line1: displayBrief.line1,
          line2: displayBrief.line2,
          line3: displayBrief.line3,
        }}
        onPressGreeting={isVoiceAvailable ? handlePressGreeting : undefined}
      />
    </>
  );
}

function VoiceCoachController({
  useVoiceCoachHook,
  onError,
  onVoiceChange,
}: {
  useVoiceCoachHook: NonNullable<typeof useVoiceCoach>;
  onError: (error: Error) => void;
  onVoiceChange: (voice: VoiceCoachApi | null) => void;
}) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const voice = useVoiceCoachHook({ onError });
  useEffect(() => {
    onVoiceChange(voice);
    return () => onVoiceChange(null);
  }, [onVoiceChange, voice]);
  return null;
}

export default function HomeScreen() {
  if (ElevenLabsProvider) {
    return (
      <ElevenLabsProvider>
        <HomeScreenInner />
      </ElevenLabsProvider>
    );
  }
  return <HomeScreenInner />;
}

function formatHomeDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(d);
}
