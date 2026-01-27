import { useMemo, useRef, useEffect, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

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

// Known analytics labels for stable ordering when animating
const ANALYTICS_LABELS = [
  "Free time",
  "Faith",
  "Family",
  "Work",
  "Health",
  "Other",
];

const ANIMATION_DURATION = 500;
const ANIMATION_FPS = 60;

export const AnalyticsDonutChart = ({
  data,
  radius = 56,
  strokeWidth = 36,
  label,
  startAngle = -90,
}: AnalyticsDonutChartProps) => {
  const circumference = 2 * Math.PI * radius;
  const center = radius + strokeWidth;

  // Calculate total
  const total = useMemo(() => {
    return data.reduce((sum, slice) => sum + slice.value, 0) || 1;
  }, [data]);

  // Check if this is analytics mode (uses known labels) or generic mode
  const isAnalyticsMode = useMemo(() => {
    return data.some((d) => ANALYTICS_LABELS.includes(d.label));
  }, [data]);

  // For analytics mode: animate between states
  // For generic mode: just render slices directly (no animation needed for IdealDay)
  const [animatedSlices, setAnimatedSlices] = useState<
    Array<{ label: string; percentage: number; color: string }>
  >([]);
  const prevSlicesRef = useRef<
    Array<{ label: string; percentage: number; color: string }>
  >([]);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate target slices
  const targetSlices = useMemo(() => {
    if (isAnalyticsMode) {
      // For analytics: use fixed order
      return ANALYTICS_LABELS.map((lbl) => {
        const slice = data.find((d) => d.label === lbl);
        return {
          label: lbl,
          percentage: slice ? slice.value / total : 0,
          color: slice?.color || getDefaultColor(lbl),
        };
      }).filter(
        (s) => s.percentage > 0 || data.some((d) => d.label === s.label),
      );
    } else {
      // For generic: use data order directly
      return data.map((slice) => ({
        label: slice.label,
        percentage: slice.value / total,
        color: slice.color,
      }));
    }
  }, [data, total, isAnalyticsMode]);

  // Animate slices for analytics mode
  useEffect(() => {
    if (!isAnalyticsMode) {
      // No animation for generic mode
      setAnimatedSlices(targetSlices);
      return;
    }

    // Clear existing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }

    const startSlices =
      prevSlicesRef.current.length > 0 ? prevSlicesRef.current : targetSlices;
    const startTime = Date.now();
    const frameInterval = 1000 / ANIMATION_FPS;

    // Build a map of all labels we need to animate
    const allLabels = new Set([
      ...startSlices.map((s) => s.label),
      ...targetSlices.map((s) => s.label),
    ]);

    animationRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);

      const interpolated = Array.from(allLabels).map((lbl) => {
        const start = startSlices.find((s) => s.label === lbl);
        const end = targetSlices.find((s) => s.label === lbl);
        const startPct = start?.percentage ?? 0;
        const endPct = end?.percentage ?? 0;
        const currentPct = startPct + (endPct - startPct) * eased;

        return {
          label: lbl,
          percentage: currentPct,
          color: end?.color || start?.color || getDefaultColor(lbl),
        };
      });

      setAnimatedSlices(interpolated.filter((s) => s.percentage > 0.001));

      if (progress >= 1) {
        if (animationRef.current) {
          clearInterval(animationRef.current);
          animationRef.current = null;
        }
        prevSlicesRef.current = targetSlices;
      }
    }, frameInterval);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [targetSlices, isAnalyticsMode]);

  // For rendering: calculate cumulative offsets
  const slicesWithOffsets = useMemo(() => {
    const slices = isAnalyticsMode ? animatedSlices : targetSlices;
    let cumulative = 0;
    return slices.map((slice) => {
      const offset = cumulative;
      cumulative += slice.percentage;
      return { ...slice, offset };
    });
  }, [animatedSlices, targetSlices, isAnalyticsMode]);

  return (
    <View className="items-center justify-center">
      <Svg
        height={(radius + strokeWidth) * 2}
        width={(radius + strokeWidth) * 2}
        viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}
      >
        <G rotation={startAngle} origin={`${center}, ${center}`}>
          {slicesWithOffsets.map((slice) => {
            const dashLength = circumference * slice.percentage;
            const gapLength = circumference - dashLength;
            const dashOffset = circumference * (1 - slice.offset);

            return (
              <Circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                fill="transparent"
                strokeDasharray={`${dashLength} ${gapLength}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
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
              style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1 }}
            >
              {label}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

// Default colors for analytics labels
function getDefaultColor(label: string): string {
  const colors: Record<string, string> = {
    "Free time": "#14B8A6",
    Faith: "#F79A3B",
    Family: "#5F63F5",
    Work: "#2F7BFF",
    Health: "#1F9C66",
    Other: "#9CA3AF",
  };
  return colors[label] || "#9CA3AF";
}
