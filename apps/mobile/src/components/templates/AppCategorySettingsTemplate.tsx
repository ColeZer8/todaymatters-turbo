import { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Search,
  Smartphone,
  Check,
  ChevronDown,
} from "lucide-react-native";
import type { AppCategory } from "@/lib/supabase/services/app-categories";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppCategoryItem {
  /** Normalized app key */
  appKey: string;
  /** Display name of the app */
  displayName: string;
  /** Total duration in seconds over the last 30 days */
  totalSeconds: number;
  /** Current category (from user override or default) */
  category: AppCategory;
  /** Whether this category is from a user override */
  isOverride: boolean;
}

export interface AppCategorySettingsTemplateProps {
  apps: AppCategoryItem[];
  isLoading: boolean;
  onBack: () => void;
  onUpdateCategory: (appKey: string, displayName: string, category: AppCategory) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: Array<{ id: AppCategory; label: string; color: string }> = [
  { id: "work", label: "Work", color: "#2563EB" },
  { id: "social", label: "Social", color: "#8B5CF6" },
  { id: "entertainment", label: "Entertainment", color: "#EC4899" },
  { id: "comms", label: "Communication", color: "#10B981" },
  { id: "utility", label: "Utility", color: "#6B7280" },
  { id: "ignore", label: "Ignore", color: "#9CA3AF" },
];

const CATEGORY_COLORS: Record<AppCategory, string> = {
  work: "#2563EB",
  social: "#8B5CF6",
  entertainment: "#EC4899",
  comms: "#10B981",
  utility: "#6B7280",
  ignore: "#9CA3AF",
};

const CATEGORY_LABELS: Record<AppCategory, string> = {
  work: "Work",
  social: "Social",
  entertainment: "Entertainment",
  comms: "Communication",
  utility: "Utility",
  ignore: "Ignore",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AppCategorySettingsTemplate = ({
  apps,
  isLoading,
  onBack,
  onUpdateCategory,
}: AppCategorySettingsTemplateProps) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppCategoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter apps based on search query
  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return apps;

    return apps.filter((app) => {
      const displayName = app.displayName.toLowerCase();
      const appKey = app.appKey.toLowerCase();
      return displayName.includes(query) || appKey.includes(query);
    });
  }, [apps, searchQuery]);

  // Handle category selection
  const handleSelectCategory = useCallback(
    async (category: AppCategory) => {
      if (!selectedApp || isSaving) return;

      setIsSaving(true);
      try {
        await onUpdateCategory(selectedApp.appKey, selectedApp.displayName, category);
        setSelectedApp(null);
      } catch (error) {
        console.error("[AppCategorySettings] Failed to update category:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedApp, isSaving, onUpdateCategory],
  );

  return (
    <View className="flex-1 bg-[#F7FAFF]">
      {/* Header */}
      <View
        className="bg-[#F7FAFF] px-6"
        style={{
          paddingTop: Math.max(insets.top - 11, 0),
          paddingBottom: 12,
          shadowColor: "#0f172a",
          shadowOpacity: 0.03,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
          zIndex: 10,
        }}
      >
        <View className="flex-row items-center my-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={onBack}
            className="flex-row items-center"
            style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
          >
            <ArrowLeft size={20} color="#2563EB" />
            <Text className="ml-1 text-[15px] font-semibold text-[#2563EB]">
              Back
            </Text>
          </Pressable>

          <View className="flex-1 items-center">
            <Text className="text-[#0F172A] text-[17px] font-semibold">
              App Categories
            </Text>
          </View>

          {/* Spacer for centering */}
          <View className="w-[60px]" />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Description */}
        <Text className="text-sm text-[#64748B] mb-4">
          Customize how apps are categorized for intent classification. Changes affect how your sessions are labeled (Work, Leisure, etc.).
        </Text>

        {/* Search */}
        <View className="flex-row items-center rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 mb-4">
          <Search size={18} color="#94A3B8" />
          <TextInput
            className="flex-1 ml-2 text-base text-[#111827]"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search apps..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-3 text-base text-[#94A3B8]">
              Loading apps...
            </Text>
          </View>
        ) : filteredApps.length === 0 ? (
          <View className="items-center py-16 px-4">
            <Smartphone size={40} color="#CBD5E1" />
            <Text className="mt-4 text-lg font-semibold text-[#475569]">
              {searchQuery ? "No Apps Found" : "No Screen Time Data"}
            </Text>
            <Text className="mt-2 text-center text-base text-[#94A3B8]">
              {searchQuery
                ? "Try a different search term."
                : "Use your device for a few days to see apps here."}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredApps.map((app) => (
              <Pressable
                key={app.appKey}
                accessibilityRole="button"
                accessibilityLabel={`Change category for ${app.displayName}`}
                onPress={() => setSelectedApp(app)}
                className="rounded-2xl border border-[#E5E9F2] bg-white p-4"
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <View className="flex-row items-center">
                  {/* App icon placeholder */}
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${CATEGORY_COLORS[app.category]}15` }}
                  >
                    <Smartphone size={20} color={CATEGORY_COLORS[app.category]} />
                  </View>

                  {/* App info */}
                  <View className="flex-1">
                    <Text
                      className="text-base font-semibold text-[#111827]"
                      numberOfLines={1}
                    >
                      {app.displayName}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className="text-sm text-[#94A3B8]">
                        {formatDuration(app.totalSeconds)} in 30 days
                      </Text>
                      {app.isOverride && (
                        <View className="ml-2 rounded-full bg-[#EFF6FF] px-2 py-0.5">
                          <Text className="text-xs text-[#2563EB]">Custom</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Category badge */}
                  <View className="flex-row items-center">
                    <View
                      className="rounded-full px-3 py-1.5"
                      style={{ backgroundColor: `${CATEGORY_COLORS[app.category]}15` }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: CATEGORY_COLORS[app.category] }}
                      >
                        {CATEGORY_LABELS[app.category]}
                      </Text>
                    </View>
                    <ChevronDown size={16} color="#94A3B8" className="ml-1" />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Category Selection Modal */}
      <Modal visible={!!selectedApp} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-[#0F172A]">
                Select Category
              </Text>
              <Pressable
                onPress={() => setSelectedApp(null)}
                disabled={isSaving}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text className="text-sm font-semibold text-[#2563EB]">
                  Cancel
                </Text>
              </Pressable>
            </View>

            {selectedApp && (
              <Text className="mt-2 text-sm text-[#64748B]">
                {selectedApp.displayName}
              </Text>
            )}

            <View className="mt-5 gap-2">
              {CATEGORY_OPTIONS.map((option) => {
                const isActive = option.id === selectedApp?.category;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectCategory(option.id)}
                    disabled={isSaving}
                    className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                      isActive
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#E2E8F0] bg-white"
                    }`}
                    style={({ pressed }) => [
                      { opacity: isSaving ? 0.5 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="mr-3 h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${option.color}15` }}
                      >
                        <View
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      </View>
                      <Text
                        className={`text-base font-medium ${
                          isActive ? "text-[#2563EB]" : "text-[#111827]"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isActive && <Check size={20} color="#2563EB" />}
                  </Pressable>
                );
              })}
            </View>

            {isSaving && (
              <View className="mt-4 items-center">
                <ActivityIndicator size="small" color="#2563EB" />
                <Text className="mt-2 text-sm text-[#64748B]">Saving...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};
