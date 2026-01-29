import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores";
import {
  PlaceLabelsTemplate,
  type PlaceLabelItem,
} from "@/components/templates";
import {
  fetchAllUserPlaces,
  updateUserPlace,
  deleteUserPlace,
  fetchAutoTagCountsByPlaceLabel,
  fetchActivityCategories,
  type ActivityCategory,
} from "@/lib/supabase/services";

/**
 * Build hierarchical category display name (e.g., 'Family > Dog Walking')
 * by walking up the parent chain from a category_id.
 */
function buildCategoryDisplayName(
  categoryId: string | null,
  categories: ActivityCategory[],
): string | null {
  if (!categoryId) return null;

  const map = new Map<string, ActivityCategory>();
  for (const cat of categories) {
    map.set(cat.id, cat);
  }

  const path: string[] = [];
  let current = map.get(categoryId);
  while (current) {
    path.unshift(current.name);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }

  return path.length > 0 ? path.join(" > ") : null;
}

export default function SettingsPlaceLabelsScreen() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [places, setPlaces] = useState<PlaceLabelItem[]>([]);
  const [activityCategories, setActivityCategories] = useState<
    ActivityCategory[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load places, categories, and auto-tag counts on mount
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [rawPlaces, categories, autoTagCounts] = await Promise.all([
          fetchAllUserPlaces(userId),
          fetchActivityCategories(userId),
          fetchAutoTagCountsByPlaceLabel(userId),
        ]);

        if (cancelled) return;

        setActivityCategories(categories);

        const items: PlaceLabelItem[] = rawPlaces.map((p) => ({
          id: p.id,
          label: p.label,
          category: p.category,
          category_id: p.category_id,
          radius_m: p.radius_m,
          categoryDisplayName: buildCategoryDisplayName(
            p.category_id,
            categories,
          ),
          autoTagCount: autoTagCounts[p.label] ?? 0,
        }));

        setPlaces(items);
      } catch (error) {
        console.error("[place-labels] Failed to load places:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  const handleUpdatePlace = useCallback(
    async (placeId: string, label: string, categoryId: string | null, radiusM: number) => {
      const updated = await updateUserPlace(placeId, {
        label,
        category_id: categoryId,
        radius_m: radiusM,
      });

      // Update local state
      setPlaces((prev) =>
        prev.map((p) =>
          p.id === placeId
            ? {
                ...p,
                label: updated.label,
                category: updated.category,
                category_id: updated.category_id,
                radius_m: updated.radius_m,
                categoryDisplayName: buildCategoryDisplayName(
                  updated.category_id,
                  activityCategories,
                ),
              }
            : p,
        ),
      );
    },
    [activityCategories],
  );

  const handleDeletePlace = useCallback(
    async (placeId: string, _placeLabel: string) => {
      try {
        await deleteUserPlace(placeId);
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));
      } catch (error) {
        console.error("[place-labels] Failed to delete place:", error);
      }
    },
    [],
  );

  return (
    <PlaceLabelsTemplate
      places={places}
      activityCategories={activityCategories}
      isLoading={isLoading}
      onBack={() => router.back()}
      onUpdatePlace={handleUpdatePlace}
      onDeletePlace={handleDeletePlace}
    />
  );
}
