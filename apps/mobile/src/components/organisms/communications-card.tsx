import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import type { CommunicationItem } from "@/types/home";

interface CommunicationsCardProps {
  items: CommunicationItem[];
}

export function CommunicationsCard({ items }: CommunicationsCardProps) {
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
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-semibold text-gray-900">Communications</Text>
          <Text className="text-[13px] text-gray-500">
            {items.length} items need your attention
          </Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-full border border-[#cdd4f4] bg-[#f7f9ff]">
          <Feather name="plus" size={15} color="#1e3a8a" />
        </View>
      </View>
      <View className="mt-4 gap-3">
        {items.map((item) => (
          <View
            key={item.id}
            className="flex-row items-center justify-between rounded-[12px] bg-[#f8fbff] px-3 py-3"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#d8ffe4]">
                <Feather name="mail" size={16} color="#0f8a4c" />
              </View>
              <View>
                <Text className="text-[14px] font-semibold text-gray-900">{item.sender}</Text>
                <Text className="text-[13px] text-gray-500">{item.subject}</Text>
              </View>
            </View>
            <Text className="text-[12px] text-[#8a8fa7]">{item.timeAgo}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
