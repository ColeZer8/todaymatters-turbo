import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Pencil,
  Trash2,
  X,
  Check,
  Tag,
} from 'lucide-react-native';
import { HierarchicalCategoryPicker } from '@/components/molecules';
import type { ActivityCategory } from '@/lib/supabase/services/activity-categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaceLabelItem {
  id: string;
  label: string;
  category: string | null;
  category_id: string | null;
  radius_m: number;
  /** Resolved hierarchical category name (e.g., 'Family > Dog Walking') */
  categoryDisplayName: string | null;
  /** Number of events auto-tagged from this place */
  autoTagCount: number;
}

export interface PlaceLabelsTemplateProps {
  places: PlaceLabelItem[];
  activityCategories: ActivityCategory[];
  isLoading: boolean;
  onBack: () => void;
  onUpdatePlace: (
    placeId: string,
    label: string,
    categoryId: string | null
  ) => Promise<void>;
  onDeletePlace: (placeId: string, placeLabel: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PlaceLabelsTemplate = ({
  places,
  activityCategories,
  isLoading,
  onBack,
  onUpdatePlace,
  onDeletePlace,
}: PlaceLabelsTemplateProps) => {
  const insets = useSafeAreaInsets();
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = useCallback(
    (place: PlaceLabelItem) => {
      setEditingPlaceId(place.id);
      setEditLabel(place.label);
      setEditCategoryId(place.category_id);
    },
    []
  );

  const handleCancelEdit = useCallback(() => {
    setEditingPlaceId(null);
    setEditLabel('');
    setEditCategoryId(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingPlaceId || !editLabel.trim()) return;
    setIsSaving(true);
    try {
      await onUpdatePlace(editingPlaceId, editLabel.trim(), editCategoryId);
      setEditingPlaceId(null);
      setEditLabel('');
      setEditCategoryId(null);
    } catch {
      Alert.alert('Error', 'Failed to update place label. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [editingPlaceId, editLabel, editCategoryId, onUpdatePlace]);

  const handleDelete = useCallback(
    (place: PlaceLabelItem) => {
      Alert.alert(
        'Delete Place Label',
        `Are you sure you want to delete "${place.label}"? Future visits will no longer auto-tag.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDeletePlace(place.id, place.label),
          },
        ]
      );
    },
    [onDeletePlace]
  );

  return (
    <View className="flex-1 bg-[#F7FAFF]">
      {/* Header */}
      <View
        className="bg-[#F7FAFF] px-6"
        style={{
          paddingTop: Math.max(insets.top - 11, 0),
          paddingBottom: 12,
          shadowColor: '#0f172a',
          shadowOpacity: 0.03,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
          zIndex: 10,
        }}
      >
        <View className="flex-row items-center my-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={onBack}
            className="flex-row items-center"
            style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
          >
            <ArrowLeft size={20} color="#2563EB" />
            <Text className="ml-1 text-[15px] font-semibold text-[#2563EB]">
              Back
            </Text>
          </Pressable>

          <View className="flex-1 items-center">
            <Text className="text-[#0F172A] text-[17px] font-semibold">
              Place Labels
            </Text>
          </View>

          {/* Spacer for centering */}
          <View className="w-[60px]" />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-3 text-base text-[#94A3B8]">
              Loading places...
            </Text>
          </View>
        ) : places.length === 0 ? (
          <View className="items-center py-16 px-4">
            <MapPin size={40} color="#CBD5E1" />
            <Text className="mt-4 text-lg font-semibold text-[#475569]">
              No Place Labels Yet
            </Text>
            <Text className="mt-2 text-center text-base text-[#94A3B8]">
              Label places from the event editor to auto-tag future visits.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {places.map((place) => (
              <View
                key={place.id}
                className="rounded-2xl border border-[#E5E9F2] bg-white"
              >
                {editingPlaceId === place.id ? (
                  /* ---- Edit Mode ---- */
                  <View className="p-4">
                    {/* Label input */}
                    <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8] mb-2">
                      Place Name
                    </Text>
                    <TextInput
                      className="h-12 rounded-xl border border-[#E2E8F0] bg-[#F7FAFF] px-4 text-base text-[#111827]"
                      value={editLabel}
                      onChangeText={setEditLabel}
                      placeholder="Place name"
                      placeholderTextColor="#94A3B8"
                      autoFocus
                    />

                    {/* Category picker */}
                    <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8] mt-4 mb-2">
                      Category
                    </Text>
                    <View style={{ maxHeight: 280 }}>
                      <HierarchicalCategoryPicker
                        categories={activityCategories}
                        selectedCategoryId={editCategoryId}
                        onSelect={(categoryId) => setEditCategoryId(categoryId)}
                      />
                    </View>

                    {/* Save / Cancel buttons */}
                    <View className="flex-row gap-3 mt-4">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Cancel editing"
                        onPress={handleCancelEdit}
                        className="flex-1 flex-row items-center justify-center rounded-xl border border-[#E2E8F0] bg-white py-3"
                        style={({ pressed }) => [
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <X size={16} color="#64748B" />
                        <Text className="ml-1.5 text-sm font-semibold text-[#64748B]">
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Save changes"
                        onPress={handleSaveEdit}
                        disabled={isSaving || !editLabel.trim()}
                        className="flex-1 flex-row items-center justify-center rounded-xl bg-[#2563EB] py-3"
                        style={({ pressed }) => [
                          {
                            opacity:
                              isSaving || !editLabel.trim()
                                ? 0.5
                                : pressed
                                  ? 0.85
                                  : 1,
                          },
                        ]}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Check size={16} color="#fff" />
                            <Text className="ml-1.5 text-sm font-semibold text-white">
                              Save
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  /* ---- Display Mode ---- */
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${place.label}`}
                    onPress={() => handleStartEdit(place)}
                    className="p-4"
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View className="flex-row items-center">
                      {/* Pin icon */}
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF]">
                        <MapPin size={20} color="#2563EB" />
                      </View>

                      {/* Place info */}
                      <View className="flex-1">
                        <Text
                          className="text-base font-semibold text-[#111827]"
                          numberOfLines={1}
                        >
                          {place.label}
                        </Text>

                        {place.categoryDisplayName ? (
                          <View className="flex-row items-center mt-0.5">
                            <Tag size={12} color="#64748B" />
                            <Text
                              className="ml-1 text-sm text-[#64748B]"
                              numberOfLines={1}
                            >
                              {place.categoryDisplayName}
                            </Text>
                          </View>
                        ) : null}

                        {place.autoTagCount > 0 ? (
                          <Text className="mt-0.5 text-xs text-[#94A3B8]">
                            {place.autoTagCount} auto-tagged event
                            {place.autoTagCount !== 1 ? 's' : ''}
                          </Text>
                        ) : null}
                      </View>

                      {/* Action buttons */}
                      <View className="flex-row items-center gap-2">
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${place.label}`}
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleStartEdit(place);
                          }}
                          className="rounded-lg p-2"
                          style={({ pressed }) => [
                            { opacity: pressed ? 0.6 : 1 },
                          ]}
                        >
                          <Pencil size={16} color="#64748B" />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${place.label}`}
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(place);
                          }}
                          className="rounded-lg p-2"
                          style={({ pressed }) => [
                            { opacity: pressed ? 0.6 : 1 },
                          ]}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};
