import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Line, Rect, Defs, Pattern } from "react-native-svg";
import {
  ArrowLeft,
  CheckCircle2,
  LucideIcon,
  MoreHorizontal,
  Sparkles,
  Zap,
} from "lucide-react-native";
import { Icon } from "@/components/atoms";
import { AnalyticsRangeToggle } from "@/components/molecules";
import type { HealthSummary } from "@/lib/insights";

type CategoryId = "faith" | "family" | "work" | "health";
type RangeKey = "today" | "week" | "month" | "year";

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

interface HabitTracker {
  icon: LucideIcon;
  label: string;
  current: string;
  goal: string;
  progress: number; // 0-1
}

interface RangeData {
  status: string;
  score: number;
  avg: number;
  best: number;
  insight: string;
  suggestion: string;
  chartData: number[];
  chartLabel: string;
  habits: HabitTracker[];
}

interface CategoryConfig {
  id: CategoryId;
  title: string;
  color: string;
  lightColor: string;
  chartMetric: string; // e.g., "Goal Progress" - combined with range prefix
  rangeData: Record<RangeKey, RangeData>;
}

const CATEGORY_CONFIGS: Record<CategoryId, CategoryConfig> = {
  faith: {
    id: "faith",
    title: "Faith Health",
    color: "#F79A3B",
    lightColor: "#FFF5E8",
    chartMetric: "Goal Progress",
    rangeData: {
      today: {
        status: "Strong",
        score: 92,
        avg: 74,
        best: 100,
        insight:
          "Your morning routine is creating a strong spiritual foundation. Meditation consistency is up 20% this month.",
        suggestion:
          "Try adding a 5-minute gratitude journal session in the evening to close the loop on your day.",
        chartData: [0, 0.85, 0.7, 0.6, 0.75, 0.5, 0.64], // Today's hourly breakdown
        chartLabel: "Today",
        habits: [
          {
            icon: Sparkles,
            label: "Meditation",
            current: "45m",
            goal: "60m",
            progress: 0.75,
          },
          {
            icon: Sparkles,
            label: "Reading",
            current: "20m",
            goal: "30m",
            progress: 0.67,
          },
          {
            icon: Sparkles,
            label: "Community",
            current: "1h",
            goal: "2h",
            progress: 0.5,
          },
        ],
      },
      week: {
        status: "Strong",
        score: 88,
        avg: 72,
        best: 100,
        insight:
          "Weekly spiritual habits are consistent. You've maintained your morning routine 6 out of 7 days.",
        suggestion:
          "Consider adding a mid-week reflection session to sustain momentum through the weekend.",
        chartData: [0.75, 0.8, 0.65, 0.85, 0.7, 0.6, 0.85], // Mon-Sun
        chartLabel: "This Week",
        habits: [
          {
            icon: Sparkles,
            label: "Meditation",
            current: "5h 15m",
            goal: "7h",
            progress: 0.75,
          },
          {
            icon: Sparkles,
            label: "Reading",
            current: "2h 20m",
            goal: "3h 30m",
            progress: 0.67,
          },
          {
            icon: Sparkles,
            label: "Community",
            current: "1.5h",
            goal: "2h",
            progress: 0.75,
          },
        ],
      },
      month: {
        status: "Good",
        score: 82,
        avg: 70,
        best: 100,
        insight:
          "Monthly trends show solid consistency in faith practices. Second half of month showed slight dip.",
        suggestion:
          "Set calendar reminders for weekend spiritual activities to maintain end-of-week engagement.",
        chartData: [0.85, 0.78, 0.72, 0.68], // Wk 1-4
        chartLabel: "This Month",
        habits: [
          {
            icon: Sparkles,
            label: "Meditation",
            current: "22h",
            goal: "30h",
            progress: 0.73,
          },
          {
            icon: Sparkles,
            label: "Reading",
            current: "10h",
            goal: "15h",
            progress: 0.67,
          },
          {
            icon: Sparkles,
            label: "Community",
            current: "6h",
            goal: "8h",
            progress: 0.75,
          },
        ],
      },
      year: {
        status: "Strong",
        score: 85,
        avg: 68,
        best: 100,
        insight:
          "Year-to-date faith habits are trending upward. Q3 showed the strongest consistency.",
        suggestion:
          "You're on track! Consider deepening one practice area to reach your full potential.",
        chartData: [
          0.6, 0.65, 0.7, 0.72, 0.75, 0.78, 0.82, 0.85, 0.88, 0.85, 0.8, 0.78,
        ], // Jan-Dec
        chartLabel: "This Year",
        habits: [
          {
            icon: Sparkles,
            label: "Meditation",
            current: "280h",
            goal: "365h",
            progress: 0.77,
          },
          {
            icon: Sparkles,
            label: "Reading",
            current: "120h",
            goal: "180h",
            progress: 0.67,
          },
          {
            icon: Sparkles,
            label: "Community",
            current: "72h",
            goal: "96h",
            progress: 0.75,
          },
        ],
      },
    },
  },
  family: {
    id: "family",
    title: "Family Health",
    color: "#5F63F5",
    lightColor: "#EFF0FF",
    chartMetric: "Goal Progress",
    rangeData: {
      today: {
        status: "Good",
        score: 78,
        avg: 62,
        best: 100,
        insight:
          "You are hitting time goals, but 'Device-Free' hours are lower than your ideal target.",
        suggestion:
          "Schedule a 'Phone Box' time from 6 PM to 8 PM to increase quality engagement scores.",
        chartData: [0, 0, 0.3, 0.5, 0.7, 0.85, 0.47], // Today's hourly breakdown
        chartLabel: "Today",
        habits: [
          {
            icon: Sparkles,
            label: "Dinner",
            current: "45m",
            goal: "60m",
            progress: 0.75,
          },
          {
            icon: Sparkles,
            label: "Play",
            current: "30m",
            goal: "45m",
            progress: 0.67,
          },
          {
            icon: Sparkles,
            label: "Date Night",
            current: "0/wk",
            goal: "1/wk",
            progress: 0,
          },
        ],
      },
      week: {
        status: "Good",
        score: 75,
        avg: 60,
        best: 100,
        insight:
          "Weekly family time is meeting targets. Weekend activities boosted your score significantly.",
        suggestion:
          "Try to replicate weekend quality time patterns during weekday evenings.",
        chartData: [0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 0.85], // Mon-Sun
        chartLabel: "This Week",
        habits: [
          {
            icon: Sparkles,
            label: "Dinner",
            current: "5h 15m",
            goal: "7h",
            progress: 0.75,
          },
          {
            icon: Sparkles,
            label: "Play",
            current: "3h 30m",
            goal: "5h 15m",
            progress: 0.67,
          },
          {
            icon: Sparkles,
            label: "Date Night",
            current: "1/wk",
            goal: "1/wk",
            progress: 1.0,
          },
        ],
      },
      month: {
        status: "Needs Work",
        score: 68,
        avg: 58,
        best: 100,
        insight:
          "Monthly family engagement dipped during busy work weeks. Last two weeks showed recovery.",
        suggestion:
          "Block 'Family First' time on your calendar to protect against work overflow.",
        chartData: [0.72, 0.58, 0.65, 0.75], // Wk 1-4
        chartLabel: "This Month",
        habits: [
          {
            icon: Sparkles,
            label: "Dinner",
            current: "20h",
            goal: "30h",
            progress: 0.67,
          },
          {
            icon: Sparkles,
            label: "Play",
            current: "12h",
            goal: "20h",
            progress: 0.6,
          },
          {
            icon: Sparkles,
            label: "Date Night",
            current: "3/mo",
            goal: "4/mo",
            progress: 0.75,
          },
        ],
      },
      year: {
        status: "Good",
        score: 72,
        avg: 55,
        best: 100,
        insight:
          "Year-to-date family time is above average. Summer months showed peak engagement.",
        suggestion:
          "Maintain momentum by scheduling regular family activities in advance.",
        chartData: [
          0.55, 0.58, 0.62, 0.7, 0.78, 0.85, 0.88, 0.82, 0.75, 0.7, 0.68, 0.72,
        ], // Jan-Dec
        chartLabel: "This Year",
        habits: [
          {
            icon: Sparkles,
            label: "Dinner",
            current: "250h",
            goal: "365h",
            progress: 0.68,
          },
          {
            icon: Sparkles,
            label: "Play",
            current: "180h",
            goal: "260h",
            progress: 0.69,
          },
          {
            icon: Sparkles,
            label: "Date Night",
            current: "38/yr",
            goal: "52/yr",
            progress: 0.73,
          },
        ],
      },
    },
  },
  work: {
    id: "work",
    title: "Work Health",
    color: "#2F7BFF",
    lightColor: "#E9F2FF",
    chartMetric: "Goal Progress",
    rangeData: {
      today: {
        status: "Overload",
        score: 45,
        avg: 36,
        best: 100,
        insight:
          "Burnout risk detected. You are consistently 15% over your daily limit, affecting Family and Health blocks.",
        suggestion:
          "Implement a hard stop at 5:00 PM. AI analysis suggests your productivity drops sharply after 4:30 PM anyway.",
        chartData: [0, 0.5, 0.85, 0.95, 0.7, 0.3, 0.62], // Today's hourly breakdown
        chartLabel: "Today",
        habits: [
          {
            icon: Zap,
            label: "Deep Work",
            current: "6h",
            goal: "8h",
            progress: 0.75,
          },
          {
            icon: Zap,
            label: "Meetings",
            current: "3h",
            goal: "5h",
            progress: 0.6,
          },
          {
            icon: Zap,
            label: "Admin",
            current: "1h",
            goal: "2h",
            progress: 0.5,
          },
        ],
      },
      week: {
        status: "Overload",
        score: 42,
        avg: 38,
        best: 100,
        insight:
          "Weekly work hours exceeded target by 8 hours. Two days showed extreme overtime.",
        suggestion:
          "Identify top 3 priorities each morning and say no to scope creep on low-value tasks.",
        chartData: [0.85, 0.9, 0.95, 0.75, 0.65, 0.5, 0.35], // Mon-Sun
        chartLabel: "This Week",
        habits: [
          {
            icon: Zap,
            label: "Deep Work",
            current: "32h",
            goal: "40h",
            progress: 0.8,
          },
          {
            icon: Zap,
            label: "Meetings",
            current: "18h",
            goal: "15h",
            progress: 0.83,
          },
          {
            icon: Zap,
            label: "Admin",
            current: "5h",
            goal: "5h",
            progress: 1.0,
          },
        ],
      },
      month: {
        status: "At Risk",
        score: 52,
        avg: 45,
        best: 100,
        insight:
          "Monthly work patterns show improvement in weeks 3-4, but early month overwork set a tough pace.",
        suggestion:
          "Start each week with a realistic capacity plan. Leave 20% buffer for unexpected tasks.",
        chartData: [0.42, 0.48, 0.55, 0.62], // Wk 1-4
        chartLabel: "This Month",
        habits: [
          {
            icon: Zap,
            label: "Deep Work",
            current: "140h",
            goal: "160h",
            progress: 0.88,
          },
          {
            icon: Zap,
            label: "Meetings",
            current: "65h",
            goal: "60h",
            progress: 0.92,
          },
          {
            icon: Zap,
            label: "Admin",
            current: "18h",
            goal: "20h",
            progress: 0.9,
          },
        ],
      },
      year: {
        status: "At Risk",
        score: 58,
        avg: 50,
        best: 100,
        insight:
          "Year-to-date work balance is trending better. Q2 showed significant improvement over Q1.",
        suggestion:
          "Continue current trajectory. Consider delegation strategies for sustained balance.",
        chartData: [
          0.35, 0.38, 0.42, 0.5, 0.55, 0.58, 0.62, 0.6, 0.58, 0.55, 0.52, 0.58,
        ], // Jan-Dec
        chartLabel: "This Year",
        habits: [
          {
            icon: Zap,
            label: "Deep Work",
            current: "1,680h",
            goal: "1,920h",
            progress: 0.88,
          },
          {
            icon: Zap,
            label: "Meetings",
            current: "720h",
            goal: "720h",
            progress: 1.0,
          },
          {
            icon: Zap,
            label: "Admin",
            current: "200h",
            goal: "240h",
            progress: 0.83,
          },
        ],
      },
    },
  },
  health: {
    id: "health",
    title: "Physical Health",
    color: "#1F9C66",
    lightColor: "#E8F7EF",
    chartMetric: "Goal Progress",
    rangeData: {
      today: {
        status: "Perfect",
        score: 98,
        avg: 78,
        best: 100,
        insight:
          "Optimal performance! Your sleep and activity levels are perfectly synced with your circadian rhythm.",
        suggestion:
          "Maintain this momentum. Consider increasing intensity of cardio by 5% next week.",
        chartData: [0.95, 0.85, 0.7, 0.8, 0.9, 0.95, 0.96], // Today's hourly breakdown
        chartLabel: "Today",
        habits: [
          {
            icon: Zap,
            label: "Sleep",
            current: "7.5h",
            goal: "8h",
            progress: 0.94,
          },
          {
            icon: Zap,
            label: "Steps",
            current: "10k",
            goal: "10k",
            progress: 1.0,
          },
          {
            icon: Zap,
            label: "Active Energy",
            current: "450 kcal",
            goal: "500 kcal",
            progress: 0.9,
          },
        ],
      },
      week: {
        status: "Strong",
        score: 92,
        avg: 75,
        best: 100,
        insight:
          "Weekly health metrics are excellent. Sleep consistency is driving better energy throughout the day.",
        suggestion:
          "Add one more strength training session to complement your cardio routine.",
        chartData: [0.85, 0.88, 0.92, 0.9, 0.85, 0.9, 0.92], // Mon-Sun
        chartLabel: "This Week",
        habits: [
          {
            icon: Zap,
            label: "Sleep",
            current: "52h",
            goal: "56h",
            progress: 0.93,
          },
          {
            icon: Zap,
            label: "Steps",
            current: "68k",
            goal: "70k",
            progress: 0.97,
          },
          {
            icon: Zap,
            label: "Active Energy",
            current: "3,200 kcal",
            goal: "3,500 kcal",
            progress: 0.91,
          },
        ],
      },
      month: {
        status: "Strong",
        score: 88,
        avg: 72,
        best: 100,
        insight:
          "Monthly health trends show consistent habits. Weekends showed slightly lower activity.",
        suggestion:
          "Plan active weekend activities to maintain momentum through the full week.",
        chartData: [0.9, 0.88, 0.85, 0.88], // Wk 1-4
        chartLabel: "This Month",
        habits: [
          {
            icon: Zap,
            label: "Sleep",
            current: "220h",
            goal: "240h",
            progress: 0.92,
          },
          {
            icon: Zap,
            label: "Steps",
            current: "285k",
            goal: "300k",
            progress: 0.95,
          },
          {
            icon: Zap,
            label: "Active Energy",
            current: "14,000 kcal",
            goal: "15,000 kcal",
            progress: 0.93,
          },
        ],
      },
      year: {
        status: "Strong",
        score: 85,
        avg: 70,
        best: 100,
        insight:
          "Year-to-date health is your strongest category. Consistent improvement since January.",
        suggestion:
          "You've built excellent habits! Consider adding a new health goal to keep challenging yourself.",
        chartData: [
          0.7, 0.72, 0.75, 0.78, 0.82, 0.85, 0.88, 0.9, 0.88, 0.85, 0.82, 0.85,
        ], // Jan-Dec
        chartLabel: "This Year",
        habits: [
          {
            icon: Zap,
            label: "Sleep",
            current: "2,700h",
            goal: "2,920h",
            progress: 0.92,
          },
          {
            icon: Zap,
            label: "Steps",
            current: "3.4M",
            goal: "3.65M",
            progress: 0.93,
          },
          {
            icon: Zap,
            label: "Active Energy",
            current: "170k kcal",
            goal: "182.5k kcal",
            progress: 0.93,
          },
        ],
      },
    },
  },
};

