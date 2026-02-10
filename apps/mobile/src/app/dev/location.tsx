import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Sparkles, Home, Briefcase, Pin } from "lucide-react-native";
import { useAuthStore } from "@/stores";
import { Card, GradientButton, Icon } from "@/components/atoms";
import { BottomToolbar } from "@/components/organisms/BottomToolbar";
import { peekPendingLocationSamplesAsync } from "@/lib/ios-location/queue";
import { peekPendingAndroidLocationSamplesAsync } from "@/lib/android-location/queue";
import { flushPendingLocationSamplesToSupabaseAsync } from "@/lib/location-provider/ios";
import { flushPendingAndroidLocationSamplesToSupabaseAsync } from "@/lib/android-location";
import { fetchRecentLocationSamples } from "@/lib/supabase/services/location-samples";
import { supabase } from "@/lib/supabase/client";
import {
  inferPlacesFromHistory,
  type InferredPlace,
  type PlaceInferenceResult,
} from "@/lib/supabase/services/place-inference";
import { fetchLocationHourlyForDay, type LocationHourlyRow } from "@/lib/supabase/services/evidence-data";
import { debugTestLocationPlaceLookup } from "@/lib/supabase/services/location-place-lookup";
import type { IosLocationSample } from "@/lib/ios-location/types";
import type { AndroidLocationSample } from "@/lib/android-location/types";

