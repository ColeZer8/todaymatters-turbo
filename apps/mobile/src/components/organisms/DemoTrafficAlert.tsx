import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Navigation } from 'lucide-react-native';
import Svg, { Path, Circle, G, Rect, Polygon } from 'react-native-svg';
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
        <View className="bg-[#E9F0E9] rounded-2xl overflow-hidden border border-[#D4DDD4] mb-4">
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
            <View className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
            <Text className="text-[13px] font-semibold text-[#111827]">
              Accident on I-40 W
            </Text>
          </View>

          {/* SVG Map */}
          <View className="h-52">
            <Svg width="100%" height="100%" viewBox="0 0 350 210">
              {/* Map background elements */}
              {/* Light blue water area in bottom left */}
              <Rect x="0" y="170" width="60" height="40" fill="#D4E8F2" opacity={0.6} />
              
              {/* Green park areas */}
              <Rect x="200" y="20" width="50" height="35" fill="#D8E8D8" rx="4" />
              <Rect x="120" y="155" width="45" height="35" fill="#D8E8D8" rx="4" />

              {/* Street grid */}
              <G opacity={0.4}>
                {/* Horizontal streets */}
                <Path d="M 0 55 L 350 55" stroke="#C0CCC0" strokeWidth="8" />
                <Path d="M 0 110 L 350 110" stroke="#C0CCC0" strokeWidth="8" />
                <Path d="M 0 160 L 350 160" stroke="#C0CCC0" strokeWidth="8" />
                
                {/* Vertical streets */}
                <Path d="M 70 0 L 70 210" stroke="#C0CCC0" strokeWidth="8" />
                <Path d="M 140 0 L 140 210" stroke="#C0CCC0" strokeWidth="8" />
                <Path d="M 210 0 L 210 210" stroke="#C0CCC0" strokeWidth="8" />
                <Path d="M 280 0 L 280 210" stroke="#C0CCC0" strokeWidth="8" />
              </G>
              
              {/* Thinner street lines on top */}
              <G opacity={0.25}>
                <Path d="M 0 55 L 350 55" stroke="#A0ACA0" strokeWidth="1" />
                <Path d="M 0 110 L 350 110" stroke="#A0ACA0" strokeWidth="1" />
                <Path d="M 0 160 L 350 160" stroke="#A0ACA0" strokeWidth="1" />
                <Path d="M 70 0 L 70 210" stroke="#A0ACA0" strokeWidth="1" />
                <Path d="M 140 0 L 140 210" stroke="#A0ACA0" strokeWidth="1" />
                <Path d="M 210 0 L 210 210" stroke="#A0ACA0" strokeWidth="1" />
                <Path d="M 280 0 L 280 210" stroke="#A0ACA0" strokeWidth="1" />
              </G>

              {/* === TOLL ROUTE (yellow) - follows streets === */}
              {/* Down from junction, right along bottom street, then up */}
              <Path
                d="M 210 110 L 210 160 L 280 160 L 280 55 L 295 55"
                stroke="#F5B740"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* === MAIN BLUE ROUTE === */}
              {/* Start point to first turn */}
              <Path
                d="M 55 175 L 55 160 L 70 160"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Continue along street, then turn up */}
              <Path
                d="M 70 160 L 140 160 L 140 110"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Turn right on horizontal street */}
              <Path
                d="M 140 110 L 165 110"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* RED ACCIDENT SECTION */}
              <Path
                d="M 165 110 L 210 110"
                stroke="#DC2626"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Continue blue after accident, go up */}
              <Path
                d="M 210 110 L 210 55"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Turn right to destination */}
              <Path
                d="M 210 55 L 295 55"
                stroke="#2563EB"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Start marker with arrow pointing up (direction of travel) */}
              <Circle cx="55" cy="175" r="8" fill="white" stroke="#374151" strokeWidth="2.5" />
              {/* Arrow pointing up inside the circle */}
              <Polygon 
                points="55,169 51,174 53,174 53,179 57,179 57,174 59,174"
                fill="#374151"
              />
              
              {/* Destination marker */}
              <Circle cx="295" cy="55" r="9" fill="#EF4444" stroke="white" strokeWidth="2.5" />
              <Circle cx="295" cy="55" r="3.5" fill="white" />
            </Svg>

            {/* Accident Marker - on the red section */}
            <View 
              className="absolute h-9 w-9 items-center justify-center rounded-full bg-white border-2 border-[#DC2626]"
              style={{ 
                top: 100,
                left: 175,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View 
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 6,
                  borderRightWidth: 6,
                  borderBottomWidth: 11,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderBottomColor: '#DC2626',
                }}
              />
            </View>

            {/* Time/Tolls badge */}
            <View 
              className="absolute bg-[#2563EB] px-3 py-1.5 rounded-lg items-center"
              style={{ 
                top: 120,
                right: 30,
                shadowColor: '#1D4ED8',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text className="text-white font-bold text-[13px]">32 min</Text>
              <Text className="text-white/80 text-[10px]">Tolls</Text>
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
