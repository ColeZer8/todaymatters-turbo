import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PatternInsightRow {
  id: string;
  timeLabel: string;
  title: string;
  detail: string;
  confidence: number;
}

interface PatternInsightsTemplateProps {
  dateLabel: string;
  anomalyScore: number;
  anomalies: PatternInsightRow[];
  predictions: PatternInsightRow[];
}

export const PatternInsightsTemplate = ({
  dateLabel,
  anomalyScore,
  anomalies,
  predictions,
}: PatternInsightsTemplateProps) => {
  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <ScrollView className="flex-1 px-5 pb-8">
        <Text className="mt-6 text-[20px] font-semibold text-[#0F172A]">Pattern Insights</Text>
        <Text className="mt-2 text-[13px] text-[#64748B]">For {dateLabel}</Text>

        <View className="mt-6 px-4 py-4 rounded-2xl border border-[#E2E8F0] bg-white">
          <Text className="text-[13px] font-semibold text-[#0F172A]">Daily anomaly score</Text>
          <Text className="mt-2 text-[28px] font-semibold text-[#0F172A]">
            {Math.round(anomalyScore * 100)}%
          </Text>
          <Text className="mt-1 text-[12px] text-[#94A3B8]">
            Higher scores mean more deviations from your usual patterns.
          </Text>
        </View>

        <View className="mt-4 px-4 py-4 rounded-2xl border border-[#E2E8F0] bg-white">
          <Text className="text-[13px] font-semibold text-[#0F172A]">Pattern deviations</Text>
          {anomalies.length === 0 ? (
            <Text className="mt-3 text-[12px] text-[#94A3B8]">No major deviations detected.</Text>
          ) : (
            <View className="mt-3 gap-3">
              {anomalies.map((row) => (
                <View key={row.id} className="flex-row items-start justify-between">
                  <View>
                    <Text className="text-[12px] font-semibold text-[#0F172A]">{row.title}</Text>
                    <Text className="text-[12px] text-[#64748B]">{row.detail}</Text>
                  </View>
                  <Text className="text-[12px] font-semibold text-[#2563EB]">{row.timeLabel}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="mt-4 px-4 py-4 rounded-2xl border border-[#E2E8F0] bg-white">
          <Text className="text-[13px] font-semibold text-[#0F172A]">Upcoming suggestions</Text>
          {predictions.length === 0 ? (
            <Text className="mt-3 text-[12px] text-[#94A3B8]">No strong suggestions yet.</Text>
          ) : (
            <View className="mt-3 gap-3">
              {predictions.map((row) => (
                <View key={row.id} className="flex-row items-start justify-between">
                  <View>
                    <Text className="text-[12px] font-semibold text-[#0F172A]">{row.title}</Text>
                    <Text className="text-[12px] text-[#64748B]">{row.detail}</Text>
                  </View>
                  <Text className="text-[12px] font-semibold text-[#0EA5E9]">{row.timeLabel}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
