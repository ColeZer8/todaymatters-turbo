import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { SubCategoriesTemplate } from "@/components/templates/SubCategoriesTemplate";
import { useAuthStore } from "@/stores";
import { useOnboardingStore } from "@/stores/onboarding-store";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";
import { generateOnboardingSubCategorySuggestionsLlm } from "@/lib/supabase/services";

export default function SubCategoriesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const coreCategories = useOnboardingStore((state) => state.coreCategories);
  const subCategories = useOnboardingStore((state) => state.subCategories);
  const addSubCategory = useOnboardingStore((state) => state.addSubCategory);
  const removeSubCategory = useOnboardingStore(
    (state) => state.removeSubCategory,
  );

  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsByCategoryId, setSuggestionsByCategoryId] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isNavigationReady, router]);

  useEffect(() => {
    if (!isNavigationReady || !hasHydrated || !isAuthenticated) return;
    if (coreCategories.length === 0) return;

    let cancelled = false;
    setIsLoadingSuggestions(true);
    generateOnboardingSubCategorySuggestionsLlm({
      categories: coreCategories.map((c) => ({
        id: c.id,
        valueId: c.valueId,
        label: c.label,
      })),
      subCategories: subCategories.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        label: s.label,
      })),
    })
      .then((suggestions) => {
        if (cancelled) return;
        setSuggestionsByCategoryId(suggestions);
      })
      .catch((error) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[onboarding] sub-category suggestions failed", error);
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
    subCategories,
  ]);

  const handleContinue = () => {
    router.replace("/goals");
  };

  const handleSkip = () => {
    router.replace("/goals");
  };

  const handleBack = () => {
    router.replace("/core-categories");
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SubCategoriesTemplate
      step={ONBOARDING_STEPS.subCategories}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      categories={coreCategories}
      subCategories={subCategories}
      suggestionsByCategoryId={suggestionsByCategoryId}
      isLoadingSuggestions={isLoadingSuggestions}
      onAddSubCategory={addSubCategory}
      onRemoveSubCategory={removeSubCategory}
      onContinue={handleContinue}
      onSkip={handleSkip}
      onBack={handleBack}
    />
  );
}
