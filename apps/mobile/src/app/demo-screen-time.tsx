import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ScreenTimeAnalyticsTemplate } from '@/components/templates';
import {
  getIosInsightsSupportStatus,
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  presentScreenTimeReportSafeAsync,
  requestScreenTimeAuthorizationSafeAsync,
  getScreenTimeReportSupportStatus,
  getScreenTimeNativeMethodAvailabilityStatus,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeRangeKey,
  type ScreenTimeSummary,
} from '@/lib/ios-insights';

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const isStale = (generatedAtIso: string | undefined, maxAgeMinutes: number): boolean => {
  if (!generatedAtIso) return true;
  const parsed = new Date(generatedAtIso);
  if (Number.isNaN(parsed.getTime())) return true;
  return Date.now() - parsed.getTime() > maxAgeMinutes * 60_000;
};

export default function DemoScreenTimeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenTimeAuthorizationStatus>('unsupported');
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range, setRange] = useState<ScreenTimeRangeKey>('today');

  const supportStatus = useMemo(() => getIosInsightsSupportStatus(), []);
  const canUseNative = supportStatus === 'available' && status !== 'unsupported';
  const { supportsRange } = useMemo(() => getScreenTimeReportSupportStatus(), []);
  const nativeMethods = useMemo(() => getScreenTimeNativeMethodAvailabilityStatus(), []);
  const showAuthorizationCta = canUseNative && (status === 'notDetermined' || status === 'denied');

  const statusLabel = useMemo(() => {
    if (Platform.OS !== 'ios') return 'iOS only.';
    if (supportStatus === 'expoGo') {
      return 'You are running in Expo Go. Screen Time requires a custom iOS dev client. Build it (pnpm --filter mobile ios) and open the installed “mobile” app (not Expo Go).';
    }
    if (supportStatus === 'missingNativeModule') {
      return 'IosInsights native module is not present in this build. This usually means your iOS dev client is stale—rebuild it (pnpm --filter mobile ios) and reopen the app.';
    }
    if (errorMessage) {
      // Add high-signal debug context for physical device builds (helps confirm which native methods exist).
      return `Error: ${errorMessage}\n\nNative methods:\n- presentScreenTimeReport: ${
        nativeMethods.hasPresentScreenTimeReport ? 'yes' : 'no'
      }\n- presentTodayScreenTimeReport: ${
        nativeMethods.hasPresentTodayScreenTimeReport ? 'yes' : 'no'
      }\n- getCachedScreenTimeSummaryJson: ${nativeMethods.hasGetCachedScreenTimeSummaryJson ? 'yes' : 'no'}`;
    }
    if (status === 'unsupported') return 'Screen Time is not available.';
    if (status === 'denied') return 'Screen Time access is off. Enable it once to see today’s totals here.';
    if (status === 'notDetermined') return 'Enable Screen Time once to see today’s totals here.';
    return 'Screen Time unavailable.';
  }, [errorMessage, nativeMethods, status, supportStatus]);

  const totalLabel = useMemo(() => {
    if (!summary) return '—';
    return formatDuration(summary.totalSeconds);
  }, [summary]);

  const score = useMemo(() => {
    if (!summary) return null;
    const minutes = Math.round(summary.totalSeconds / 60);
    const pickups = summary.topApps.reduce((acc, app) => acc + app.pickups, 0);
    // Heuristic score: lower minutes and lower pickups => higher score.
    // Keeps this "real" (derived from actual data) without claiming to be Apple’s metric.
    const minutesPenalty = Math.min(70, Math.round(minutes / 6));
    const pickupsPenalty = Math.min(30, Math.round(pickups / 8));
    return Math.max(0, Math.min(100, 100 - minutesPenalty - pickupsPenalty));
  }, [summary]);

  const scoreLabel = useMemo(() => {
    if (score === null) return '—';
    if (score >= 80) return 'Balanced';
    if (score >= 60) return 'Steady';
    return 'Overloaded';
  }, [score]);

  const scoreTrendLabel = useMemo(() => {
    if (score === null) return null;
    return score >= 80 ? 'Improving' : score >= 60 ? 'Stable' : 'Needs focus';
  }, [score]);

  const deltaLabel = useMemo(() => {
    // Placeholder until we have history-based baseline.
    return null;
  }, []);

  const insightBody = useMemo(() => {
    if (!summary) return null;
    const minutes = Math.round(summary.totalSeconds / 60);
    if (minutes === 0) return "No usage yet today. You’re set up for a focused day.";
    if (minutes <= 90) return 'Your screen time is light today—great control. Keep momentum by batching check-ins.';
    if (minutes <= 180) return 'You’re in a solid range. Try compressing social check-ins into one window to protect deep work.';
    return 'Screen time is trending high today. A small boundary (like a 15-minute cap) can protect your evening routine.';
  }, [summary]);

  const suggestionBody = useMemo(() => {
    if (!summary) return null;
    const top = summary.topApps[0]?.displayName;
    if (!top) return 'Try a 15-minute limit for social apps this evening to protect your wind-down routine.';
    return `Try setting a 15-minute limit for ${top} this evening to protect your wind-down routine.`;
  }, [summary]);

  const topApps = useMemo(() => {
    if (!summary) return [];
    return summary.topApps.map((app) => {
      const category = categorizeApp(app.displayName);
      return {
        id: app.bundleIdentifier,
        name: app.displayName,
        durationLabel: formatDuration(app.durationSeconds),
        durationSeconds: app.durationSeconds,
        categoryLabel: category.label,
        categoryAccent: category.accent,
      };
    });
  }, [summary]);

  const refreshStatusAndCache = useCallback(async (): Promise<{
    nextStatus: ScreenTimeAuthorizationStatus;
    nextSummary: ScreenTimeSummary | null;
  }> => {
    setErrorMessage(null);

    const support = getIosInsightsSupportStatus();
    if (support !== 'available') {
      setStatus('unsupported');
      setSummary(null);
      return { nextStatus: 'unsupported', nextSummary: null };
    }

    try {
      const [nextStatus, nextSummary] = await Promise.all([
        getScreenTimeAuthorizationStatusSafeAsync(),
        getCachedScreenTimeSummarySafeAsync(range),
      ]);
      setStatus(nextStatus);
      setSummary(nextSummary);
      return { nextStatus, nextSummary };
    } catch (e) {
      setStatus('unknown');
      setSummary(null);
      setErrorMessage(e instanceof Error ? e.message : String(e));
      return { nextStatus: 'unknown', nextSummary: null };
    }
  }, [range]);

  useEffect(() => {
    void refreshStatusAndCache();
  }, [refreshStatusAndCache]);

  const onRequestAuthorization = useCallback(async () => {
    setErrorMessage(null);
    try {
      const nextStatus = await requestScreenTimeAuthorizationSafeAsync();
      setStatus(nextStatus);
      if (nextStatus === 'approved') {
        // Immediately sync the first time permissions are approved.
        setIsSyncing(true);
        try {
          await presentScreenTimeReportSafeAsync(range);
          const { nextSummary } = await refreshStatusAndCache();
          if (!nextSummary) {
            setErrorMessage(
              'Screen Time synced, but no data was returned. This usually means the report filter produced an empty result or the report extension didn’t write to the shared cache.',
            );
          }
        } finally {
          setIsSyncing(false);
        }
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStatus('unknown');
    }
  }, [refreshStatusAndCache]);

  const maybeAutoSync = useCallback(async () => {
    if (!(supportStatus === 'available' && status === 'approved')) return;
    // Keep it light: only auto-sync if we have no data yet or it's stale.
    const shouldSync = !summary || isStale(summary.generatedAtIso, 15);
    if (!shouldSync) return;

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      await presentScreenTimeReportSafeAsync(range);
      
      // Retry reading the cache a few times in case there's a slight delay
      // between when the extension writes and when we can read it.
      let nextSummary: ScreenTimeSummary | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await refreshStatusAndCache();
        if (result.nextSummary) {
          nextSummary = result.nextSummary;
          break;
        }
        // Wait 300ms before retrying
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      
      if (!nextSummary) {
        setErrorMessage(
          'Screen Time synced, but no data was returned. Please try again.',
        );
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
    }
  }, [range, refreshStatusAndCache, status, summary, supportStatus]);

  useEffect(() => {
    void maybeAutoSync();
  }, [maybeAutoSync]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTimeAnalyticsTemplate
        range={range}
        onChangeRange={setRange}
        canChangeRange={supportsRange}
        totalLabel={totalLabel}
        deltaLabel={deltaLabel}
        score={score}
        scoreLabel={scoreLabel}
        scoreTrendLabel={scoreTrendLabel}
        insightBody={insightBody}
        suggestionBody={suggestionBody}
        hourlyBuckets={summary?.hourlyBucketsSeconds ?? null}
        topApps={topApps}
        onPressBack={() => router.back()}
        onPressSettings={undefined}
        isSyncing={isSyncing}
        statusLabel={showAuthorizationCta || !!errorMessage ? statusLabel : null}
        onRequestAuthorization={onRequestAuthorization}
        showAuthorizationCta={showAuthorizationCta}
      />
    </>
  );
}

function categorizeApp(appName: string): { label: string; accent: string } {
  const name = appName.toLowerCase();

  const work = ['slack', 'gmail', 'calendar', 'outlook', 'teams', 'notion', 'jira', 'figma', 'linear'];
  const faith = ['bible', 'pray', 'prayer', 'hallow', 'youversion', 'calm'];
  const family = ['instagram', 'tiktok', 'snapchat', 'facebook', 'messages', 'messenger', 'whatsapp', 'imessage'];

  if (work.some((k) => name.includes(k))) return { label: 'Work', accent: '#2F7BFF' };
  if (faith.some((k) => name.includes(k))) return { label: 'Faith', accent: '#F79A3B' };
  if (family.some((k) => name.includes(k))) return { label: 'Family', accent: '#5F63F5' };
  return { label: 'Other', accent: '#9CA3AF' };
}