type LocationSample = IosLocationSample | AndroidLocationSample;

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function DevLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [samples, setSamples] = useState<LocationSample[]>([]);
  const [remoteSamples, setRemoteSamples] = useState<LocationSample[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  
  // Place Inference state
  const [inferenceResult, setInferenceResult] = useState<PlaceInferenceResult | null>(null);
  const [isInferenceLoading, setIsInferenceLoading] = useState(false);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [isFlushLoading, setIsFlushLoading] = useState(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);
  
  // Hourly data with place names from the view (includes google_place_name from cache)
  const [hourlyData, setHourlyData] = useState<LocationHourlyRow[]>([]);
  
  // Debug test state
  const [isDebugTestLoading, setIsDebugTestLoading] = useState(false);
  const [debugTestResult, setDebugTestResult] = useState<string | null>(null);

  const samplesToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return samples.filter((sample) => {
      const ts = new Date(sample.recorded_at).getTime();
      return Number.isFinite(ts) && ts >= startMs;
    });
  }, [samples]);

  const remoteSamplesToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return remoteSamples.filter((sample) => {
      const ts = new Date(sample.recorded_at).getTime();
      return Number.isFinite(ts) && ts >= startMs;
    });
  }, [remoteSamples]);

  const refreshSamples = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSupabaseWarning(null);
    try {
      const nextSamples =
        Platform.OS === "ios"
          ? await peekPendingLocationSamplesAsync(userId, 200)
          : await peekPendingAndroidLocationSamplesAsync(userId, 200);
      setSamples(nextSamples);
      try {
        const sinceIso = new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString();
        const remote = await fetchRecentLocationSamples(userId, {
          limit: 200,
          sinceIso,
        });
        setRemoteSamples(remote);
        
        // Fetch hourly data with place names for today
        const now = new Date();
        const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const hourly = await fetchLocationHourlyForDay(userId, todayYmd);
        setHourlyData(hourly);
        if (__DEV__) {
          console.log(`📍 Hourly data loaded: ${hourly.length} rows`);
          hourly.slice(0, 3).forEach(r => {
            const placeName = r.place_label || r.google_place_name || "(no name)";
            console.log(`   - ${r.hour_start}: ${placeName}`);
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("📍 Location samples fetch failed:", error);
        }
        setSupabaseWarning(
          "Supabase tables are missing — showing only local queued samples.",
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
      setLastRefreshAt(new Date());
    }
  }, [userId]);

  // Manual flush to Supabase
  const flushToSupabase = useCallback(async () => {
    if (!userId) return;
    setIsFlushLoading(true);
    setFlushMessage(null);
    try {
      const result = Platform.OS === "ios"
        ? await flushPendingLocationSamplesToSupabaseAsync(userId)
        : await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
      
      setFlushMessage(
        `✅ Flushed: ${result.uploaded} uploaded, ${result.remaining} remaining in queue`
      );
      // Auto-refresh to show updated data
      void refreshSamples();
    } catch (error) {
      setFlushMessage(
        `❌ Flush error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsFlushLoading(false);
    }
  }, [userId, refreshSamples]);

  useEffect(() => {
    if (userId) void refreshSamples();
  }, [refreshSamples, userId]);

  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      void refreshSamples();
    }, 30_000);
    return () => clearInterval(id);
  }, [refreshSamples, userId]);

  const latest = useMemo(() => {
    const combined = [...samplesToday, ...remoteSamplesToday].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    if (combined.length === 0) return null;
    return combined[combined.length - 1];
  }, [remoteSamplesToday, samplesToday]);

  const hourlyBuckets = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => 0);
    for (const sample of [...samplesToday, ...remoteSamplesToday]) {
      const date = new Date(sample.recorded_at);
      const hour = date.getHours();
      if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
        buckets[hour] += 1;
      }
    }
    return buckets;
  }, [remoteSamplesToday, samplesToday]);

  // Build a map of hour -> place name from hourly data
  const hourlyPlaceNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of hourlyData) {
      const hourStart = new Date(row.hour_start);
      const hour = hourStart.getHours();
      const placeName = row.place_label || row.google_place_name || null;
      if (placeName && !map.has(hour)) {
        map.set(hour, placeName);
      }
    }
    return map;
  }, [hourlyData]);

  const hourlyBreakdown = useMemo(() => {
    const hourMaps = Array.from(
      { length: 24 },
      () => new Map<string, { count: number; lastAt: string; coords: string }>(),
    );

    for (const sample of [...samplesToday, ...remoteSamplesToday]) {
      const date = new Date(sample.recorded_at);
      const hour = date.getHours();
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      
      // Use place name from hourly data if available, otherwise fall back to coordinates
      const placeName = hourlyPlaceNames.get(hour);
      const coords = `${sample.latitude.toFixed(4)}, ${sample.longitude.toFixed(4)}`;
      const key = placeName || coords;
      
      const existing = hourMaps[hour].get(key);
      if (existing) {
        hourMaps[hour].set(key, {
          count: existing.count + 1,
          lastAt: sample.recorded_at,
          coords: existing.coords,
        });
      } else {
        hourMaps[hour].set(key, { count: 1, lastAt: sample.recorded_at, coords });
      }
    }

    return hourMaps.map((map, hour) => {
      const locations = Array.from(map.entries())
        .map(([label, data]) => ({
          label,
          count: data.count,
          lastAt: data.lastAt,
          coords: data.coords,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
      return { hour, locations };
    });
  }, [remoteSamplesToday, samplesToday, hourlyPlaceNames]);

  const maxHourly = Math.max(...hourlyBuckets, 1);

  const runPlaceLookup = useCallback(async () => {
    if (!userId) return;
    setLookupMessage(null);
    setIsLookupLoading(true);
    try {
      setLookupMessage("Fetching hourly data...");

      // Fetch hourly centroids for the past 7 days (these are what the view actually joins against)
      const allHourlyRows: LocationHourlyRow[] = [];
      const debugDays: string[] = [];
      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const rows = await fetchLocationHourlyForDay(userId, ymd);
        debugDays.push(`${ymd}: ${rows.length} rows`);
        if (__DEV__) {
          console.log(`📍 Hourly data for ${ymd}: ${rows.length} rows`);
          rows.slice(0, 3).forEach(r => {
            console.log(`   - ${r.hour_start}: place_label=${r.place_label}, google_place_name=${r.google_place_name}, lat=${r.centroid_latitude}`);
          });
        }
        allHourlyRows.push(...rows);
      }
      
      // Show debug info in UI
      setLookupMessage(`Fetched hourly data:\n${debugDays.join(', ')}\nTotal: ${allHourlyRows.length} rows`);
      
      if (__DEV__) {
        console.log(`📍 Total hourly rows: ${allHourlyRows.length}`);
      }

      // Filter to rows that need lookup (no place_label AND no google_place_name)
      // and extract the hourly centroids
      const dedupe = new Set<string>();
      const points: Array<{ latitude: number; longitude: number }> = [];
      
      let skippedWithPlaceLabel = 0;
      let skippedWithGoogleName = 0;
      let skippedNoCoords = 0;
      
      for (const row of allHourlyRows) {
        // Skip if already has a place name
        if (row.place_label) {
          skippedWithPlaceLabel++;
          continue;
        }
        if (row.google_place_name) {
          skippedWithGoogleName++;
          continue;
        }
        
        // Get centroid from hourly row
        const lat = row.centroid_latitude;
        const lng = row.centroid_longitude;
        if (lat == null || lng == null) {
          skippedNoCoords++;
          continue;
        }
        
        // Deduplicate by geohash7 (same precision as cache key)
        const key = row.geohash7 ?? `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        
        points.push({ latitude: lat, longitude: lng });
        if (points.length >= 50) break; // Limit to 50 unique locations
      }
      
      if (__DEV__) {
        console.log(`📍 Filter results: ${points.length} points to lookup`);
        console.log(`   - Skipped (has place_label): ${skippedWithPlaceLabel}`);
        console.log(`   - Skipped (has google_name): ${skippedWithGoogleName}`);
        console.log(`   - Skipped (no coordinates): ${skippedNoCoords}`);
      }

      if (points.length === 0) {
        setLookupMessage(
          `No locations to lookup.\n` +
          `Total hourly rows: ${allHourlyRows.length}\n` +
          `Skipped (place_label): ${skippedWithPlaceLabel}\n` +
          `Skipped (google_name): ${skippedWithGoogleName}\n` +
          `Skipped (no coords): ${skippedNoCoords}\n` +
          `User ID: ${userId}`
        );
        return;
      }

      setLookupMessage(`Looking up ${points.length} points via edge function...`);

      // Use supabase.functions.invoke() - same as the working pipeline
      // This handles auth automatically and avoids manual token parsing issues
      const { data, error } = await supabase.functions.invoke(
        "location-place-lookup",
        { body: { points } },
      );

      if (error) {
        setLookupMessage(
          `❌ Lookup failed: ${error.message}\n` +
          `Points attempted: ${points.length}\n` +
          `User ID: ${userId}`
        );
        return;
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      const poiResults = results.filter(
        (r: unknown) => (r as { source?: string })?.source === "google_places_nearby"
      ).length;
      const reverseGeocodeResults = results.filter(
        (r: unknown) => (r as { source?: string })?.source === "reverse_geocode"
      ).length;
      const cacheHits = results.filter(
        (r: unknown) => (r as { source?: string })?.source === "cache"
      ).length;
      const noResults = results.filter(
        (r: unknown) => (r as { source?: string })?.source === "none"
      ).length;
      
      // Build detailed status message
      const parts: string[] = [`✅ Lookup complete: ${results.length} locations processed`];
      if (poiResults > 0) parts.push(`📍 ${poiResults} POIs found`);
      if (reverseGeocodeResults > 0) parts.push(`🗺️ ${reverseGeocodeResults} areas (reverse geocode)`);
      if (cacheHits > 0) parts.push(`💾 ${cacheHits} from cache`);
      if (noResults > 0) parts.push(`⚠️ ${noResults} no results`);
      
      setLookupMessage(parts.join('\n'));
      
      // Auto-refresh samples to show updated place names
      if (poiResults > 0 || reverseGeocodeResults > 0) {
        void refreshSamples();
      }
    } catch (error) {
      setLookupMessage(
        `Lookup error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLookupLoading(false);
    }
  }, [userId, refreshSamples]);

  const runPlaceInference = useCallback(async () => {
    if (!userId) return;
    setIsInferenceLoading(true);
    setInferenceError(null);
    try {
      const result = await inferPlacesFromHistory(userId, 14);
      setInferenceResult(result);
    } catch (error) {
      setInferenceError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsInferenceLoading(false);
    }
  }, [userId]);

  // Debug test for edge function auth
  const runDebugTest = useCallback(async () => {
    setIsDebugTestLoading(true);
    setDebugTestResult(null);
    try {
      const result = await debugTestLocationPlaceLookup();
      setDebugTestResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setDebugTestResult(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsDebugTestLoading(false);
    }
  }, []);

  const getInferenceIcon = (type: InferredPlace["inferredType"]) => {
    switch (type) {
      case "home":
        return Home;
      case "work":
        return Briefcase;
      case "frequent":
        return Pin;
      default:
        return MapPin;
    }
  };

  const getInferenceColor = (type: InferredPlace["inferredType"]) => {
    switch (type) {
      case "home":
        return "#22C55E"; // green
      case "work":
        return "#3B82F6"; // blue
      case "frequent":
        return "#F59E0B"; // amber
      default:
        return "#6B7280"; // gray
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#FBFCFF", "#F4F7FF"]} style={{ flex: 1 }}>
        <SafeAreaView className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: 140 + insets.bottom,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
              >
                <Icon icon={ArrowLeft} size={20} color="#111827" />
              </Pressable>
              <Text className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-primary">
                Location Activity
              </Text>
              <View className="h-11 w-11" />
            </View>

            <View className="mt-5">
              <Card className="border border-[#E6EAF2] shadow-sm shadow-[#0f172a0d]">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-[18px] font-bold text-text-primary">
                      Today
                    </Text>
                    <Text className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                      Samples logged
                    </Text>
                    <Text className="mt-1 text-[34px] font-bold text-text-primary">
                      {samplesToday.length + remoteSamplesToday.length}
                    </Text>
                    <Text className="mt-1 text-[12px] text-text-tertiary">
                      Local queue: {samplesToday.length} · Supabase:{" "}
                      {remoteSamplesToday.length}
                    </Text>
                  </View>
                  <View className="items-center">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FF]">
                      <Icon icon={MapPin} size={20} color="#2563EB" />
                    </View>
                    <Text className="mt-2 text-[12px] font-semibold text-text-secondary">
                      {Platform.OS === "android" ? "Android" : "iOS"}
                    </Text>
                  </View>
                </View>

                {latest ? (
                  <View className="mt-3 flex-row items-center gap-2">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF]">
                      <Icon icon={MapPin} size={16} color="#2563EB" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-semibold text-text-primary">
                        {formatCoordinate(latest.latitude)},{" "}
                        {formatCoordinate(latest.longitude)}
                      </Text>
                      <Text className="text-[12px] text-text-secondary">
                        {formatTimestamp(latest.recorded_at)} ·
                        {latest.accuracy_m != null
                          ? ` ±${Math.round(latest.accuracy_m)}m`
                          : " accuracy n/a"}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text className="mt-3 text-[13px] text-text-tertiary">
                    No samples yet.
                  </Text>
                )}

                <View className="mt-4">
                  <GradientButton
                    label={isLoading ? "Refreshing…" : "Refresh samples"}
                    onPress={refreshSamples}
                    disabled={isLoading || !userId}
                  />
                </View>
                <View className="mt-3">
                  <GradientButton
                    label={isFlushLoading ? "Flushing to Supabase…" : "Flush to Supabase"}
                    onPress={flushToSupabase}
                    disabled={isFlushLoading || !userId}
                  />
                </View>
                {flushMessage ? (
                  <Text className="mt-2 text-xs text-text-tertiary">
                    {flushMessage}
                  </Text>
                ) : null}
                <View className="mt-3">
                  <GradientButton
                    label={
                      isLookupLoading
                        ? "Looking up places…"
                        : "Lookup places"
                    }
                    onPress={runPlaceLookup}
                    disabled={isLookupLoading || !userId}
                  />
                </View>
                {lookupMessage ? (
                  <Text className="mt-2 text-xs text-text-tertiary">
                    {lookupMessage}
                  </Text>
                ) : null}
                <View className="mt-3">
                  <GradientButton
                    label={
                      isDebugTestLoading
                        ? "Running debug test…"
                        : "🔧 Debug Auth Test"
                    }
                    onPress={runDebugTest}
                    disabled={isDebugTestLoading}
                  />
                </View>
                {debugTestResult ? (
                  <View className="mt-2 rounded-lg bg-gray-100 p-3">
                    <Text className="text-xs font-mono text-text-tertiary" selectable>
                      {debugTestResult}
                    </Text>
                  </View>
                ) : null}
                {lastRefreshAt ? (
                  <Text className="mt-2 text-xs text-text-tertiary">
                    Last refresh: {lastRefreshAt.toLocaleTimeString()}
                  </Text>
                ) : null}
                <Text className="mt-2 text-xs text-text-tertiary" selectable>
                  User ID: {userId ?? "Not logged in"}
                </Text>

                {errorMessage ? (
                  <Text className="mt-3 text-xs text-red-500">
                    Error: {errorMessage}
                  </Text>
                ) : null}
                {supabaseWarning ? (
                  <Text className="mt-2 text-xs text-amber-600">
                    {supabaseWarning}
                  </Text>
                ) : null}
              </Card>
            </View>

            {/* Place Inference Section */}
            <View className="mt-5">
              <Card className="border border-[#E6EAF2] shadow-sm shadow-[#0f172a0d]">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                    <Icon icon={Sparkles} size={20} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[18px] font-bold text-text-primary">
                      Place Inference
                    </Text>
                    <Text className="text-[12px] text-text-secondary">
                      Auto-detect Home, Work, and frequent locations
                    </Text>
                  </View>
                </View>

                <View className="mt-4">
                  <GradientButton
                    label={
                      isInferenceLoading
                        ? "Analyzing patterns…"
                        : "Run Place Inference (14 days)"
                    }
                    onPress={runPlaceInference}
                    disabled={isInferenceLoading || !userId}
                  />
                </View>

                {inferenceError ? (
                  <Text className="mt-3 text-xs text-red-500">
                    Error: {inferenceError}
                  </Text>
                ) : null}

                {inferenceResult ? (
                  <View className="mt-4">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                        Results
                      </Text>
                      <Text className="text-[11px] text-text-tertiary">
                        {inferenceResult.stats.hoursAnalyzed}h across{" "}
                        {inferenceResult.stats.daysAnalyzed} days
                      </Text>
                    </View>

                    {inferenceResult.inferredPlaces.length === 0 ? (
                      <Text className="mt-3 text-[13px] text-text-tertiary">
                        No places could be inferred. Need more location history.
                      </Text>
                    ) : (
                      <View className="mt-3 gap-3">
                        {inferenceResult.inferredPlaces.map((place, idx) => (
                          <View
                            key={`${place.geohash7}-${idx}`}
                            className="rounded-xl border border-[#E6EAF2] bg-[#F9FAFB] p-3"
                          >
                            <View className="flex-row items-center gap-3">
                              <View
                                className="h-10 w-10 items-center justify-center rounded-xl"
                                style={{
                                  backgroundColor: `${getInferenceColor(place.inferredType)}15`,
                                }}
                              >
                                <Icon
                                  icon={getInferenceIcon(place.inferredType)}
                                  size={18}
                                  color={getInferenceColor(place.inferredType)}
                                />
                              </View>
                              <View className="flex-1">
                                <View className="flex-row items-center gap-2">
                                  <Text className="text-[15px] font-semibold text-text-primary">
                                    {place.suggestedLabel}
                                  </Text>
                                  <View
                                    className="rounded-full px-2 py-0.5"
                                    style={{
                                      backgroundColor: `${getInferenceColor(place.inferredType)}20`,
                                    }}
                                  >
                                    <Text
                                      className="text-[10px] font-bold uppercase"
                                      style={{
                                        color: getInferenceColor(place.inferredType),
                                      }}
                                    >
                                      {Math.round(place.confidence * 100)}%
                                    </Text>
                                  </View>
                                </View>
                                <Text className="text-[12px] text-text-secondary">
                                  {place.inferredType.charAt(0).toUpperCase() +
                                    place.inferredType.slice(1)}{" "}
                                  · {place.stats.totalHours}h total
                                </Text>
                              </View>
                            </View>
                            <Text className="mt-2 text-[11px] text-text-tertiary">
                              {place.reasoning}
                            </Text>
                            {place.googlePlaceName &&
                              place.googlePlaceName !== place.suggestedLabel && (
                                <Text className="mt-1 text-[11px] text-text-tertiary">
                                  Google: {place.googlePlaceName}
                                </Text>
                              )}
                            {place.latitude && place.longitude && (
                              <Text className="mt-1 text-[10px] font-mono text-text-tertiary">
                                {place.latitude.toFixed(5)},{" "}
                                {place.longitude.toFixed(5)}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
              </Card>
            </View>

            <View className="mt-5">
              <Text className="px-1 text-[16px] font-bold text-text-primary">
                Hourly Activity
              </Text>
              <View className="mt-3 flex-row items-end justify-between px-1">
                {hourlyBuckets.slice(0, 24).map((value, idx) => {
                  const height =
                    maxHourly <= 0
                      ? 4
                      : Math.max(4, Math.round((value / maxHourly) * 56));
                  const showLabel = idx % 3 === 0;
                  const formatHourLabel = (hour: number): string => {
                    if (hour === 0) return "12am";
                    if (hour < 12) return `${hour}am`;
                    if (hour === 12) return "12pm";
                    return `${hour - 12}pm`;
                  };
                  const label = showLabel ? formatHourLabel(idx) : "";

                  return (
                    <View
                      key={String(idx)}
                      className="items-center"
                      style={{ width: 10 }}
                    >
                      <View
                        className="w-full overflow-hidden rounded-md bg-[#E5E7EB]"
                        style={{ height: 56 }}
                      >
                        <View
                          className="w-full rounded-md bg-[#2F7BFF]"
                          style={{ height, marginTop: 56 - height }}
                        />
                      </View>
                      {showLabel ? (
                        <Text
                          numberOfLines={1}
                          className="mt-2 text-[10px] font-semibold text-text-tertiary"
                          style={{ width: 30, textAlign: "center" }}
                        >
                          {label}
                        </Text>
                      ) : (
                        <View className="mt-2" style={{ height: 12 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            <View className="mt-5">
              <Text className="px-1 text-[16px] font-bold text-text-primary">
                Hourly Location Breakdown
              </Text>
              <View className="mt-3 gap-3">
                {hourlyBreakdown.map((bucket) => (
                  <View
                    key={`hour-${bucket.hour}`}
                    className="rounded-2xl border border-[#E6EAF2] bg-white px-4 py-3 shadow-sm shadow-[#0f172a0d]"
                  >
                    <Text className="text-[12px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                      {bucket.hour === 0
                        ? "12am"
                        : bucket.hour < 12
                          ? `${bucket.hour}am`
                          : bucket.hour === 12
                            ? "12pm"
                            : `${bucket.hour - 12}pm`}
                    </Text>
                    {bucket.locations.length === 0 ? (
                      <Text className="mt-2 text-[13px] text-text-tertiary">
                        No location samples.
                      </Text>
                    ) : (
                      <View className="mt-2 gap-2">
                        {bucket.locations.map((location) => (
                          <View
                            key={`${bucket.hour}-${location.label}`}
                            className="flex-row items-center justify-between gap-3"
                          >
                            <View className="flex-1">
                              <Text className="text-[14px] font-semibold text-text-primary">
                                {location.label}
                              </Text>
                              <Text className="text-[12px] text-text-secondary">
                                {location.count} samples · last{" "}
                                {formatTimestamp(location.lastAt)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View className="mt-5">
              <Text className="px-1 text-[16px] font-bold text-text-primary">
                Recent Samples
              </Text>
              <View className="mt-3 gap-3">
                {samples.length === 0 && remoteSamples.length === 0 && (
                  <Text className="text-sm text-slate-400">
                    No samples queued yet.
                  </Text>
                )}
                {[...samples, ...remoteSamples]
                  .slice(-50)
                  .reverse()
                  .map((sample) => {
                    const sampleHour = new Date(sample.recorded_at).getHours();
                    const placeName = hourlyPlaceNames.get(sampleHour);
                    return (
                      <View
                        key={sample.dedupe_key}
                        className="rounded-2xl border border-[#E6EAF2] bg-white px-4 py-3 shadow-sm shadow-[#0f172a0d]"
                      >
                        <Text className="text-xs text-text-tertiary">
                          {formatTimestamp(sample.recorded_at)}
                        </Text>
                        {placeName ? (
                          <>
                            <Text className="mt-1 text-sm font-semibold text-text-primary">
                              {placeName}
                            </Text>
                            <Text className="mt-0.5 text-[10px] font-mono text-text-tertiary">
                              {formatCoordinate(sample.latitude)},{" "}
                              {formatCoordinate(sample.longitude)}
                            </Text>
                          </>
                        ) : (
                          <Text className="mt-1 text-sm font-semibold text-text-primary">
                            {formatCoordinate(sample.latitude)},{" "}
                            {formatCoordinate(sample.longitude)}
                          </Text>
                        )}
                        <Text className="mt-1 text-xs text-text-secondary">
                          {sample.accuracy_m != null
                            ? `±${Math.round(sample.accuracy_m)}m`
                            : "Accuracy n/a"}{" "}
                          · {sample.source}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          </ScrollView>
          <BottomToolbar />
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}
