import { useState, useCallback, useEffect, useRef } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { MapPin, Check, Search } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { PLACE_LABEL_SUGGESTIONS, getSuggestedCategory } from "@/lib/supabase/services/user-places";
import {
  searchPlacesAutocomplete,
  createSessionToken,
  cancelAutocomplete,
  type PlaceAutocompletePrediction,
} from "@/lib/supabase/services/google-places";

interface AddPlaceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (label: string, category: string | null) => void;
  /** Initial label suggestion (e.g., from Google Places) */
  initialLabel?: string;
  /** Whether a save is in progress */
  isSaving?: boolean;
  /** GPS latitude for autocomplete location bias */
  latitude?: number | null;
  /** GPS longitude for autocomplete location bias */
  longitude?: number | null;
}

/**
 * Modal for adding a new place label when viewing a session at an unknown location.
 * Provides common place suggestions (Home, Office, Gym) and custom text input.
 */
export const AddPlaceModal = ({
  visible,
  onClose,
  onSave,
  initialLabel = "",
  isSaving = false,
  latitude = null,
  longitude = null,
}: AddPlaceModalProps) => {
  const [customLabel, setCustomLabel] = useState(initialLabel);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  // Autocomplete state
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<PlaceAutocompletePrediction[]>([]);
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
  const [sessionToken] = useState(() => createSessionToken());
  const autocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCustomLabel(initialLabel);
      setSelectedSuggestion(null);
      setAutocompleteSuggestions([]);
    } else {
      cancelAutocomplete();
      if (autocompleteTimerRef.current) {
        clearTimeout(autocompleteTimerRef.current);
      }
    }
  }, [visible, initialLabel]);

  const handleSelectSuggestion = useCallback((label: string) => {
    setSelectedSuggestion(label);
    setCustomLabel(""); // Clear custom input when selecting a suggestion
    setAutocompleteSuggestions([]);
  }, []);

  const handleCustomInput = useCallback((text: string) => {
    setCustomLabel(text);
    setSelectedSuggestion(null); // Clear suggestion when typing custom

    // Debounced autocomplete search
    if (autocompleteTimerRef.current) {
      clearTimeout(autocompleteTimerRef.current);
    }

    if (text.length < 2) {
      setAutocompleteSuggestions([]);
      setIsLoadingAutocomplete(false);
      return;
    }

    setIsLoadingAutocomplete(true);
    autocompleteTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchPlacesAutocomplete(
          text,
          latitude,
          longitude,
          sessionToken
        );
        setAutocompleteSuggestions(results);
      } catch {
        setAutocompleteSuggestions([]);
      } finally {
        setIsLoadingAutocomplete(false);
      }
    }, 300);
  }, [latitude, longitude, sessionToken]);

  const handleAutocompletePick = useCallback((prediction: PlaceAutocompletePrediction) => {
    setCustomLabel(prediction.mainText);
    setSelectedSuggestion(null);
    setAutocompleteSuggestions([]);
  }, []);

  const handleSave = useCallback(() => {
    const label = selectedSuggestion || customLabel.trim();
    if (!label) return;

    const category = getSuggestedCategory(label);
    onSave(label, category);
  }, [selectedSuggestion, customLabel, onSave]);

  const handleCancel = useCallback(() => {
    setCustomLabel("");
    setSelectedSuggestion(null);
    onClose();
  }, [onClose]);

  const canSave = (selectedSuggestion || customLabel.trim()) && !isSaving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE]">
              <Icon icon={MapPin} size={20} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text className="text-[18px] font-bold text-[#111827]">
                Add Place
              </Text>
              <Text className="text-[14px] text-[#64748B]">
                Label this location for future recognition
              </Text>
            </View>
          </View>

          {/* Suggestion chips */}
          <View className="mt-5">
            <Text className="text-[12px] font-semibold tracking-wider text-[#94A3B8] mb-2">
              QUICK SELECT
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row -mx-1"
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {PLACE_LABEL_SUGGESTIONS.map((label) => {
                const isSelected = selectedSuggestion === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => handleSelectSuggestion(label)}
                    className={`mr-2 flex-row items-center rounded-full px-4 py-2 ${
                      isSelected ? "bg-[#2563EB]" : "bg-[#F1F5F9]"
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  >
                    {isSelected && (
                      <Icon icon={Check} size={14} color="#FFFFFF" />
                    )}
                    <Text
                      className={`text-[14px] font-medium ${
                        isSelected ? "text-white ml-1" : "text-[#475569]"
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Custom input with autocomplete */}
          <View className="mt-5">
            <Text className="text-[12px] font-semibold tracking-wider text-[#94A3B8] mb-2">
              OR SEARCH / ENTER CUSTOM NAME
            </Text>
            <View className="flex-row items-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3">
              <Icon icon={Search} size={16} color="#94A3B8" />
              <TextInput
                value={customLabel}
                onChangeText={handleCustomInput}
                placeholder="e.g., Starbucks, Mom's House"
                placeholderTextColor="#94A3B8"
                className="flex-1 px-2 py-3 text-[15px] text-[#111827]"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={canSave ? handleSave : undefined}
              />
              {isLoadingAutocomplete && (
                <ActivityIndicator size="small" color="#2563EB" />
              )}
            </View>

            {/* Autocomplete suggestions */}
            {autocompleteSuggestions.length > 0 && (
              <View className="mt-1 rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
                {autocompleteSuggestions.slice(0, 4).map((prediction) => (
                  <Pressable
                    key={prediction.placeId}
                    onPress={() => handleAutocompletePick(prediction)}
                    className="flex-row items-center px-3 py-2.5 border-b border-[#F2F2F7]"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className="w-7 h-7 rounded-md bg-[#EFF6FF] items-center justify-center mr-2.5">
                      <Icon icon={MapPin} size={14} color="#2563EB" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-semibold text-[#111827]" numberOfLines={1}>
                        {prediction.mainText}
                      </Text>
                      <Text className="text-[12px] text-[#94A3B8]" numberOfLines={1}>
                        {prediction.secondaryText}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Info text */}
          <View className="mt-4 rounded-lg bg-[#F0FDF4] p-3">
            <Text className="text-[13px] text-[#166534] leading-5">
              Future visits within 150m of this location will automatically be tagged with this place name.
            </Text>
          </View>

          {/* Action buttons */}
          <View className="mt-6 flex-row justify-end gap-3">
            <Pressable
              onPress={handleCancel}
              className="rounded-lg px-5 py-3"
              disabled={isSaving}
            >
              <Text className="text-[15px] font-semibold text-[#6B7280]">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              className={`rounded-lg px-5 py-3 ${
                canSave ? "bg-[#2563EB]" : "bg-[#94A3B8]"
              }`}
              style={({ pressed }) => ({ opacity: pressed && canSave ? 0.8 : 1 })}
            >
              <Text className="text-[15px] font-bold text-white">
                {isSaving ? "Saving..." : "Save Place"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
