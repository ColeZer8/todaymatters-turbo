import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores";
import {
  AppCategorySettingsTemplate,
  type AppCategoryItem,
} from "@/components/templates";
import {
  fetchRecentlyUsedApps,
  upsertAppCategoryOverride,
} from "@/lib/supabase/services/user-app-categories";
import type { AppCategory } from "@/lib/supabase/services/app-categories";

export default function SettingsAppCategoriesScreen() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [apps, setApps] = useState<AppCategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load apps on mount
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const recentApps = await fetchRecentlyUsedApps(userId);
        if (cancelled) return;
        setApps(recentApps);
      } catch (error) {
        console.error("[app-categories] Failed to load apps:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  const handleUpdateCategory = useCallback(
    async (appKey: string, displayName: string, category: AppCategory) => {
      if (!userId) return;

      const success = await upsertAppCategoryOverride({
        userId,
        appKey,
        appName: displayName,
        category,
      });

      if (success) {
        // Update local state
        setApps((prev) =>
          prev.map((app) =>
            app.appKey === appKey
              ? { ...app, category, isOverride: true }
              : app,
          ),
        );
      }
    },
    [userId],
  );

  return (
    <AppCategorySettingsTemplate
      apps={apps}
      isLoading={isLoading}
      onBack={() => router.back()}
      onUpdateCategory={handleUpdateCategory}
    />
  );
}
