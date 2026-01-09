import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, Mic, Link2, Pencil, Video } from 'lucide-react-native';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoMeetingRate - Meeting reflection rating screen for demo mode
 * 
 * Shows completion state after meeting with star rating and notes.
 * Follows home page golden standard for spacing and typography.
 */
export const DemoMeetingRate = ({ userName = 'Paul' }: { userName?: string }) => {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(4);
  const [notesText, setNotesText] = useState('');

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
            {userName}.
          </Text>
        </View>

        {/* Subtitle - matches DailyBrief: mt-3.5 */}
        <View className="mt-3.5 mb-8">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            Meeting complete.
          </Text>
        </View>

        {/* Meeting Reflection Section */}
        <View className="mb-8">
          {/* Section Header */}
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-2">
            Meeting Reflection
          </Text>
          
          {/* Divider - full width, solid */}
          <View className="h-[1px] bg-[#E5E7EB] mb-8" />
          
          {/* Question */}
          <Text className="text-[28px] leading-[36px] font-bold text-[#111827] text-center mb-3">
            How was your meeting?
          </Text>
          
          {/* Subtitle */}
          <Text className="text-[15px] leading-[22px] text-[#6B7280] text-center mb-8">
            Capture key takeaways and action items.
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

        {/* Meeting Notes Section */}
        <View>
          {/* Section Header with Meeting Badge */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Icon icon={Pencil} size={14} color="#374151" />
              <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151]">
                Meeting Notes
              </Text>
            </View>
            
            {/* Meeting Reference Badge */}
            <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF]">
              <Icon icon={Video} size={12} color="#2563EB" />
              <Text className="text-[11px] font-semibold text-[#2563EB]">
                Strategy Sync • 45 min
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
              value={notesText}
              onChangeText={setNotesText}
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






