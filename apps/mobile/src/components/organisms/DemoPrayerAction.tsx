import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, Play } from 'lucide-react-native';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoPrayerAction - Prayer/devotional action screen for demo mode
 * 
 * Shows the proactive prayer reminder with verse of the day.
 * Follows home page golden standard for spacing and typography.
 */
export const DemoPrayerAction = () => {
  const insets = useSafeAreaInsets();

  // Use serif font for scripture quote
  const serifFont = Platform.select({
    ios: 'Georgia-Italic',
    android: 'serif',
    default: 'serif',
  });

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
    >
      <View className="flex-1 px-6">
        {/* Header - matches Greeting: mt-1 mb-4 */}
        <View className="mt-1 mb-4">
          <Text className="text-[38px] leading-[42px] font-extrabold">
            <Text className="text-[#111827]">Action: </Text>
            <Text className="text-[#2563EB]">Prayer.</Text>
          </Text>
        </View>

        {/* Subtitle - matches DailyBrief: mt-3.5 with font-bold text-[#4A5568] */}
        <View className="mt-3.5 mb-20">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            It's a perfect time for prayer & reflection.
          </Text>
        </View>

        {/* Verse of the Day Section */}
        <View className="mb-12">
          {/* Section Header */}
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-2">
            Verse of the Day
          </Text>
          
          {/* Divider - full width, solid */}
          <View className="h-[1px] bg-[#E5E7EB] mb-8" />
          
          {/* Scripture Quote - Serif Italic, darker color */}
          <Text 
            style={{ 
              fontFamily: serifFont,
              fontSize: 26,
              lineHeight: 42,
              color: '#374151',
              fontStyle: 'italic',
              marginBottom: 24,
            }}
          >
            "Trust in the Lord with all your heart and lean not on your own understanding."
          </Text>
          
          {/* Reference */}
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-[2px] bg-[#2563EB]" />
            <Text className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
              Proverbs 3:5-6
            </Text>
          </View>
        </View>

        {/* Open In Section */}
        <View className="mt-8">
          {/* Section Header */}
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151] mb-2">
            Open In
          </Text>
          
          {/* Divider - full width, solid */}
          <View className="h-[1px] bg-[#E5E7EB] mb-6" />
          
          {/* YouVersion Card */}
          <Pressable
            className="flex-row items-center py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {/* Icon */}
            <View className="h-14 w-14 rounded-2xl bg-[#6366F1] items-center justify-center mr-4">
              <Icon icon={BookOpen} size={26} color="#FFFFFF" />
            </View>
            
            {/* Text */}
            <View className="flex-1">
              <Text className="text-[17px] font-bold text-[#111827] mb-0.5">
                YouVersion & Prayer
              </Text>
              <Text className="text-[14px] text-[#6B7280]">
                Read Plan + Start Focus Timer
              </Text>
            </View>
            
            {/* Arrow - filled */}
            <View className="ml-2">
              <Icon icon={Play} size={20} color="#2563EB" fill="#2563EB" />
            </View>
          </Pressable>
          
          {/* Bottom Divider */}
          <View className="h-[1px] bg-[#E5E7EB] mt-6" />
        </View>
      </View>

      <BottomToolbar />
    </View>
  );
};
