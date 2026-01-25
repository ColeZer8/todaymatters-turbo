import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native';

export interface LocationMappingItem {
  id: string;
  location_address: string;
  activity_name: string;
}

interface LocationMappingsTemplateProps {
  mappings: LocationMappingItem[];
  isLoading: boolean;
  onAddMapping: (locationAddress: string, activityName: string) => Promise<void>;
  onEditMapping: (id: string, locationAddress: string, activityName: string) => Promise<void>;
  onDeleteMapping: (id: string) => Promise<void>;
  onBack: () => void;
}

export const LocationMappingsTemplate = ({
  mappings,
  isLoading,
  onAddMapping,
  onEditMapping,
  onDeleteMapping,
  onBack,
}: LocationMappingsTemplateProps) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMapping, setEditingMapping] = useState<LocationMappingItem | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [activityName, setActivityName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingMapping(null);
    setLocationAddress('');
    setActivityName('');
    setIsModalVisible(true);
  };

  const openEditModal = (mapping: LocationMappingItem) => {
    setEditingMapping(mapping);
    setLocationAddress(mapping.location_address);
    setActivityName(mapping.activity_name);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setEditingMapping(null);
    setLocationAddress('');
    setActivityName('');
  };

  const handleSave = async () => {
    const trimmedAddress = locationAddress.trim();
    const trimmedActivity = activityName.trim();

    if (!trimmedAddress || !trimmedActivity) {
      Alert.alert('Missing Information', 'Please enter both a location address and an activity name.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMapping) {
        await onEditMapping(editingMapping.id, trimmedAddress, trimmedActivity);
      } else {
        await onAddMapping(trimmedAddress, trimmedActivity);
      }
      closeModal();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save mapping.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (mapping: LocationMappingItem) => {
    Alert.alert(
      'Delete Mapping',
      `Are you sure you want to delete the mapping for "${mapping.location_address}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDeleteMapping(mapping.id);
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete mapping.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <ScrollView className="flex-1 px-5 pb-8">
        {/* Header with back button */}
        <View className="mt-4 flex-row items-center">
          <Pressable
            onPress={onBack}
            hitSlop={12}
            className="flex-row items-center gap-1 py-2 pr-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ArrowLeft size={18} color="#2563EB" strokeWidth={2.5} />
            <Text className="text-[15px] font-semibold text-[#2563EB]">Back</Text>
          </Pressable>
        </View>

        {/* Title */}
        <Text className="mt-4 text-[24px] font-bold text-[#0F172A]">Location Mappings</Text>
        <Text className="mt-2 text-[14px] text-[#64748B]">
          Map locations to activities so the system can automatically infer what you were doing.
        </Text>

        {/* Add button */}
        <Pressable
          onPress={openAddModal}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl border border-[#2563EB] bg-[#EFF6FF] px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Plus size={18} color="#2563EB" />
          <Text className="text-[14px] font-semibold text-[#2563EB]">Add Location Mapping</Text>
        </Pressable>

        {/* Loading state */}
        {isLoading && (
          <Text className="mt-6 text-center text-[13px] text-[#94A3B8]">Loading mappings…</Text>
        )}

        {/* Empty state */}
        {!isLoading && mappings.length === 0 && (
          <View className="mt-6 rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-4 py-6">
            <View className="items-center">
              <MapPin size={32} color="#94A3B8" />
              <Text className="mt-3 text-[14px] font-semibold text-[#1E293B]">No mappings yet</Text>
              <Text className="mt-2 text-center text-[13px] text-[#64748B]">
                Add a location mapping to help the system understand your activities.
              </Text>
            </View>
          </View>
        )}

        {/* Mappings list */}
        <View className="mt-4 gap-3">
          {mappings.map((mapping) => (
            <View
              key={mapping.id}
              className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <MapPin size={16} color="#2563EB" />
                    <Text className="flex-1 text-[14px] font-semibold text-[#0F172A]" numberOfLines={2}>
                      {mapping.location_address}
                    </Text>
                  </View>
                  <View className="mt-2 flex-row items-center">
                    <Text className="text-[12px] text-[#64748B]">Maps to: </Text>
                    <View className="rounded-full bg-[#F1F5F9] px-2 py-1">
                      <Text className="text-[12px] font-medium text-[#475569]">{mapping.activity_name}</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => openEditModal(mapping)}
                    className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F9]"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Pencil size={16} color="#64748B" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(mapping)}
                    className="h-9 w-9 items-center justify-center rounded-full bg-[#FEF2F2]"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[18px] font-semibold text-[#0F172A]">
                {editingMapping ? 'Edit Mapping' : 'Add Mapping'}
              </Text>
              <Pressable onPress={closeModal}>
                <Text className="text-[14px] font-semibold text-[#2563EB]">Cancel</Text>
              </Pressable>
            </View>

            <View className="mt-6">
              <Text className="text-[13px] font-medium text-[#475569]">Location Address</Text>
              <TextInput
                value={locationAddress}
                onChangeText={setLocationAddress}
                placeholder="e.g., 123 Main Street, City"
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[14px] text-[#0F172A]"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View className="mt-4">
              <Text className="text-[13px] font-medium text-[#475569]">Activity Name</Text>
              <TextInput
                value={activityName}
                onChangeText={setActivityName}
                placeholder="e.g., Work, Gym, Home"
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[14px] text-[#0F172A]"
                autoCapitalize="words"
              />
            </View>

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              className="mt-6 items-center rounded-xl bg-[#2563EB] px-4 py-3"
              style={({ pressed }) => ({ opacity: pressed || isSaving ? 0.8 : 1 })}
            >
              <Text className="text-[15px] font-semibold text-white">
                {isSaving ? 'Saving…' : editingMapping ? 'Save Changes' : 'Add Mapping'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
