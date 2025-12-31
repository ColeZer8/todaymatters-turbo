import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Settings2, Sparkles, Smartphone } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Icon } from '@/components/atoms';
import { AnalyticsDonutChart } from '@/components/molecules/AnalyticsDonutChart';
import { BottomToolbar } from '@/components/organisms/BottomToolbar';

type RangeKey = 'today' | 'week' | 'month' | 'year';

interface TopAppRow {
  id: string;
  name: string;
  durationLabel: string;
  durationSeconds: number;
  categoryLabel: string;
  categoryAccent: string;
}

interface ScreenTimeAnalyticsTemplateProps {
  range: RangeKey;
  onChangeRange: (next: RangeKey) => void;
  canChangeRange: boolean;

  totalLabel: string;
  deltaLabel: string | null;
  score: number | null;
  scoreLabel: string;
  scoreTrendLabel: string | null;

  insightBody: string | null;
  suggestionBody: string | null;

  hourlyBuckets: number[] | null;

  topApps: TopAppRow[];

  onPressBack?: () => void;
  onPressSettings?: () => void;

  statusLabel: string | null;
  onRequestAuthorization: () => void;
  showAuthorizationCta: boolean;
  isSyncing: boolean;
}

export const ScreenTimeAnalyticsTemplate = ({
  range,
  onChangeRange,
  canChangeRange,
  totalLabel,
  deltaLabel,
  score,
  scoreLabel,
  scoreTrendLabel,
  insightBody,
  suggestionBody,
  hourlyBuckets,
  topApps,
  statusLabel,
  onRequestAuthorization,
  showAuthorizationCta,
  isSyncing,
  onPressBack,
  onPressSettings,
}: ScreenTimeAnalyticsTemplateProps) => {
  const insets = useSafeAreaInsets();

  const maxSeconds = Math.max(...topApps.map((app) => app.durationSeconds), 1);
  const maxHourly = Math.max(...(hourlyBuckets ?? []), 1);

  const rangeOptions: Array<{ label: string; value: RangeKey }> = [
    { label: 'Today', value: 'today' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
  ];

  return (
    <LinearGradient colors={['#FBFCFF', '#F4F7FF']} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: 140 + insets.bottom,
          }}
        >
          {/* Top Nav */}
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              onPress={onPressBack}
              disabled={!onPressBack}
              className="h-11 w-11 items-center justify-center rounded-full bg-white"
              style={({ pressed }) => [{ opacity: !onPressBack ? 0 : pressed ? 0.75 : 1 }]}
            >
              <Icon icon={ArrowLeft} size={20} color="#111827" />
            </Pressable>

            <Text className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-primary">
              Digital Wellbeing
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={onPressSettings}
              disabled={!onPressSettings}
              className="h-11 w-11 items-center justify-center rounded-full bg-white"
              style={({ pressed }) => [{ opacity: !onPressSettings ? 0 : pressed ? 0.75 : 1 }]}
            >
              <Icon icon={Settings2} size={18} color="#111827" />
            </Pressable>
          </View>

          {/* Range Toggle */}
          <View className="mt-3 items-center">
            <View className="flex-row items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-1.5 py-1">
              {rangeOptions.map((opt) => {
                const isActive = opt.value === range;
                const isDisabled = !canChangeRange && opt.value !== 'today';
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive, disabled: isDisabled }}
                    onPress={() => {
                      if (isDisabled) return;
                      onChangeRange(opt.value);
                    }}
                    className={`items-center justify-center rounded-full px-4 py-1.5 ${
                      isActive ? 'bg-[#1F2937]' : 'bg-transparent'
                    }`}
                    style={({ pressed }) => [{ opacity: isDisabled ? 0.4 : pressed ? 0.9 : 1 }]}
                  >
                    <Text className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mt-5">
            <Card className="border border-[#E6EAF2] shadow-sm shadow-[#0f172a0d]">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text className="text-[18px] font-bold text-[#16A34A]">{scoreLabel}</Text>
                  <Text className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                    {range === 'today' ? "Today's total" : 'Total'}
                  </Text>
                  <Text className="mt-1 text-[34px] font-bold text-text-primary">{totalLabel}</Text>
                  {deltaLabel ? (
                    <Text className="mt-1 text-[13px] font-semibold text-[#16A34A]">{deltaLabel}</Text>
                  ) : null}
                </View>

                <View className="items-center">
                  <View className="relative">
                    <AnalyticsDonutChart
                      data={[
                        { label: 'Score', value: score ?? 0, color: '#2F7BFF' },
                        { label: 'Remaining', value: Math.max(0, 100 - (score ?? 0)), color: '#E5E7EB' },
                      ]}
                      radius={36}
                      strokeWidth={18}
                      startAngle={-90}
                    />
                    <View className="absolute inset-0 items-center justify-center">
                      <Text className="text-[20px] font-bold text-text-primary">{score ?? '—'}</Text>
                      <Text className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary">Score</Text>
                    </View>
                  </View>
                  {scoreTrendLabel ? (
                    <Text className="mt-1 text-[12px] font-semibold text-text-secondary">{scoreTrendLabel}</Text>
                  ) : null}
                </View>
              </View>

              <View className="mt-3">
                <View className="h-px bg-[#E5E7EB]" />
              </View>

              {statusLabel ? (
                <View className="mt-3 flex-row items-center gap-2">
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF]">
                    <Icon icon={Smartphone} size={18} color="#2563EB" />
                  </View>
                  <Text className="flex-1 text-[14px] leading-[20px] text-text-secondary">{statusLabel}</Text>
                </View>
              ) : null}

              {isSyncing ? (
                <View className="mt-3 self-start rounded-full bg-[#EEF0FF] px-3 py-1">
                  <Text className="text-[12px] font-semibold text-brand-primary">Syncing…</Text>
                </View>
              ) : null}

              {showAuthorizationCta ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onRequestAuthorization}
                  className="mt-3 flex-row items-center justify-center rounded-2xl bg-brand-primary px-4 py-3"
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text className="text-[14px] font-semibold text-white">Enable Screen Time</Text>
                </Pressable>
              ) : null}
            </Card>
          </View>

          {/* AI Insight */}
          {insightBody ? (
            <View className="mt-4 gap-3">
              <View className="flex-row items-center gap-2 px-1">
                <Icon icon={Sparkles} size={16} color="#2563EB" />
                <Text className="text-[14px] font-bold text-text-primary">AI Optimization Insight</Text>
              </View>
              <Text className="px-1 text-[14px] leading-[20px] text-text-secondary">{insightBody}</Text>
              {suggestionBody ? (
                <View className="rounded-2xl border border-[#86EFAC] bg-[#ECFDF5] p-4">
                  <Text className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#166534]">Suggestion</Text>
                  <Text className="mt-2 text-[14px] leading-[20px] text-[#14532D]">{suggestionBody}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Hourly Activity */}
          <View className="mt-5">
            <Text className="px-1 text-[16px] font-bold text-text-primary">Hourly Activity</Text>
            <View className="mt-3 flex-row items-end justify-between px-1">
              {(hourlyBuckets ?? Array.from({ length: 24 }, () => 0)).slice(0, 24).map((value, idx) => {
                const height = maxHourly <= 0 ? 4 : Math.max(4, Math.round((value / maxHourly) * 56));
                // Show labels every 3 hours: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm
                const showLabel = idx % 3 === 0;
                const formatHourLabel = (hour: number): string => {
                  if (hour === 0) return '12am';
                  if (hour < 12) return `${hour}am`;
                  if (hour === 12) return '12pm';
                  return `${hour - 12}pm`;
                };
                const label = showLabel ? formatHourLabel(idx) : '';

                return (
                  <View key={String(idx)} className="items-center" style={{ width: 10 }}>
                    <View
                      className="w-full overflow-hidden rounded-md bg-[#E5E7EB]"
                      style={{ height: 56 }}
                    >
                      <View className="w-full rounded-md bg-[#2F7BFF]" style={{ height, marginTop: 56 - height }} />
                    </View>
                    {showLabel ? (
                      <Text
                        numberOfLines={1}
                        className="mt-2 text-[10px] font-semibold text-text-tertiary"
                        style={{ width: 30, textAlign: 'center' }}
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

          {/* Top Apps */}
          <View className="mt-5">
            <Text className="px-1 text-[16px] font-bold text-text-primary">Top Apps</Text>
            <View className="mt-3 gap-3">
              {topApps.map((app) => {
                const percent = Math.min(1, app.durationSeconds / maxSeconds);
                return (
                  <View key={app.id} className="overflow-hidden rounded-2xl border border-[#E6EAF2] bg-white px-4 py-3 shadow-sm shadow-[#0f172a0d]">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-row items-center gap-3">
                        <View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${app.categoryAccent}22` }}>
                          <Text className="text-[16px] font-bold" style={{ color: app.categoryAccent }}>
                            {app.name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View className="gap-1">
                          <Text className="text-[14px] font-bold text-text-primary">{app.name}</Text>
                          <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: `${app.categoryAccent}22` }}>
                            <Text className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: app.categoryAccent }}>
                              {app.categoryLabel}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text className="text-[13px] font-semibold text-text-primary">{app.durationLabel}</Text>
                    </View>
                    <View className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                      <View className="h-2 rounded-full" style={{ width: `${percent * 100}%`, backgroundColor: app.categoryAccent }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <BottomToolbar />
      </SafeAreaView>
    </LinearGradient>
  );
};


