import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, Dumbbell, Gift, Heart, LucideIcon, Sparkles, SunMedium, Target, Briefcase, BarChart3 } from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';
import { Card, Icon } from '@/components/atoms';
import { AnalyticsRangeToggle } from '@/components/molecules';
import { AnalyticsDonutChart } from '@/components/molecules/AnalyticsDonutChart';
import { BottomToolbar } from '@/components/organisms/BottomToolbar';
import { DemoOverviewGoals } from '@/components/organisms/DemoOverviewGoals';
import { DemoOverviewInitiatives } from '@/components/organisms/DemoOverviewInitiatives';

type RangeKey = 'today' | 'week' | 'month' | 'year';
type TabKey = 'overview' | 'goals' | 'initiatives';

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

const TAB_OPTIONS: { label: string; value: TabKey; icon: LucideIcon }[] = [
  { label: 'Overview', value: 'overview', icon: BarChart3 },
  { label: 'Goals', value: 'goals', icon: Target },
  { label: 'Initiatives', value: 'initiatives', icon: Briefcase },
];

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

const ANALYTICS_SNAPSHOT: Record<RangeKey, RangeData> = {
  today: {
    insight: {
      headline: "You're excelling in Health and Faith goals this week. Great consistency.",
      detail:
        'However, Work hours are trending 15% over target. Consider scheduling a hard stop at 5 PM tomorrow to rebalance family time.',
      emphasis: 'Performance Insight',
    },
    timeSpent: [
      { label: 'Faith', value: 45, goal: 60, color: '#F79A3B', accent: '#FFF4E6' },
      { label: 'Family', value: 120, goal: 240, color: '#6A74F7', accent: '#EEF0FF' },
      { label: 'Work', value: 360, goal: 300, color: '#2F9BFF', accent: '#E8F3FF' },
      { label: 'Health', value: 60, goal: 60, color: '#3BB273', accent: '#E5F7EF' },
      { label: 'Other', value: 90, goal: 120, color: '#9CA3AF', accent: '#F3F4F6' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'Consistent habits', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Need more presence', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Exceeding limits', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Goal hit', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Free time', value: 10, color: '#14B8A6' },
        { label: 'Faith', value: 10, color: '#F79A3B' },
        { label: 'Family', value: 30, color: '#5F63F5' },
        { label: 'Work', value: 40, color: '#2F7BFF' },
        { label: 'Health', value: 10, color: '#1F9C66' },
      ],
      reality: [
        { label: 'Free time', value: 5, color: '#14B8A6' },
        { label: 'Faith', value: 5, color: '#F79A3B' },
        { label: 'Family', value: 20, color: '#5F63F5' },
        { label: 'Work', value: 50, color: '#2F7BFF' },
        { label: 'Health', value: 5, color: '#1F9C66' },
        { label: 'Other', value: 15, color: '#9CA3AF' },
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
      { label: 'Other', value: 300, goal: 420, color: '#9CA3AF', accent: '#F3F4F6' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'More consistent', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Energy improving', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Trim evening hours', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Recovery trending up', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Free time', value: 5, color: '#14B8A6' },
        { label: 'Faith', value: 12, color: '#F79A3B' },
        { label: 'Family', value: 33, color: '#5F63F5' },
        { label: 'Work', value: 40, color: '#2F7BFF' },
        { label: 'Health', value: 10, color: '#1F9C66' },
      ],
      reality: [
        { label: 'Free time', value: 3, color: '#14B8A6' },
        { label: 'Faith', value: 8, color: '#F79A3B' },
        { label: 'Family', value: 25, color: '#5F63F5' },
        { label: 'Work', value: 50, color: '#2F7BFF' },
        { label: 'Health', value: 9, color: '#1F9C66' },
        { label: 'Other', value: 5, color: '#9CA3AF' },
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
      { label: 'Other', value: 1200, goal: 1860, color: '#9CA3AF', accent: '#F3F4F6' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'Small daily reps', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Rituals working', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Needs cap', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Goal hit', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Free time', value: 5, color: '#14B8A6' },
        { label: 'Faith', value: 12, color: '#F79A3B' },
        { label: 'Family', value: 33, color: '#5F63F5' },
        { label: 'Work', value: 40, color: '#2F7BFF' },
        { label: 'Health', value: 10, color: '#1F9C66' },
      ],
      reality: [
        { label: 'Free time', value: 5, color: '#14B8A6' },
        { label: 'Faith', value: 10, color: '#F79A3B' },
        { label: 'Family', value: 28, color: '#5F63F5' },
        { label: 'Work', value: 48, color: '#2F7BFF' },
        { label: 'Health', value: 5, color: '#1F9C66' },
        { label: 'Other', value: 4, color: '#9CA3AF' },
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
      { label: 'Other', value: 15000, goal: 18600, color: '#9CA3AF', accent: '#F3F4F6' },
    ],
    categories: [
      { id: 'faith', title: 'Faith', status: 'Strong', helper: 'Habits hold', accent: '#C1630A', background: '#FFF5E8', icon: SunMedium },
      { id: 'family', title: 'Family', status: 'Good', helper: 'Protect weekends', accent: '#5F63F5', background: '#EFF0FF', icon: Heart },
      { id: 'work', title: 'Work', status: 'Overload', helper: 'Trim Q4 scope', accent: '#2E67F5', background: '#E9F2FF', icon: Gift },
      { id: 'health', title: 'Health', status: 'Perfect', helper: 'Recovery green', accent: '#1F9C66', background: '#E8F7EF', icon: Dumbbell },
    ],
    distribution: {
      ideal: [
        { label: 'Free time', value: 5, color: '#14B8A6' },
        { label: 'Faith', value: 12, color: '#F79A3B' },
        { label: 'Family', value: 33, color: '#5F63F5' },
        { label: 'Work', value: 40, color: '#2F7BFF' },
        { label: 'Health', value: 10, color: '#1F9C66' },
      ],
      reality: [
        { label: 'Free time', value: 5, color: '#14B8A6' },
        { label: 'Faith', value: 11, color: '#F79A3B' },
        { label: 'Family', value: 30, color: '#5F63F5' },
        { label: 'Work', value: 47, color: '#2F7BFF' },
        { label: 'Health', value: 5, color: '#1F9C66' },
        { label: 'Other', value: 2, color: '#9CA3AF' },
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

// Tab Selector Component - Pill style for inline placement
const TabSelector = ({ 
  tabs, 
  activeTab, 
  onTabChange 
}: { 
  tabs: typeof TAB_OPTIONS; 
  activeTab: TabKey; 
  onTabChange: (tab: TabKey) => void;
}) => (
  <View className="flex-row items-center justify-center gap-1.5 p-1 bg-[#F3F4F6] rounded-full">
    {tabs.map((tab) => {
      const isActive = tab.value === activeTab;
      return (
        <Pressable
          key={tab.value}
          onPress={() => onTabChange(tab.value)}
          className={`flex-row items-center justify-center gap-1.5 px-4 py-2 rounded-full ${
            isActive ? 'bg-white' : 'bg-transparent'
          }`}
          style={({ pressed }) => ({ 
            opacity: pressed ? 0.8 : 1,
            ...(isActive && {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }),
          })}
        >
          <Icon icon={tab.icon} size={14} color={isActive ? '#2563EB' : '#9CA3AF'} />
          <Text
            className={`text-[13px] font-semibold ${
              isActive ? 'text-[#2563EB]' : 'text-[#9CA3AF]'
            }`}
          >
            {tab.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

export const AnalyticsTemplate = () => {
  const [range, setRange] = useState<RangeKey>('today');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const currentRange = ANALYTICS_SNAPSHOT[range];
  const idealDistribution = currentRange.distribution.ideal;

  // Render Goals or Initiatives views (embedded mode - no toolbar, adjusted padding)
  if (activeTab === 'goals') {
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
            {/* Tab Selector */}
            <View className="mb-4">
              <TabSelector tabs={TAB_OPTIONS} activeTab={activeTab} onTabChange={setActiveTab} />
            </View>
            
            {/* Goals Content (without wrapper) */}
            <DemoOverviewGoals embedded />
          </ScrollView>
          <BottomToolbar />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (activeTab === 'initiatives') {
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
            {/* Tab Selector */}
            <View className="mb-4">
              <TabSelector tabs={TAB_OPTIONS} activeTab={activeTab} onTabChange={setActiveTab} />
            </View>
            
            {/* Initiatives Content (without wrapper) */}
            <DemoOverviewInitiatives embedded />
          </ScrollView>
          <BottomToolbar />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Overview tab (original content)
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
          {/* Tab Selector - at top of content */}
          <View className="mb-4">
            <TabSelector tabs={TAB_OPTIONS} activeTab={activeTab} onTabChange={setActiveTab} />
          </View>

          <View className="gap-4 pb-6">
            <Card className="gap-3 border border-[#E6EAF2] shadow-sm shadow-[#0f172a0d]">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]">
                    <Icon icon={Sparkles} size={16} color="#FFFFFF" />
                  </View>
                  <Text className="text-[15px] font-bold text-text-primary">
                    Performance Insight
                  </Text>
                </View>
                <Pressable hitSlop={8}>
                  <Icon icon={ChevronDown} size={20} color="#9CA3AF" />
                </Pressable>
              </View>
              <View className="gap-2">
                <Text className="text-[15px] leading-[22px] text-text-secondary">
                  You're excelling in <Text style={{ color: '#1F9C66', fontWeight: '600' }}>Health</Text> and <Text style={{ color: '#F79A3B', fontWeight: '600' }}>Faith</Text> goals this week. Great consistency!
                </Text>
                <Text className="text-[15px] leading-[22px] text-text-secondary">
                  However, <Text style={{ color: '#2F9BFF', fontWeight: '600' }}>Work</Text> hours are trending 15% over target. Consider scheduling a hard stop at 5 PM tomorrow to rebalance family time.
                </Text>
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

            {/* 
              HIDDEN: Life Distribution - Ideal vs Reality Donut Charts
              Hidden on 2024-12-13 - See /docs/hidden-features/life-distribution-donuts.md for details
              To re-enable: uncomment this entire section
            */}
            {/* START: Life Distribution Section (Hidden)
            <View className="gap-3">
              <View className="h-px bg-[#E5E7EB]" />
              <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] px-1">
                Life Distribution
              </Text>
              
              <View className="flex-row justify-around items-start">
                <View className="items-center flex-1">
                  <AnalyticsDonutChart
                    data={idealDistribution}
                    label="IDEAL"
                    radius={48}
                    strokeWidth={28}
                  />
                </View>
                
                <View className="items-center flex-1">
                  <AnalyticsDonutChart
                    data={currentRange.distribution.reality}
                    label="REALITY"
                    radius={48}
                    strokeWidth={28}
                  />
                </View>
              </View>
              
              <View className="flex-row items-center gap-2 px-1">
                <Icon icon={Sparkles} size={14} color="#2563EB" />
                <Text className="text-[13px] text-[#6B7280]">
                  These splits update automatically as you log time across pillars.
                </Text>
              </View>
              <View className="h-px bg-[#E5E7EB]" />
            </View>
            END: Life Distribution Section (Hidden) */}

            {/* Time Spent vs Goal - Horizontal Bars */}
            <View className="gap-3">
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-[13px] font-bold text-text-primary uppercase tracking-[0.04em]">
                  Time Spent vs. Goal
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {}}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Text className="text-[14px] font-semibold text-brand-primary">Edit Goals</Text>
                </Pressable>
              </View>
              <TimeSpentChart 
                data={currentRange.timeSpent} 
                onOtherPress={() => router.push('/review-time' as const)} 
              />
              <View className="h-px bg-[#E5E7EB]" />
            </View>

            {/* Category Health */}
            <View className="gap-3">
              <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] px-1">
                Category Health
              </Text>
              <View className="flex-row flex-wrap justify-between gap-3">
                {currentRange.categories.map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    className="w-[48%]"
                    onPress={() => router.push(`/category/${category.id}` as const)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  >
                    <View
                      className="rounded-2xl px-4 py-4"
                      style={{
                        backgroundColor: category.background,
                        minHeight: 140,
                      }}
                    >
                      <View className="items-center gap-1.5">
                        <Icon icon={category.icon} size={20} color={category.accent} strokeWidth={1.8} />
                        <Text className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B7280] mt-1">
                          {category.title}
                        </Text>
                        <Text
                          className="text-xl font-bold"
                          style={{ color: category.accent }}
                        >
                          {category.status}
                        </Text>
                        <Text className="text-[13px] text-[#9CA3AF]">{category.helper}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
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
  onOtherPress?: () => void;
}

// Simple diagonal stripes - just draw lines across the bar
const StripedBar = ({ color, height }: { color: string; height: number }) => {
  const spacing = 14;
  const lineCount = 25;
  
  return (
    <View className="flex-1" style={{ height, backgroundColor: '#F3F4F6' }}>
      <Svg width="100%" height={height} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {Array.from({ length: lineCount }).map((_, i) => {
          const offset = i * spacing;
          return (
            <Line
              key={i}
              x1={offset}
              y1={0}
              x2={offset - height}
              y2={height}
              stroke={color}
              strokeWidth={6}
              strokeOpacity={0.3}
            />
          );
        })}
      </Svg>
    </View>
  );
};

const TimeSpentChart = ({ data, onOtherPress }: TimeSpentChartProps) => {
  const LABEL_AREA_WIDTH = 56;
  const BAR_HEIGHT = 36;
  const ROW_HEIGHT = 52;
  const GOAL_LINE_PERCENT = 70;
  const GOAL_TEXT_OFFSET = 8;
  const MIN_GAP_FOR_TEXT = 12;

  // Separate "Other" from regular categories
  const regularData = data.filter((item) => item.label !== 'Other');
  const otherItem = data.find((item) => item.label === 'Other');

  return (
    <View className="py-2">
      <View style={{ position: 'relative' }}>
        {regularData.map((item) => {
          const barPercent = Math.max(15, (item.value / item.goal) * GOAL_LINE_PERCENT);
          const isUnderGoal = item.value < item.goal;
          const gapPercent = isUnderGoal ? GOAL_LINE_PERCENT - barPercent : 0;
          const difference = item.goal - item.value;
          const hasRoomForText = gapPercent > MIN_GAP_FOR_TEXT;
          
          return (
            <View key={item.label} style={{ height: ROW_HEIGHT }} className="flex-row items-center">
              {/* Category label on the left */}
              <View style={{ width: LABEL_AREA_WIDTH }} className="justify-center">
                <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-primary">
                  {item.label}
                </Text>
              </View>
              
              {/* Bar area */}
              <View className="flex-1" style={{ height: ROW_HEIGHT, position: 'relative' }}>
                {/* Layer 1: Gray goal text */}
                <View 
                  className="absolute justify-center"
                  style={{ 
                    left: `${GOAL_LINE_PERCENT}%`,
                    marginLeft: GOAL_TEXT_OFFSET,
                    top: 0,
                    bottom: 0,
                    zIndex: 1,
                  }}
                  pointerEvents="none"
                >
                  <Text className="text-[11px] font-medium text-[#9CA3AF]">
                    Goal: {formatMinutes(item.goal)}
                  </Text>
                </View>
                
                {/* Layer 2: Dashed goal line */}
                <View 
                  className="absolute top-0 bottom-0"
                  style={{ left: `${GOAL_LINE_PERCENT}%`, zIndex: 4, width: 1 }}
                  pointerEvents="none"
                >
                  <View className="flex-1 border-l border-dashed border-[#D1D5DB]" />
                </View>
                
                {/* Layer 2.5: Striped gap bar - extends LEFT under solid bar for smooth blend */}
                {isUnderGoal && gapPercent > 0 && (
                  <View 
                    className="absolute"
                    style={{ 
                      left: `${barPercent - 3}%`, // Extend left to blend with solid bar
                      top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                      height: BAR_HEIGHT,
                      width: `${gapPercent + 3}%`, // Add overlap width
                      zIndex: 2,
                      borderTopRightRadius: 8,
                      borderBottomRightRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <StripedBar color={item.color} height={BAR_HEIGHT} />
                    {/* Red difference text (no minus sign) */}
                    {hasRoomForText && (
                      <View className="absolute inset-0 items-center justify-center" style={{ paddingLeft: 8 }}>
                        <Text className="text-[12px] font-bold text-[#DC2626]">
                          {formatMinutes(difference)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                {/* Layer 3: Solid bar */}
                <View 
                  className="absolute"
                  style={{ 
                    left: 0, 
                    top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                    height: BAR_HEIGHT,
                    width: `${barPercent}%`,
                    zIndex: 3,
                  }}
                >
                  <View 
                    style={{ 
                      height: BAR_HEIGHT,
                      backgroundColor: item.color,
                      borderRadius: 8,
                      overflow: 'hidden',
                      width: '100%',
                    }}
                  >
                    {/* Value text at LEFT */}
                    <View className="absolute left-0 top-0 bottom-0 justify-center pl-2.5">
                      <Text className="text-[13px] font-bold text-white">
                        {formatMinutes(item.value)}
                      </Text>
                    </View>
                    
                    {/* White goal text - clips when bar covers */}
                    <View 
                      className="absolute justify-center"
                      style={{ 
                        left: `${(GOAL_LINE_PERCENT / barPercent) * 100}%`,
                        marginLeft: GOAL_TEXT_OFFSET,
                        top: 0,
                        bottom: 0,
                      }}
                    >
                      <Text className="text-[11px] font-medium text-white">
                        Goal: {formatMinutes(item.goal)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      
      {/* Other row - label left, time centered, arrow right */}
      {otherItem && (
        <Pressable 
          onPress={onOtherPress}
          className="flex-row items-center py-3 mt-2 bg-[#F9FAFB] rounded-xl active:opacity-70 px-2"
        >
          <View style={{ width: LABEL_AREA_WIDTH }} className="justify-center">
            <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-secondary">
              Other
            </Text>
          </View>
          <View className="flex-1 flex-row items-center justify-center">
            <Text className="text-[13px] font-semibold text-text-secondary">
              {formatMinutes(otherItem.value)}
            </Text>
            <Text className="text-[11px] text-[#9CA3AF] ml-1.5">
              unassigned
            </Text>
          </View>
          <ChevronRight size={18} color="#9CA3AF" />
        </Pressable>
      )}
      
      <Text className="text-[11px] font-medium text-[#9CA3AF] text-center mt-2">
        Dashed line indicates your goal for each category.
      </Text>
    </View>
  );
};
