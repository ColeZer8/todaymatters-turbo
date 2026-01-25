import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { LocationMappingsTemplate, type LocationMappingItem } from '@/components/templates';
import { useAuthStore } from '@/stores';
import {
  fetchLocationMappings,
  createLocationMapping,
  updateLocationMapping,
  deleteLocationMapping,
  type LocationMapping,
} from '@/lib/supabase/services';

export default function SettingsLocationMappingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [mappings, setMappings] = useState<LocationMappingItem[]>([]);
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
        const data = await fetchLocationMappings(user.id);
        if (cancelled) return;
        setMappings(data.map(toTemplateItem));
      } catch (error) {
        console.error('Failed to load location mappings:', error);
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
    async (locationAddress: string, activityName: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const created = await createLocationMapping(user.id, {
        location_address: locationAddress,
        activity_name: activityName,
      });

      setMappings((prev) => [toTemplateItem(created), ...prev]);
    },
    [user?.id]
  );

  const handleEditMapping = useCallback(
    async (id: string, locationAddress: string, activityName: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const updated = await updateLocationMapping(user.id, id, {
        location_address: locationAddress,
        activity_name: activityName,
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

      await deleteLocationMapping(user.id, id);
      setMappings((prev) => prev.filter((item) => item.id !== id));
    },
    [user?.id]
  );

  return (
    <LocationMappingsTemplate
      mappings={mappings}
      isLoading={isLoading}
      onAddMapping={handleAddMapping}
      onEditMapping={handleEditMapping}
      onDeleteMapping={handleDeleteMapping}
      onBack={() => router.back()}
    />
  );
}

function toTemplateItem(mapping: LocationMapping): LocationMappingItem {
  return {
    id: mapping.id,
    location_address: mapping.location_address,
    activity_name: mapping.activity_name,
  };
}
