import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Navigation, Clock, MapPin, Send } from 'lucide-react-native';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoTrafficAccident - Accident alert with alternate route for demo mode
 * 
 * Shows a "wrap up meeting" alert about traffic accident and alternate route.
 * Includes map visualization with accident marker and new route.
 * Follows home page golden standard for spacing and typography.
 */
export const DemoTrafficAccident = () => {
  const insets = useSafeAreaInsets();

  // Use monospace font for timer
  const timerFontFamily = Platform.select({
    ios: 'Menlo-Bold',
    android: 'monospace',
    default: 'monospace',
  });

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
    >
      <View className="flex-1 px-6">
        {/* Header - matches Greeting: mt-1 mb-4 */}
        <View className="mt-1 mb-4">
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            Wrap up,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            Paul.
          </Text>
        </View>

        {/* Message - matches DailyBrief: mt-3.5 mb-5 */}
        <View className="mt-3.5 mb-4">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            There's an accident ahead and traffic is backed up. You'll need to take an alternate route home.
          </Text>
        </View>

        {/* Alert Banner - Blue themed */}
        <View 
          className="flex-row items-center gap-3 bg-[#EFF6FF] rounded-xl px-4 py-3 mb-4 border border-[#DBEAFE]"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE]">
            <Icon icon={Send} size={20} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-[14px] font-bold text-[#1E40AF]">
              Sending you the updated route
            </Text>
            <Text className="text-[13px] text-[#3B82F6]">
              to avoid the accident
            </Text>
          </View>
        </View>

        {/* Map Card */}
        <View className="bg-[#EBF0F5] rounded-2xl overflow-hidden border border-[#D4DDE8] mb-4">
          {/* Accident Badge */}
          <View 
            className="absolute top-3 left-3 z-10 flex-row items-center gap-2 bg-white px-3 py-2 rounded-full"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <Icon icon={AlertTriangle} size={14} color="#EF4444" />
            <Text className="text-[13px] font-semibold text-[#111827]">
              Accident on Highway 101
            </Text>
          </View>

          {/* SVG Map */}
          <View className="h-44">
            <Svg width="100%" height="100%" viewBox="0 0 350 180">
              {/* Map background elements */}
              {/* Park areas - muted blue-gray */}
              <Rect x="20" y="20" width="50" height="45" fill="#D1DBE8" rx="3" />
              <Rect x="280" y="100" width="55" height="50" fill="#D1DBE8" rx="3" />
              <Circle cx="180" cy="150" r="22" fill="#D1DBE8" />

              {/* Street grid - main roads */}
              <G>
                {/* Major horizontal roads */}
                <Path d="M 0 50 L 350 50" stroke="#FFFFFF" strokeWidth="12" />
                <Path d="M 0 100 L 350 100" stroke="#FFFFFF" strokeWidth="14" />
                <Path d="M 0 145 L 350 145" stroke="#FFFFFF" strokeWidth="10" />
                
                {/* Major vertical roads */}
                <Path d="M 60 0 L 60 180" stroke="#FFFFFF" strokeWidth="10" />
                <Path d="M 140 0 L 140 180" stroke="#FFFFFF" strokeWidth="10" />
                <Path d="M 220 0 L 220 180" stroke="#FFFFFF" strokeWidth="12" />
                <Path d="M 300 0 L 300 180" stroke="#FFFFFF" strokeWidth="10" />
              </G>
              
              {/* Road outlines for depth */}
              <G opacity={0.15}>
                <Path d="M 0 50 L 350 50" stroke="#666" strokeWidth="12" />
                <Path d="M 0 100 L 350 100" stroke="#666" strokeWidth="14" />
                <Path d="M 0 145 L 350 145" stroke="#666" strokeWidth="10" />
                <Path d="M 60 0 L 60 180" stroke="#666" strokeWidth="10" />
                <Path d="M 140 0 L 140 180" stroke="#666" strokeWidth="10" />
                <Path d="M 220 0 L 220 180" stroke="#666" strokeWidth="12" />
                <Path d="M 300 0 L 300 180" stroke="#666" strokeWidth="10" />
              </G>

              {/* OLD ROUTE - Crossed out / Red */}
              <Path
                d="M 60 160 L 60 100 L 180 100"
                stroke="#EF4444"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8,8"
                opacity={0.6}
              />

              {/* NEW ROUTE - Blue alternate route */}
              <Path
                d="M 60 160 L 60 145 L 140 145 L 140 50 L 220 50 L 220 100 L 300 100"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Start marker - Blue dot */}
              <Circle cx="60" cy="160" r="10" fill="#2563EB" />
              <Circle cx="60" cy="160" r="6" fill="#FFFFFF" />
              <Circle cx="60" cy="160" r="4" fill="#2563EB" />
              
              {/* Destination marker - Blue pin */}
              <Path
                d="M 290 85 C 290 75 300 68 300 68 C 300 68 310 75 310 85 C 310 92 300 102 300 102 C 300 102 290 92 290 85 Z"
                fill="#2563EB"
              />
              <Circle cx="300" cy="84" r="4" fill="#FFFFFF" />
            </Svg>

            {/* Accident warning icon - positioned on the old route */}
            <View 
              className="absolute items-center justify-center"
              style={{ 
                top: 78,
                left: 115,
              }}
            >
              <View 
                className="h-7 w-7 items-center justify-center rounded-full bg-[#EF4444]"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Text className="text-white font-bold text-[12px]">!</Text>
              </View>
            </View>

            {/* New Route badge - Blue */}
            <View 
              className="absolute flex-row items-center gap-1.5 bg-[#2563EB] px-2.5 py-1.5 rounded-md"
              style={{ 
                top: 25,
                left: 165,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text className="text-white font-bold text-[12px]">+8 min</Text>
              <View className="h-3 w-px bg-white/50" />
              <Text className="text-white/90 text-[11px]">new route</Text>
            </View>
          </View>
        </View>

        {/* Time Estimate Cards */}
        <View className="flex-row gap-3 mb-4">
          {/* New ETA */}
          <View className="flex-1 bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB]">
            <View className="flex-row items-center gap-2 mb-2">
              <Icon icon={Clock} size={16} color="#2563EB" />
              <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]">
                New ETA
              </Text>
            </View>
            <Text 
              style={{ 
                fontFamily: timerFontFamily,
                fontSize: 28, 
                color: '#2563EB',
                letterSpacing: -0.5,
              }}
            >
              6:23 PM
            </Text>
          </View>

          {/* Distance */}
          <View className="flex-1 bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB]">
            <View className="flex-row items-center gap-2 mb-2">
              <Icon icon={MapPin} size={16} color="#2563EB" />
              <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7280]">
                Distance
              </Text>
            </View>
            <Text 
              style={{ 
                fontFamily: timerFontFamily,
                fontSize: 28, 
                color: '#2563EB',
                letterSpacing: -0.5,
              }}
            >
              12.4 mi
            </Text>
          </View>
        </View>

        {/* Start Navigation Button - Blue */}
        <Pressable
          className="flex-row items-center justify-center gap-3 bg-[#2563EB] rounded-2xl px-5 py-4"
          style={({ pressed }) => ({ 
            opacity: pressed ? 0.9 : 1,
            shadowColor: '#2563EB',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          })}
        >
          <Icon icon={Navigation} size={22} color="#FFFFFF" />
          <Text className="text-[17px] font-bold text-white">
            Start New Route
          </Text>
        </Pressable>
      </View>

      <BottomToolbar />
    </View>
  );
};



