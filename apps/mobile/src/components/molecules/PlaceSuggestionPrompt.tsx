import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { MapPin, Check, X, ChevronRight } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import {
  fetchNearbyPlaces,
  getBestSuggestion,
  getPlaceTypeLabel,
  mapPlaceTypeToCategory,
  isGooglePlacesAvailable,
  type GooglePlaceSuggestion,
} from "@/lib/supabase/services/google-places";

// Theme colors
const COLORS = {
  primary: "#2563EB",
  success: "#16A34A",
  danger: "#DC2626",
  textDark: "#111827",
  textMuted: "#64748B",
  border: "#E5E7EB",
  cardBg: "#FFFFFF",
  suggestionBg: "#F0F9FF",
};

interface PlaceSuggestionPromptProps {
  /** Latitude of the unknown location */
  latitude: number;
  /** Longitude of the unknown location */
  longitude: number;
  /** Called when user accepts a suggestion */
  onAccept: (suggestion: GooglePlaceSuggestion, category: string | null) => void;
  /** Called when user rejects the suggestion (wants manual entry) */
  onReject: () => void;
  /** Called when user wants to use "Near [Area]" fallback */
  onUseFallback?: (fallbackName: string) => void;
  /** Whether the component is in a loading state (saving) */
  isSaving?: boolean;
  /** Optional style overrides */
  className?: string;
}

/**
 * PlaceSuggestionPrompt - Shows a Google Places suggestion for an unknown location.
 *
 * Displays an "Are you at [Place]?" prompt when the user views a session at an
 * unknown location. The suggestion comes from Google Places Nearby Search API
 * with 15-minute caching to reduce API calls.
 *
 * If rejected, the user can enter a manual label or use a "Near [Area]" fallback.
 */
