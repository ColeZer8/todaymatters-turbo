import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface AnalyticsDonutChartProps {
  data: DonutSlice[];
  radius?: number;
  strokeWidth?: number;
  label?: string;
  startAngle?: number;
}

// All possible slice labels in order (for consistent rendering)
const ALL_LABELS = ['Free time', 'Faith', 'Family', 'Work', 'Health', 'Other'];

const ANIMATION_CONFIG = {
  duration: 500,
  easing: Easing.inOut(Easing.cubic),
};

interface AnimatedSliceProps {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  circumference: number;
  color: string;
  percentage: Animated.SharedValue<number>;
  startPercentage: Animated.SharedValue<number>;
}

const AnimatedSlice = ({
  cx,
  cy,
  radius,
  strokeWidth,
  circumference,
  color,
  percentage,
  startPercentage,
}: AnimatedSliceProps) => {
  const animatedProps = useAnimatedProps(() => {
    const dashLength = circumference * percentage.value;
    const gapLength = circumference - dashLength;
    const dashOffset = circumference * (1 - startPercentage.value);

    return {
      strokeDasharray: `${dashLength} ${gapLength}`,
      strokeDashoffset: dashOffset,
      opacity: percentage.value > 0.001 ? 1 : 0,
    };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={radius}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      fill="transparent"
      animatedProps={animatedProps}
    />
  );
};

export const AnalyticsDonutChart = ({
  data,
  radius = 56,
  strokeWidth = 36,
  label,
  startAngle = -90,
}: AnalyticsDonutChartProps) => {
  const circumference = 2 * Math.PI * radius;
  const center = radius + strokeWidth;

  // Create a map of current data values
  const dataMap = useMemo(() => {
    const map: Record<string, { value: number; color: string }> = {};
    data.forEach((slice) => {
      map[slice.label] = { value: slice.value, color: slice.color };
    });
    return map;
  }, [data]);

  // Calculate total
  const total = useMemo(() => {
    return data.reduce((sum, slice) => sum + slice.value, 0) || 1;
  }, [data]);

  // Animated values for each possible slice
  const freeTimeValue = useSharedValue(0);
  const faithValue = useSharedValue(0);
  const familyValue = useSharedValue(0);
  const workValue = useSharedValue(0);
  const healthValue = useSharedValue(0);
  const otherValue = useSharedValue(0);

  // Update animated values when data changes
  useEffect(() => {
    const getPercent = (label: string) => {
      const item = dataMap[label];
      return item ? item.value / total : 0;
    };

    freeTimeValue.value = withTiming(getPercent('Free time'), ANIMATION_CONFIG);
    faithValue.value = withTiming(getPercent('Faith'), ANIMATION_CONFIG);
    familyValue.value = withTiming(getPercent('Family'), ANIMATION_CONFIG);
    workValue.value = withTiming(getPercent('Work'), ANIMATION_CONFIG);
    healthValue.value = withTiming(getPercent('Health'), ANIMATION_CONFIG);
    otherValue.value = withTiming(getPercent('Other'), ANIMATION_CONFIG);
  }, [dataMap, total, freeTimeValue, faithValue, familyValue, workValue, healthValue, otherValue]);

  // Derived cumulative start positions
  const freeTimeStart = useDerivedValue(() => 0);
  const faithStart = useDerivedValue(() => freeTimeValue.value);
  const familyStart = useDerivedValue(() => freeTimeValue.value + faithValue.value);
  const workStart = useDerivedValue(() => freeTimeValue.value + faithValue.value + familyValue.value);
  const healthStart = useDerivedValue(() => freeTimeValue.value + faithValue.value + familyValue.value + workValue.value);
  const otherStart = useDerivedValue(() => freeTimeValue.value + faithValue.value + familyValue.value + workValue.value + healthValue.value);

  // Get color for each slice
  const getColor = (label: string) => {
    const colors: Record<string, string> = {
      'Free time': '#14B8A6',
      'Faith': '#F79A3B',
      'Family': '#5F63F5',
      'Work': '#2F7BFF',
      'Health': '#1F9C66',
      'Other': '#9CA3AF',
    };
    return dataMap[label]?.color || colors[label];
  };

  const sliceConfigs = [
    { label: 'Free time', percentage: freeTimeValue, startPercentage: freeTimeStart },
    { label: 'Faith', percentage: faithValue, startPercentage: faithStart },
    { label: 'Family', percentage: familyValue, startPercentage: familyStart },
    { label: 'Work', percentage: workValue, startPercentage: workStart },
    { label: 'Health', percentage: healthValue, startPercentage: healthStart },
    { label: 'Other', percentage: otherValue, startPercentage: otherStart },
  ];

  return (
    <View className="items-center justify-center">
      <Svg
        height={(radius + strokeWidth) * 2}
        width={(radius + strokeWidth) * 2}
        viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}
      >
        <G rotation={startAngle} origin={`${center}, ${center}`}>
          {sliceConfigs.map((config) => (
            <AnimatedSlice
              key={config.label}
              cx={center}
              cy={center}
              radius={radius}
              strokeWidth={strokeWidth}
              circumference={circumference}
              color={getColor(config.label)}
              percentage={config.percentage}
              startPercentage={config.startPercentage}
            />
          ))}
        </G>
      </Svg>
      <View className="absolute items-center justify-center">
        <View
          className="items-center justify-center rounded-full bg-white"
          style={{ height: 80, width: 80 }}
        >
          {label ? (
            <Text
              allowFontScaling={false}
              className="uppercase text-[#9CA3AF]"
              style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1 }}
            >
              {label}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};
