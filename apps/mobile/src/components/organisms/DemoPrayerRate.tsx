import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, Mic, Link2, Pencil } from 'lucide-react-native';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoPrayerRate - Prayer/spiritual reflection rating screen for demo mode
 * 
 * Shows completion state after prayer session with star rating and journal.
 * Follows home page golden standard for spacing and typography.
 */
export const DemoPrayerRate = () => {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(4);
  const [journalText, setJournalText] = useState('');

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
    >
      <View className="flex-1 px-6">
        {/* Header - matches Greeting component: mt-1 mb-4 */}
        <View className="mt-1 mb-4">
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            Well done,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            Paul.
          </Text>
        </View>

        {/* Subtitle - matches DailyBrief: mt-3.5 */}
        <View className="mt-3.5 mb-8">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            Your session is complete.
          </Text>
        </View>

        {/* Spiritual Reflection Section */}
        <View className="mb-8">
          {/* Section Header */}
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-2">
            Spiritual Reflection
          </Text>
          
          {/* Divider - full width, solid */}
          <View className="h-[1px] bg-[#E5E7EB] mb-8" />
          
          {/* Question */}
          <Text className="text-[28px] leading-[36px] font-bold text-[#111827] text-center mb-3">
            How was your time with God?
          </Text>
          
          {/* Subtitle */}
          <Text className="text-[15px] leading-[22px] text-[#6B7280] text-center mb-8">
            Take a moment to capture what stood out.
          </Text>
          
          {/* Star Rating */}
          <View className="flex-row justify-center gap-3 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon
                  icon={Star}
                  size={44}
                  color={star <= rating ? '#FACC15' : '#D1D5DB'}
                  fill={star <= rating ? '#FACC15' : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Journal Notes Section */}
        <View>
          {/* Section Header with Detected Tag */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={Pencil} size={14} color="#374151" />
              <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151]">
                Journal Notes
              </Text>
            </View>
            
            {/* Detected Reference Badge */}
            <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF]">
              <View className="w-3.5 h-4 rounded-[2px] border border-[#2563EB] items-center justify-center">
                <View className="w-1.5 h-[1px] bg-[#2563EB]" />
              </View>
              <Text className="text-[11px] font-semibold text-[#2563EB]">
                Detected: Romans 8 (YouVersion)
              </Text>
            </View>
          </View>
          
          {/* Divider - full width, solid */}
          <View className="h-[1px] bg-[#E5E7EB] mb-4" />
          
          {/* Text Input Area */}
          <View className="bg-[#F3F4F6] rounded-2xl p-4 min-h-[120px]">
            <TextInput
              className="flex-1 text-[16px] text-[#374151]"
              placeholder="Type, speak, or drop a link..."
              placeholderTextColor="#9CA3AF"
              multiline
              value={journalText}
              onChangeText={setJournalText}
              style={{ textAlignVertical: 'top' }}
            />
            
            {/* Input Actions */}
            <View className="flex-row justify-end gap-3 mt-4">
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E5E7EB]"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon icon={Mic} size={18} color="#6B7280" />
              </Pressable>
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E5E7EB]"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon icon={Link2} size={18} color="#6B7280" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <BottomToolbar />
    </View>
  );
};






