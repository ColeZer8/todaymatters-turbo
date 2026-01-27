import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Activity,
  HeartPulse,
  Moon,
  Ruler,
  Flame,
  Dumbbell,
  ShieldAlert,
  RefreshCcw,
} from "lucide-react-native";
import { Card, Icon } from "@/components/atoms";
import { AnalyticsRangeToggle } from "@/components/molecules";
import type { HealthRangeKey, HealthSummary } from "@/lib/ios-insights";

interface HealthKitDashboardTemplateProps {
  range: HealthRangeKey;
  onChangeRange: (range: HealthRangeKey) => void;
  summary: HealthSummary | null;
  statusLabel: string;
  canRequestAuthorization: boolean;
  canRefresh: boolean;
  onRequestAuthorization: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const RANGE_OPTIONS: { label: string; value: HealthRangeKey }[] = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatNumber = (value: number, fractionDigits = 0) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
  }).format(value);

const formatOptional = (
  value: number | null | undefined,
  formatter: (v: number) => string,
) => (value === null || value === undefined ? "—" : formatter(value));

export const HealthKitDashboardTemplate = ({
  range,
  onChangeRange,
  summary,
  statusLabel,
  canRequestAuthorization,
  canRefresh,
  onRequestAuthorization,
  onRefresh,
  isRefreshing,
}: HealthKitDashboardTemplateProps) => {
  const insets = useSafeAreaInsets();

  const metrics = useMemo(() => {
    return {
      steps: formatOptional(summary?.steps, (v) => `${formatNumber(v)} steps`),
      activeEnergy: formatOptional(
        summary?.activeEnergyKcal,
        (v) => `${formatNumber(v)} kcal`,
      ),
      distance: formatOptional(
        summary?.distanceWalkingRunningMeters,
        (v) => `${formatNumber(v / 1000, 1)} km`,
      ),
      sleep: formatOptional(summary?.sleepAsleepSeconds, (v) =>
        formatDuration(v),
      ),
      heartRate: formatOptional(
        summary?.heartRateAvgBpm,
        (v) => `${formatNumber(v)} bpm`,
      ),
      restingHeartRate: formatOptional(
        summary?.restingHeartRateAvgBpm,
        (v) => `${formatNumber(v)} bpm`,
      ),
      hrv: formatOptional(
        summary?.hrvSdnnAvgSeconds,
        (v) => `${formatNumber(v * 1000)} ms`,
      ),
      workouts: formatOptional(
        summary?.workoutsCount,
        (v) => `${formatNumber(v)} workouts`,
      ),
      workoutsDuration: formatOptional(summary?.workoutsDurationSeconds, (v) =>
        formatDuration(v),
      ),
    };
  }, [summary]);

  const isRefreshDisabled = !canRefresh || isRefreshing;
  const isAuthorizationDisabled = !canRequestAuthorization;

  return (
    <SafeAreaView
      className="flex-1 bg-slate-950"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 40 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Apple Health
        </Text>
        <Text className="mt-2 text-3xl font-semibold text-white">
          Physical Health
        </Text>
        <Text className="mt-2 text-sm text-slate-300">{statusLabel}</Text>

        <View className="mt-5">
          <AnalyticsRangeToggle
            options={RANGE_OPTIONS}
            value={range}
            onChange={(next) => onChangeRange(next as HealthRangeKey)}
            accessibilityLabel="Switch HealthKit range"
          />
        </View>

        <View className="mt-6">
          <Card className="bg-white/5 border border-white/10">
            <Text className="text-base font-semibold text-white">
              Permissions
            </Text>

            <View className="mt-4 flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={onRequestAuthorization}
                disabled={isAuthorizationDisabled}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3"
                style={({ pressed }) => [
                  {
                    opacity: isAuthorizationDisabled ? 0.6 : pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Icon icon={ShieldAlert} size={18} color="#fff" />
                <Text className="text-sm font-semibold text-white">
                  Connect Health
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={onRefresh}
                disabled={isRefreshDisabled}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3"
                style={({ pressed }) => [
                  { opacity: isRefreshDisabled ? 0.6 : pressed ? 0.92 : 1 },
                ]}
              >
                <Icon icon={RefreshCcw} size={18} color="#fff" />
                <Text className="text-sm font-semibold text-white">
                  {isRefreshing ? "Refreshing…" : "Refresh"}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>

        <View className="mt-6 gap-4">
          <Card className="bg-white/5 border border-white/10">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon icon={Activity} size={18} color="#fff" />
                <Text className="text-base font-semibold text-white">
                  Steps
                </Text>
              </View>
              <Text className="text-sm font-semibold text-slate-200">
                {metrics.steps}
              </Text>
            </View>
          </Card>

          <Card className="bg-white/5 border border-white/10">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon icon={Flame} size={18} color="#fff" />
                <Text className="text-base font-semibold text-white">
                  Active Energy
                </Text>
              </View>
              <Text className="text-sm font-semibold text-slate-200">
                {metrics.activeEnergy}
              </Text>
            </View>
          </Card>

          <Card className="bg-white/5 border border-white/10">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon icon={Ruler} size={18} color="#fff" />
                <Text className="text-base font-semibold text-white">
                  Distance
                </Text>
              </View>
              <Text className="text-sm font-semibold text-slate-200">
                {metrics.distance}
              </Text>
            </View>
          </Card>

          <Card className="bg-white/5 border border-white/10">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon icon={Moon} size={18} color="#fff" />
                <Text className="text-base font-semibold text-white">
                  Sleep
                </Text>
              </View>
              <Text className="text-sm font-semibold text-slate-200">
                {metrics.sleep}
              </Text>
            </View>
          </Card>

          <Card className="bg-white/5 border border-white/10">
            <Text className="text-base font-semibold text-white">Heart</Text>
            <View className="mt-4 gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Icon icon={HeartPulse} size={18} color="#fff" />
                  <Text className="text-sm font-semibold text-slate-200">
                    Avg Heart Rate
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-slate-200">
                  {metrics.heartRate}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-300">Resting HR</Text>
                <Text className="text-sm font-semibold text-slate-200">
                  {metrics.restingHeartRate}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-300">HRV (SDNN)</Text>
                <Text className="text-sm font-semibold text-slate-200">
                  {metrics.hrv}
                </Text>
              </View>
            </View>
          </Card>

          <Card className="bg-white/5 border border-white/10">
            <Text className="text-base font-semibold text-white">Workouts</Text>
            <View className="mt-4 gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Icon icon={Dumbbell} size={18} color="#fff" />
                  <Text className="text-sm font-semibold text-slate-200">
                    Count
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-slate-200">
                  {metrics.workouts}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-300">Total duration</Text>
                <Text className="text-sm font-semibold text-slate-200">
                  {metrics.workoutsDuration}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {summary?.errors?.length ? (
          <View className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4">
            <Text className="text-sm font-semibold text-amber-200">
              HealthKit notes
            </Text>
            <Text className="mt-2 text-sm text-amber-100">
              {summary.errors.slice(0, 3).join("\n")}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};