export const PlaceSuggestionPrompt = ({
  latitude,
  longitude,
  onAccept,
  onReject,
  onUseFallback,
  isSaving = false,
  className = "",
}: PlaceSuggestionPromptProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<GooglePlaceSuggestion | null>(null);
  const [allSuggestions, setAllSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Check if API is available
  const apiAvailable = isGooglePlacesAvailable();

  // Fetch suggestions on mount
  useEffect(() => {
    if (!apiAvailable) {
      setIsLoading(false);
      setError("Google Places API not configured");
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);

      const result = await fetchNearbyPlaces(latitude, longitude);

      if (!result.success) {
        setError(result.error || "Failed to fetch suggestions");
        setSuggestion(null);
        setAllSuggestions([]);
      } else if (result.suggestions.length === 0) {
        // No suggestions found - this is normal for remote locations
        setSuggestion(null);
        setAllSuggestions([]);
      } else {
        setAllSuggestions(result.suggestions);
        setSuggestion(getBestSuggestion(result.suggestions));
      }

      setIsLoading(false);
    };

    fetchSuggestions();
  }, [latitude, longitude, apiAvailable]);

  // Handle accepting the current suggestion
  const handleAccept = useCallback(() => {
    if (!suggestion || isSaving) return;

    const category = mapPlaceTypeToCategory(suggestion.types);
    onAccept(suggestion, category);
  }, [suggestion, isSaving, onAccept]);

  // Handle accepting an alternative suggestion
  const handleAcceptAlternative = useCallback(
    (alt: GooglePlaceSuggestion) => {
      if (isSaving) return;

      const category = mapPlaceTypeToCategory(alt.types);
      onAccept(alt, category);
    },
    [isSaving, onAccept]
  );

  // Handle rejecting the suggestion
  const handleReject = useCallback(() => {
    if (isSaving) return;
    onReject();
  }, [isSaving, onReject]);

  // Handle using fallback
  const handleFallback = useCallback(() => {
    if (isSaving) return;
    // Use a generic fallback based on vicinity from first suggestion
    const fallbackName =
      suggestion?.vicinity || allSuggestions[0]?.vicinity || "this area";
    const nearLabel = `Near ${fallbackName.split(",")[0]}`;
    if (onUseFallback) {
      onUseFallback(nearLabel);
    }
  }, [isSaving, suggestion, allSuggestions, onUseFallback]);

  // Show loading state
  if (isLoading) {
    return (
      <View className={`bg-white rounded-xl p-4 ${className}`}>
        <View className="flex-row items-center justify-center py-4">
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text className="ml-3 text-[14px] text-[#64748B]">
            Looking for nearby places...
          </Text>
        </View>
      </View>
    );
  }

  // Show error or no suggestions state
  if (error || !suggestion) {
    return null; // Don't show anything if no suggestions - user can still use manual entry
  }

  // Get display info for the suggestion
  const typeLabel = getPlaceTypeLabel(suggestion.types);
  const distanceText =
    suggestion.distanceM < 100
      ? "Very close"
      : `${suggestion.distanceM}m away`;

  return (
    <View className={`overflow-hidden rounded-xl bg-white ${className}`}>
      {/* Main suggestion */}
      <View className="p-4">
        <View className="flex-row items-center mb-3">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: COLORS.suggestionBg }}
          >
            <Icon icon={MapPin} size={20} color={COLORS.primary} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[12px] font-semibold tracking-wider text-[#94A3B8] mb-1">
              SUGGESTED LOCATION
            </Text>
            <Text className="text-[16px] font-bold text-[#111827]">
              Are you at {suggestion.name}?
            </Text>
          </View>
        </View>

        {/* Place details */}
        <View className="ml-13 mb-4">
          <View className="flex-row items-center flex-wrap">
            <View className="bg-[#F1F5F9] px-2 py-1 rounded mr-2 mb-1">
              <Text className="text-[12px] font-medium text-[#475569]">
                {typeLabel}
              </Text>
            </View>
            <Text className="text-[13px] text-[#64748B]">{distanceText}</Text>
            {suggestion.rating !== undefined && (
              <Text className="text-[13px] text-[#64748B] ml-2">
                {suggestion.rating.toFixed(1)} rating
              </Text>
            )}
          </View>
          {suggestion.vicinity && (
            <Text className="text-[13px] text-[#64748B] mt-1" numberOfLines={1}>
              {suggestion.vicinity}
            </Text>
          )}
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleReject}
            disabled={isSaving}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border border-[#E5E7EB] ${
              isSaving ? "opacity-50" : ""
            }`}
            style={({ pressed }) => ({ opacity: pressed && !isSaving ? 0.7 : 1 })}
          >
            <Icon icon={X} size={18} color={COLORS.textMuted} />
            <Text className="ml-2 text-[15px] font-semibold text-[#475569]">
              No
            </Text>
          </Pressable>

          <Pressable
            onPress={handleAccept}
            disabled={isSaving}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
              isSaving ? "bg-[#94A3B8]" : "bg-[#16A34A]"
            }`}
            style={({ pressed }) => ({
              opacity: pressed && !isSaving ? 0.8 : 1,
            })}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon icon={Check} size={18} color="#FFFFFF" />
                <Text className="ml-2 text-[15px] font-bold text-white">
                  Yes
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Show alternatives toggle */}
      {allSuggestions.length > 1 && (
        <>
          <View className="h-[1px] bg-[#E5E5EA]" />
          <Pressable
            onPress={() => setShowAlternatives(!showAlternatives)}
            className="flex-row items-center justify-between px-4 py-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-[14px] text-[#2563EB]">
              {showAlternatives
                ? "Hide alternatives"
                : `See ${allSuggestions.length - 1} other suggestion${allSuggestions.length > 2 ? "s" : ""}`}
            </Text>
            <Icon
              icon={ChevronRight}
              size={18}
              color={COLORS.primary}
              style={{
                transform: [{ rotate: showAlternatives ? "90deg" : "0deg" }],
              }}
            />
          </Pressable>
        </>
      )}

      {/* Alternative suggestions */}
      {showAlternatives && allSuggestions.length > 1 && (
        <View className="border-t border-[#E5E5EA]">
          {allSuggestions.slice(1).map((alt) => {
            const altTypeLabel = getPlaceTypeLabel(alt.types);
            return (
              <Pressable
                key={alt.placeId}
                onPress={() => handleAcceptAlternative(alt)}
                disabled={isSaving}
                className={`flex-row items-center px-4 py-3 border-b border-[#F1F5F9] ${
                  isSaving ? "opacity-50" : ""
                }`}
                style={({ pressed }) => ({
                  opacity: pressed && !isSaving ? 0.7 : 1,
                })}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center bg-[#F1F5F9]">
                  <Icon icon={MapPin} size={14} color={COLORS.textMuted} />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-[14px] font-medium text-[#111827]"
                    numberOfLines={1}
                  >
                    {alt.name}
                  </Text>
                  <Text className="text-[12px] text-[#64748B]">
                    {altTypeLabel} &middot; {alt.distanceM}m away
                  </Text>
                </View>
                <Icon icon={Check} size={18} color={COLORS.success} />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Fallback option */}
      {onUseFallback && (
        <>
          <View className="h-[1px] bg-[#E5E5EA]" />
          <Pressable
            onPress={handleFallback}
            disabled={isSaving}
            className={`px-4 py-3 ${isSaving ? "opacity-50" : ""}`}
            style={({ pressed }) => ({
              opacity: pressed && !isSaving ? 0.7 : 1,
            })}
          >
            <Text className="text-[14px] text-center text-[#64748B]">
              Use &quot;Near {suggestion.vicinity?.split(",")[0] || "this area"}&quot; instead
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
};
