import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import type { BigThreeItem } from "@/types/home";

interface BigThreeCardProps {
  items: BigThreeItem[];
}

export function BigThreeCard({ items }: BigThreeCardProps) {
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
      <Text className="text-lg font-semibold text-gray-900">Big 3</Text>
      <Text className="mt-1 text-[13px] text-gray-500">Your top priorities for today</Text>
      <View className="mt-3 gap-3">
        {items.map((item, index) => (
          <View
            key={item.id}
            className={`flex-row items-center justify-between rounded-[14px] px-3 py-3 ${
              item.status === "completed" ? "bg-[#eff4ff]" : "bg-white"
            }`}
          >
            <View className="flex-row items-center gap-3 flex-1">
              <View className="h-8 w-8 items-center justify-center rounded-full border border-[#cdd4f4] bg-white">
                <Text className="text-[13px] font-semibold text-[#4f6dff]">{index + 1}</Text>
              </View>
              <View className="flex-1">
                <Text
                  className={`text-[14px] ${
                    item.status === "completed" ? "text-gray-500 line-through" : "text-gray-900"
                  }`}
                >
                  {item.title}
                </Text>
              </View>
            </View>
            {item.status === "completed" ? (
              <Feather name="check-circle" size={18} color="#2ecc71" />
            ) : (
              <Feather name="x" size={16} color="#c4c8da" />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
