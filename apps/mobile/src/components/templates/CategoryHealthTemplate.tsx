import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Line, Rect, Defs, Pattern } from 'react-native-svg';
import {
  ArrowLeft,
  CheckCircle2,
  LucideIcon,
  MoreHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react-native';
import { Icon } from '@/components/atoms';

type CategoryId = 'faith' | 'family' | 'work' | 'health';

interface HabitTracker {
  icon: LucideIcon;
  label: string;
  current: string;
  goal: string;
  progress: number; // 0-1
}

interface CategoryConfig {
  id: CategoryId;
  title: string;
  color: string;
  lightColor: string;
  status: string;
  score: number;
  avg: number;
  best: number;
  insight: string;
  suggestion: string;
  chartTitle: string;
  chartData: number[];
  habits: HabitTracker[];
}

const CATEGORY_CONFIGS: Record<CategoryId, CategoryConfig> = {
  faith: {
    id: 'faith',
    title: 'Faith Health',
    color: '#F79A3B',
    lightColor: '#FFF5E8',
    status: 'Strong',
    score: 92,
    avg: 74,
    best: 100,
    insight: "Your morning routine is creating a strong spiritual foundation. Meditation consistency is up 20% this month.",
    suggestion: "Try adding a 5-minute gratitude journal session in the evening to close the loop on your day.",
    chartTitle: 'Spiritual Connection vs. Stress',
    chartData: [0.7, 0.85, 0.6, 0.9, 0.75, 0.55, 0.8],
    habits: [
      { icon: Sparkles, label: 'Meditation', current: '45m', goal: '60m', progress: 0.75 },
      { icon: Sparkles, label: 'Reading', current: '20m', goal: '30m', progress: 0.67 },
      { icon: Sparkles, label: 'Community', current: '1h', goal: '2h', progress: 0.5 },
    ],
  },
  family: {
    id: 'family',
    title: 'Family Health',
    color: '#5F63F5',
    lightColor: '#EFF0FF',
    status: 'Good',
    score: 78,
    avg: 62,
    best: 100,
    insight: "You are hitting time goals, but 'Device-Free' hours are lower than your ideal target.",
    suggestion: "Schedule a 'Phone Box' time from 6 PM to 8 PM to increase quality engagement scores.",
    chartTitle: 'Quality Time vs. Screen Time',
    chartData: [0.5, 0.65, 0.7, 0.6, 0.85, 0.9, 0.75],
    habits: [
      { icon: Sparkles, label: 'Dinner', current: '45m', goal: '60m', progress: 0.75 },
      { icon: Sparkles, label: 'Play', current: '30m', goal: '45m', progress: 0.67 },
      { icon: Sparkles, label: 'Date Night', current: '0/wk', goal: '1/wk', progress: 0 },
    ],
  },
  work: {
    id: 'work',
    title: 'Work Health',
    color: '#2F7BFF',
    lightColor: '#E9F2FF',
    status: 'Overload',
    score: 45,
    avg: 36,
    best: 100,
    insight: "Burnout risk detected. You are consistently 15% over your daily limit, affecting Family and Health blocks.",
    suggestion: "Implement a hard stop at 5:00 PM. AI analysis suggests your productivity drops sharply after 4:30 PM anyway.",
    chartTitle: 'Hours Worked vs. Productivity',
    chartData: [0.9, 0.95, 0.85, 0.7, 0.6, 0.4, 0.3],
    habits: [
      { icon: Zap, label: 'Deep Work', current: '6h', goal: '8h', progress: 0.75 },
      { icon: Zap, label: 'Meetings', current: '3h', goal: '5h', progress: 0.6 },
      { icon: Zap, label: 'Admin', current: '1h', goal: '2h', progress: 0.5 },
    ],
  },
  health: {
    id: 'health',
    title: 'Health Health',
    color: '#1F9C66',
    lightColor: '#E8F7EF',
    status: 'Perfect',
    score: 98,
    avg: 78,
    best: 100,
    insight: "Optimal performance! Your sleep and activity levels are perfectly synced with your circadian rhythm.",
    suggestion: "Maintain this momentum. Consider increasing intensity of cardio by 5% next week.",
    chartTitle: 'Energy Levels vs. Activity',
    chartData: [0.8, 0.85, 0.9, 0.95, 0.9, 0.85, 0.88],
    habits: [
      { icon: Zap, label: 'Sleep', current: '7.5h', goal: '9h', progress: 0.83 },
      { icon: Zap, label: 'Steps', current: '10k', goal: '12k', progress: 0.83 },
      { icon: Zap, label: 'Water', current: '2.5L', goal: '3L', progress: 0.83 },
    ],
  },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Circular Score Indicator Component
const ScoreCircle = ({ score, color }: { score: number; color: string }) => {
  const size = 90;
  const center = size / 2;
  const radius = 36;
  const tickCount = 40;
  const tickLength = 6;
  const gapAngle = 60; // Gap at the bottom in degrees
  const startAngle = 90 + gapAngle / 2;
  const endAngle = 450 - gapAngle / 2;
  const totalAngle = endAngle - startAngle;
  const filledTicks = Math.round((score / 100) * tickCount);

  const ticks = [];
  for (let i = 0; i < tickCount; i++) {
    const angle = startAngle + (i / tickCount) * totalAngle;
    const rad = (angle * Math.PI) / 180;
    const isFilled = i < filledTicks;
    
    const x1 = center + (radius - tickLength) * Math.cos(rad);
    const y1 = center + (radius - tickLength) * Math.sin(rad);
    const x2 = center + radius * Math.cos(rad);
    const y2 = center + radius * Math.sin(rad);

    ticks.push(
      <Line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isFilled ? color : '#E5E7EB'}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }

  return (
    <View className="items-center">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {ticks}
        </Svg>
        <View 
          className="absolute inset-0 items-center justify-center"
          style={{ top: -2 }}
        >
          <Text className="text-[32px] font-bold text-[#1F2937]">{score}</Text>
          <Text className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-wider -mt-1">
            Score
          </Text>
        </View>
      </View>
    </View>
  );
};

// Solid Bar Component with rounded top
const SolidBar = ({ 
  height, 
  color, 
  maxHeight = 120 
}: { 
  height: number; 
  color: string; 
  maxHeight?: number;
}) => {
  const barHeight = Math.max(height * maxHeight, 8);
  const barWidth = 36;

  return (
    <View style={{ height: maxHeight, justifyContent: 'flex-end' }}>
      <View
        style={{
          width: barWidth,
          height: barHeight,
          backgroundColor: color,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }}
      />
    </View>
  );
};

// Striped Progress Bar Component
const StripedProgressBar = ({ 
  progress, 
  color 
}: { 
  progress: number; 
  color: string;
}) => {
  const width = 200;
  const height = 10;
  const stripeWidth = 3;
  const stripeGap = 2;
  const filledWidth = progress * width;

  return (
    <View className="flex-1">
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern
            id="progressStripes"
            patternUnits="userSpaceOnUse"
            width={stripeWidth + stripeGap}
            height={height}
          >
            <Rect
              x={0}
              y={0}
              width={stripeWidth}
              height={height}
              fill={color}
            />
          </Pattern>
        </Defs>
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width="100%"
          height={height}
          fill="#F3F4F6"
          rx={5}
        />
        {/* Filled portion with stripes */}
        <Rect
          x={0}
          y={0}
          width={`${progress * 100}%`}
          height={height}
          fill="url(#progressStripes)"
          rx={5}
        />
      </Svg>
    </View>
  );
};

interface CategoryHealthTemplateProps {
  categoryId: CategoryId;
}

export const CategoryHealthTemplate = ({ categoryId }: CategoryHealthTemplateProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const config = CATEGORY_CONFIGS[categoryId];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Strong':
      case 'Perfect':
        return '#1F9C66';
      case 'Good':
        return '#5F63F5';
      case 'Overload':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon icon={ArrowLeft} size={24} color="#374151" />
          </Pressable>
          <Text 
            className="text-[15px] font-bold uppercase tracking-wider"
            style={{ color: config.color }}
          >
            {config.title}
          </Text>
          <Pressable
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon icon={MoreHorizontal} size={24} color="#9CA3AF" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 40 + insets.bottom,
          }}
        >
          {/* Daily Breakdown Section */}
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-4">
              <Icon icon={Sparkles} size={16} color={config.color} />
              <Text className="text-[14px] font-semibold text-[#374151]">Daily Breakdown</Text>
            </View>

            <View className="bg-[#F9FAFB] rounded-2xl p-5">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text 
                    className="text-[32px] font-bold"
                    style={{ color: getStatusColor(config.status) }}
                  >
                    {config.status}
                  </Text>
                  <Text className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide mt-1">
                    Today's Status
                  </Text>
                  <View className="flex-row items-center gap-4 mt-3">
                    <View>
                      <Text className="text-[20px] font-bold" style={{ color: config.color }}>
                        {config.avg}
                      </Text>
                      <Text className="text-[10px] text-[#9CA3AF] uppercase">Avg</Text>
                    </View>
                    <View>
                      <Text className="text-[20px] font-bold text-[#374151]">
                        {config.best}
                      </Text>
                      <Text className="text-[10px] text-[#9CA3AF] uppercase">Best</Text>
                    </View>
                  </View>
                </View>

                {/* Score Circle with ticks */}
                <ScoreCircle score={config.score} color={config.color} />
              </View>
            </View>
          </View>

          {/* AI Optimization Insight */}
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-4">
              <Icon icon={Sparkles} size={16} color={config.color} />
              <Text className="text-[14px] font-semibold text-[#374151]">AI Optimization Insight</Text>
            </View>

            <Text className="text-[14px] text-[#6B7280] leading-[22px] mb-4">
              {config.insight}
            </Text>

            <View 
              className="rounded-xl p-4"
              style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Icon icon={CheckCircle2} size={16} color="#16A34A" />
                <Text className="text-[12px] font-bold text-[#16A34A] uppercase tracking-wide">
                  Suggestion
                </Text>
              </View>
              <Text className="text-[14px] text-[#166534] leading-[20px]">
                {config.suggestion}
              </Text>
            </View>
          </View>

          {/* Chart Section with Striped Bars */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[14px] font-semibold text-[#374151]">{config.chartTitle}</Text>
              <View className="bg-[#F3F4F6] px-3 py-1 rounded-full">
                <Text className="text-[11px] font-medium text-[#6B7280]">This Week</Text>
              </View>
            </View>

            <View className="flex-row items-end justify-between px-1" style={{ height: 140 }}>
              {config.chartData.map((value, index) => (
                <View key={index} className="items-center">
                  <SolidBar height={value} color={config.color} maxHeight={100} />
                  <Text className="text-[11px] text-[#9CA3AF] mt-2">{DAYS[index]}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Habit Trackers with Striped Progress */}
          <View 
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F0F0F0' }}
          >
            <View className="gap-4">
              {config.habits.map((habit, index) => (
                <View key={index} className="flex-row items-center gap-3">
                  <Icon icon={habit.icon} size={16} color={config.color} />
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-[13px] font-semibold text-[#374151]">{habit.label}</Text>
                      <Text className="text-[12px] text-[#9CA3AF]">
                        <Text style={{ color: config.color, fontWeight: '600' }}>{habit.current}</Text>
                        <Text className="text-[#D1D5DB]"> / </Text>
                        <Text>{habit.goal}</Text>
                      </Text>
                    </View>
                    <StripedProgressBar progress={habit.progress} color={config.color} />
                  </View>
                </View>
              ))}
            </View>

            <Pressable 
              className="flex-row items-center justify-center gap-1 mt-4 pt-3 border-t border-[#E5E7EB]"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-[12px] text-[#9CA3AF]">↻ Live Updates</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
