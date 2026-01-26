import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { CoreCategoriesTemplate } from '@/components/templates/CoreCategoriesTemplate';
import { useAuthStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';
import { generateOnboardingCategorySuggestionsLlm } from '@/lib/supabase/services';
import {
  seedDefaultActivityCategories,
  fetchActivityCategories,
  createActivityCategory,
  deleteActivityCategory,
} from '@/lib/supabase/services/activity-categories';
import type { ActivityCategory } from '@/lib/supabase/services/activity-categories';

export default function CoreCategoriesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);

  // Activity categories from tm.activity_categories
  const [activityCategories, setActivityCategories] = useState<ActivityCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsByTopCategoryId, setSuggestionsByTopCategoryId] = useState<Record<string, string[]>>({});

  // Top-level categories (sections)
  const topLevelCategories = useMemo(
    () => activityCategories.filter((c) => c.parent_id === null),
    [activityCategories]
  );

  // Subcategories grouped by parent_id
  const subcategoriesByParent = useMemo(() => {
    const map: Record<string, ActivityCategory[]> = {};
    for (const cat of activityCategories) {
      if (cat.parent_id !== null) {
        if (!map[cat.parent_id]) map[cat.parent_id] = [];
        map[cat.parent_id].push(cat);
      }
    }
    return map;
  }, [activityCategories]);

  // Auth guard
  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isNavigationReady, router]);

  // Seed and fetch categories on mount
  useEffect(() => {
    if (!isNavigationReady || !hasHydrated || !isAuthenticated || !userId) return;

    let cancelled = false;

    async function loadCategories() {
      setIsLoadingCategories(true);
      try {
        // Seed defaults (idempotent) then fetch
        await seedDefaultActivityCategories(userId!);
        const categories = await fetchActivityCategories(userId!);
        if (!cancelled) {
          setActivityCategories(categories);
        }
      } catch (error) {
        console.warn('[core-categories] Failed to load activity categories', error);
      } finally {
        if (!cancelled) setIsLoadingCategories(false);
      }
    }

    loadCategories();
    return () => { cancelled = true; };
  }, [hasHydrated, isAuthenticated, isNavigationReady, userId]);

  // LLM suggestions — map top-level categories to "values" for the suggestion engine
  useEffect(() => {
    if (!isNavigationReady || !hasHydrated || !isAuthenticated) return;
    if (topLevelCategories.length === 0) return;

    // Map top-level activity categories to the format the LLM engine expects
    const valuesForLlm = topLevelCategories.map((c) => ({ id: c.id, label: c.name }));

    // Map subcategories to the format the LLM engine expects (as "categories" under values)
    const categoriesForLlm: Array<{ id: string; valueId: string; label: string }> = [];
    for (const topCat of topLevelCategories) {
      const subs = subcategoriesByParent[topCat.id] ?? [];
      for (const sub of subs) {
        categoriesForLlm.push({ id: sub.id, valueId: topCat.id, label: sub.name });
      }
    }

    let cancelled = false;
    setIsLoadingSuggestions(true);
    generateOnboardingCategorySuggestionsLlm({
      values: valuesForLlm,
      categories: categoriesForLlm,
    })
      .then((suggestions) => {
        if (cancelled) return;
        setSuggestionsByTopCategoryId(suggestions);
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('[core-categories] category suggestions failed', error);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingSuggestions(false);
      });

    return () => { cancelled = true; };
  }, [hasHydrated, isAuthenticated, isNavigationReady, topLevelCategories, subcategoriesByParent]);

  // Add a subcategory under a top-level category
  const handleAddSubcategory = useCallback(
    async (parentId: string, label: string, color: string) => {
      if (!userId) return;
      const trimmed = label.trim();
      if (!trimmed) return;

      // Check for duplicate under same parent
      const existing = (subcategoriesByParent[parentId] ?? []);
      if (existing.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) return;

      try {
        const created = await createActivityCategory({
          user_id: userId,
          parent_id: parentId,
          name: trimmed,
          color,
          sort_order: existing.length,
        });
        setActivityCategories((prev) => [...prev, created]);
      } catch (error) {
        console.warn('[core-categories] Failed to create subcategory', error);
      }
    },
    [userId, subcategoriesByParent]
  );

  // Remove a subcategory
  const handleRemoveSubcategory = useCallback(
    async (categoryId: string) => {
      try {
        await deleteActivityCategory(categoryId);
        setActivityCategories((prev) => prev.filter((c) => c.id !== categoryId));
      } catch (error) {
        console.warn('[core-categories] Failed to delete subcategory', error);
      }
    },
    []
  );

  const handleContinue = () => {
    router.replace('/values-scores');
  };

  const handleSkip = () => {
    router.replace('/values-scores');
  };

  const handleBack = () => {
    router.replace('/core-values');
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <CoreCategoriesTemplate
      step={SETUP_SCREENS_STEPS.coreCategories}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      topLevelCategories={topLevelCategories}
      subcategoriesByParent={subcategoriesByParent}
      suggestionsByTopCategoryId={suggestionsByTopCategoryId}
      isLoadingSuggestions={isLoadingSuggestions}
      isLoadingCategories={isLoadingCategories}
      onAddSubcategory={handleAddSubcategory}
      onRemoveSubcategory={handleRemoveSubcategory}
      onContinue={handleContinue}
      onSkip={handleSkip}
      onBack={handleBack}
    />
  );
}
