import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import type { HeaderAction, HeroContent } from "@/types/home";
import { Avatar } from "../atoms";

interface HeroActionBarProps {
  hero: HeroContent;
}

const iconMap: Record<HeaderAction["icon"], React.ReactNode> = {
  search: <Feather name="search" size={18} color="#1d4ed8" />,
  bell: <Feather name="bell" size={18} color="#1d4ed8" />,
  zap: <Feather name="zap" size={18} color="#1d4ed8" />,
  users: <Feather name="users" size={18} color="#1d4ed8" />,
  gift: <Feather name="gift" size={18} color="#1d4ed8" />,
  calendar: <Feather name="calendar" size={18} color="#1d4ed8" />,
  "share-2": <Feather name="share-2" size={18} color="#1d4ed8" />,
  user: <Feather name="user" size={18} color="#1d4ed8" />,
};

export function HeroActionBar({ hero }: HeroActionBarProps) {
  return (
    <View
      className="overflow-hidden"
      style={{
        shadowColor: "#cfd7fa",
        shadowOpacity: 0.4,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      <View className="absolute inset-0 bg-white/92" />
      <View className="absolute inset-0 opacity-60" style={{ backgroundColor: "#dfe7ff" }} />
      <View className="absolute inset-x-6 -bottom-8 h-12 rounded-full bg-white/40" />
      <View className="relative px-5 pt-7 pb-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Avatar
              name={hero.avatarName}
              size={48}
              className="border border-[#d7dcff] bg-[#e9edff]"
              textClassName="text-[#1d4ed8]"
            />
            <View>
              <Text className="text-lg font-semibold text-gray-900">{hero.title}</Text>
              <Text className="text-[12px] font-medium text-[#7c87b3]">{hero.timestamp}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1">
            {hero.actions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function ActionButton({ action }: { action: HeaderAction }) {
  return (
    <View className="relative">
      <View className="h-10 w-10 items-center justify-center rounded-[14px] border border-[#d6defc] bg-white/75">
        {React.cloneElement(iconMap[action.icon], { size: 15 })}
      </View>
      {action.badge ? (
        <View className="absolute -top-1 -right-1 min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#0f6bff] px-1">
          <Text className="text-[10px] font-bold text-white">{action.badge}</Text>
        </View>
      ) : null}
    </View>
  );
}
