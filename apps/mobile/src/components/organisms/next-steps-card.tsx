import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import type { NextStepsContent } from "@/types/home";

interface NextStepsCardProps {
  nextSteps: NextStepsContent;
}

export function NextStepsCard({ nextSteps }: NextStepsCardProps) {
  return (
    <View
      className="rounded-[18px] border border-[#e4e8fb] bg-white px-5 py-5"
      style={{
        shadowColor: "#c0c8ee",
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold tracking-[0.04em] text-gray-900">
          {nextSteps.sectionTitle}
        </Text>
        <View className="h-9 w-9 items-center justify-center rounded-full border border-[#cdd4f4] bg-[#f7f9ff]">
          <Feather name="plus" size={15} color="#1e3a8a" />
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-3 rounded-[14px] bg-[#f8f9ff] px-3 py-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white">
          <Feather name="video" size={15} color="#1e3a8a" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-semibold text-gray-900" style={{ lineHeight: 20 }}>
              {nextSteps.event.title}
            </Text>
            <Text className="ml-2 text-[12px] font-medium text-[#8a8fa7]">
              {nextSteps.event.timeUntil}
            </Text>
          </View>
          <Text className="text-[13px] text-gray-500" style={{ lineHeight: 18 }}>
            {nextSteps.event.attendees}
          </Text>
          <Text className="text-[13px] text-gray-500" style={{ lineHeight: 18 }}>
            {nextSteps.event.statusDetail}
          </Text>
        </View>
      </View>

      <Text className="mt-4 text-[13px] text-gray-600" style={{ lineHeight: 18 }}>
        {nextSteps.reminder}
      </Text>

      <View
        className="mt-3 flex-row items-center justify-between rounded-[14px] border border-[#d4dbff] px-4"
        style={{ backgroundColor: "rgba(50,90,255,0.05)", height: 48 }}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-xl border border-[#cdd7ff] bg-white">
            <Feather name="calendar" size={14} color="#1e40af" />
          </View>
          <Text className="text-[14px] font-semibold text-blue-900">
            {nextSteps.buttonLabel}
          </Text>
        </View>
        <Feather name="arrow-right" size={12} color="#1e40af" />
      </View>

      <View className="mt-4 gap-2">
        {nextSteps.suggestions.map((suggestion) => (
          <View key={suggestion.id} className="flex-row items-start gap-2">
            <Feather name="zap" size={12} color="#f7b731" style={{ opacity: 0.7 }} />
            <Text
              className="flex-1 text-[13px] font-medium text-gray-600"
              style={{ lineHeight: 18 }}
            >
              {suggestion.text}
            </Text>
          </View>
        ))}
      </View>

      <View
        className="mt-4 overflow-hidden rounded-[16px]"
        style={{
          shadowColor: "#0c3da6",
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 10 },
        }}
      >
        <View className="absolute inset-0 bg-[#1a67ff]" />
        <View
          className="absolute inset-y-0 left-0 w-1/2"
          style={{ backgroundColor: "#1ec6ff", opacity: 0.55 }}
        />
        <View className="relative flex-row items-center justify-between px-5 py-4">
          <View>
            <Text className="text-[15px] font-semibold text-white">
              {nextSteps.actionCardTitle}
            </Text>
            <Text className="text-[13px] text-blue-50">{nextSteps.actionCardSubtitle}</Text>
          </View>
          <Feather name="chevron-down" size={15} color="#ffffff" style={{ marginRight: 4 }} />
        </View>
      </View>
    </View>
  );
}
