import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ComprehensiveCalendarTemplate } from '../components/templates/ComprehensiveCalendarTemplate';
import { useEventsStore } from '@/stores';
import {
  getIosInsightsSupportStatus,
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  presentScreenTimeReportSafeAsync,
  type ScreenTimeAuthorizationStatus,
  type ScreenTimeSummary,
} from '@/lib/ios-insights';
import { deriveActualEventsFromScreenTime } from '@/lib/calendar/derive-screen-time-actual-events';

export default function ComprehensiveCalendarScreen() {
  const [status, setStatus] = useState<ScreenTimeAuthorizationStatus>('unsupported');
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);

  const supportStatus = useMemo(() => getIosInsightsSupportStatus(), []);
  const actualEvents = useEventsStore((state) => state.actualEvents);
  const setDerivedActualEvents = useEventsStore((state) => state.setDerivedActualEvents);

  const isStale = useCallback((generatedAtIso: string | undefined, maxAgeMinutes: number): boolean => {
    if (!generatedAtIso) return true;
    const parsed = new Date(generatedAtIso);
    if (Number.isNaN(parsed.getTime())) return true;
    return Date.now() - parsed.getTime() > maxAgeMinutes * 60_000;
  }, []);

  const maybeAutoSync = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'ios') return;
    if (supportStatus !== 'available') return;

    const nextStatus = await getScreenTimeAuthorizationStatusSafeAsync();
    setStatus(nextStatus);
    if (nextStatus !== 'approved') {
      setSummary(null);
      return;
    }

    const cached = await getCachedScreenTimeSummarySafeAsync('today');
    const shouldSync = !cached || isStale(cached.generatedAtIso, 15);
    if (!shouldSync) {
      setSummary(cached);
      return;
    }

    // Sync via the report extension, then re-read cache with small retries.
    await presentScreenTimeReportSafeAsync('today');
    for (let attempt = 0; attempt < 5; attempt++) {
      const refreshed = await getCachedScreenTimeSummarySafeAsync('today');
      if (refreshed) {
        setSummary(refreshed);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // If we couldn't read a refreshed cache, keep whatever we had.
    setSummary(cached ?? null);
  }, [isStale, supportStatus]);

  useEffect(() => {
    void maybeAutoSync();
  }, [maybeAutoSync]);

  useEffect(() => {
    // Derive “display actual” events when Screen Time is present; otherwise clear derivation.
    if (!(supportStatus === 'available' && status === 'approved' && summary)) {
      setDerivedActualEvents(null);
      return;
    }

    // Remove the hardcoded demo Screen Time block when we have real Screen Time data.
    const baseActualEvents = actualEvents.filter((e) => e.id !== 'a_screen_time');

    const derived = deriveActualEventsFromScreenTime({
      existingActualEvents: baseActualEvents,
      screenTimeSummary: summary,
    });

    setDerivedActualEvents(derived);
  }, [actualEvents, setDerivedActualEvents, status, summary, supportStatus]);

  // Keep template unchanged (it reads derivedActualEvents if present).
  return <ComprehensiveCalendarTemplate />;
}
