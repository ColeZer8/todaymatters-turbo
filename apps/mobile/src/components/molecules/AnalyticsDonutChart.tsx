import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

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

export const AnalyticsDonutChart = ({
  data,
  radius = 64,
  strokeWidth = 48,
  label,
  startAngle = -90,
}: AnalyticsDonutChartProps) => {
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;

  return (
    <View className="items-center justify-center">
      <Svg
        height={(radius + strokeWidth) * 2}
        width={(radius + strokeWidth) * 2}
        viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}
      >
        <G rotation={startAngle} origin={`${radius + strokeWidth}, ${radius + strokeWidth}`}>
          {data.reduce<{ start: number; elements: JSX.Element[] }>((acc, slice, index) => {
            const slicePercent = slice.value / total;
            const dashLength = circumference * slicePercent;
            const gapLength = circumference - dashLength;
            const dashOffset = circumference - acc.start * circumference;
            acc.elements.push(
              <Circle
                key={slice.label + index}
                cx={radius + strokeWidth}
                cy={radius + strokeWidth}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${gapLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                fill="transparent"
                opacity={1}
              />
            );
            if (index === 0) {
              acc.elements.push(
                <Circle
                  key={`shadow-${slice.label}-${index}`}
                  cx={radius + strokeWidth}
                  cy={radius + strokeWidth}
                  r={radius}
                  stroke="#0f172a"
                  strokeWidth={strokeWidth + 2}
                  strokeDasharray={`${dashLength} ${gapLength}`}
                  strokeDashoffset={dashOffset + 1}
                  strokeLinecap="butt"
                  fill="transparent"
                  opacity={0.08}
                />
              );
            }
            acc.start += slicePercent;
            return acc;
          }, { start: 0, elements: [] }).elements}
        </G>
      </Svg>
      <View className="absolute items-center justify-center">
        <View
          className="items-center justify-center rounded-full bg-white shadow-sm shadow-[#0f172a1a]"
          style={{ height: 102, width: 102 }}
        >
          <View
            className="items-center justify-center rounded-full bg-white"
            style={{ height: 66, width: 66 }}
          >
            {label ? (
              <Text
                allowFontScaling={false}
                className="uppercase text-[#8F97A6]"
                style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}
              >
                {label}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};
