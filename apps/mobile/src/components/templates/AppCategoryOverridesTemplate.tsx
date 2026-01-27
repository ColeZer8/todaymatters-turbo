import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { EventCategory } from "@/stores";

interface AppCategoryOverrideRow {
  appKey: string;
  appName: string | null;
  category: EventCategory;
  confidence: number;
  sampleCount: number;
}

interface AppCategoryOverridesTemplateProps {
  overrides: AppCategoryOverrideRow[];
  query: string;
  isLoading: boolean;
  onChangeQuery: (value: string) => void;
  onSelectCategory: (appKey: string, category: EventCategory) => void;
  onRemoveOverride: (appKey: string) => void;
}

const CATEGORY_OPTIONS: Array<{ id: EventCategory; label: string }> = [
  { id: "work", label: "Work" },
  { id: "digital", label: "Screen Time" },
  { id: "social", label: "Social" },
  { id: "meeting", label: "Meeting" },
  { id: "health", label: "Health" },
  { id: "family", label: "Family" },
  { id: "routine", label: "Routine" },
  { id: "travel", label: "Travel" },
  { id: "finance", label: "Finance" },
  { id: "comm", label: "Commute" },
  { id: "meal", label: "Meal" },
  { id: "free", label: "Free" },
  { id: "unknown", label: "Unknown" },
];

export const AppCategoryOverridesTemplate = ({
  overrides,
  query,
  isLoading,
  onChangeQuery,
  onSelectCategory,
  onRemoveOverride,
}: AppCategoryOverridesTemplateProps) => {
  const [activeOverride, setActiveOverride] =
    useState<AppCategoryOverrideRow | null>(null);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return overrides;
    return overrides.filter((item) => {
      const name = (item.appName ?? "").toLowerCase();
      return name.includes(trimmed) || item.appKey.includes(trimmed);
    });
  }, [overrides, query]);

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <ScrollView className="flex-1 px-5 pb-8">
        <Text className="mt-6 text-[20px] font-semibold text-[#0F172A]">
          App Categories
        </Text>
        <Text className="mt-2 text-[13px] text-[#64748B]">
          Review and adjust app classifications to improve screen time accuracy.
        </Text>

        <View className="mt-5 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search apps"
            placeholderTextColor="#94A3B8"
            className="text-[13px] text-[#0F172A]"
          />
        </View>

        {isLoading && (
          <Text className="mt-4 text-[12px] text-[#94A3B8]">
            Loading overrides…
          </Text>
        )}

        {!isLoading && filtered.length === 0 && (
          <View className="mt-6 rounded-2xl border border-dashed border-[#CBD5F5] bg-white px-4 py-5">
            <Text className="text-[13px] font-semibold text-[#1E293B]">
              No overrides yet
            </Text>
            <Text className="mt-2 text-[12px] text-[#64748B]">
              When you correct app categories, they will show up here for
              review.
            </Text>
          </View>
        )}

        <View className="mt-4 gap-3">
          {filtered.map((item) => (
            <View
              key={item.appKey}
              className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-[14px] font-semibold text-[#0F172A]">
                    {item.appName ?? "Unknown app"}
                  </Text>
                  <Text className="mt-1 text-[11px] text-[#94A3B8]">
                    {item.appKey}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setActiveOverride(item)}
                  className="rounded-full border border-[#2563EB] bg-[#EFF6FF] px-3 py-1.5"
                >
                  <Text className="text-[11px] font-semibold text-[#2563EB]">
                    Change
                  </Text>
                </Pressable>
              </View>
              <View className="mt-3 flex-row flex-wrap items-center gap-3">
                <View className="rounded-full bg-[#F1F5F9] px-3 py-1.5">
                  <Text className="text-[11px] font-semibold text-[#475569]">
                    {item.category}
                  </Text>
                </View>
                <Text className="text-[11px] text-[#64748B]">
                  {Math.round(item.confidence * 100)}% confidence
                </Text>
                <Text className="text-[11px] text-[#64748B]">
                  {item.sampleCount} edits
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!activeOverride} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-semibold text-[#0F172A]">
                Select category
              </Text>
              <Pressable onPress={() => setActiveOverride(null)}>
                <Text className="text-[13px] font-semibold text-[#2563EB]">
                  Close
                </Text>
              </Pressable>
            </View>
            <Text className="mt-2 text-[12px] text-[#64748B]">
              {activeOverride?.appName ?? "Unknown app"}
            </Text>

            <View className="mt-4 flex-row flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => {
                const isActive = option.id === activeOverride?.category;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      if (!activeOverride) return;
                      onSelectCategory(activeOverride.appKey, option.id);
                      setActiveOverride(null);
                    }}
                    className={`rounded-full border px-3 py-2 ${
                      isActive
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#E2E8F0] bg-white"
                    }`}
                  >
                    <Text
                      className={`text-[12px] font-semibold ${
                        isActive ? "text-[#2563EB]" : "text-[#475569]"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeOverride && (
              <Pressable
                onPress={() => {
                  onRemoveOverride(activeOverride.appKey);
                  setActiveOverride(null);
                }}
                className="mt-6 items-center rounded-full border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-2"
              >
                <Text className="text-[12px] font-semibold text-[#B91C1C]">
                  Remove override
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
