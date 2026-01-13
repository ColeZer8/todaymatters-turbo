import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Cross,
  Heart,
  Home,
  Moon,
  Palette,
  Plus,
  Star,
  TrendingUp,
  Users,
  X,
} from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { CoreValue, CoreCategory } from '@/stores/onboarding-store';

interface CoreCategoriesTemplateProps {
  step?: number;
  totalSteps?: number;
  coreValues: CoreValue[];
  categories: CoreCategory[];
  suggestionsByValueId?: Record<string, string[]>;
  isLoadingSuggestions?: boolean;
  onAddCategory: (valueId: string, label: string, color: string) => void;
  onRemoveCategory: (categoryId: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

const CATEGORY_COLORS = [
  '#F33C83', '#F59E0B', '#1FA56E', '#4F8BFF', '#8B5CF6', '#F95C2E', '#10B981', '#EC4899',
];

const ICON_MAP: Record<string, typeof Cross> = {
  cross: Cross,
  users: Users,
  briefcase: Briefcase,
  moon: Moon,
  'trending-up': TrendingUp,
  heart: Heart,
  home: Home,
  palette: Palette,
  star: Star,
};

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const CoreCategoriesTemplate = ({
  step = ONBOARDING_STEPS.coreCategories,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  coreValues,
  categories,
  suggestionsByValueId,
  isLoadingSuggestions,
  onAddCategory,
  onRemoveCategory,
  onContinue,
  onSkip,
  onBack,
}: CoreCategoriesTemplateProps) => {
  const [expandedValues, setExpandedValues] = useState<Set<string>>(
    new Set(coreValues.filter((v) => v.isSelected).map((v) => v.id))
  );
  const [addingForValue, setAddingForValue] = useState<string | null>(null);
  const [newCategoryText, setNewCategoryText] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const selectedValues = useMemo(
    () => coreValues.filter((v) => v.isSelected),
    [coreValues]
  );

  const categoriesByValue = useMemo(() => {
    const map: Record<string, CoreCategory[]> = {};
    for (const value of selectedValues) {
      map[value.id] = categories.filter((c) => c.valueId === value.id);
    }
    return map;
  }, [categories, selectedValues]);

  const toggleExpanded = (valueId: string) => {
    setExpandedValues((prev) => {
      const next = new Set(prev);
      if (next.has(valueId)) {
        next.delete(valueId);
      } else {
        next.add(valueId);
      }
      return next;
    });
  };

  const handleAddCategory = (valueId: string) => {
    if (newCategoryText.trim()) {
      const color = CATEGORY_COLORS[selectedColorIndex % CATEGORY_COLORS.length];
      onAddCategory(valueId, newCategoryText.trim(), color);
      setNewCategoryText('');
      setAddingForValue(null);
      setSelectedColorIndex((prev) => prev + 1);
    }
  };

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Time Categories"
      subtitle="How do you spend time in each area? Add categories to track."
      onBack={onBack}
      footer={
        <View className="gap-3">
          <GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />
          {onSkip && (
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              className="items-center py-2"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-sm font-semibold text-[#94A3B8]">Skip for now</Text>
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
            Categories help you track how you spend time within each core value.
            For example, under "Work" you might have "Deep Work", "Meetings", and "Admin".
          </Text>
        </View>

        {/* Value Sections */}
        {selectedValues.map((value) => {
          const isExpanded = expandedValues.has(value.id);
          const valueCategories = categoriesByValue[value.id] || [];
          const IconComponent = ICON_MAP[value.icon] || Star;
          const accentColor = valueCategories[0]?.color ?? '#2563EB';
          const rawSuggestions = suggestionsByValueId?.[value.id] ?? [];
          const existingLabels = new Set(
            valueCategories.map((c) => c.label.trim().toLowerCase())
          );
          const filteredSuggestions = rawSuggestions.filter(
            (s) => !existingLabels.has(s.trim().toLowerCase())
          );

          return (
            <View
              key={value.id}
              className="rounded-2xl border border-[#E4E8F0] bg-white overflow-hidden"
              style={cardShadowStyle}
            >
              {/* Value Header */}
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleExpanded(value.id)}
                className="flex-row items-center justify-between px-4 py-4"
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: accentColor }}
                  >
                    <IconComponent size={18} color="#fff" />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-text-primary">
                      {value.label}
                    </Text>
                    <Text className="text-xs text-[#94A3B8]">
                      {valueCategories.length} {valueCategories.length === 1 ? 'category' : 'categories'}
                    </Text>
                  </View>
                </View>
                {isExpanded ? (
                  <ChevronUp size={20} color="#94A3B8" />
                ) : (
                  <ChevronDown size={20} color="#94A3B8" />
                )}
              </Pressable>

              {/* Expanded Content */}
              {isExpanded && (
                <View className="px-4 pb-4 gap-2">
                  {/* Category Pills */}
                  <View className="flex-row flex-wrap gap-2">
                    {valueCategories.map((category) => (
                      <View
                        key={category.id}
                        className="flex-row items-center gap-2 rounded-2xl border px-3 py-2.5"
                        style={{
                          backgroundColor: `${category.color}10`,
                          borderColor: `${category.color}40`,
                        }}
                      >
                        <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: category.color }}>
                          <IconComponent size={16} color="#fff" />
                        </View>
                        <Text
                          className="text-sm font-semibold text-text-primary"
                        >
                          {category.label}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${category.label}`}
                          onPress={() => onRemoveCategory(category.id)}
                          className="ml-1 h-6 w-6 items-center justify-center rounded-full bg-[#E2E8F0]"
                          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                        >
                          <X size={12} color="#64748B" />
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  {/* Suggested Categories */}
                  {(isLoadingSuggestions || filteredSuggestions.length > 0) && (
                    <View className="mt-2 gap-2">
                      <Text className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                        Suggested
                      </Text>
                      {isLoadingSuggestions ? (
                        <Text className="text-sm text-[#94A3B8]">Generating suggestions…</Text>
                      ) : (
                        <View className="flex-row flex-wrap gap-2">
                          {filteredSuggestions.slice(0, 10).map((suggestion) => (
                            <Pressable
                              key={suggestion}
                              accessibilityRole="button"
                              accessibilityLabel={`Add ${suggestion}`}
                              onPress={() => onAddCategory(value.id, suggestion, accentColor)}
                              className="flex-row items-center gap-2 rounded-2xl border border-[#E4E8F0] bg-white px-3 py-2.5"
                              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                            >
                              <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: accentColor }}>
                                <Plus size={14} color="#fff" />
                              </View>
                              <Text className="text-sm font-semibold text-text-primary">
                                {suggestion}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Add Category */}
                  {addingForValue === value.id ? (
                    <View className="mt-2 gap-2">
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          value={newCategoryText}
                          onChangeText={setNewCategoryText}
                          placeholder="Category name"
                          placeholderTextColor="#94A3B8"
                          autoFocus
                          className="flex-1 rounded-xl bg-[#F8FAFC] px-4 py-2.5 text-sm text-text-primary"
                          style={{ borderWidth: 1, borderColor: '#E2E8F0' }}
                          onSubmitEditing={() => handleAddCategory(value.id)}
                        />
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            setSelectedColorIndex((prev) => prev + 1)
                          }
                          className="h-10 w-10 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[
                                selectedColorIndex % CATEGORY_COLORS.length
                              ],
                          }}
                        />
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleAddCategory(value.id)}
                          disabled={!newCategoryText.trim()}
                          className="rounded-xl bg-brand-primary px-4 py-2.5"
                          style={({ pressed }) => [
                            {
                              opacity: !newCategoryText.trim()
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
                          setAddingForValue(null);
                          setNewCategoryText('');
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
                      onPress={() => setAddingForValue(value.id)}
                      className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-3 py-2.5 mt-1"
                      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Plus size={14} color="#2563EB" />
                      <Text className="text-sm font-semibold text-brand-primary">
                        Add Category
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
