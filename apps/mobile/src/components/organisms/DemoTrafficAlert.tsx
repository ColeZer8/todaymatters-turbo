import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Navigation } from 'lucide-react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';

/**
 * DemoTrafficAlert - Traffic/departure reminder screen for demo mode
 * 
 * Shows the proactive traffic alert when user needs to leave for an event.
 * Spacing matches HomeTemplate exactly.
 */
export const DemoTrafficAlert = () => {
  const insets = useSafeAreaInsets();

  // Use monospace font with slashed zeros
  const timerFontFamily = Platform.select({
    ios: 'Menlo-Bold',
    android: 'monospace',
    default: 'monospace',
  });

  const timerColonFontFamily = Platform.select({
    ios: 'Menlo',
    android: 'monospace', 
    default: 'monospace',
  });

  return (
    <View
      className="flex-1 bg-[#F7FAFF]"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
    >
      <View className="flex-1 px-6">
        {/* Greeting - matches Greeting component: mt-1 mb-4 */}
        <View className="mt-1 mb-4">
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
            Head's up,
          </Text>
          <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
            Paul.
          </Text>
        </View>

        {/* Message - matches DailyBrief: mt-3.5 mb-5 */}
        <View className="mt-3.5 mb-5">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            You need to leave the office in 5 minutes and take a different route home if you're going to be home in time for dinner with your family.
          </Text>
        </View>

        {/* Map Card */}
        <View className="bg-[#F0F5F0] rounded-2xl overflow-hidden border border-[#E0E8E0] mb-4">
          {/* Accident Badge */}
          <View 
            className="absolute top-3 left-3 z-10 flex-row items-center gap-2 bg-white px-3 py-2 rounded-full"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <View className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
            <Text className="text-[13px] font-semibold text-[#111827]">
              Accident on I-40 W
            </Text>
          </View>

          {/* SVG Map */}
          <View className="h-56">
            <Svg width="100%" height="100%" viewBox="0 0 350 220">
              {/* Grid pattern - horizontal roads */}
              <Path d="M 0 60 L 350 60" stroke="#D8E0D8" strokeWidth="1.5" fill="none" />
              <Path d="M 0 120 L 350 120" stroke="#D8E0D8" strokeWidth="1.5" fill="none" />
              <Path d="M 0 180 L 350 180" stroke="#D8E0D8" strokeWidth="1.5" fill="none" />
              
              {/* Grid pattern - vertical roads */}
              <Path d="M 70 0 L 70 220" stroke="#D8E0D8" strokeWidth="1.5" fill="none" />
              <Path d="M 140 0 L 140 220" stroke="#D8E0D8" strokeWidth="1.5" fill="none" />
              <Path d="M 210 0 L 210 220" stroke="#D8E0D8" strokeWidth="1.5" fill="none" />
              <Path d="M 280 0 L 280 220" stroke="#D8E0D8" strokeWidth="1.5" fill="none" />
              
              {/* Background curved road (gray) */}
              <Path
                d="M 0 190 Q 80 180 120 150 Q 180 100 240 70 Q 300 40 350 30"
                stroke="#C5CEC5"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              
              {/* Yellow toll route - branches off near the accident and goes to destination */}
              <Path
                d="M 180 120 Q 220 140 260 120 Q 290 100 295 65"
                stroke="#F5B041"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
              
              {/* Main route - blue portion (before accident) */}
              <Path
                d="M 50 195 Q 80 185 110 165 Q 140 140 160 125"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              
              {/* Red portion (accident area) */}
              <Path
                d="M 160 125 Q 180 115 200 105"
                stroke="#EF4444"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              
              {/* Main route - blue portion (after accident to destination) */}
              <Path
                d="M 200 105 Q 240 85 270 70 Q 290 60 295 55"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />

              {/* Start point - hollow white circle */}
              <Circle cx="50" cy="195" r="8" fill="white" stroke="#374151" strokeWidth="2.5" />
              
              {/* Destination - red pin style */}
              <Circle cx="295" cy="55" r="10" fill="#EF4444" stroke="white" strokeWidth="2.5" />
              <Circle cx="295" cy="55" r="4" fill="white" />
            </Svg>

            {/* Accident Marker - warning triangle */}
            <View 
              className="absolute h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#EF4444]"
              style={{ 
                top: '46%', 
                left: '44%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View 
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 7,
                  borderRightWidth: 7,
                  borderBottomWidth: 12,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderBottomColor: '#EF4444',
                }}
              />
            </View>

            {/* Time/Tolls badge */}
            <View 
              className="absolute bg-[#2563EB] px-3 py-2 rounded-lg items-center"
              style={{ 
                top: '42%', 
                right: '12%',
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text className="text-white font-bold text-[14px]">32 min</Text>
              <Text className="text-white/70 text-[11px]">Tolls</Text>
            </View>
          </View>
        </View>

        {/* Departure Timer Card */}
        <View className="bg-[#FEF2F2] rounded-2xl px-5 py-4 border border-[#FECACA]">
          {/* Header Row */}
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-2">
              <Icon icon={Clock} size={18} color="#991B1B" />
              <Text className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#991B1B]">
                Departure Timer
              </Text>
            </View>
            <View className="bg-[#FEE2E2] px-3 py-1.5 rounded-full border border-[#FECACA]">
              <Text className="text-[12px] font-bold text-[#DC2626]">
                Critical
              </Text>
            </View>
          </View>

          {/* Timer and Button Row */}
          <View className="flex-row items-center justify-between">
            <View>
              {/* Timer with slashed zeros using monospace font */}
              <View className="flex-row items-baseline">
                <Text 
                  style={{ 
                    fontFamily: timerFontFamily,
                    fontSize: 52, 
                    color: '#0F172A',
                    letterSpacing: -1,
                  }}
                >
                  05
                </Text>
                <Text 
                  style={{ 
                    fontFamily: timerColonFontFamily,
                    fontSize: 52, 
                    color: '#0F172A',
                    marginHorizontal: 1,
                  }}
                >
                  :
                </Text>
                <Text 
                  style={{ 
                    fontFamily: timerFontFamily,
                    fontSize: 52, 
                    color: '#0F172A',
                    letterSpacing: -1,
                  }}
                >
                  00
                </Text>
              </View>
              <Text className="text-[14px] text-[#DC2626] font-medium -mt-2">
                Minutes until you must leave
              </Text>
            </View>

            {/* Start Button */}
            <Pressable
              className="flex-row items-center gap-2 bg-[#2563EB] px-5 py-3.5 rounded-xl"
              style={({ pressed }) => ({ 
                opacity: pressed ? 0.9 : 1,
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <Icon icon={Navigation} size={18} color="#FFFFFF" />
              <Text className="text-[16px] font-bold text-white">
                Start
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <BottomToolbar />
    </View>
  );
};
