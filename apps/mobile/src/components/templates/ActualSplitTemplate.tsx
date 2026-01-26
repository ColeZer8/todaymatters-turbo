import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text, View } from 'react-native';
import { MultiSplitControl } from '@/components/molecules';

export interface ActualSplitTemplateProps {
  title: string;
  timeLabel: string;
  duration: number;
  startTime: string;
  endTime: string;
  onCancel: () => void;
  onConfirm: (splitPointMinutes: number[]) => void;
}

export const ActualSplitTemplate = ({
  title,
  timeLabel,
  duration,
  startTime,
  endTime,
  onCancel,
  onConfirm,
}: ActualSplitTemplateProps) => {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1 bg-[#F7FAFF]">
      <View
        className="flex-row items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable onPress={onCancel} className="px-3 py-2">
          <Text className="text-[14px] font-semibold text-[#64748B]">Cancel</Text>
        </Pressable>
        <Text className="text-[16px] font-semibold text-[#111827]">Split Event</Text>
        <View className="w-16" />
      </View>

      <View className="px-5">
        <View className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
          <Text className="text-[14px] font-semibold text-[#111827]">{title}</Text>
          <Text className="mt-1 text-[12px] text-[#64748B]">{timeLabel}</Text>
        </View>
      </View>

      <View className="px-5 pt-6">
        <View className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
          <Text className="text-[13px] font-semibold text-[#111827]">Choose where to split</Text>
          <Text className="mt-1 text-[12px] text-[#64748B]">
            Tap the bar to add split points. Drag to adjust. Tap X to remove.
          </Text>
          <View className="mt-4">
            <MultiSplitControl
              duration={duration}
              startTime={startTime}
              endTime={endTime}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};
