import React, { useState } from "react";
import { GestureResponderEvent, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import type { VerseContent } from "@/types/home";

interface VerseCardProps {
  verse: VerseContent;
}

export function VerseCard({ verse }: VerseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
    if (expanded) {
      setShowFull(false);
    }
  };

  const handleKeepReading = (event: GestureResponderEvent) => {
    event.stopPropagation();
    setShowFull(true);
  };

  return (
    <Pressable
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityLabel="Toggle verse details"
      className="overflow-hidden rounded-[18px] border border-[#4d6fff]"
      style={{
        shadowColor: "#1b3ec3",
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 12 },
      }}
    >
      <View style={{ backgroundColor: "#1c48e6" }}>
        <View
          style={{
            position: "absolute",
            top: -40,
            left: -20,
            right: -20,
            height: "75%",
            backgroundColor: "#3a66ff",
            opacity: 0.85,
          }}
        />
        <View className="relative px-4 pt-4 pb-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              <View className="h-11 w-11 items-center justify-center rounded-[16px] border border-white/35 bg-white/15">
                <Feather name="book" size={18} color="#ffffff" />
              </View>
              <View>
                <Text className="text-[17px] font-semibold text-white">{verse.title}</Text>
                <Text className="text-[13px] text-blue-100">{verse.reference}</Text>
              </View>
            </View>
            <Feather name="bookmark" size={16} color="#ffffff" style={{ marginRight: -4 }} />
          </View>
          {expanded ? (
            <>
              <Text className="mt-3 text-white" style={{ fontSize: 15, lineHeight: 20 }}>
                {verse.highlight}
              </Text>
              {showFull && verse.fullText ? (
                <Text className="mt-3 text-white" style={{ fontSize: 14, lineHeight: 20 }}>
                  {verse.fullText}
                </Text>
              ) : verse.fullText ? (
                <Pressable
                  onPress={handleKeepReading}
                  accessibilityRole="button"
                  accessibilityLabel="Keep reading full verse"
                >
                  <Text className="mt-3 text-[13px] font-semibold text-blue-200 text-right">
                    Keep reading
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-[13px] text-blue-100">Tap to view today&apos;s verse</Text>
              <Feather name="chevron-down" size={16} color="#ffffff" />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
