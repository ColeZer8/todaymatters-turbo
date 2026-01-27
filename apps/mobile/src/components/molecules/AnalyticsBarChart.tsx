import { Text, View } from "react-native";

interface AnalyticsBarChartProps {
  data: number[];
  labels?: string[];
  color: string;
  height?: number;
  maxValue?: number;
}

export const AnalyticsBarChart = ({
  data,
  labels,
  color,
  height = 140,
  maxValue,
}: AnalyticsBarChartProps) => {
  const computedMax = maxValue ?? Math.max(...data, 0, 1);

  return (
    <View className="w-full">
      <View className="flex-row items-end" style={{ height }}>
        {data.map((value, index) => {
          const barHeight =
            computedMax === 0 ? 0 : (value / computedMax) * height;
          const label = labels?.[index];

          return (
            <View
              key={`bar-${index}`}
              className="items-center"
              style={{ width: 18, marginHorizontal: 8 }}
            >
              <View
                className="w-4 rounded-2xl"
                style={{
                  height: Math.max(barHeight, 6),
                  backgroundColor: color,
                }}
              />
              {label ? (
                <Text className="mt-2 text-xs font-semibold text-text-tertiary">
                  {label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
};
