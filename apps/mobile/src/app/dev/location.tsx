import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useAuthStore } from '@/stores';
import { GradientButton } from '@/components/atoms';
import { peekPendingLocationSamplesAsync } from '@/lib/ios-location/queue';
import { peekPendingAndroidLocationSamplesAsync } from '@/lib/android-location/queue';
import type { IosLocationSample } from '@/lib/ios-location/types';
import type { AndroidLocationSample } from '@/lib/android-location/types';

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
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [samples, setSamples] = useState<LocationSample[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSamples = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const nextSamples =
        Platform.OS === 'ios'
          ? await peekPendingLocationSamplesAsync(userId, 200)
          : await peekPendingAndroidLocationSamplesAsync(userId, 200);
      setSamples(nextSamples);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void refreshSamples();
  }, [refreshSamples, userId]);

  const latest = useMemo(() => {
    if (samples.length === 0) return null;
    return samples[samples.length - 1];
  }, [samples]);

  return (
    <>
      <Stack.Screen options={{ title: 'Location Samples (Dev)' }} />
      <ScrollView className="flex-1 bg-slate-950" contentContainerStyle={{ padding: 20 }}>
        <View className="rounded-2xl bg-slate-900 p-4">
          <Text className="text-lg font-semibold text-white">Pending samples</Text>
          <Text className="mt-1 text-sm text-slate-300">
            {samples.length} queued locally{Platform.OS === 'android' ? ' (Android)' : ' (iOS)'}
          </Text>

          {latest && (
            <View className="mt-4 rounded-xl bg-slate-950/60 p-4">
              <Text className="text-xs font-semibold text-slate-300">Latest sample</Text>
              <Text className="mt-2 text-sm text-slate-100">
                {formatTimestamp(latest.recorded_at)}
              </Text>
              <Text className="mt-1 text-xs text-slate-300">
                {formatCoordinate(latest.latitude)}, {formatCoordinate(latest.longitude)} ·
                {latest.accuracy_m != null ? ` ±${Math.round(latest.accuracy_m)}m` : ' accuracy n/a'}
              </Text>
              <Text className="mt-1 text-xs text-slate-400">Source: {latest.source}</Text>
            </View>
          )}

          <View className="mt-4">
            <GradientButton
              label={isLoading ? 'Refreshing…' : 'Refresh samples'}
              onPress={refreshSamples}
              disabled={isLoading || !userId}
            />
          </View>

          {errorMessage ? (
            <Text className="mt-3 text-xs text-red-200">Error: {errorMessage}</Text>
          ) : null}
        </View>

        <View className="mt-6 rounded-2xl bg-slate-900 p-4">
          <Text className="text-lg font-semibold text-white">Recent samples</Text>
          <Text className="mt-1 text-xs text-slate-400">Showing up to 50 most recent points.</Text>

          <View className="mt-4 gap-3">
            {samples.length === 0 && (
              <Text className="text-sm text-slate-400">No samples queued yet.</Text>
            )}
            {samples
              .slice(-50)
              .reverse()
              .map((sample) => (
                <View key={sample.dedupe_key} className="rounded-xl bg-slate-950/60 p-3">
                  <Text className="text-xs text-slate-400">{formatTimestamp(sample.recorded_at)}</Text>
                  <Text className="mt-1 text-sm text-white">
                    {formatCoordinate(sample.latitude)}, {formatCoordinate(sample.longitude)}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-400">
                    {sample.accuracy_m != null ? `±${Math.round(sample.accuracy_m)}m` : 'Accuracy n/a'} · {sample.source}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}