// X-axis labels for each time range
const CHART_LABELS: Record<RangeKey, string[]> = {
  today: ["6am", "9am", "12pm", "3pm", "6pm", "9pm", "Now"],
  week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  month: ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
  year: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
};

// Chart title prefix based on time range
const CHART_TITLE_PREFIX: Record<RangeKey, string> = {
  today: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

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
        stroke={isFilled ? color : "#E5E7EB"}
        strokeWidth={2}
        strokeLinecap="round"
      />,
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

// Solid Bar Component with grey background for 100% reference
const SolidBar = ({
  height,
  color,
  maxHeight = 100,
  barWidth = 32,
}: {
  height: number;
  color: string;
  maxHeight?: number;
  barWidth?: number;
}) => {
  const barHeight = Math.max(height * maxHeight, 4);

  return (
    <View
      style={{
        height: maxHeight,
        justifyContent: "flex-end",
        position: "relative",
      }}
    >
      {/* Grey background bar showing 100% */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          width: barWidth,
          height: maxHeight,
          backgroundColor: "#F3F4F6",
          borderRadius: 6,
        }}
      />
      {/* Colored progress bar */}
      <View
        style={{
          width: barWidth,
          height: barHeight,
          backgroundColor: color,
          borderRadius: 6,
          zIndex: 1,
        }}
      />
    </View>
  );
};

