import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ArrowLeft, MapPin } from "lucide-react-native";
import { useAuthStore } from "@/stores";
import { Card, GradientButton, Icon } from "@/components/atoms";
import { BottomToolbar } from "@/components/organisms/BottomToolbar";
import {
  getAndroidLocationDiagnostics,
  getLastSyncTime,
  getMovementState,
  peekPendingAndroidLocationSamplesAsync,
} from "@/lib/android-location";
// Import safely to prevent crashes if native module not available
let getPendingCount: typeof import("expo-background-location").getPendingCount | null = null;
let isTracking: typeof import("expo-background-location").isTracking | null = null;
let drainPendingSamples: typeof import("expo-background-location").drainPendingSamples | null = null;
let peekPendingSamples: typeof import("expo-background-location").peekPendingSamples | null = null;
let runOneTimeLocationWorker: typeof import("expo-background-location").runOneTimeLocationWorker | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("expo-background-location");
  getPendingCount = mod.getPendingCount;
  isTracking = mod.isTracking;
  drainPendingSamples = mod.drainPendingSamples;
  peekPendingSamples = mod.peekPendingSamples;
  runOneTimeLocationWorker = mod.runOneTimeLocationWorker;
} catch {
  console.warn("📍 [dev] expo-background-location not available");
}
import {
  enqueueAndroidLocationSamplesForUserAsync,
  flushPendingAndroidLocationSamplesToSupabaseAsync,
} from "@/lib/android-location";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function DevBackgroundLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean | null>(null);
  const [nativePendingCount, setNativePendingCount] = useState<number>(0);
  const [nativeSamples, setNativeSamples] = useState<
    Array<{ recorded_at: string; latitude: number; longitude: number }>
  >([]);
  const [jsPendingCount, setJsPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [movementState, setMovementState] = useState<string>("unknown");
  const [taskRunning, setTaskRunning] = useState<boolean | null>(null);
  const [lastTaskFiredAt, setLastTaskFiredAt] = useState<string | null>(null);
  const [lastTaskError, setLastTaskError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!userId) return;
    if (Platform.OS !== "android") return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [tracking, count, nativePeek, jsPending, syncTime, movement, diag] =
        await Promise.all([
          isTracking ? isTracking() : Promise.resolve(false),
          getPendingCount ? getPendingCount(userId) : Promise.resolve(0),
          peekPendingSamples ? peekPendingSamples(userId, 8) : Promise.resolve([]),
          peekPendingAndroidLocationSamplesAsync(userId, 10),
          getLastSyncTime(),
          getMovementState(),
          getAndroidLocationDiagnostics(),
        ]);
      setTrackingEnabled(tracking);
      setNativePendingCount(count);
      setNativeSamples(
        nativePeek.map((sample) => ({
          recorded_at: sample.recorded_at,
          latitude: sample.latitude,
          longitude: sample.longitude,
        })),
      );
      setJsPendingCount(jsPending.length);
      setLastSyncTime(syncTime);
      setMovementState(movement.state);
      setTaskRunning(diag.taskStarted);
      setLastTaskFiredAt(diag.lastTaskFiredAt);
      setLastTaskError(diag.lastTaskError);
      setLastRefreshAt(new Date());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const triggerOneTimeWorker = useCallback(async () => {
    if (!userId) return;
    if (Platform.OS !== "android") return;
    setIsTriggering(true);
    setErrorMessage(null);
    try {
      if (!runOneTimeLocationWorker) {
        throw new Error("Native module not available");
      }
      await runOneTimeLocationWorker(userId);
      setTimeout(() => {
        void refreshStatus();
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsTriggering(false);
    }
  }, [refreshStatus, userId]);

  const flushToSupabase = useCallback(async () => {
    if (!userId) return;
    if (Platform.OS !== "android") return;
    setIsFlushing(true);
    setErrorMessage(null);
    try {
      if (drainPendingSamples) {
        const nativeSamples = await drainPendingSamples(userId, 500);
        if (nativeSamples.length > 0) {
          await enqueueAndroidLocationSamplesForUserAsync(userId, nativeSamples);
        }
      }
      await flushPendingAndroidLocationSamplesToSupabaseAsync(userId);
      await refreshStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsFlushing(false);
    }
  }, [refreshStatus, userId]);

  useEffect(() => {
    if (!userId || Platform.OS !== "android") return;
    void refreshStatus();
  }, [refreshStatus, userId]);

  useEffect(() => {
    if (!userId || Platform.OS !== "android") return;
    const id = setInterval(() => {
      void refreshStatus();
    }, 15_000);
    return () => clearInterval(id);
  }, [refreshStatus, userId]);

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
                Background Location
              </Text>
              <View className="h-11 w-11" />
            </View>

            {Platform.OS !== "android" ? (
              <View className="mt-5">
                <Card className="border border-[#E6EAF2] shadow-sm shadow-[#0f172a0d]">
                  <Text className="text-[14px] text-text-secondary">
                    Background WorkManager status is Android-only.
                  </Text>
                </Card>
              </View>
            ) : (
              <>
                <View className="mt-5">
                  <Card className="border border-[#E6EAF2] shadow-sm shadow-[#0f172a0d]">
                    <View className="flex-row items-start justify-between gap-4">
                      <View className="flex-1">
                        <Text className="text-[18px] font-bold text-text-primary">
                          Status
                        </Text>
                        <Text className="mt-1 text-[12px] text-text-tertiary">
                          Tracking is{" "}
                          {trackingEnabled == null
                            ? "unknown"
                            : trackingEnabled
                              ? "active"
                              : "inactive"}
                        </Text>
                        <Text className="mt-2 text-[12px] text-text-tertiary">
                          Movement: {movementState}
                        </Text>
                        <Text className="mt-2 text-[12px] text-text-tertiary">
                          Last sync: {formatTimestamp(lastSyncTime)}
                        </Text>
                        <Text className="mt-2 text-[12px] text-text-tertiary">
                          Foreground task:{" "}
                          {taskRunning == null
                            ? "unknown"
                            : taskRunning
                              ? "running"
                              : "stopped"}
                        </Text>
                        <Text className="mt-2 text-[12px] text-text-tertiary">
                          Last task fired: {formatTimestamp(lastTaskFiredAt)}
                        </Text>
                        {lastTaskError ? (
                          <Text className="mt-2 text-[12px] text-red-500">
                            Task error: {lastTaskError}
                          </Text>
                        ) : null}
                        <Text className="mt-2 text-[12px] text-text-tertiary">
                          Native pending: {nativePendingCount}
                        </Text>
                        <Text className="mt-1 text-[12px] text-text-tertiary">
                          JS pending: {jsPendingCount}
                        </Text>
                      </View>
                      <View className="items-center">
                        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FF]">
                          <Icon icon={MapPin} size={20} color="#2563EB" />
                        </View>
                        <Text className="mt-2 text-[12px] font-semibold text-text-secondary">
                          Android
                        </Text>
                      </View>
                    </View>

                    <View className="mt-4">
                      <GradientButton
                        label={isLoading ? "Refreshing…" : "Refresh status"}
                        onPress={refreshStatus}
                        disabled={isLoading || !userId}
                      />
                    </View>
                    <View className="mt-3">
                      <GradientButton
                        label={
                          isTriggering ? "Running worker…" : "Run one-time worker"
                        }
                        onPress={triggerOneTimeWorker}
                        disabled={isTriggering || !userId}
                      />
                    </View>
                    <View className="mt-3">
                      <GradientButton
                        label={isFlushing ? "Flushing…" : "Flush to Supabase"}
                        onPress={flushToSupabase}
                        disabled={isFlushing || !userId}
                      />
                    </View>
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
                  </Card>
                </View>

                <View className="mt-5">
                  <Text className="px-1 text-[16px] font-bold text-text-primary">
                    Native Queue Preview
                  </Text>
                  <View className="mt-3 gap-3">
                    {nativeSamples.length === 0 ? (
                      <Text className="text-sm text-slate-400">
                        No native samples queued yet.
                      </Text>
                    ) : (
                      nativeSamples.map((sample, index) => (
                        <View
                          key={`${sample.recorded_at}-${index}`}
                          className="rounded-2xl border border-[#E6EAF2] bg-white px-4 py-3 shadow-sm shadow-[#0f172a0d]"
                        >
                          <Text className="text-xs text-text-tertiary">
                            {formatTimestamp(sample.recorded_at)}
                          </Text>
                          <Text className="mt-1 text-sm font-semibold text-text-primary">
                            {sample.latitude.toFixed(5)},{" "}
                            {sample.longitude.toFixed(5)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
          <BottomToolbar />
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}
