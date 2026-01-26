import { useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Cross,
  Heart,
  Plus,
  Star,
  TrendingUp,
  Users,
  X,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { ActivityCategory } from '@/lib/supabase/services/activity-categories';

interface CoreCategoriesTemplateProps {
  step?: number;
  totalSteps?: number;
  topLevelCategories: ActivityCategory[];
  subcategoriesByParent: Record<string, ActivityCategory[]>;
  suggestionsByTopCategoryId?: Record<string, string[]>;
  isLoadingSuggestions?: boolean;
  isLoadingCategories?: boolean;
  onAddSubcategory: (parentId: string, label: string, color: string) => void;
  onRemoveSubcategory: (categoryId: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

const CATEGORY_COLORS = [
  '#F33C83', '#F59E0B', '#1FA56E', '#4F8BFF', '#8B5CF6', '#F95C2E', '#10B981', '#EC4899',
];

const DEFAULT_ACCENT_COLOR = '#2563EB';

const NAME_TO_ICON: Record<string, typeof Cross> = {
  faith: Cross,
  family: Users,
  work: Briefcase,
  health: Heart,
  'personal growth': TrendingUp,
  finances: Briefcase,
  other: Star,
};

const NAME_TO_COLOR: Record<string, string> = {
  faith: '#F33C83',
  family: '#F59E0B',
  work: '#1FA56E',
  health: '#F95C2E',
  'personal growth': '#8B5CF6',
  finances: '#10B981',
  other: '#94A3B8',
};

const EXAMPLE_SUBCATEGORIES: Record<string, string[]> = {
  faith: [
    'Prayer / Meditation',
    'Scripture / Study',
    'Worship',
    'Spiritual Growth',
    'Moral Grounding',
    'Gratitude',
    'Service to Others',
    'Calling / Purpose',
  ],
  family: [
    'Marriage / Spouse',
    'Parenting',
    'Quality Time',
    'Communication',
    'Extended Family',
    'Emotional Presence',
    'Conflict Resolution',
    'Love & Support',
  ],
  health: [
    'Exercise / Movement',
    'Nutrition',
    'Sleep / Recovery',
    'Mental Health',
    'Stress Management',
    'Emotional Resilience',
    'Medical Care',
    'Energy Management',
  ],
  work: [
    'Career / Vocation',
    'Leadership',
    'Productivity',
    'Focus / Deep Work',
    'Excellence',
    'Creativity',
    'Stewardship of Skills',
    'Impact & Contribution',
  ],
  'personal growth': [
    'Learning / Education',
    'Character Development',
    'Emotional Intelligence',
    'Habits & Discipline',
    'Self-Reflection',
    'Coaching / Mentorship',
    'Vision & Goals',
    'Identity Formation',
  ],
  finances: [
    'Budgeting',
    'Saving',
    'Investing',
    'Generosity / Giving',
    'Debt Management',
    'Financial Planning',
    'Margin & Simplicity',
    'Long-Term Security',
  ],
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
  topLevelCategories,
  subcategoriesByParent,
  suggestionsByTopCategoryId,
  isLoadingSuggestions,
  isLoadingCategories,
  onAddSubcategory,
  onRemoveSubcategory,
  onContinue,
  onSkip,
  onBack,
}: CoreCategoriesTemplateProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(topLevelCategories.map((c) => c.id))
  );
  const [addingForCategory, setAddingForCategory] = useState<string | null>(null);
  const [newSubcategoryText, setNewSubcategoryText] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

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

  const handleAddSubcategory = (parentId: string) => {
    if (newSubcategoryText.trim()) {
      const color = CATEGORY_COLORS[selectedColorIndex % CATEGORY_COLORS.length];
      onAddSubcategory(parentId, newSubcategoryText.trim(), color);
      setNewSubcategoryText('');
      setAddingForCategory(null);
      setSelectedColorIndex((prev) => prev + 1);
    }
  };

  if (isLoadingCategories) {
    return (
      <SetupStepLayout
        step={step}
        totalSteps={totalSteps}
        title="Time Categories"
        subtitle="Loading your categories..."
        onBack={onBack}
      >
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SetupStepLayout>
    );
  }

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Time Categories"
      subtitle="Add subcategories under each area to describe how you live each value."
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
            Each activity gets a primary category and optional subcategories. For example, under
            "Work" you might add "Deep Work", "Meetings", and "Admin". Add as many
            subcategories as you like.
          </Text>
        </View>

        {/* Top-Level Category Sections */}
        {topLevelCategories.map((topCat) => {
          const isExpanded = expandedCategories.has(topCat.id);
          const subcategories = subcategoriesByParent[topCat.id] ?? [];
          const nameLower = topCat.name.toLowerCase();
          const IconComponent = NAME_TO_ICON[nameLower] ?? Star;
          const accentColor = topCat.color ?? NAME_TO_COLOR[nameLower] ?? DEFAULT_ACCENT_COLOR;
          const rawSuggestions = suggestionsByTopCategoryId?.[topCat.id] ?? [];
          const existingLabels = new Set(
            subcategories.map((c) => c.name.trim().toLowerCase())
          );
          const filteredSuggestions = rawSuggestions.filter(
            (s) => !existingLabels.has(s.trim().toLowerCase())
          );
          const examples = EXAMPLE_SUBCATEGORIES[nameLower] ?? [];

          return (
            <View
              key={topCat.id}
              className="rounded-2xl border border-[#E4E8F0] bg-white overflow-hidden"
              style={cardShadowStyle}
            >
              {/* Category Header */}
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleExpanded(topCat.id)}
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
                      {topCat.name}
                    </Text>
                    <Text className="text-xs text-[#94A3B8]">
                      {subcategories.length} {subcategories.length === 1 ? 'subcategory' : 'subcategories'}
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
                  {/* Subcategory Pills */}
                  {subcategories.length > 0 && (
                    <View className="flex-row flex-wrap gap-2">
                      {subcategories.map((sub) => {
                        const subColor = sub.color ?? accentColor;
                        return (
                          <View
                            key={sub.id}
                            className="flex-row items-center gap-2 rounded-2xl border px-3 py-2.5"
                            style={{
                              backgroundColor: `${subColor}10`,
                              borderColor: `${subColor}40`,
                            }}
                          >
                            <View
                              className="h-8 w-8 items-center justify-center rounded-xl"
                              style={{ backgroundColor: subColor }}
                            >
                              <IconComponent size={16} color="#fff" />
                            </View>
                            <Text className="text-sm font-semibold text-text-primary">
                              {sub.name}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${sub.name}`}
                              onPress={() => onRemoveSubcategory(sub.id)}
                              className="ml-1 h-6 w-6 items-center justify-center rounded-full bg-[#E2E8F0]"
                              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                            >
                              <X size={12} color="#64748B" />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Suggested Subcategories */}
                  {(isLoadingSuggestions || filteredSuggestions.length > 0) && (
                    <View className="mt-2 gap-2">
                      <Text className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                        Suggested
                      </Text>
                      {isLoadingSuggestions ? (
                        <Text className="text-sm text-[#94A3B8]">Generating suggestions...</Text>
                      ) : (
                        <View className="flex-row flex-wrap gap-2">
                          {filteredSuggestions.slice(0, 10).map((suggestion) => (
                            <Pressable
                              key={suggestion}
                              accessibilityRole="button"
                              accessibilityLabel={`Add ${suggestion}`}
                              onPress={() => onAddSubcategory(topCat.id, suggestion, accentColor)}
                              className="flex-row items-center gap-2 rounded-2xl border border-[#E4E8F0] bg-white px-3 py-2.5"
                              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                            >
                              <View
                                className="h-8 w-8 items-center justify-center rounded-xl"
                                style={{ backgroundColor: accentColor }}
                              >
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

                  {/* Add Subcategory */}
                  {addingForCategory === topCat.id ? (
                    <View className="mt-2 gap-2">
                      {examples.length > 0 && (
                        <View className="gap-2">
                          <Text className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Quick add examples
                          </Text>
                          <View className="flex-row flex-wrap gap-2">
                            {examples
                              .filter((ex) => !existingLabels.has(ex.trim().toLowerCase()))
                              .map((example) => (
                                <Pressable
                                  key={example}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Add ${example}`}
                                  onPress={() => onAddSubcategory(topCat.id, example, accentColor)}
                                  className="rounded-2xl border border-[#E4E8F0] bg-white px-3 py-2"
                                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                                >
                                  <Text className="text-xs font-semibold text-text-primary">
                                    {example}
                                  </Text>
                                </Pressable>
                              ))}
                          </View>
                        </View>
                      )}
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          value={newSubcategoryText}
                          onChangeText={setNewSubcategoryText}
                          placeholder="Subcategory name"
                          placeholderTextColor="#94A3B8"
                          autoFocus
                          className="flex-1 rounded-xl bg-[#F8FAFC] px-4 py-2.5 text-sm text-text-primary"
                          style={{ borderWidth: 1, borderColor: '#E2E8F0' }}
                          onSubmitEditing={() => handleAddSubcategory(topCat.id)}
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
                          onPress={() => handleAddSubcategory(topCat.id)}
                          disabled={!newSubcategoryText.trim()}
                          className="rounded-xl bg-brand-primary px-4 py-2.5"
                          style={({ pressed }) => [
                            {
                              opacity: !newSubcategoryText.trim()
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
                          setNewSubcategoryText('');
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
                      onPress={() => setAddingForCategory(topCat.id)}
                      className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-3 py-2.5 mt-1"
                      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Plus size={14} color="#2563EB" />
                      <Text className="text-sm font-semibold text-brand-primary">
                        Add Subcategory
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
