import { useEffect, useMemo, useState, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, Dumbbell, Gift, Heart, LucideIcon, Sparkles, SunMedium } from 'lucide-react-native';
import { Card, Icon } from '@/components/atoms';
import { AnalyticsRangeToggle } from '@/components/molecules';
import { AnalyticsDonutChart } from '@/components/molecules/AnalyticsDonutChart';
import { BottomToolbar } from '@/components/organisms/BottomToolbar';

// Animated number component with smooth ticking effect
// All animations complete in the same duration for unified feel
interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  style?: object;
}

const ANIMATION_DURATION = 1800; // Total duration in ms - slow and dramatic
const FRAME_RATE = 60; // Updates per second for smoother animation

// Global animation coordinator to sync all number animations
let globalAnimationStart: number | null = null;
let globalAnimationTimeout: NodeJS.Timeout | null = null;

const AnimatedNumber = ({ value, suffix = '', prefix = '', style }: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const animationRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(value);
  const targetValueRef = useRef<number>(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayValue(value);
      return;
    }

    // Cancel any existing animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startVal = displayValue;
    const endVal = value;
    
    if (startVal === endVal) return;
    
    startValueRef.current = startVal;
    targetValueRef.current = endVal;
    
    // Reset global start time when a new batch of animations begins
    // Use a small timeout to batch all value changes together
    if (globalAnimationTimeout) {
      clearTimeout(globalAnimationTimeout);
    }
    globalAnimationTimeout = setTimeout(() => {
      globalAnimationStart = null;
    }, 50);
    
    if (globalAnimationStart === null) {
      globalAnimationStart = performance.now();
    }
    
    const animationStartTime = globalAnimationStart;
    
    const animate = () => {
      const now = performance.now();
      const elapsed = now - animationStartTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      
      // Easing function: easeOutQuart for smooth, dramatic deceleration
      const eased = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = startValueRef.current + (targetValueRef.current - startValueRef.current) * eased;
      setDisplayValue(Math.round(currentValue));
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        animationRef.current = null;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [value]);
  
  return (
    <Text style={style}>
      {prefix}{displayValue}{suffix}
    </Text>
  );
};

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

