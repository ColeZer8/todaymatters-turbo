import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dumbbell, Gift, Heart, Info, LucideIcon, Pencil, Sparkles, SunMedium } from 'lucide-react-native';
import { Card, Icon } from '@/components/atoms';
import { AnalyticsRangeToggle } from '@/components/molecules';
import { AnalyticsDonutChart } from '@/components/molecules/AnalyticsDonutChart';
import { BottomToolbar } from '@/components/organisms/BottomToolbar';

type RangeKey = 'today' | 'week' | 'month' | 'year';
type DistributionView = 'ideal' | 'reality';

interface PerformanceInsight {
  headline: string;
  detail: string;
  emphasis: string;
}

interface TimeSpentBar {
  label: string;
  value: number;
  goal: number;
  color: string;
  accent: string;
}

interface CategoryCardData {
  id: string;
  title: string;
  status: string;
  helper: string;
  accent: string;
  background: string;
  icon: LucideIcon;
}

interface DistributionSlice {
  label: string;
  value: number;
  color: string;
}

interface RangeData {
  insight: PerformanceInsight;
  timeSpent: TimeSpentBar[];
  categories: CategoryCardData[];
  distribution: {
    ideal: DistributionSlice[];
    reality: DistributionSlice[];
  };
}

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

const ANALYTICS_SNAPSHOT: Record<RangeKey, RangeData> = {
  today: {
    insight: {
      headline: 'You’re excelling in Health and Faith goals this week. Great consistency.',
      detail:
        'However, Work hours are trending 15% over target. Consider scheduling a hard stop at 5 PM tomorrow to rebalance family time.',
      emphasis: 'Performance Insight',
    },
    timeSpent: [
      { label: 'Faith', value: 45, goal: 60, color: '#F79A3B', accent: '#FFF4E6' },
      { label: 'Family', value: 120, goal: 240, color: '#6A74F7', accent: '#EEF0FF' },
      { label: 'Work', value: 360, goal: 300, color: '#2F9BFF', accent: '#E8F3FF' },
      { label: 'Health', value: 60, goal: 60, color: '#3BB273', accent: '#E5F7EF' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'Consistent habits', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Need more presence', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Exceeding limits', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Goal hit', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Free time', value: 10, color: '#A0AEC0' },
        { label: 'Faith', value: 10, color: '#F79A3B' },
        { label: 'Family', value: 30, color: '#5F63F5' },
        { label: 'Work', value: 40, color: '#2F7BFF' },
        { label: 'Health', value: 10, color: '#1F9C66' },
      ],
      reality: [
        { label: 'Free time', value: 8, color: '#A0AEC0' },
        { label: 'Faith', value: 9, color: '#F79A3B' },
        { label: 'Family', value: 24, color: '#5F63F5' },
        { label: 'Work', value: 49, color: '#2F7BFF' },
        { label: 'Health', value: 10, color: '#1F9C66' },
      ],
    },
  },
  week: {
    insight: {
      headline: 'Health and Family are trending up while Work creeps over budget on two days.',
      detail:
        'Shift one deep-work block earlier in the day and protect Friday evening for recovery.',
      emphasis: 'Weekly Insight',
    },
    timeSpent: [
      { label: 'Faith', value: 280, goal: 420, color: '#F79A3B', accent: '#FFF4E6' },
      { label: 'Family', value: 520, goal: 840, color: '#6A74F7', accent: '#EEF0FF' },
      { label: 'Work', value: 2580, goal: 2520, color: '#2F9BFF', accent: '#E8F3FF' },
      { label: 'Health', value: 540, goal: 420, color: '#3BB273', accent: '#E5F7EF' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'More consistent', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Energy improving', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Trim evening hours', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Recovery trending up', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Faith', value: 12, color: '#F79A3B' },
        { label: 'Family', value: 33, color: '#6A74F7' },
        { label: 'Work', value: 45, color: '#2F9BFF' },
        { label: 'Health', value: 10, color: '#3BB273' },
      ],
      reality: [
        { label: 'Faith', value: 8, color: '#F79A3B' },
        { label: 'Family', value: 30, color: '#6A74F7' },
        { label: 'Work', value: 50, color: '#2F9BFF' },
        { label: 'Health', value: 12, color: '#3BB273' },
      ],
    },
  },
  month: {
    insight: {
      headline: 'Consistency is improving; Work drifted up mid-month.',
      detail:
        'Add one buffer day next week to keep Work in check and maintain Health momentum.',
      emphasis: 'Monthly Insight',
    },
    timeSpent: [
      { label: 'Faith', value: 1180, goal: 1860, color: '#F79A3B', accent: '#FFF4E6' },
      { label: 'Family', value: 2200, goal: 3720, color: '#6A74F7', accent: '#EEF0FF' },
      { label: 'Work', value: 10200, goal: 10080, color: '#2F9BFF', accent: '#E8F3FF' },
      { label: 'Health', value: 1860, goal: 1860, color: '#3BB273', accent: '#E5F7EF' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'Small daily reps', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Rituals working', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Needs cap', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Goal hit', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Faith', value: 12, color: '#F79A3B' },
        { label: 'Family', value: 33, color: '#6A74F7' },
        { label: 'Work', value: 45, color: '#2F9BFF' },
        { label: 'Health', value: 10, color: '#3BB273' },
      ],
      reality: [
        { label: 'Faith', value: 10, color: '#F79A3B' },
        { label: 'Family', value: 32, color: '#6A74F7' },
        { label: 'Work', value: 48, color: '#2F9BFF' },
        { label: 'Health', value: 10, color: '#3BB273' },
      ],
    },
  },
  year: {
    insight: {
      headline: 'Year-to-date balance is steady with stronger Health adherence.',
      detail: 'Revisit Work limits before Q4 to prevent spillover into Family time.',
      emphasis: 'Yearly Insight',
    },
    timeSpent: [
      { label: 'Faith', value: 14500, goal: 18600, color: '#F79A3B', accent: '#FFF4E6' },
      { label: 'Family', value: 26000, goal: 37200, color: '#6A74F7', accent: '#EEF0FF' },
      { label: 'Work', value: 110000, goal: 111600, color: '#2F9BFF', accent: '#E8F3FF' },
      { label: 'Health', value: 20500, goal: 18600, color: '#3BB273', accent: '#E5F7EF' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'Habits hold', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Protect weekends', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Trim Q4 scope', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Recovery green', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Faith', value: 12, color: '#F79A3B' },
        { label: 'Family', value: 33, color: '#6A74F7' },
        { label: 'Work', value: 45, color: '#2F9BFF' },
        { label: 'Health', value: 10, color: '#3BB273' },
      ],
      reality: [
        { label: 'Faith', value: 11, color: '#F79A3B' },
        { label: 'Family', value: 30, color: '#6A74F7' },
        { label: 'Work', value: 47, color: '#2F9BFF' },
        { label: 'Health', value: 12, color: '#3BB273' },
      ],
    },
  },
};

