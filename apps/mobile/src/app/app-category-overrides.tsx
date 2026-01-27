import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { AppCategoryOverridesTemplate } from "@/components/templates/AppCategoryOverridesTemplate";
import { useAppCategoryOverridesStore, useAuthStore } from "@/stores";
import type { EventCategory } from "@/stores";
import {
  fetchUserAppCategoryDetails,
  removeUserAppCategoryOverride,
  upsertUserAppCategoryOverride,
} from "@/lib/supabase/services/user-app-categories";

export default function AppCategoryOverridesScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const setStoreOverrides = useAppCategoryOverridesStore((s) => s.setOverrides);
  const upsertOverride = useAppCategoryOverridesStore((s) => s.upsertOverride);
  const removeOverride = useAppCategoryOverridesStore((s) => s.removeOverride);
  const [overrides, setOverrides] = useState<
    Array<{
      appKey: string;
      appName: string | null;
      category: EventCategory;
      confidence: number;
      sampleCount: number;
    }>
  >([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setOverrides([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const data = await fetchUserAppCategoryDetails(userId);
      if (cancelled) return;
      setOverrides(data);
      setStoreOverrides(
        data.reduce<
          Record<string, { category: EventCategory; confidence: number }>
        >((acc, item) => {
          acc[item.appKey] = {
            category: item.category,
            confidence: item.confidence,
          };
          return acc;
        }, {}),
      );
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSelectCategory = useCallback(
    async (appKey: string, category: EventCategory) => {
      if (!userId) {
        Alert.alert("Sign in required", "Sign in to update app categories.");
        return;
      }
      const target = overrides.find((item) => item.appKey === appKey);
      if (!target) return;
      const updated = await upsertUserAppCategoryOverride({
        userId,
        appKey,
        appName: target.appName,
        category,
        confidence: target.confidence,
        sampleCount: target.sampleCount,
      });
      if (!updated) {
        Alert.alert("Update failed", "Please try again in a moment.");
        return;
      }
      setOverrides((prev) =>
        prev.map((item) =>
          item.appKey === appKey
            ? {
                ...item,
                category: updated.category,
                confidence: updated.confidence,
                sampleCount: updated.sampleCount,
              }
            : item,
        ),
      );
      upsertOverride(appKey, {
        category: updated.category,
        confidence: updated.confidence,
      });
    },
    [overrides, upsertOverride, userId],
  );

  const handleRemoveOverride = useCallback(
    async (appKey: string) => {
      if (!userId) {
        Alert.alert("Sign in required", "Sign in to update app categories.");
        return;
      }
      const ok = await removeUserAppCategoryOverride({ userId, appKey });
      if (!ok) {
        Alert.alert("Remove failed", "Please try again in a moment.");
        return;
      }
      setOverrides((prev) => prev.filter((item) => item.appKey !== appKey));
      removeOverride(appKey);
    },
    [removeOverride, userId],
  );

  return (
    <>
      <Stack.Screen options={{ title: "App Categories" }} />
      <AppCategoryOverridesTemplate
        overrides={overrides}
        query={query}
        isLoading={isLoading}
        onChangeQuery={setQuery}
        onSelectCategory={handleSelectCategory}
        onRemoveOverride={handleRemoveOverride}
      />
    </>
  );
}
