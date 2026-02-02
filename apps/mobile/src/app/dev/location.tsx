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
import { fetchRecentLocationSamples } from "@/lib/supabase/services/location-samples";
import { supabase, SUPABASE_ANON_KEY } from "@/lib/supabase/client";
import {
  inferPlacesFromHistory,
  type InferredPlace,
  type PlaceInferenceResult,
} from "@/lib/supabase/services/place-inference";
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

  const hourlyBreakdown = useMemo(() => {
    const hourMaps = Array.from(
      { length: 24 },
      () => new Map<string, { count: number; lastAt: string }>(),
    );

    for (const sample of [...samplesToday, ...remoteSamplesToday]) {
      const date = new Date(sample.recorded_at);
      const hour = date.getHours();
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      const key = `${sample.latitude.toFixed(4)}, ${sample.longitude.toFixed(4)}`;
      const existing = hourMaps[hour].get(key);
      if (existing) {
        hourMaps[hour].set(key, {
          count: existing.count + 1,
          lastAt: sample.recorded_at,
        });
      } else {
        hourMaps[hour].set(key, { count: 1, lastAt: sample.recorded_at });
      }
    }

    return hourMaps.map((map, hour) => {
      const locations = Array.from(map.entries())
        .map(([label, data]) => ({
          label,
          count: data.count,
          lastAt: data.lastAt,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
      return { hour, locations };
    });
  }, [remoteSamplesToday, samplesToday]);

  const maxHourly = Math.max(...hourlyBuckets, 1);

  const buildLookupPoints = useCallback(() => {
    const dedupe = new Set<string>();
    const points: Array<{ latitude: number; longitude: number }> = [];
    const combined = [...remoteSamplesToday, ...samplesToday];
    for (const sample of combined) {
      const key = `${sample.latitude.toFixed(4)},${sample.longitude.toFixed(4)}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      points.push({ latitude: sample.latitude, longitude: sample.longitude });
      if (points.length >= 12) break;
    }
    return points;
  }, [remoteSamplesToday, samplesToday]);

  const runLocalPlaceLookup = useCallback(async () => {
    if (!userId) return;
    setLookupMessage(null);
    setIsLookupLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLookupMessage("Missing session token.");
        return;
      }

      const points = buildLookupPoints();
      if (points.length === 0) {
        setLookupMessage("No samples available for lookup.");
        return;
      }

      const response = await fetch(
        "http://localhost:54321/functions/v1/location-place-lookup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ points }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLookupMessage(
          `Lookup failed: ${response.status} ${
            typeof payload?.error === "string" ? payload.error : ""
          }`.trim(),
        );
        return;
      }

      const resultCount = Array.isArray(payload?.results)
        ? payload.results.length
        : 0;
      setLookupMessage(`Lookup complete: ${resultCount} results.`);
    } catch (error) {
      setLookupMessage(
        `Lookup error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLookupLoading(false);
    }
  }, [buildLookupPoints, userId]);

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
                    label={
                      isLookupLoading
                        ? "Looking up places…"
                        : "Lookup places (local)"
                    }
                    onPress={runLocalPlaceLookup}
                    disabled={isLookupLoading || !userId}
                  />
                </View>
                {lookupMessage ? (
                  <Text className="mt-2 text-xs text-text-tertiary">
                    {lookupMessage}
                  </Text>
                ) : null}
                {lastRefreshAt ? (
                  <Text className="mt-2 text-xs text-text-tertiary">
                    Last refresh: {lastRefreshAt.toLocaleTimeString()}
                  </Text>
                ) : null}

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
                  .map((sample) => (
                    <View
                      key={sample.dedupe_key}
                      className="rounded-2xl border border-[#E6EAF2] bg-white px-4 py-3 shadow-sm shadow-[#0f172a0d]"
                    >
                      <Text className="text-xs text-text-tertiary">
                        {formatTimestamp(sample.recorded_at)}
                      </Text>
                      <Text className="mt-1 text-sm font-semibold text-text-primary">
                        {formatCoordinate(sample.latitude)},{" "}
                        {formatCoordinate(sample.longitude)}
                      </Text>
                      <Text className="mt-1 text-xs text-text-secondary">
                        {sample.accuracy_m != null
                          ? `±${Math.round(sample.accuracy_m)}m`
                          : "Accuracy n/a"}{" "}
                        · {sample.source}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          </ScrollView>
          <BottomToolbar />
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}
