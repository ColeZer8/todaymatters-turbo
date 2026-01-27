import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { CoreCategoriesTemplate } from "@/components/templates/CoreCategoriesTemplate";
import { useAuthStore } from "@/stores";
import { useOnboardingStore } from "@/stores/onboarding-store";
import {
  SETUP_SCREENS_STEPS,
  SETUP_SCREENS_TOTAL_STEPS,
} from "@/constants/setup-screens";
import { generateOnboardingCategorySuggestionsLlm } from "@/lib/supabase/services";
import { useOnboardingSync } from "@/lib/supabase/hooks";

const REQUIRED_CATEGORY_SEEDS = [
  { valueId: "health", label: "Exercise", color: "#F95C2E" },
  { valueId: "health", label: "Nutrition", color: "#F95C2E" },
  { valueId: "health", label: "Sleep / Recovery", color: "#F95C2E" },
  { valueId: "finances", label: "Budgeting", color: "#10B981" },
  { valueId: "finances", label: "Saving", color: "#10B981" },
  { valueId: "finances", label: "Investing", color: "#10B981" },
] as const;

export default function CoreCategoriesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const coreValues = useOnboardingStore((state) => state.coreValues);
  const coreCategories = useOnboardingStore((state) => state.coreCategories);
  const setCoreCategories = useOnboardingStore(
    (state) => state.setCoreCategories,
  );
  const addCoreCategory = useOnboardingStore((state) => state.addCoreCategory);
  const removeCoreCategory = useOnboardingStore(
    (state) => state.removeCoreCategory,
  );
  const { saveCoreCategories } = useOnboardingSync({
    autoLoad: false,
    autoSave: false,
  });

  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsByValueId, setSuggestionsByValueId] = useState<
    Record<string, string[]>
  >({});

  const selectedValues = useMemo(
    () =>
      coreValues
        .filter((v) => v.isSelected)
        .map((v) => ({ id: v.id, label: v.label })),
    [coreValues],
  );

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isNavigationReady, router]);

  useEffect(() => {
    if (!isNavigationReady || !hasHydrated || !isAuthenticated) return;
    const existingLabels = new Set(
      coreCategories.map(
        (category) => `${category.valueId}:${category.label.toLowerCase()}`,
      ),
    );
    const additions = REQUIRED_CATEGORY_SEEDS.filter(
      (seed) =>
        !existingLabels.has(`${seed.valueId}:${seed.label.toLowerCase()}`),
    ).map((seed) => ({
      id: `${seed.valueId}-${seed.label.toLowerCase().replace(/\s+/g, "-")}`,
      valueId: seed.valueId,
      label: seed.label,
      color: seed.color,
      isCustom: false,
    }));
    if (additions.length > 0) {
      setCoreCategories([...coreCategories, ...additions]);
    }
  }, [
    coreCategories,
    hasHydrated,
    isAuthenticated,
    isNavigationReady,
    setCoreCategories,
  ]);

  useEffect(() => {
    if (!isNavigationReady || !hasHydrated || !isAuthenticated) return;
    const timeoutId = setTimeout(() => {
      saveCoreCategories(coreCategories);
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [
    coreCategories,
    hasHydrated,
    isAuthenticated,
    isNavigationReady,
    saveCoreCategories,
  ]);

  useEffect(() => {
    if (!isNavigationReady || !hasHydrated || !isAuthenticated) return;
    if (selectedValues.length === 0) return;

    let cancelled = false;
    setIsLoadingSuggestions(true);
    generateOnboardingCategorySuggestionsLlm({
      values: selectedValues,
      categories: coreCategories.map((c) => ({
        id: c.id,
        valueId: c.valueId,
        label: c.label,
      })),
    })
      .then((suggestions) => {
        if (cancelled) return;
        setSuggestionsByValueId(suggestions);
      })
      .catch((error) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[onboarding] category suggestions failed", error);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingSuggestions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    coreCategories,
    hasHydrated,
    isAuthenticated,
    isNavigationReady,
    selectedValues,
  ]);

  const handleContinue = () => {
    saveCoreCategories(coreCategories);
    router.replace("/values-scores");
  };

  const handleSkip = () => {
    saveCoreCategories(coreCategories);
    router.replace("/values-scores");
  };

  const handleBack = () => {
    router.replace("/core-values");
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
      coreValues={coreValues}
      categories={coreCategories}
      suggestionsByValueId={suggestionsByValueId}
      isLoadingSuggestions={isLoadingSuggestions}
      onAddCategory={addCoreCategory}
      onRemoveCategory={removeCoreCategory}
      onContinue={handleContinue}
      onSkip={handleSkip}
      onBack={handleBack}
    />
  );
}
