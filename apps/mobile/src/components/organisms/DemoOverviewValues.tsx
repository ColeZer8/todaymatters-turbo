import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Heart,
  Sparkles,
  TrendingUp,
  Star,
  CheckCircle2,
  Calendar,
  Flame,
  Shield,
  Users,
  Brain,
  Zap
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, G, Path } from 'react-native-svg';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';
import { useIdealDayStore } from '@/stores/ideal-day-store';

/**
 * DemoOverviewValues - Values/life pillars analytics for demo mode
 * 
 * Shows how time is being spent across life values/categories.
 * Pulls from ideal-day store to display user's configured values.
 * Follows home page golden standard for spacing and typography.
 */

// Radar chart for values alignment
const ValuesRadar = ({ values }: { values: { name: string; score: number; color: string }[] }) => {
  const size = 200;
  const center = size / 2;
  const maxRadius = 80;
  const levels = 4;
  
  // Calculate points for polygon
  const angleStep = (2 * Math.PI) / values.length;
  const points = values.map((value, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = maxRadius * value.score;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });
  
  const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  
  return (
    <View className="items-center">
      <Svg width={size} height={size}>
        {/* Background rings */}
        {Array.from({ length: levels }).map((_, i) => (
          <SvgCircle
            key={i}
            cx={center}
            cy={center}
            r={(maxRadius / levels) * (i + 1)}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}
        
        {/* Axis lines */}
        {values.map((_, index) => {
          const angle = angleStep * index - Math.PI / 2;
          return (
            <Path
              key={index}
              d={`M ${center} ${center} L ${center + maxRadius * Math.cos(angle)} ${center + maxRadius * Math.sin(angle)}`}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          );
        })}
        
        {/* Value polygon */}
        <Path
          d={polygonPath}
          fill="#2563EB"
          fillOpacity={0.2}
          stroke="#2563EB"
          strokeWidth={2}
        />
        
        {/* Data points */}
        {points.map((point, index) => (
          <SvgCircle
            key={index}
            cx={point.x}
            cy={point.y}
            r={6}
            fill={values[index].color}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        ))}
      </Svg>
      
      {/* Labels */}
      {values.map((value, index) => {
        const angle = angleStep * index - Math.PI / 2;
        const labelRadius = maxRadius + 25;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        
        return (
          <View
            key={index}
            className="absolute items-center"
            style={{
              left: x - 30,
              top: y - 8,
              width: 60,
            }}
          >
            <Text className="text-[11px] font-semibold text-[#374151] text-center">
              {value.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// Value card component
const ValueCard = ({ 
  name, 
  icon, 
  score, 
  trend, 
  hours,
  color,
  bgColor 
}: { 
  name: string; 
  icon: typeof Heart;
  score: number; 
  trend: 'up' | 'stable' | 'down';
  hours: number;
  color: string;
  bgColor: string;
}) => {
  return (
    <View 
      className="rounded-2xl px-4 py-4 border"
      style={{ backgroundColor: bgColor, borderColor: `${color}30` }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Icon icon={icon} size={18} color={color} />
          <Text className="text-[14px] font-bold text-[#111827]">{name}</Text>
        </View>
        {trend === 'up' && (
          <View className="flex-row items-center gap-1">
            <Icon icon={TrendingUp} size={12} color="#16A34A" />
            <Text className="text-[11px] font-semibold text-[#16A34A]">+5%</Text>
          </View>
        )}
      </View>
      
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-[11px] text-[#6B7280] mb-1">Alignment Score</Text>
          <Text className="text-[28px] font-bold" style={{ color }}>
            {Math.round(score * 100)}%
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[11px] text-[#6B7280] mb-1">This Week</Text>
          <Text className="text-[18px] font-semibold text-[#374151]">
            {hours}h
          </Text>
        </View>
      </View>
      
      {/* Progress bar */}
      <View className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${color}20` }}>
        <View 
          className="h-full rounded-full" 
          style={{ width: `${score * 100}%`, backgroundColor: color }} 
        />
      </View>
    </View>
  );
};

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, typeof Heart> = {
  sleep: Shield,
  work: Zap,
  family: Users,
  prayer: Heart,
  fitness: Flame,
  default: Star,
};

export const DemoOverviewValues = () => {
  const insets = useSafeAreaInsets();
  const categories = useIdealDayStore((state) => state.categoriesByType.weekdays);
  
  // Map categories to value data
  const valueData = categories.map((cat, index) => ({
    name: cat.name,
    icon: CATEGORY_ICONS[cat.id] || CATEGORY_ICONS.default,
    score: [0.85, 0.72, 0.68, 0.92, 0.78][index % 5],
    trend: (['up', 'stable', 'up', 'up', 'stable'] as const)[index % 5],
    hours: cat.hours * 7, // Weekly hours
    color: cat.color,
    bgColor: `${cat.color}10`,
  }));

  // Radar chart data
  const radarData = valueData.slice(0, 5).map(v => ({
    name: v.name,
    score: v.score,
    color: v.color,
  }));

  // Overall alignment score
  const overallScore = valueData.reduce((sum, v) => sum + v.score, 0) / valueData.length;

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
            Values
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            Overview
          </Text>
        </View>

        {/* Summary Message */}
        <View className="mt-3.5 mb-5">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            See how your time aligns with what matters most to you.
          </Text>
        </View>

        {/* Divider */}
        <View className="h-px bg-[#E5E7EB] mb-5" />

        {/* Overall Score Card */}
        <View className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB] mb-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Icon icon={Heart} size={18} color="#2563EB" />
            <Text className="text-[15px] font-bold text-[#111827]">
              Life Alignment
            </Text>
          </View>

          <View className="items-center mb-4">
            {/* Radar Chart */}
            <ValuesRadar values={radarData} />
          </View>

          {/* Overall Score */}
          <View className="items-center py-3 border-t border-[#E5E7EB]">
            <Text className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B7280] mb-1">
              Overall Alignment
            </Text>
            <Text className="text-[36px] font-bold text-[#2563EB]">
              {Math.round(overallScore * 100)}%
            </Text>
            <View className="flex-row items-center gap-1 mt-1">
              <Icon icon={TrendingUp} size={14} color="#16A34A" />
              <Text className="text-[13px] font-semibold text-[#16A34A]">
                +3% from last week
              </Text>
            </View>
          </View>
        </View>

        {/* AI Insight Card */}
        <View className="bg-[#EFF6FF] rounded-2xl px-4 py-4 border border-[#DBEAFE] mb-5">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]">
              <Icon icon={Sparkles} size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-bold text-[#1E40AF] mb-1">
                AI Insight
              </Text>
              <Text className="text-[14px] leading-[20px] text-[#3B82F6]">
                Your Prayer time has been exceptionally consistent. Family time dipped mid-week — consider a dedicated family evening tomorrow.
              </Text>
            </View>
          </View>
        </View>

        {/* Weekly Wins */}
        <View className="bg-[#F0FDF4] rounded-2xl px-4 py-4 border border-[#BBF7D0] mb-5">
          <View className="flex-row items-center gap-2 mb-3">
            <Icon icon={Star} size={16} color="#16A34A" />
            <Text className="text-[14px] font-bold text-[#166534]">
              Weekly Wins
            </Text>
          </View>
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={CheckCircle2} size={14} color="#16A34A" />
              <Text className="text-[13px] text-[#15803D]">
                Hit fitness goals 5 days this week
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Icon icon={CheckCircle2} size={14} color="#16A34A" />
              <Text className="text-[13px] text-[#15803D]">
                Morning prayer streak: 12 days
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Icon icon={CheckCircle2} size={14} color="#16A34A" />
              <Text className="text-[13px] text-[#15803D]">
                Work hours under target (-2h)
              </Text>
            </View>
          </View>
        </View>

        {/* Section Header */}
        <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-3">
          Value Categories
        </Text>

        {/* Value Cards - 2 column grid */}
        <View className="flex-row flex-wrap justify-between">
          {valueData.map((value, index) => (
            <View key={index} className="w-[48%] mb-3">
              <ValueCard {...value} />
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomToolbar />
    </View>
  );
};


