import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Search,
  X,
  Navigation,
  Video,
  Mic,
  MapPin,
  Briefcase,
  Home,
  Trash2,
} from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import { useOnboardingStore } from "@/stores";
import { useOnboardingSync } from "@/lib/supabase/hooks/use-onboarding-sync";

async function loadExpoLocationAsync(): Promise<
  typeof import("expo-location") | null
> {
  try {
    // Lazy-load to avoid hard-crashing the app when the native module isn't compiled into the dev client.
    return await import("expo-location");
  } catch {
    return null;
  }
}

interface LocationResult {
  id: string;
  name: string;
  address: string;
  type: "location" | "video" | "suggestion" | "action";
}

interface LocationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: string) => void;
  currentLocation?: string;
}

export const LocationSearchModal = ({
  visible,
  onClose,
  onSelect,
  currentLocation,
}: LocationSearchModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingAddressType, setPendingAddressType] = useState<
    "home" | "work" | null
  >(null);
  const searchInputRef = useRef<TextInput>(null);

  // Privacy and personalization: Get home/work from store
  const { homeAddress, workAddress, setHomeAddress, setWorkAddress } =
    useOnboardingStore();
  const { saveHomeAddress, saveWorkAddress } = useOnboardingSync({
    autoLoad: false,
  });

  // Dynamic suggestions based on what's set
  const suggestions: LocationResult[] = [
    {
      id: "work",
      name: workAddress ? "Work" : "Set Work Address",
      address: workAddress || "Tap to search and save your work address",
      type: "suggestion",
    },
    {
      id: "home",
      name: homeAddress ? "Home" : "Set Home Address",
      address: homeAddress || "Tap to search and save your home address",
      type: "suggestion",
    },
  ];

  const searchLocations = async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Using Photon (OpenStreetMap) API - Free, no key required
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`,
      );
      const data = await response.json();

      const mappedResults: LocationResult[] = data.features.map(
        (feature: any, index: number) => {
          const { name, street, city, state, country } = feature.properties;
          const addressParts = [street, city, state, country].filter(Boolean);
          return {
            id: `result-${index}`,
            name: name || street || city || "Unknown Location",
            address: addressParts.join(", "),
            type: "location",
          };
        },
      );

      setResults(mappedResults);
    } catch (error) {
      console.error("Location search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        searchLocations(searchQuery);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleGetCurrentLocation = async () => {
    const Location = await loadExpoLocationAsync();
    if (!Location || !Location.requestForegroundPermissionsAsync) {
      alert(
        "Location services are not available in this build yet. Please rebuild the app.",
      );
      return;
    }

    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Permission to access location was denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const locationStr = [
          address.name,
          address.street,
          address.city,
          address.region,
        ]
          .filter(Boolean)
          .join(", ");
        onSelect(locationStr);
        onClose();
      }
    } catch (error) {
      console.error("Error getting current location:", error);
      alert("Could not determine your location.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: LocationResult }) => (
    <Pressable
      onPress={async () => {
        if (item.id === "clear") {
          onSelect("");
        } else {
          const finalLocation =
            item.type === "suggestion"
              ? item.address
              : item.name + (item.address ? `, ${item.address}` : "");

          // If we were in "Set Home/Work" mode, save it
          if (pendingAddressType === "work") {
            setWorkAddress(finalLocation);
            void saveWorkAddress(finalLocation);
            alert(`Saved "${item.name}" as Work address.`);
          } else if (pendingAddressType === "home") {
            setHomeAddress(finalLocation);
            void saveHomeAddress(finalLocation);
            alert(`Saved "${item.name}" as Home address.`);
          }

          onSelect(finalLocation);
        }
        onClose();
      }}
      className="flex-row items-center px-4 py-3 border-b border-[#F2F2F7]"
    >
      <View
        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
          item.id === "clear"
            ? "bg-[#FEE2E2]"
            : item.type === "video"
              ? "bg-[#34C759]"
              : "bg-[#F2F2F7]"
        }`}
      >
        <Icon
          icon={
            item.id === "clear"
              ? Trash2
              : item.type === "video"
                ? Video
                : item.id === "work"
                  ? Briefcase
                  : item.id === "home"
                    ? Home
                    : MapPin
          }
          size={16}
          color={
            item.id === "clear"
              ? "#EF4444"
              : item.type === "video"
                ? "white"
                : "#8E8E93"
          }
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-lg font-semibold ${item.id === "clear" ? "text-[#EF4444]" : "text-[#111827]"}`}
        >
          {item.name}
        </Text>
        {item.address && (
          <Text className="text-sm text-[#8E8E93]" numberOfLines={1}>
            {item.address}
          </Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#F2F2F7]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <View style={{ width: 40 }} />
          <Text className="text-lg font-bold text-[#111827]">Location</Text>
          <Pressable
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-[#E5E5EA] items-center justify-center"
          >
            <Icon icon={X} size={18} color="#8E8E93" />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View className="px-4 py-2">
          <View className="flex-row items-center bg-[#E5E5EA] rounded-xl px-3 py-2">
            <Icon icon={Search} size={18} color="#8E8E93" />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Enter Location or Video Call"
              placeholderTextColor="#8E8E93"
              className="flex-1 ml-2 text-lg text-[#111827]"
              autoFocus
            />
            <Icon icon={Mic} size={18} color="#8E8E93" />
          </View>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1">
          {!searchQuery && (
            <>
              {/* Suggestions */}
              <View className="mt-2 bg-white">
                {suggestions.map((item) => {
                  const isWork = item.id === "work";
                  const addr = isWork ? workAddress : homeAddress;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={async () => {
                        if (!addr) {
                          // Enter "Set Mode" and focus search bar
                          setPendingAddressType(isWork ? "work" : "home");
                          searchInputRef.current?.focus();
                          return;
                        }

                        onSelect(addr);
                        onClose();
                      }}
                      className="flex-row items-center px-4 py-3 border-b border-[#F2F2F7]"
                    >
                      <View
                        className={`w-8 h-8 rounded-full bg-[#F2F2F7] items-center justify-center mr-3 ${
                          pendingAddressType === (isWork ? "work" : "home")
                            ? "border-2 border-[#3B82F6]"
                            : ""
                        }`}
                      >
                        <Icon
                          icon={isWork ? Briefcase : Home}
                          size={16}
                          color={
                            pendingAddressType === (isWork ? "work" : "home")
                              ? "#3B82F6"
                              : "#8E8E93"
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-[#111827]">
                          {item.name}
                        </Text>
                        <Text
                          className={`text-sm ${addr ? "text-[#8E8E93]" : "text-[#3B82F6]"}`}
                          numberOfLines={1}
                        >
                          {addr || item.address}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Actions (Clear Location) */}
              {currentLocation && (
                <View className="mt-2 bg-white">
                  <Pressable
                    onPress={() => {
                      onSelect("");
                      onClose();
                    }}
                    className="flex-row items-center px-4 py-4 border-b border-[#F2F2F7]"
                  >
                    <View className="w-8 h-8 rounded-full bg-[#FEE2E2] items-center justify-center mr-3">
                      <Icon icon={Trash2} size={16} color="#EF4444" />
                    </View>
                    <Text className="text-lg text-[#EF4444] font-semibold">
                      Remove Location
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Current Location */}
              <Pressable
                onPress={handleGetCurrentLocation}
                className="flex-row items-center px-4 py-4 bg-white mt-4"
              >
                <View className="w-8 h-8 rounded-full bg-[#007AFF] items-center justify-center mr-3">
                  <Icon icon={Navigation} size={16} color="white" />
                </View>
                <Text className="text-lg text-[#007AFF] font-semibold">
                  Current Location
                </Text>
              </Pressable>

              {/* Video Call */}
              <View className="px-4 py-2 mt-6">
                <Text className="text-xs font-semibold text-[#8E8E93] uppercase">
                  Video Call
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  onSelect("Video Call");
                  onClose();
                }}
                className="flex-row items-center px-4 py-3 bg-white"
              >
                <View className="w-8 h-8 rounded-full bg-[#34C759] items-center justify-center mr-3">
                  <Icon icon={Video} size={16} color="white" />
                </View>
                <Text className="text-lg text-[#111827] font-semibold">
                  Video Call
                </Text>
              </Pressable>
            </>
          )}

          {loading && (
            <View className="py-8">
              <ActivityIndicator color="#007AFF" />
            </View>
          )}

          {searchQuery && !loading && (
            <View className="bg-white">
              <FlatList
                data={results}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
