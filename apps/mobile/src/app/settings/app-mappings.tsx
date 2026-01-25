import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { AppMappingsTemplate, type AppMappingItem } from '@/components/templates';
import { useAuthStore } from '@/stores';
import {
  fetchAppMappings,
  createAppMapping,
  updateAppMapping,
  deleteAppMapping,
  type AppMapping,
} from '@/lib/supabase/services';

export default function SettingsAppMappingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [mappings, setMappings] = useState<AppMappingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load mappings on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadMappings = async () => {
      try {
        const data = await fetchAppMappings(user.id);
        if (cancelled) return;
        setMappings(data.map(toTemplateItem));
      } catch (error) {
        console.error('Failed to load app mappings:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadMappings();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleAddMapping = useCallback(
    async (appName: string, activityType: string, isDistraction: boolean) => {
      if (!user?.id) throw new Error('Not authenticated');

      const created = await createAppMapping(user.id, {
        app_name: appName,
        activity_type: activityType,
        is_distraction: isDistraction,
      });

      setMappings((prev) => [toTemplateItem(created), ...prev]);
    },
    [user?.id]
  );

  const handleEditMapping = useCallback(
    async (id: string, appName: string, activityType: string, isDistraction: boolean) => {
      if (!user?.id) throw new Error('Not authenticated');

      const updated = await updateAppMapping(user.id, id, {
        app_name: appName,
        activity_type: activityType,
        is_distraction: isDistraction,
      });

      setMappings((prev) =>
        prev.map((item) => (item.id === id ? toTemplateItem(updated) : item))
      );
    },
    [user?.id]
  );

  const handleDeleteMapping = useCallback(
    async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      await deleteAppMapping(user.id, id);
      setMappings((prev) => prev.filter((item) => item.id !== id));
    },
    [user?.id]
  );

  return (
    <AppMappingsTemplate
      mappings={mappings}
      isLoading={isLoading}
      onAddMapping={handleAddMapping}
      onEditMapping={handleEditMapping}
      onDeleteMapping={handleDeleteMapping}
      onBack={() => router.back()}
    />
  );
}

function toTemplateItem(mapping: AppMapping): AppMappingItem {
  return {
    id: mapping.id,
    app_name: mapping.app_name,
    activity_type: mapping.activity_type,
    is_distraction: mapping.is_distraction,
  };
}