export const AnalyticsTemplate = () => {
  const [range, setRange] = useState<RangeKey>('today');
  const [distributionView, setDistributionView] = useState<DistributionView>('ideal');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const currentRange = ANALYTICS_SNAPSHOT[range];
  const distribution = useMemo(
    () => currentRange.distribution[distributionView],
    [currentRange.distribution, distributionView],
  );

  const idealDistribution = currentRange.distribution.ideal;

  const getDiff = (label: string, realityValue: number): number | null => {
    if (distributionView !== 'reality') return null;
    const idealSlice = idealDistribution.find((s) => s.label === label);
    if (!idealSlice) return null;
    return realityValue - idealSlice.value;
  };

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

            <View className="gap-3">
              <View className="h-px bg-[#E5E7EB]" />
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
              <TimeSpentChart data={currentRange.timeSpent} />
              <View className="h-px bg-[#E5E7EB]" />
            </View>

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

            <View className="gap-3">
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">
                  Life Distribution
                </Text>
                <View className="flex-row items-center border border-[#E5E7EB] rounded-full overflow-hidden">
                  {(['ideal', 'reality'] as DistributionView[]).map((viewKey) => {
                    const isActive = distributionView === viewKey;
                    return (
                      <Pressable
                        key={viewKey}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        onPress={() => setDistributionView(viewKey)}
                        className={`px-4 py-1.5 ${isActive ? 'bg-white' : 'bg-[#F9FAFB]'}`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                      >
                        <Text
                          className={`text-[13px] font-semibold ${
                            isActive ? 'text-text-primary' : 'text-[#9CA3AF]'
                          }`}
                        >
                          {viewKey === 'ideal' ? 'Ideal' : 'Reality'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row items-start gap-4 px-1">
                <View style={{ width: 150 }}>
                  <AnalyticsDonutChart
                    data={distribution}
                    label={distributionView === 'ideal' ? 'IDEAL' : 'REALITY'}
                  />
                </View>
                <View className="flex-1 pl-2 pt-2">
                  {/* Fixed order categories - always same position */}
                  <View className="gap-2.5">
                    {(['Free time', 'Faith', 'Family', 'Work', 'Health', 'Other'] as const).map((label) => {
                      const slice = distribution.find((s) => s.label === label);
                      const isOther = label === 'Other';
                      
                      // Only show "Other" in reality view
                      if (isOther && distributionView === 'ideal') {
                        return null;
                      }
                      
                      // If slice doesn't exist in current view, don't show
                      if (!slice) {
                        return null;
                      }
                      
                      const diff = getDiff(slice.label, slice.value);
                      const sliceColor = slice.color;
                      
                      // Don't show delta for "Other" category
                      const showDelta = distributionView === 'reality' && !isOther;
                      
                      const RowContent = (
                        <View className="flex-row items-center justify-between py-0.5">
                          <View className="flex-row items-center gap-2" style={{ minWidth: 90 }}>
                            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sliceColor }} />
                            <Text className="text-[14px] font-medium text-text-primary">
                              {label}
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            {/* Always reserve space for delta column to keep alignment consistent */}
                            <View style={{ width: 48, alignItems: 'flex-end', marginRight: 8 }}>
                              {showDelta && (
                                <AnimatedNumber
                                  value={diff ?? 0}
                                  prefix={diff !== null && diff > 0 ? '+' : ''}
                                  suffix="%"
                                  style={{ 
                                    color: diff === null || diff === 0 ? '#1F9C66' : diff > 0 ? '#F79A3B' : '#EF4444',
                                    fontSize: 13,
                                    fontWeight: '600',
                                  }}
                                />
                              )}
                            </View>
                            <View style={{ width: 40, alignItems: 'flex-end', marginRight: 8 }}>
                              <AnimatedNumber
                                value={slice.value}
                                suffix="%"
                                style={{ 
                                  color: '#1F2937',
                                  fontSize: 14,
                                  fontWeight: '600',
                                }}
                              />
                            </View>
                            {isOther ? (
                              <Icon icon={ChevronRight} size={16} color="#9CA3AF" />
                            ) : (
                              <View style={{ width: 16 }} />
                            )}
                          </View>
                        </View>
                      );

                      if (isOther) {
                        return (
                          <Pressable
                            key={label}
                            onPress={() => router.push('/review-time')}
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                          >
                            {RowContent}
                          </Pressable>
                        );
                      }

                      return <View key={label}>{RowContent}</View>;
                    })}
                  </View>
                </View>
              </View>

              <View className="flex-row items-center gap-2 px-1">
                <Icon icon={Sparkles} size={14} color="#2563EB" />
                <Text className="text-[13px] text-[#6B7280]">
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
  const CHART_HEIGHT = 240;
  const GOAL_LINE_FROM_BOTTOM = 170;
  const LABEL_AREA_HEIGHT = 32;
  const BAR_WIDTH = 48;
  const COLUMN_WIDTH = 72;
  const GOAL_TEXT_OFFSET = 8; // Distance above goal line for text

  // Calculate the height from bar bottom to goal line
  const goalBarHeight = GOAL_LINE_FROM_BOTTOM - LABEL_AREA_HEIGHT;

  return (
    <View className="py-2">
      <View style={{ height: CHART_HEIGHT, position: 'relative' }}>
        
        {/* Layer 1: Gray goal text (behind bars - always visible as base) */}
        <View 
          className="absolute left-0 right-0 flex-row justify-around"
          style={{ bottom: GOAL_LINE_FROM_BOTTOM + GOAL_TEXT_OFFSET, zIndex: 1 }}
          pointerEvents="none"
        >
          {data.map((item) => (
            <View key={`${item.label}-gray`} className="items-center" style={{ width: COLUMN_WIDTH }}>
              <Text className="text-[11px] font-medium text-[#9CA3AF]">
                Goal: {formatMinutes(item.goal)}
              </Text>
            </View>
          ))}
        </View>
        
        {/* Layer 2: Dashed goal line */}
        <View 
          className="absolute left-0 right-0"
          style={{ bottom: GOAL_LINE_FROM_BOTTOM, zIndex: 2 }}
          pointerEvents="none"
        >
          <View className="border-t border-dashed border-[#D1D5DB]" />
        </View>
        
        {/* Layer 3: Bars with white text clipped inside */}
        <View 
          className="absolute left-0 right-0 flex-row justify-around items-end"
          style={{ bottom: LABEL_AREA_HEIGHT, zIndex: 3, height: CHART_HEIGHT - LABEL_AREA_HEIGHT }}
        >
          {data.map((item) => {
            const barHeight = Math.max(44, (item.value / item.goal) * goalBarHeight);
            // White text position: distance from bottom of bar to where text should appear
            const whiteTextFromBarBottom = goalBarHeight + GOAL_TEXT_OFFSET;
            
            return (
              <View key={item.label} className="items-center" style={{ width: COLUMN_WIDTH }}>
                <View 
                  style={{ 
                    width: BAR_WIDTH,
                    height: barHeight, 
                    backgroundColor: item.color,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {/* Value text at bottom of bar */}
                  <View className="absolute bottom-0 left-0 right-0 items-center pb-2.5">
                    <Text className="text-[13px] font-bold text-white text-center">
                      {formatMinutes(item.value)}
                    </Text>
                  </View>
                  
                  {/* White goal text - clipped by bar's overflow:hidden */}
                  <View 
                    className="absolute items-center"
                    style={{ 
                      bottom: whiteTextFromBarBottom,
                      left: -(COLUMN_WIDTH - BAR_WIDTH) / 2,
                      width: COLUMN_WIDTH,
                    }}
                  >
                    <Text className="text-[11px] font-medium text-white">
                      Goal: {formatMinutes(item.goal)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        
        {/* Layer 4: Category labels */}
        <View 
          className="absolute left-0 right-0 bottom-0 flex-row justify-around"
          style={{ height: LABEL_AREA_HEIGHT, zIndex: 4 }}
        >
          {data.map((item) => (
            <View key={`${item.label}-label`} className="items-center justify-center" style={{ width: COLUMN_WIDTH }}>
              <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-primary">
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
      
      <Text className="text-[11px] font-medium text-[#9CA3AF] text-center mt-2">
        Dashed line indicates your daily goal.
      </Text>
    </View>
  );
};
