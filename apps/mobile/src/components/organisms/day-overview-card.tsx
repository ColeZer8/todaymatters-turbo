import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import type { DaySegment } from "@/types/home";

interface DayOverviewCardProps {
  segments: DaySegment[];
}

export function DayOverviewCard({ segments }: DayOverviewCardProps) {
  return (
    <View
      className="rounded-[18px] border border-[#e5e9fb] bg-white px-5 py-5"
      style={{
        shadowColor: "#c0c8ee",
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      <Text className="text-lg font-semibold text-gray-900">How Your Day Is Going</Text>
      <ScrollView
        className="mt-4"
        style={{ maxHeight: 260 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {segments.map((segment) => (
          <View key={segment.id} className="flex-row items-start gap-4">
            <View className="w-12">
              <Text className="text-[13px] font-semibold text-gray-900">{segment.time}</Text>
              {segment.status === "current" ? (
                <Text className="text-[12px] text-[#3d73ff]">• Now</Text>
              ) : (
                <Text className="text-[12px] text-gray-400">—</Text>
              )}
            </View>
            <View className="flex-1 rounded-[14px] bg-[#f5f7ff] px-3 py-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-1 rounded-full" style={{ backgroundColor: segment.accent }} />
                  <View>
                    <Text className="text-[14px] font-semibold text-gray-900">{segment.label}</Text>
                    <Text className="text-[12px] text-gray-500">{segment.duration}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color="#b0b6d1" />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
