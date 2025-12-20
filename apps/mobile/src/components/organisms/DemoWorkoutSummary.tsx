import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { 
  Flame, 
  Heart, 
  Timer, 
  TrendingUp, 
  Footprints, 
  Zap,
  Award,
  ChevronRight,
  Activity,
  Target,
  Trophy,
  Sparkles,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, G } from 'react-native-svg';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoWorkoutSummary - Apple-style workout summary for demo mode
 * 
 * Mimics Apple Fitness reports/analytics with rings, stats, and achievements.
 * Shows workout data that will later pull from Apple HealthKit.
 * Follows home page golden standard for spacing and typography.
 */

// Apple-style activity ring component
const ActivityRing = ({ 
  progress, 
  color, 
  bgColor, 
  size, 
  strokeWidth 
}: { 
  progress: number; 
  color: string; 
  bgColor: string;
  size: number; 
  strokeWidth: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
  
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        {/* Background ring */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </G>
    </Svg>
  );
};

// Weekly bar chart component
const WeeklyBarChart = ({ 
  data, 
  color, 
  bgColor,
  goal 
}: { 
  data: number[]; 
  color: string;
  bgColor: string;
  goal: number;
}) => {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxValue = Math.max(...data, goal);
  
  return (
    <View className="flex-row items-end justify-between gap-1.5 h-16">
      {data.map((value, index) => {
        const heightPercent = (value / maxValue) * 100;
        const isToday = index === data.length - 1;
        const metGoal = value >= goal;
        
        return (
          <View key={index} className="flex-1 items-center">
            <View 
              className="w-full rounded-t-sm"
              style={{ 
                height: `${heightPercent}%`,
                backgroundColor: metGoal ? color : bgColor,
                minHeight: 4,
              }}
            />
            <Text className={`text-[10px] mt-1 ${isToday ? 'font-bold text-[#111827]' : 'text-[#9CA3AF]'}`}>
              {days[index]}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// Stat card component - now tappable
const StatCard = ({ 
  icon, 
  label, 
  value, 
  unit, 
  color, 
  bgColor,
  onPress,
}: { 
  icon: typeof Flame; 
  label: string; 
  value: string; 
  unit: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}) => (
  <Pressable 
    onPress={onPress}
    className="flex-1 rounded-2xl px-4 py-4 border border-[#E5E7EB]"
    style={{ backgroundColor: bgColor }}
  >
    <View className="flex-row items-center gap-2 mb-2">
      <Icon icon={icon} size={16} color={color} />
      <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]">
        {label}
      </Text>
    </View>
    <View className="flex-row items-baseline">
      <Text className="text-[24px] font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[14px] font-medium text-[#9CA3AF] ml-1">
        {unit}
      </Text>
    </View>
  </Pressable>
);

// Detail panel for stats
const StatDetailPanel = ({
  label,
  color,
  bgColor,
  weeklyData,
  weeklyGoal,
  avgValue,
  bestValue,
  totalValue,
  unit,
}: {
  label: string;
  color: string;
  bgColor: string;
  weeklyData: number[];
  weeklyGoal: number;
  avgValue: string;
  bestValue: string;
  totalValue: string;
  unit: string;
}) => (
  <Animated.View 
    entering={FadeIn.duration(200)} 
    exiting={FadeOut.duration(150)}
    className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB] mb-3"
  >
    <Text className="text-[13px] font-bold text-[#111827] mb-3">{label} - This Week</Text>
    
    <WeeklyBarChart 
      data={weeklyData} 
      color={color} 
      bgColor={bgColor}
      goal={weeklyGoal}
    />
    
    <View className="flex-row mt-4 pt-3 border-t border-[#F3F4F6]">
      <View className="flex-1 items-center border-r border-[#F3F4F6]">
        <Text className="text-[18px] font-bold" style={{ color }}>{avgValue}</Text>
        <Text className="text-[11px] text-[#9CA3AF]">Daily Avg</Text>
      </View>
      <View className="flex-1 items-center border-r border-[#F3F4F6]">
        <Text className="text-[18px] font-bold text-[#111827]">{bestValue}</Text>
        <Text className="text-[11px] text-[#9CA3AF]">Best Day</Text>
      </View>
      <View className="flex-1 items-center">
        <Text className="text-[18px] font-bold" style={{ color }}>{totalValue}</Text>
        <Text className="text-[11px] text-[#9CA3AF]">Total {unit}</Text>
      </View>
    </View>
  </Animated.View>
);

// Ring detail card
const RingDetailCard = ({
  label,
  current,
  goal,
  unit,
  color,
  bgColor,
  icon,
  description,
}: {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
  bgColor: string;
  icon: typeof Flame;
  description: string;
}) => {
  const progress = Math.min(current / goal, 1);
  const percentComplete = Math.round(progress * 100);
  
  return (
    <View 
      className="flex-row items-center rounded-xl px-3 py-3 mb-2"
      style={{ backgroundColor: bgColor }}
    >
      <View className="mr-3">
        <View className="relative items-center justify-center">
          <ActivityRing 
            progress={progress}
            color={color}
            bgColor={`${color}30`}
            size={48}
            strokeWidth={6}
          />
          <View className="absolute">
            <Icon icon={icon} size={16} color={color} />
          </View>
        </View>
      </View>
      <View className="flex-1">
        <View className="flex-row items-baseline">
          <Text className="text-[18px] font-bold" style={{ color }}>{current}</Text>
          <Text className="text-[13px] text-[#6B7280]">/{goal} {unit}</Text>
        </View>
        <Text className="text-[12px] text-[#6B7280]">{description}</Text>
      </View>
      <View className="items-end">
        <Text className="text-[20px] font-bold" style={{ color }}>{percentComplete}%</Text>
      </View>
    </View>
  );
};

// Progress detail panel
const ProgressDetailPanel = ({
  label,
  color,
  bgColor,
  weeklyData,
  weeklyGoal,
  avgValue,
  bestValue,
}: {
  label: string;
  color: string;
  bgColor: string;
  weeklyData: number[];
  weeklyGoal: number;
  avgValue: string;
  bestValue: string;
}) => (
  <Animated.View 
    entering={FadeIn.duration(200)} 
    exiting={FadeOut.duration(150)}
    className="mt-3 pt-3 border-t border-[#F3F4F6]"
  >
    <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280] mb-2">
      7-Day Trend
    </Text>
    <WeeklyBarChart 
      data={weeklyData} 
      color={color} 
      bgColor={bgColor}
      goal={weeklyGoal}
    />
    <View className="flex-row mt-3 pt-3 border-t border-[#F3F4F6]">
      <View className="flex-1 items-center border-r border-[#F3F4F6]">
        <Text className="text-[16px] font-bold" style={{ color }}>{avgValue}</Text>
        <Text className="text-[11px] text-[#9CA3AF]">Daily Avg</Text>
      </View>
      <View className="flex-1 items-center">
        <Text className="text-[16px] font-bold text-[#111827]">{bestValue}</Text>
        <Text className="text-[11px] text-[#9CA3AF]">Best This Week</Text>
      </View>
    </View>
  </Animated.View>
);

// Achievements list
const AchievementsList = ({ onClose }: { onClose: () => void }) => {
  const achievements = [
    { title: '5-Day Streak', description: 'Worked out 5 days in a row', icon: Flame, color: '#EF4444', bgColor: '#FEE2E2', date: 'Today', isNew: true },
    { title: 'Early Bird', description: 'Completed a workout before 7 AM', icon: Sparkles, color: '#F59E0B', bgColor: '#FEF3C7', date: 'Yesterday', isNew: false },
    { title: 'Calorie Crusher', description: 'Burned 500+ calories in one workout', icon: Zap, color: '#8B5CF6', bgColor: '#EDE9FE', date: 'Dec 8', isNew: false },
    { title: 'Heart Racer', description: 'Reached 170+ BPM during workout', icon: Heart, color: '#EC4899', bgColor: '#FCE7F3', date: 'Dec 6', isNew: false },
    { title: 'Step Master', description: 'Achieved 10,000 steps in one day', icon: Footprints, color: '#2563EB', bgColor: '#DBEAFE', date: 'Dec 5', isNew: false },
  ];
  
  return (
    <Animated.View entering={FadeIn.duration(200)} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <View className="flex-row items-center gap-2">
          <Icon icon={Trophy} size={18} color="#F59E0B" />
          <Text className="text-[15px] font-bold text-[#111827]">Achievements</Text>
        </View>
        <Pressable onPress={onClose}>
          <Text className="text-[14px] font-semibold text-[#2563EB]">Done</Text>
        </Pressable>
      </View>
      
      {achievements.map((achievement, index) => (
        <View 
          key={index}
          className={`flex-row items-center px-4 py-3 ${index < achievements.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl mr-3" style={{ backgroundColor: achievement.bgColor }}>
            <Icon icon={achievement.icon} size={22} color={achievement.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-[14px] font-semibold text-[#111827]">{achievement.title}</Text>
              {achievement.isNew && (
                <View className="bg-[#EF4444] px-1.5 py-0.5 rounded">
                  <Text className="text-[9px] font-bold text-white">NEW</Text>
                </View>
              )}
            </View>
            <Text className="text-[12px] text-[#6B7280]">{achievement.description}</Text>
          </View>
          <Text className="text-[12px] text-[#9CA3AF]">{achievement.date}</Text>
        </View>
      ))}
    </Animated.View>
  );
};

export const DemoWorkoutSummary = () => {
  const insets = useSafeAreaInsets();
  const [showRingDetails, setShowRingDetails] = useState(false);
  const [expandedStat, setExpandedStat] = useState<string | null>(null);
  const [expandedProgress, setExpandedProgress] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);

  // Ring sizes and positions
  const outerSize = 180;
  const middleSize = 140;
  const innerSize = 100;
  const strokeWidth = 16;

  const toggleStat = (stat: string) => {
    setExpandedStat(expandedStat === stat ? null : stat);
  };

  const toggleProgress = (progress: string) => {
    setExpandedProgress(expandedProgress === progress ? null : progress);
  };

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
    >
      <ScrollView 
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Header */}
        <View className="mt-1 mb-4">
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            Great workout,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            Paul!
          </Text>
        </View>

        {/* Message */}
        <View className="mt-3.5 mb-5">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            You crushed your morning workout. Here's your activity summary.
          </Text>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-5" />

        {/* Activity Rings Section - Tappable */}
        <Pressable 
          onPress={() => setShowRingDetails(!showRingDetails)}
          className="items-center mb-6"
        >
          <View 
            className="items-center justify-center mb-4"
            style={{ width: outerSize, height: outerSize }}
          >
            <View className="absolute" style={{ top: 0, left: 0 }}>
              <ActivityRing progress={0.85} color="#EF4444" bgColor="#FEE2E2" size={outerSize} strokeWidth={strokeWidth} />
            </View>
            <View className="absolute" style={{ top: (outerSize - middleSize) / 2, left: (outerSize - middleSize) / 2 }}>
              <ActivityRing progress={1.0} color="#16A34A" bgColor="#DCFCE7" size={middleSize} strokeWidth={strokeWidth} />
            </View>
            <View className="absolute" style={{ top: (outerSize - innerSize) / 2, left: (outerSize - innerSize) / 2 }}>
              <ActivityRing progress={0.75} color="#2563EB" bgColor="#DBEAFE" size={innerSize} strokeWidth={strokeWidth} />
            </View>
          </View>

          {/* Ring Legend */}
          <View className="flex-row items-center gap-6">
            <View className="flex-row items-center gap-1.5">
              <View className="h-3 w-3 rounded-full bg-[#EF4444]" />
              <Text className="text-[12px] font-semibold text-[#6B7280]">Move</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="h-3 w-3 rounded-full bg-[#16A34A]" />
              <Text className="text-[12px] font-semibold text-[#6B7280]">Exercise</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="h-3 w-3 rounded-full bg-[#2563EB]" />
              <Text className="text-[12px] font-semibold text-[#6B7280]">Stand</Text>
            </View>
          </View>
        </Pressable>

        {/* Ring Details (expanded) */}
        {showRingDetails && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} className="mb-5">
            <RingDetailCard label="Move" current={487} goal={600} unit="cal" color="#EF4444" bgColor="#FEF2F2" icon={Flame} description="Active calories burned today" />
            <RingDetailCard label="Exercise" current={52} goal={45} unit="min" color="#16A34A" bgColor="#F0FDF4" icon={Activity} description="Goal exceeded! Great job!" />
            <RingDetailCard label="Stand" current={9} goal={12} unit="hrs" color="#2563EB" bgColor="#EFF6FF" icon={Target} description="Hours with standing activity" />
          </Animated.View>
        )}

        {/* Section Header */}
        <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-3">
          Workout Stats
        </Text>

        {/* Stats Grid - Row 1 */}
        <View className="flex-row gap-3 mb-3">
          <StatCard icon={Flame} label="Calories" value="487" unit="kcal" color="#EF4444" bgColor="#FFFFFF" onPress={() => toggleStat('calories')} />
          <StatCard icon={Timer} label="Duration" value="52" unit="min" color="#2563EB" bgColor="#FFFFFF" onPress={() => toggleStat('duration')} />
        </View>

        {/* Calories Detail */}
        {expandedStat === 'calories' && (
          <StatDetailPanel
            label="Calories"
            color="#EF4444"
            bgColor="#FEE2E2"
            weeklyData={[320, 450, 280, 520, 380, 410, 487]}
            weeklyGoal={400}
            avgValue="407"
            bestValue="520"
            totalValue="2,847"
            unit="kcal"
          />
        )}

        {/* Duration Detail */}
        {expandedStat === 'duration' && (
          <StatDetailPanel
            label="Duration"
            color="#2563EB"
            bgColor="#DBEAFE"
            weeklyData={[35, 48, 30, 55, 42, 38, 52]}
            weeklyGoal={45}
            avgValue="43m"
            bestValue="55m"
            totalValue="5h 20m"
            unit=""
          />
        )}

        {/* Stats Grid - Row 2 */}
        <View className="flex-row gap-3 mb-3">
          <StatCard icon={Heart} label="Avg Heart" value="142" unit="bpm" color="#EC4899" bgColor="#FFFFFF" onPress={() => toggleStat('avgHeart')} />
          <StatCard icon={TrendingUp} label="Peak Heart" value="168" unit="bpm" color="#F97316" bgColor="#FFFFFF" onPress={() => toggleStat('peakHeart')} />
        </View>

        {/* Avg Heart Detail */}
        {expandedStat === 'avgHeart' && (
          <StatDetailPanel
            label="Average Heart Rate"
            color="#EC4899"
            bgColor="#FCE7F3"
            weeklyData={[135, 142, 128, 155, 138, 145, 142]}
            weeklyGoal={140}
            avgValue="141"
            bestValue="155"
            totalValue="62"
            unit="resting"
          />
        )}

        {/* Peak Heart Detail */}
        {expandedStat === 'peakHeart' && (
          <StatDetailPanel
            label="Peak Heart Rate"
            color="#F97316"
            bgColor="#FFEDD5"
            weeklyData={[158, 165, 150, 172, 162, 168, 168]}
            weeklyGoal={170}
            avgValue="163"
            bestValue="172"
            totalValue="92%"
            unit="max HR"
          />
        )}

        {/* Section Header */}
        <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-3 mt-2">
          Daily Progress
        </Text>

        {/* Progress Bars */}
        <View className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB] gap-4 mb-5">
          {/* Steps */}
          <Pressable onPress={() => toggleProgress('steps')}>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2">
                <Icon icon={Footprints} size={16} color="#2563EB" />
                <Text className="text-[14px] font-semibold text-[#111827]">Steps</Text>
              </View>
              <Text className="text-[14px] font-bold text-[#2563EB]">6,842 / 10,000</Text>
            </View>
            <View className="h-2 bg-[#DBEAFE] rounded-full overflow-hidden">
              <View className="h-full bg-[#2563EB] rounded-full" style={{ width: '68%' }} />
            </View>
            {expandedProgress === 'steps' && (
              <ProgressDetailPanel
                label="Steps"
                color="#2563EB"
                bgColor="#DBEAFE"
                weeklyData={[8200, 6500, 9100, 7800, 5400, 8900, 6842]}
                weeklyGoal={10000}
                avgValue="7,534"
                bestValue="9,100"
              />
            )}
          </Pressable>

          {/* Active Calories */}
          <Pressable onPress={() => toggleProgress('activeCalories')}>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2">
                <Icon icon={Zap} size={16} color="#EF4444" />
                <Text className="text-[14px] font-semibold text-[#111827]">Active Calories</Text>
              </View>
              <Text className="text-[14px] font-bold text-[#EF4444]">487 / 600</Text>
            </View>
            <View className="h-2 bg-[#FEE2E2] rounded-full overflow-hidden">
              <View className="h-full bg-[#EF4444] rounded-full" style={{ width: '81%' }} />
            </View>
            {expandedProgress === 'activeCalories' && (
              <ProgressDetailPanel
                label="Active Calories"
                color="#EF4444"
                bgColor="#FEE2E2"
                weeklyData={[320, 450, 280, 520, 380, 410, 487]}
                weeklyGoal={600}
                avgValue="407"
                bestValue="520"
              />
            )}
          </Pressable>

          {/* Exercise Minutes */}
          <Pressable onPress={() => toggleProgress('exercise')}>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2">
                <Icon icon={Timer} size={16} color="#16A34A" />
                <Text className="text-[14px] font-semibold text-[#111827]">Exercise</Text>
              </View>
              <Text className="text-[14px] font-bold text-[#16A34A]">52 / 45 min</Text>
            </View>
            <View className="h-2 bg-[#DCFCE7] rounded-full overflow-hidden">
              <View className="h-full bg-[#16A34A] rounded-full" style={{ width: '100%' }} />
            </View>
            {expandedProgress === 'exercise' && (
              <ProgressDetailPanel
                label="Exercise"
                color="#16A34A"
                bgColor="#DCFCE7"
                weeklyData={[35, 48, 30, 55, 42, 38, 52]}
                weeklyGoal={45}
                avgValue="43 min"
                bestValue="55 min"
              />
            )}
          </Pressable>
        </View>

        {/* Achievement Card */}
        {!showAchievements ? (
          <Pressable onPress={() => setShowAchievements(true)}>
            <View className="flex-row items-center rounded-2xl px-4 py-4 border border-[#DBEAFE]" style={{ backgroundColor: '#EFF6FF' }}>
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#DBEAFE] mr-3">
                <Icon icon={Award} size={24} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-[#1E40AF] mb-0.5">New Achievement Unlocked!</Text>
                <Text className="text-[13px] text-[#3B82F6]">5-day workout streak • Keep it going!</Text>
              </View>
              <Icon icon={ChevronRight} size={20} color="#2563EB" />
            </View>
          </Pressable>
        ) : (
          <AchievementsList onClose={() => setShowAchievements(false)} />
        )}
      </ScrollView>

      <BottomToolbar />
    </View>
  );
};