const formatMinutes = (minutes: number) => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

export const AnalyticsTemplate = () => {
  const [range, setRange] = useState<RangeKey>('today');
  const [distributionView, setDistributionView] = useState<DistributionView>('ideal');
  const insets = useSafeAreaInsets();

  const currentRange = ANALYTICS_SNAPSHOT[range];
  const distribution = useMemo(
    () => currentRange.distribution[distributionView],
    [currentRange.distribution, distributionView],
  );

  return (
    <LinearGradient colors={['#FBFCFF', '#F4F7FF']} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: 140 + insets.bottom,
          }}
        >
          <View className="gap-5 pb-6">
            <Card className="gap-4 border border-[#E6EAF2] shadow-sm shadow-[#0f172a0d]">
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF]">
                  <Icon icon={Info} size={20} color="#2563EB" />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {currentRange.insight.emphasis}
                  </Text>
                  <Text className="text-base font-semibold text-text-primary leading-6">
                    {currentRange.insight.headline}
                  </Text>
                  <Text className="text-sm leading-6 text-text-secondary">
                    {currentRange.insight.detail}
                  </Text>
                </View>
              </View>
            </Card>

            <View className="flex-row items-center justify-center">
              <AnalyticsRangeToggle
                options={RANGE_OPTIONS}
                value={range}
                onChange={(next) => setRange(next as RangeKey)}
                accessibilityLabel="Switch analytics range"
              />
            </View>

            <View className="gap-4">
              <View className="h-px bg-[#E5E7EB]" />
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-sm font-extrabold text-text-primary uppercase tracking-[0.08em]">
                  Time Spent vs. Goal
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {}}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Text className="text-base font-semibold text-brand-primary">Edit Goals</Text>
                </Pressable>
              </View>
              <TimeSpentChart data={currentRange.timeSpent} />
              <View className="h-px bg-[#E5E7EB]" />
            </View>

            <View className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary px-1">
                Category health
              </Text>
              <View className="flex-row flex-wrap justify-between gap-3">
                {currentRange.categories.map((category, index) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    className="w-[48%]"
                    style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  >
                    <View
                      className="rounded-[18px] border px-4 py-5"
                      style={{
                        backgroundColor: category.background,
                        borderColor: category.background,
                        minHeight: 156,
                        shadowColor: '#0f172a',
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 6 },
                      }}
                    >
                      <View className="items-center gap-2">
                        <Icon icon={category.icon} size={22} color={category.accent} />
                        <Text className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary">
                          {category.title}
                        </Text>
                        <Text
                          className="text-[20px] font-extrabold"
                          style={{ color: category.accent }}
                        >
                          {category.status}
                        </Text>
                        <Text className="text-sm text-text-secondary mt-0.5">{category.helper}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-4">
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  Life distribution
                </Text>
                <View className="flex-row items-center gap-2">
                  {(['ideal', 'reality'] as DistributionView[]).map((viewKey) => {
                    const isActive = distributionView === viewKey;
                    return (
                      <Pressable
                        key={viewKey}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        onPress={() => setDistributionView(viewKey)}
                        className={`rounded-full px-4 py-2 border ${
                          isActive ? 'border-[#D1D9E6] bg-white' : 'border-[#E5E7EB] bg-[#F5F7FB]'
                        }`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                      >
                        <Text
                          className={`text-sm font-extrabold ${
                            isActive ? 'text-text-primary' : 'text-text-secondary'
                          }`}
                        >
                          {viewKey === 'ideal' ? 'Ideal' : 'Reality'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row items-center justify-between px-1 gap-4">
                <View className="w-[40%] items-center">
                  <AnalyticsDonutChart
                    data={distribution}
                    label={distributionView === 'ideal' ? 'Ideal' : 'Reality'}
                  />
                </View>
                <View className="flex-1 gap-1.5 pl-3 min-w-[54%]">
                  {distribution.map((slice) => (
                    <View key={slice.label} className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                        <Text className="text-[12px] font-extrabold text-text-primary">
                          {slice.label}
                        </Text>
                      </View>
                      <Text className="text-[12px] font-extrabold text-text-primary">{slice.value}%</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="flex-row items-center gap-2 px-1">
                <Icon icon={Sparkles} size={16} color="#2563EB" />
                <Text className="text-sm text-text-secondary">
                  These splits update automatically as you log time across pillars.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomToolbar />
      </SafeAreaView>
    </LinearGradient>
  );
};

interface TimeSpentChartProps {
  data: TimeSpentBar[];
}

const TimeSpentChart = ({ data }: TimeSpentChartProps) => {
  const goalLineHeight = 140;
  const maxBarHeight = 170;

  return (
    <View className="p-2">
      <View className="relative h-[240px]">
        <View
          className="absolute left-0 right-0 flex-row items-center px-2"
          style={{ bottom: goalLineHeight + 46, zIndex: 2 }}
          pointerEvents="none"
        >
          {data.map((item) => (
            <View key={`${item.label}-goal-text`} className="flex-1 items-center">
              <Text className="text-xs font-semibold text-[#8F97A6]">
                Goal: {formatMinutes(item.goal)}
              </Text>
            </View>
          ))}
        </View>
        <View className="absolute left-0 right-0" style={{ bottom: goalLineHeight + 36 }}>
          <View className="border-t border-dashed border-[#C3CAD5]" />
        </View>
        <View className="flex-1 flex-row items-end justify-between px-2">
          {data.map((item) => {
            const barHeight = Math.max(40, Math.min(maxBarHeight, (item.value / item.goal) * goalLineHeight));
            return (
              <View key={item.label} className="flex-1 items-center">
                <View
                  className="w-11 rounded-[6px] items-center justify-end pb-2"
                  style={{ height: barHeight, backgroundColor: item.color }}
                >
                  <Text className="text-sm font-extrabold text-white">
                    {formatMinutes(item.value)}
                  </Text>
                </View>
                <Text className="mt-3 text-xs font-extrabold uppercase tracking-[0.08em] text-text-primary">
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text className="mt-3 text-xs font-semibold text-text-tertiary text-center">
        Dashed line indicates your daily goal.
      </Text>
    </View>
  );
};
