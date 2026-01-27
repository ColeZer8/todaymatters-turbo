import { Redirect, Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { ScreenTimeAnalyticsTemplate } from "@/components/templates";
import { useDemoStore } from "@/stores";
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
} from "@/lib/ios-insights";
import {
  getUsageAuthorizationStatusSafeAsync,
  getUsageSummarySafeAsync,
  openUsageSettingsSafeAsync,
  type UsageAccessAuthorizationStatus,
  type UsageSummary,
} from "@/lib/insights";
import { getAndroidInsightsSupportStatus } from "@/lib/android-insights";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const isStale = (
  generatedAtIso: string | undefined,
  maxAgeMinutes: number,
): boolean => {
  if (!generatedAtIso) return true;
  const parsed = new Date(generatedAtIso);
  if (Number.isNaN(parsed.getTime())) return true;
  return Date.now() - parsed.getTime() > maxAgeMinutes * 60_000;
};

export default function DemoScreenTimeScreen() {
  const isDemoActive = useDemoStore((s) => s.isActive);
  const router = useRouter();

  // Keep iOS state and logic intact (Screen Time / FamilyControls)
  const [status, setStatus] =
    useState<ScreenTimeAuthorizationStatus>("unsupported");
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range, setRange] = useState<ScreenTimeRangeKey>("today");

  const supportStatus = useMemo(() => getIosInsightsSupportStatus(), []);
  const canUseNative =
    supportStatus === "available" && status !== "unsupported";
  const { supportsRange } = useMemo(
    () => getScreenTimeReportSupportStatus(),
    [],
  );
  const nativeMethods = useMemo(
    () => getScreenTimeNativeMethodAvailabilityStatus(),
    [],
  );
  const showAuthorizationCta =
    canUseNative && (status === "notDetermined" || status === "denied");

  // Android state (UsageStatsManager)
  const androidSupportStatus = useMemo(
    () => getAndroidInsightsSupportStatus(),
    [],
  );
  const [androidStatus, setAndroidStatus] =
    useState<UsageAccessAuthorizationStatus>("unsupported");
  const [androidSummary, setAndroidSummary] = useState<UsageSummary | null>(
    null,
  );
  const [androidIsSyncing, setAndroidIsSyncing] = useState(false);
  const [androidErrorMessage, setAndroidErrorMessage] = useState<string | null>(
    null,
  );

  const isAndroid = Platform.OS === "android";
  const canUseAndroidNative = isAndroid && androidSupportStatus === "available";
  const showAndroidAuthorizationCta =
    canUseAndroidNative && androidStatus !== "authorized";

  const statusLabel = useMemo(() => {
    if (Platform.OS !== "ios") return "iOS only.";
    if (supportStatus === "expoGo") {
      return "You are running in Expo Go. Screen Time requires a custom iOS dev client. Build it (pnpm --filter mobile ios) and open the installed “mobile” app (not Expo Go).";
    }
    if (supportStatus === "missingNativeModule") {
      return "IosInsights native module is not present in this build. This usually means your iOS dev client is stale—rebuild it (pnpm --filter mobile ios) and reopen the app.";
    }
    if (errorMessage) {
      // Add high-signal debug context for physical device builds (helps confirm which native methods exist).
      return `Error: ${errorMessage}\n\nNative methods:\n- presentScreenTimeReport: ${
        nativeMethods.hasPresentScreenTimeReport ? "yes" : "no"
      }\n- presentTodayScreenTimeReport: ${
        nativeMethods.hasPresentTodayScreenTimeReport ? "yes" : "no"
      }\n- getCachedScreenTimeSummaryJson: ${nativeMethods.hasGetCachedScreenTimeSummaryJson ? "yes" : "no"}`;
    }
    if (status === "unsupported") return "Screen Time is not available.";
    if (status === "denied")
      return "Screen Time access is off. Enable it once to see today’s totals here.";
    if (status === "notDetermined")
      return "Enable Screen Time once to see today’s totals here.";
    return "Screen Time unavailable.";
  }, [errorMessage, nativeMethods, status, supportStatus]);

  const androidStatusLabel = useMemo(() => {
    if (Platform.OS !== "android") return "Android only.";
    if (androidSupportStatus === "expoGo") {
      return "You are running in Expo Go. Usage Stats requires a custom Android dev client. Build it (pnpm --filter mobile android) and open the installed “mobile” app (not Expo Go).";
    }
    if (androidSupportStatus === "missingNativeModule") {
      return "AndroidInsights native module is not present in this build. Rebuild the Android dev client.";
    }
    if (androidErrorMessage) return `Error: ${androidErrorMessage}`;
    if (androidStatus === "authorized")
      return "Usage Stats connected. Tap Refresh to pull the latest totals.";
    if (androidStatus === "denied")
      return "Usage access is off. Enable “Usage Access” once to see today’s totals here.";
    if (androidStatus === "notDetermined")
      return "Enable “Usage Access” once to see today’s totals here.";
    if (androidStatus === "unsupported") return "Usage Stats is not available.";
    return "Usage Stats unavailable.";
  }, [androidErrorMessage, androidStatus, androidSupportStatus]);

  const resolvedSummary: {
    totalSeconds: number;
    topApps: Array<{
      id: string;
      name: string;
      durationSeconds: number;
      pickups?: number;
    }>;
  } | null =
    Platform.OS === "ios"
      ? summary
        ? {
            totalSeconds: summary.totalSeconds,
            topApps: summary.topApps.map((app) => ({
              id: app.bundleIdentifier,
              name: app.displayName,
              durationSeconds: app.durationSeconds,
              pickups: app.pickups,
            })),
          }
        : null
      : androidSummary
        ? {
            totalSeconds: androidSummary.totalSeconds,
            topApps: androidSummary.topApps.map((app) => ({
              id: app.packageName,
              name: app.displayName,
              durationSeconds: app.durationSeconds,
              pickups: 0,
            })),
          }
        : null;

  const totalLabel = useMemo(() => {
    if (!resolvedSummary) return "—";
    return formatDuration(resolvedSummary.totalSeconds);
  }, [resolvedSummary]);

  const score = useMemo(() => {
    if (!resolvedSummary) return null;
    const minutes = Math.round(resolvedSummary.totalSeconds / 60);
    const pickups = resolvedSummary.topApps.reduce(
      (acc, app) => acc + (app.pickups ?? 0),
      0,
    );
    // Heuristic score: lower minutes and lower pickups => higher score.
    // Keeps this "real" (derived from actual data) without claiming to be Apple’s metric.
    const minutesPenalty = Math.min(70, Math.round(minutes / 6));
    const pickupsPenalty = Math.min(30, Math.round(pickups / 8));
    return Math.max(0, Math.min(100, 100 - minutesPenalty - pickupsPenalty));
  }, [resolvedSummary]);

  const scoreLabel = useMemo(() => {
    if (score === null) return "—";
    if (score >= 80) return "Balanced";
    if (score >= 60) return "Steady";
    return "Overloaded";
  }, [score]);

  const scoreTrendLabel = useMemo(() => {
    if (score === null) return null;
    return score >= 80 ? "Improving" : score >= 60 ? "Stable" : "Needs focus";
  }, [score]);

  const deltaLabel = useMemo(() => {
    // Placeholder until we have history-based baseline.
    return null;
  }, []);

  const insightBody = useMemo(() => {
    if (!resolvedSummary) return null;
    const minutes = Math.round(resolvedSummary.totalSeconds / 60);
    if (minutes === 0)
      return "No usage yet today. You’re set up for a focused day.";
    if (minutes <= 90)
      return "Your screen time is light today—great control. Keep momentum by batching check-ins.";
    if (minutes <= 180)
      return "You’re in a solid range. Try compressing social check-ins into one window to protect deep work.";
    return "Screen time is trending high today. A small boundary (like a 15-minute cap) can protect your evening routine.";
  }, [resolvedSummary]);

  const suggestionBody = useMemo(() => {
    if (!resolvedSummary) return null;
    const top = resolvedSummary.topApps[0]?.name;
    if (!top)
      return "Try a 15-minute limit for social apps this evening to protect your wind-down routine.";
    return `Try setting a 15-minute limit for ${top} this evening to protect your wind-down routine.`;
  }, [resolvedSummary]);

  const topApps = useMemo(() => {
    if (!resolvedSummary) return [];
    return resolvedSummary.topApps.map((app) => {
      const category = categorizeApp(app.name);
      return {
        id: app.id,
        name: app.name,
        durationLabel: formatDuration(app.durationSeconds),
        durationSeconds: app.durationSeconds,
        categoryLabel: category.label,
        categoryAccent: category.accent,
      };
    });
  }, [resolvedSummary]);

  const refreshAndroid = useCallback(async () => {
    if (!canUseAndroidNative) return;
    setAndroidIsSyncing(true);
    setAndroidErrorMessage(null);
    try {
      const [nextStatus, nextSummary] = await Promise.all([
        getUsageAuthorizationStatusSafeAsync(),
        getUsageSummarySafeAsync(range),
      ]);
      setAndroidStatus(nextStatus);
      setAndroidSummary(nextSummary);
    } catch (e) {
      setAndroidStatus("unknown");
      setAndroidSummary(null);
      setAndroidErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setAndroidIsSyncing(false);
    }
  }, [canUseAndroidNative, range]);

  const refreshStatusAndCache = useCallback(async (): Promise<{
    nextStatus: ScreenTimeAuthorizationStatus;
    nextSummary: ScreenTimeSummary | null;
  }> => {
    setErrorMessage(null);

    const support = getIosInsightsSupportStatus();
    if (support !== "available") {
      setStatus("unsupported");
      setSummary(null);
      return { nextStatus: "unsupported", nextSummary: null };
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
      setStatus("unknown");
      setSummary(null);
      setErrorMessage(e instanceof Error ? e.message : String(e));
      return { nextStatus: "unknown", nextSummary: null };
    }
  }, [range]);

  useEffect(() => {
    if (!isDemoActive) return;
    if (Platform.OS === "ios") void refreshStatusAndCache();
    if (Platform.OS === "android") void refreshAndroid();
  }, [isDemoActive, refreshStatusAndCache]);

  const onRequestAuthorization = useCallback(async () => {
    if (!isDemoActive) return;
    setErrorMessage(null);
    try {
      const nextStatus = await requestScreenTimeAuthorizationSafeAsync();
      setStatus(nextStatus);
      if (nextStatus === "approved") {
        // Immediately sync the first time permissions are approved.
        setIsSyncing(true);
        try {
          await presentScreenTimeReportSafeAsync(range);
          const { nextSummary } = await refreshStatusAndCache();
          if (!nextSummary) {
            setErrorMessage(
              "Screen Time synced, but no data was returned. This usually means the report filter produced an empty result or the report extension didn’t write to the shared cache.",
            );
          }
        } finally {
          setIsSyncing(false);
        }
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStatus("unknown");
    }
  }, [isDemoActive, refreshStatusAndCache]);

  const onRequestAndroidAuthorization = useCallback(async () => {
    if (!isDemoActive) return;
    setAndroidErrorMessage(null);
    try {
      await openUsageSettingsSafeAsync();
      // User must grant access in Settings; we re-check when they return.
      await refreshAndroid();
    } catch (e) {
      setAndroidErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [isDemoActive, refreshAndroid]);

  const maybeAutoSync = useCallback(async () => {
    if (!isDemoActive) return;
    if (!(supportStatus === "available" && status === "approved")) return;
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
          "Screen Time synced, but no data was returned. Please try again.",
        );
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
    }
  }, [
    isDemoActive,
    range,
    refreshStatusAndCache,
    status,
    summary,
    supportStatus,
  ]);

  useEffect(() => {
    if (!isDemoActive) return;
    if (Platform.OS === "ios") void maybeAutoSync();
  }, [isDemoActive, maybeAutoSync]);

  if (!isDemoActive) {
    return <Redirect href="/comprehensive-calendar" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTimeAnalyticsTemplate
        range={range}
        onChangeRange={setRange}
        canChangeRange={Platform.OS === "ios" ? supportsRange : true}
        totalLabel={totalLabel}
        deltaLabel={deltaLabel}
        score={score}
        scoreLabel={scoreLabel}
        scoreTrendLabel={scoreTrendLabel}
        insightBody={insightBody}
        suggestionBody={suggestionBody}
        hourlyBuckets={
          Platform.OS === "ios" ? (summary?.hourlyBucketsSeconds ?? null) : null
        }
        topApps={topApps}
        onPressBack={() => router.back()}
        onPressSettings={undefined}
        isSyncing={Platform.OS === "ios" ? isSyncing : androidIsSyncing}
        statusLabel={
          Platform.OS === "ios"
            ? showAuthorizationCta || !!errorMessage
              ? statusLabel
              : null
            : showAndroidAuthorizationCta || !!androidErrorMessage
              ? androidStatusLabel
              : null
        }
        onRequestAuthorization={
          Platform.OS === "ios"
            ? onRequestAuthorization
            : onRequestAndroidAuthorization
        }
        showAuthorizationCta={
          Platform.OS === "ios"
            ? showAuthorizationCta
            : showAndroidAuthorizationCta
        }
      />
    </>
  );
}

function categorizeApp(appName: string): { label: string; accent: string } {
  const name = appName.toLowerCase();

  const work = [
    "slack",
    "gmail",
    "calendar",
    "outlook",
    "teams",
    "notion",
    "jira",
    "figma",
    "linear",
  ];
  const faith = ["bible", "pray", "prayer", "hallow", "youversion", "calm"];
  const family = [
    "instagram",
    "tiktok",
    "snapchat",
    "facebook",
    "messages",
    "messenger",
    "whatsapp",
    "imessage",
  ];

  if (work.some((k) => name.includes(k)))
    return { label: "Work", accent: "#2F7BFF" };
  if (faith.some((k) => name.includes(k)))
    return { label: "Faith", accent: "#F79A3B" };
  if (family.some((k) => name.includes(k)))
    return { label: "Family", accent: "#5F63F5" };
  return { label: "Other", accent: "#9CA3AF" };
}
