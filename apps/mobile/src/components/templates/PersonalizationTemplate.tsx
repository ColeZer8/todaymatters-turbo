import { ScrollView, Text, Pressable, View, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { GapFillingPreference } from "@/stores/user-preferences-store";

interface PersonalizationTemplateProps {
  gapFillingPreference: GapFillingPreference;
  confidenceThreshold: number;
  autoSuggestEvents: boolean;
  verificationAlerts: boolean;
  realTimeUpdates: boolean;
  verificationStrictness: "lenient" | "balanced" | "strict";
  isSaving: boolean;
  appOverridesCount: number;
  onSelectGapFilling: (value: GapFillingPreference) => void;
  onSelectConfidence: (value: number) => void;
  onToggleAutoSuggest: (value: boolean) => void;
  onToggleVerificationAlerts: (value: boolean) => void;
  onToggleRealTimeUpdates: (value: boolean) => void;
  onSelectVerificationStrictness: (
    value: "lenient" | "balanced" | "strict",
  ) => void;
  onOpenAppOverrides: () => void;
  onSave: () => void;
}

const CONFIDENCE_OPTIONS = [0.5, 0.6, 0.7, 0.8];

export const PersonalizationTemplate = ({
  gapFillingPreference,
  confidenceThreshold,
  autoSuggestEvents,
  verificationAlerts,
  realTimeUpdates,
  verificationStrictness,
  isSaving,
  appOverridesCount,
  onSelectGapFilling,
  onSelectConfidence,
  onToggleAutoSuggest,
  onToggleVerificationAlerts,
  onToggleRealTimeUpdates,
  onSelectVerificationStrictness,
  onOpenAppOverrides,
  onSave,
}: PersonalizationTemplateProps) => {
  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <ScrollView className="flex-1 px-5 pb-8">
        <Text className="mt-6 text-[20px] font-semibold text-[#0F172A]">
          Personalization
        </Text>
        <Text className="mt-2 text-[13px] text-[#64748B]">
          Tune how Today Matters fills gaps and surfaces evidence.
        </Text>

        <View className="mt-6 px-4 py-4 rounded-2xl border border-[#E2E8F0] bg-white">
          <Text className="text-[13px] font-semibold text-[#0F172A]">
            Gap filling style
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(
              ["conservative", "aggressive", "manual"] as GapFillingPreference[]
            ).map((option) => {
              const isActive = gapFillingPreference === option;
              const label =
                option === "conservative"
                  ? "Conservative"
                  : option === "aggressive"
                    ? "Aggressive"
                    : "Manual";
              return (
                <Pressable
                  key={option}
                  onPress={() => onSelectGapFilling(option)}
                  className={`px-4 py-2 rounded-full border ${
                    isActive
                      ? "border-[#2563EB] bg-[#EFF6FF]"
                      : "border-[#E2E8F0] bg-white"
                  }`}
                >
                  <Text
                    className={`text-[12px] font-semibold ${isActive ? "text-[#2563EB]" : "text-[#475569]"}`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-3 text-[12px] text-[#94A3B8]">
            Conservative keeps more gaps unknown; aggressive fills more.
          </Text>
        </View>

        <View className="mt-4 px-4 py-4 rounded-2xl border border-[#E2E8F0] bg-white">
          <Text className="text-[13px] font-semibold text-[#0F172A]">
            Pattern confidence
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {CONFIDENCE_OPTIONS.map((option) => {
              const isActive = Math.abs(confidenceThreshold - option) < 0.001;
              return (
                <Pressable
                  key={option}
                  onPress={() => onSelectConfidence(option)}
                  className={`px-4 py-2 rounded-full border ${
                    isActive
                      ? "border-[#0EA5E9] bg-[#ECFEFF]"
                      : "border-[#E2E8F0] bg-white"
                  }`}
                >
                  <Text
                    className={`text-[12px] font-semibold ${isActive ? "text-[#0EA5E9]" : "text-[#475569]"}`}
                  >
                    {Math.round(option * 100)}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-3 text-[12px] text-[#94A3B8]">
            Higher thresholds mean fewer pattern-based suggestions.
          </Text>
        </View>

        <View className="mt-4 px-4 py-4 rounded-2xl border border-[#E2E8F0] bg-white">
          <Text className="text-[13px] font-semibold text-[#0F172A]">
            Verification strictness
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(["lenient", "balanced", "strict"] as const).map((option) => {
              const isActive = verificationStrictness === option;
              const label =
                option === "lenient"
                  ? "Lenient"
                  : option === "strict"
                    ? "Strict"
                    : "Balanced";
              return (
                <Pressable
                  key={option}
                  onPress={() => onSelectVerificationStrictness(option)}
                  className={`px-4 py-2 rounded-full border ${
                    isActive
                      ? "border-[#10B981] bg-[#ECFDF3]"
                      : "border-[#E2E8F0] bg-white"
                  }`}
                >
                  <Text
                    className={`text-[12px] font-semibold ${isActive ? "text-[#10B981]" : "text-[#475569]"}`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-3 text-[12px] text-[#94A3B8]">
            Lenient marks more events verified; strict requires stronger
            evidence.
          </Text>
        </View>

        <View className="mt-4 px-4 py-4 rounded-2xl border border-[#E2E8F0] bg-white">
          <Text className="text-[13px] font-semibold text-[#0F172A]">
            Suggestions & alerts
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] text-[#475569]">
              Auto-suggest events
            </Text>
            <Switch
              value={autoSuggestEvents}
              onValueChange={onToggleAutoSuggest}
            />
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] text-[#475569]">
              Verification alerts
            </Text>
            <Switch
              value={verificationAlerts}
              onValueChange={onToggleVerificationAlerts}
            />
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[12px] text-[#475569]">
              Real-time updates
            </Text>
            <Switch
              value={realTimeUpdates}
              onValueChange={onToggleRealTimeUpdates}
            />
          </View>
        </View>

        <Pressable
          onPress={onOpenAppOverrides}
          className="mt-4 flex-row items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4"
        >
          <View>
            <Text className="text-[13px] font-semibold text-[#0F172A]">
              App category overrides
            </Text>
            <Text className="mt-1 text-[12px] text-[#64748B]">
              {appOverridesCount} saved override
              {appOverridesCount === 1 ? "" : "s"}
            </Text>
          </View>
          <Text className="text-[12px] font-semibold text-[#2563EB]">
            Manage
          </Text>
        </Pressable>

        <Pressable
          onPress={onSave}
          disabled={isSaving}
          className={`mt-6 items-center px-5 py-3 rounded-full ${
            isSaving ? "bg-[#CBD5F5]" : "bg-[#2563EB]"
          }`}
        >
          <Text className="text-[14px] font-semibold text-white">
            {isSaving ? "Saving..." : "Save preferences"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};