// Striped Progress Bar Component
const StripedProgressBar = ({
  progress,
  color,
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
        <Rect x={0} y={0} width="100%" height={height} fill="#F3F4F6" rx={5} />
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
  range?: RangeKey;
  onChangeRange?: (range: RangeKey) => void;
  healthSummary?: HealthSummary | null;
  onPressLiveUpdates?: () => void;
  isRefreshingHealth?: boolean;
  healthErrorMessage?: string | null;
}

export const CategoryHealthTemplate = ({
  categoryId,
  range: controlledRange,
  onChangeRange,
  healthSummary,
  onPressLiveUpdates,
  isRefreshingHealth,
}: CategoryHealthTemplateProps) => {
  const [uncontrolledRange, setUncontrolledRange] = useState<RangeKey>("today");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const range = controlledRange ?? uncontrolledRange;
  const config = CATEGORY_CONFIGS[categoryId];
  const currentData = config.rangeData[range];

  const handleChangeRange = (next: RangeKey) => {
    if (onChangeRange) onChangeRange(next);
    else setUncontrolledRange(next);
  };

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(undefined).format(value);

  const formatNumberCompact = (value: number) =>
    new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  const formatDurationSeconds = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const habitsToRender: HabitTracker[] = useMemo(() => {
    if (categoryId !== "health") return currentData.habits;
    if (!healthSummary) return currentData.habits;

    const sleepGoalSeconds: Record<RangeKey, number> = {
      today: 8 * 3600,
      week: 56 * 3600,
      month: 240 * 3600,
      year: 2920 * 3600,
    };

    const stepsGoal: Record<RangeKey, number> = {
      today: 10_000,
      week: 70_000,
      month: 300_000,
      year: 3_650_000,
    };

    const activeEnergyGoalKcal: Record<RangeKey, number> = {
      today: 500,
      week: 500 * 7,
      month: 500 * 30,
      year: 500 * 365,
    };

    const steps = healthSummary.steps ?? null;
    const sleepSeconds = healthSummary.sleepAsleepSeconds ?? null;
    const activeEnergyKcal = healthSummary.activeEnergyKcal ?? null;

    const stepsProgress =
      steps !== null && steps !== undefined
        ? Math.min(steps / stepsGoal[range], 1)
        : 0;
    const sleepProgress =
      sleepSeconds !== null && sleepSeconds !== undefined
        ? Math.min(sleepSeconds / sleepGoalSeconds[range], 1)
        : 0;
    const activeEnergyProgress =
      activeEnergyKcal !== null && activeEnergyKcal !== undefined
        ? Math.min(activeEnergyKcal / activeEnergyGoalKcal[range], 1)
        : 0;

    return [
      {
        icon: Zap,
        label: "Sleep",
        current:
          sleepSeconds !== null && sleepSeconds !== undefined
            ? formatDurationSeconds(sleepSeconds)
            : "—",
        goal: formatDurationSeconds(sleepGoalSeconds[range]),
        progress: sleepProgress,
      },
      {
        icon: Zap,
        label: "Steps",
        current:
          steps !== null && steps !== undefined
            ? formatNumberCompact(steps)
            : "—",
        goal: formatNumberCompact(stepsGoal[range]),
        progress: stepsProgress,
      },
      {
        icon: Zap,
        label: "Active Energy",
        current:
          activeEnergyKcal !== null && activeEnergyKcal !== undefined
            ? `${formatNumber(activeEnergyKcal)} kcal`
            : "—",
        goal: `${formatNumber(activeEnergyGoalKcal[range])} kcal`,
        progress: activeEnergyProgress,
      },
    ];
  }, [categoryId, currentData.habits, healthSummary, range]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Strong":
      case "Perfect":
        return "#1F9C66";
      case "Good":
        return "#5F63F5";
      case "Overload":
      case "At Risk":
      case "Needs Work":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = () => {
    switch (range) {
      case "today":
        return "Today's Status";
      case "week":
        return "Weekly Status";
      case "month":
        return "Monthly Status";
      case "year":
        return "Yearly Status";
      default:
        return "Status";
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
          {/* Time Range Selector */}
          <View className="flex-row items-center justify-center mb-5">
            <AnalyticsRangeToggle
              options={RANGE_OPTIONS}
              value={range}
              onChange={(next) => handleChangeRange(next as RangeKey)}
              accessibilityLabel="Switch time range"
            />
          </View>

          {/* Daily Breakdown Section */}
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-4">
              <Icon icon={Sparkles} size={16} color={config.color} />
              <Text className="text-[14px] font-semibold text-[#374151]">
                Breakdown
              </Text>
            </View>

            <View className="bg-[#F9FAFB] rounded-2xl p-5">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text
                    className="text-[32px] font-bold"
                    style={{ color: getStatusColor(currentData.status) }}
                  >
                    {currentData.status}
                  </Text>
                  <Text className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide mt-1">
                    {getStatusLabel()}
                  </Text>
                  <View className="flex-row items-center gap-4 mt-3">
                    <View>
                      <Text
                        className="text-[20px] font-bold"
                        style={{ color: config.color }}
                      >
                        {currentData.avg}
                      </Text>
                      <Text className="text-[10px] text-[#9CA3AF] uppercase">
                        Avg
                      </Text>
                    </View>
                    <View>
                      <Text className="text-[20px] font-bold text-[#374151]">
                        {currentData.best}
                      </Text>
                      <Text className="text-[10px] text-[#9CA3AF] uppercase">
                        Best
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Score Circle with ticks */}
                <ScoreCircle score={currentData.score} color={config.color} />
              </View>
            </View>
          </View>

          {/* AI Optimization Insight */}
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-4">
              <Icon icon={Sparkles} size={16} color={config.color} />
              <Text className="text-[14px] font-semibold text-[#374151]">
                AI Optimization Insight
              </Text>
            </View>

            <Text className="text-[14px] text-[#6B7280] leading-[22px] mb-4">
              {currentData.insight}
            </Text>

            <View
              className="rounded-xl p-4"
              style={{
                backgroundColor: "#F0FDF4",
                borderWidth: 1,
                borderColor: "#BBF7D0",
              }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Icon icon={CheckCircle2} size={16} color="#16A34A" />
                <Text className="text-[12px] font-bold text-[#16A34A] uppercase tracking-wide">
                  Suggestion
                </Text>
              </View>
              <Text className="text-[14px] text-[#166534] leading-[20px]">
                {currentData.suggestion}
              </Text>
            </View>
          </View>

          {/* Chart Section - Combined Goal Progress */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[14px] font-semibold text-[#374151]">
                {CHART_TITLE_PREFIX[range]} {config.chartMetric}
              </Text>
              <View className="bg-[#F3F4F6] px-3 py-1 rounded-full">
                <Text className="text-[11px] font-medium text-[#6B7280]">
                  {currentData.chartLabel}
                </Text>
              </View>
            </View>

            <View
              className="flex-row items-end justify-between px-1"
              style={{ height: 140 }}
            >
              {currentData.chartData.map((value, index) => {
                const labels = CHART_LABELS[range];
                // Adjust bar width based on number of items
                const barWidth =
                  range === "year" ? 20 : range === "month" ? 48 : 32;

                return (
                  <View key={index} className="items-center flex-1">
                    <SolidBar
                      height={value}
                      color={config.color}
                      maxHeight={100}
                      barWidth={barWidth}
                    />
                    <Text
                      className="text-[#9CA3AF] mt-2"
                      style={{ fontSize: range === "year" ? 9 : 11 }}
                    >
                      {labels[index]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Habit Trackers with Striped Progress */}
          <View
            className="rounded-2xl p-4"
            style={{
              backgroundColor: "#FAFAFA",
              borderWidth: 1,
              borderColor: "#F0F0F0",
            }}
          >
            <View className="gap-4">
              {habitsToRender.map((habit, index) => (
                <View key={index} className="flex-row items-center gap-3">
                  <Icon icon={habit.icon} size={16} color={config.color} />
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-[13px] font-semibold text-[#374151]">
                        {habit.label}
                      </Text>
                      <Text className="text-[12px] text-[#9CA3AF]">
                        <Text
                          style={{ color: config.color, fontWeight: "600" }}
                        >
                          {habit.current}
                        </Text>
                        <Text className="text-[#D1D5DB]"> / </Text>
                        <Text>{habit.goal}</Text>
                      </Text>
                    </View>
                    <StripedProgressBar
                      progress={habit.progress}
                      color={config.color}
                    />
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              className="flex-row items-center justify-center gap-1 mt-4 pt-3 border-t border-[#E5E7EB]"
              onPress={onPressLiveUpdates}
              disabled={!onPressLiveUpdates || Boolean(isRefreshingHealth)}
              style={({ pressed }) => ({
                opacity:
                  !onPressLiveUpdates || isRefreshingHealth
                    ? 0.55
                    : pressed
                      ? 0.7
                      : 1,
              })}
            >
              <Text className="text-[12px] text-[#9CA3AF]">↻ Live Updates</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
