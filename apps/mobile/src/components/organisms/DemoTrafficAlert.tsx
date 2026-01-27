import { View, Text, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, Navigation } from "lucide-react-native";
import Svg, { Path, Circle, G, Rect } from "react-native-svg";
import { Icon } from "@/components/atoms";
import { BottomToolbar } from "./BottomToolbar";

/**
 * DemoTrafficAlert - Traffic/departure reminder screen for demo mode
 *
 * Shows the proactive traffic alert when user needs to leave for an event.
 * Spacing matches HomeTemplate exactly.
 */
export const DemoTrafficAlert = ({
  userName = "Paul",
}: {
  userName?: string;
}) => {
  const insets = useSafeAreaInsets();

  // Use monospace font with slashed zeros
  const timerFontFamily = Platform.select({
    ios: "Menlo-Bold",
    android: "monospace",
    default: "monospace",
  });

  const timerColonFontFamily = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
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
            {userName}.
          </Text>
        </View>

        {/* Message - matches DailyBrief: mt-3.5 mb-5 */}
        <View className="mt-3.5 mb-5">
          <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
            You need to leave the office in 5 minutes and take a different route
            home if you're going to be home in time for dinner with your family.
          </Text>
        </View>

        {/* Map Card */}
        <View className="bg-[#E9F0E9] rounded-2xl overflow-hidden border border-[#D4DDD4] mb-4">
          {/* Accident Badge */}
          <View
            className="absolute top-3 left-3 z-10 flex-row items-center gap-2 bg-white px-3 py-2 rounded-full"
            style={{
              shadowColor: "#000",
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
              {/* Light blue water/river area */}
              <Path
                d="M 0 180 Q 40 160 80 185 Q 120 210 160 190 L 160 210 L 0 210 Z"
                fill="#C5DCE8"
                opacity={0.5}
              />

              {/* Green park areas */}
              <Rect
                x="260"
                y="130"
                width="55"
                height="40"
                fill="#C8E6C9"
                rx="3"
              />
              <Rect
                x="45"
                y="30"
                width="40"
                height="45"
                fill="#C8E6C9"
                rx="3"
              />
              <Circle cx="295" cy="85" r="18" fill="#C8E6C9" />

              {/* Street grid - main roads */}
              <G>
                {/* Major horizontal roads */}
                <Path d="M 0 60 L 350 60" stroke="#FFFFFF" strokeWidth="12" />
                <Path d="M 0 115 L 350 115" stroke="#FFFFFF" strokeWidth="14" />
                <Path d="M 0 165 L 200 165" stroke="#FFFFFF" strokeWidth="10" />

                {/* Major vertical roads */}
                <Path d="M 55 0 L 55 210" stroke="#FFFFFF" strokeWidth="10" />
                <Path d="M 125 0 L 125 210" stroke="#FFFFFF" strokeWidth="10" />
                <Path
                  d="M 200 60 L 200 210"
                  stroke="#FFFFFF"
                  strokeWidth="12"
                />
                <Path d="M 280 0 L 280 180" stroke="#FFFFFF" strokeWidth="10" />
              </G>

              {/* Road outlines for depth */}
              <G opacity={0.15}>
                <Path d="M 0 60 L 350 60" stroke="#666" strokeWidth="12" />
                <Path d="M 0 115 L 350 115" stroke="#666" strokeWidth="14" />
                <Path d="M 0 165 L 200 165" stroke="#666" strokeWidth="10" />
                <Path d="M 55 0 L 55 210" stroke="#666" strokeWidth="10" />
                <Path d="M 125 0 L 125 210" stroke="#666" strokeWidth="10" />
                <Path d="M 200 60 L 200 210" stroke="#666" strokeWidth="12" />
                <Path d="M 280 0 L 280 180" stroke="#666" strokeWidth="10" />
              </G>

              {/* === MAIN ROUTE with traffic === */}
              {/* Route shadow for depth */}
              <Path
                d="M 55 185 L 55 165 L 125 165 L 125 115 L 200 115 L 200 60 L 310 60"
                stroke="#1E40AF"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.3}
              />

              {/* Blue route - start to before accident */}
              <Path
                d="M 55 185 L 55 165 L 125 165 L 125 115 L 155 115"
                stroke="#4285F4"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* RED - Traffic/accident section on I-40 */}
              <Path
                d="M 155 115 L 200 115"
                stroke="#EA4335"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Blue route - after accident to destination */}
              <Path
                d="M 200 115 L 200 60 L 310 60"
                stroke="#4285F4"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Start marker - Google Maps style blue dot */}
              <Circle cx="55" cy="185" r="10" fill="#4285F4" />
              <Circle cx="55" cy="185" r="6" fill="#FFFFFF" />
              <Circle cx="55" cy="185" r="4" fill="#4285F4" />

              {/* Destination marker - Google Maps style red pin */}
              {/* Pin body */}
              <Path
                d="M 310 45 C 310 35 320 28 320 28 C 320 28 330 35 330 45 C 330 52 320 62 320 62 C 320 62 310 52 310 45 Z"
                fill="#EA4335"
              />
              {/* Pin inner circle */}
              <Circle cx="320" cy="44" r="5" fill="#B31412" opacity={0.3} />
              <Circle cx="320" cy="44" r="4" fill="#FFFFFF" />
            </Svg>

            {/* Accident warning icon - positioned on the red section */}
            <View
              className="absolute items-center justify-center"
              style={{
                top: 94,
                left: 160,
              }}
            >
              <View
                className="h-8 w-8 items-center justify-center rounded-full bg-[#EA4335]"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Text className="text-white font-bold text-[14px]">!</Text>
              </View>
            </View>

            {/* Route time badge - positioned along route near destination */}
            <View
              className="absolute flex-row items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-md"
              style={{
                top: 68,
                left: 215,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text className="text-[#1F2937] font-bold text-[13px]">
                32 min
              </Text>
              <View className="h-3 w-px bg-[#D1D5DB]" />
              <Text className="text-[#6B7280] text-[11px]">fastest</Text>
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
                    color: "#0F172A",
                    letterSpacing: -1,
                  }}
                >
                  05
                </Text>
                <Text
                  style={{
                    fontFamily: timerColonFontFamily,
                    fontSize: 52,
                    color: "#0F172A",
                    marginHorizontal: 1,
                  }}
                >
                  :
                </Text>
                <Text
                  style={{
                    fontFamily: timerFontFamily,
                    fontSize: 52,
                    color: "#0F172A",
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
                shadowColor: "#2563EB",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <Icon icon={Navigation} size={18} color="#FFFFFF" />
              <Text className="text-[16px] font-bold text-white">Start</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <BottomToolbar />
    </View>
  );
};
