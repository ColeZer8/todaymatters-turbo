import { useMemo, useState } from "react";
import {
  ArrowRight,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { GradientButton } from "@/components/atoms";
import { SetupStepLayout } from "@/components/organisms";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";
import type { CoreCategory, SubCategory } from "@/stores/onboarding-store";

interface SubCategoriesTemplateProps {
  step?: number;
  totalSteps?: number;
  categories: CoreCategory[];
  subCategories: SubCategory[];
  suggestionsByCategoryId?: Record<string, string[]>;
  isLoadingSuggestions?: boolean;
  onAddSubCategory: (categoryId: string, label: string) => void;
  onRemoveSubCategory: (subId: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

const cardShadowStyle = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const SubCategoriesTemplate = ({
  step = ONBOARDING_STEPS.subCategories,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  categories,
  subCategories,
  suggestionsByCategoryId,
  isLoadingSuggestions,
  onAddSubCategory,
  onRemoveSubCategory,
  onContinue,
  onSkip,
  onBack,
}: SubCategoriesTemplateProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.slice(0, 3).map((c) => c.id)),
  );
  const [addingForCategory, setAddingForCategory] = useState<string | null>(
    null,
  );
  const [newSubCategoryText, setNewSubCategoryText] = useState("");

  const subCategoriesByCategory = useMemo(() => {
    const map: Record<string, SubCategory[]> = {};
    for (const category of categories) {
      map[category.id] = subCategories.filter(
        (s) => s.categoryId === category.id,
      );
    }
    return map;
  }, [categories, subCategories]);

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleAddSubCategory = (categoryId: string) => {
    if (newSubCategoryText.trim()) {
      onAddSubCategory(categoryId, newSubCategoryText.trim());
      setNewSubCategoryText("");
      setAddingForCategory(null);
    }
  };

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Sub-Categories"
      subtitle="Break down your categories into specific activities you want to track."
      onBack={onBack}
      footer={
        <View className="gap-3">
          <GradientButton
            label="Continue"
            onPress={onContinue}
            rightIcon={ArrowRight}
          />
          {onSkip && (
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              className="items-center py-2"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-sm font-semibold text-[#94A3B8]">
                Skip for now
              </Text>
            </Pressable>
          )}
        </View>
      }
    >
      <View className="mt-2 gap-3">
        {/* Info Card */}
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-[#F5F9FF] px-4 py-3"
          style={cardShadowStyle}
        >
          <Text className="text-sm leading-5 text-text-secondary">
            Sub-categories let you track specific activities. For example, under
            "Quality Time" you might add "Date Night", "Kids Activities", or
            "Family Dinner".
          </Text>
        </View>

        {/* Category Sections */}
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const categorySubs = subCategoriesByCategory[category.id] || [];
          const rawSuggestions = suggestionsByCategoryId?.[category.id] ?? [];
          const existingLabels = new Set(
            categorySubs.map((s) => s.label.trim().toLowerCase()),
          );
          const filteredSuggestions = rawSuggestions.filter(
            (s) => !existingLabels.has(s.trim().toLowerCase()),
          );

          return (
            <View
              key={category.id}
              className="rounded-2xl border border-[#E4E8F0] bg-white overflow-hidden"
              style={cardShadowStyle}
            >
              {/* Category Header */}
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleExpanded(category.id)}
                className="flex-row items-center justify-between px-4 py-3.5"
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <View>
                    <Text className="text-[15px] font-semibold text-text-primary">
                      {category.label}
                    </Text>
                    {categorySubs.length > 0 && (
                      <Text className="text-xs text-[#94A3B8]">
                        {categorySubs.length} sub-
                        {categorySubs.length === 1 ? "category" : "categories"}
                      </Text>
                    )}
                  </View>
                </View>
                {isExpanded ? (
                  <ChevronUp size={18} color="#94A3B8" />
                ) : (
                  <ChevronDown size={18} color="#94A3B8" />
                )}
              </Pressable>

              {/* Expanded Content */}
              {isExpanded && (
                <View className="px-4 pb-4 gap-2">
                  {/* Sub-Category Pills */}
                  {categorySubs.length > 0 && (
                    <View className="flex-row flex-wrap gap-2">
                      {categorySubs.map((sub) => (
                        <View
                          key={sub.id}
                          className="flex-row items-center gap-2 rounded-full bg-[#F1F5F9] px-3 py-2"
                        >
                          <Text className="text-sm font-medium text-text-primary">
                            {sub.label}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${sub.label}`}
                            onPress={() => onRemoveSubCategory(sub.id)}
                            className="h-5 w-5 items-center justify-center rounded-full bg-[#E2E8F0]"
                            style={({ pressed }) => [
                              { opacity: pressed ? 0.8 : 1 },
                            ]}
                          >
                            <X size={10} color="#64748B" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Suggested Sub-Categories */}
                  {(isLoadingSuggestions || filteredSuggestions.length > 0) && (
                    <View className="mt-2 gap-2">
                      <Text className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                        Suggested
                      </Text>
                      {isLoadingSuggestions ? (
                        <Text className="text-sm text-[#94A3B8]">
                          Generating suggestions…
                        </Text>
                      ) : (
                        <View className="flex-row flex-wrap gap-2">
                          {filteredSuggestions
                            .slice(0, 10)
                            .map((suggestion) => (
                              <Pressable
                                key={suggestion}
                                accessibilityRole="button"
                                accessibilityLabel={`Add ${suggestion}`}
                                onPress={() =>
                                  onAddSubCategory(category.id, suggestion)
                                }
                                className="flex-row items-center gap-2 rounded-full bg-[#F8FAFF] px-3 py-2"
                                style={({ pressed }) => [
                                  { opacity: pressed ? 0.85 : 1 },
                                ]}
                              >
                                <Plus size={14} color="#2563EB" />
                                <Text className="text-sm font-semibold text-brand-primary">
                                  {suggestion}
                                </Text>
                              </Pressable>
                            ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Add Sub-Category */}
                  {addingForCategory === category.id ? (
                    <View className="mt-1 gap-2">
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          value={newSubCategoryText}
                          onChangeText={setNewSubCategoryText}
                          placeholder="e.g., Date Night with Wife"
                          placeholderTextColor="#94A3B8"
                          autoFocus
                          className="flex-1 rounded-xl bg-[#F8FAFC] px-4 py-2.5 text-sm text-text-primary"
                          style={{ borderWidth: 1, borderColor: "#E2E8F0" }}
                          onSubmitEditing={() =>
                            handleAddSubCategory(category.id)
                          }
                        />
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleAddSubCategory(category.id)}
                          disabled={!newSubCategoryText.trim()}
                          className="rounded-xl bg-brand-primary px-4 py-2.5"
                          style={({ pressed }) => [
                            {
                              opacity: !newSubCategoryText.trim()
                                ? 0.5
                                : pressed
                                  ? 0.9
                                  : 1,
                            },
                          ]}
                        >
                          <Text className="text-sm font-semibold text-white">
                            Add
                          </Text>
                        </Pressable>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setAddingForCategory(null);
                          setNewSubCategoryText("");
                        }}
                        className="items-center py-1"
                      >
                        <Text className="text-xs font-semibold text-[#94A3B8]">
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setAddingForCategory(category.id)}
                      className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-3 py-2.5"
                      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Plus size={14} color="#2563EB" />
                      <Text className="text-sm font-semibold text-brand-primary">
                        Add Sub-Category
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </SetupStepLayout>
  );
};
