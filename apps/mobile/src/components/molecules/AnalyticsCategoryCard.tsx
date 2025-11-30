import { Pressable, Text, View } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { Card, Icon } from '@/components/atoms';
import { AnalyticsBarChart } from './AnalyticsBarChart';

interface AnalyticsCategoryCardProps {
  title: string;
  status: string;
  score: number;
  insight: string;
  bars: number[];
  barLabels?: string[];
  accentColor: string;
  accentBackground: string;
  isActive?: boolean;
  onPress?: () => void;
}

export const AnalyticsCategoryCard = ({
  title,
  status,
  score,
  insight,
  bars,
  barLabels,
  accentColor,
  accentBackground,
  isActive = false,
  onPress,
}: AnalyticsCategoryCardProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={`Open ${title} details`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
    >
      <Card
        className={`gap-3 border ${
          isActive ? 'border-brand-primary shadow-md shadow-[#1d4ed81a]' : 'border-[#E5E7EB]'
        }`}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3">
            <View
              className="items-center justify-center h-12 w-12 rounded-2xl"
              style={{ backgroundColor: accentBackground }}
            >
              <Text className="text-lg font-extrabold" style={{ color: accentColor }}>
                {score}
              </Text>
            </View>
            <View>
              <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                {title}
              </Text>
              <Text className="text-lg font-extrabold text-text-primary">{status}</Text>
            </View>
          </View>
          <Icon icon={ArrowUpRight} size={20} color={accentColor} />
        </View>

        <Text className="text-sm leading-6 text-text-secondary">{insight}</Text>

        <AnalyticsBarChart data={bars} labels={barLabels} color={accentColor} height={90} />

        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <Text className="text-xs font-semibold text-text-tertiary">Tap to open deeper view</Text>
        </View>
      </Card>
    </Pressable>
  );
};
