/**
 * LocationPermissionPrompt - Prompts user to enable location for better insights.
 *
 * Shows a gentle reminder that location improves the app experience.
 * Only shown when:
 * 1. Location permission is not granted
 * 2. At least 1 week has passed since the last prompt
 *
 * Used by US-027 to handle location permission denied gracefully.
 */

import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { MapPin, Settings, X } from "lucide-react-native";
import { Icon } from "../atoms/Icon";
import {
  shouldShowLocationPrompt,
  recordLocationPromptShown,
  openLocationSettings,
  type LocationPermissionStatus,
} from "@/lib/location-permission";

// Theme colors (consistent with app design)
const COLORS = {
  primary: "#2563EB",
  primaryBg: "#EFF6FF",
  success: "#16A34A",
  textDark: "#111827",
  textMuted: "#64748B",
  border: "#E5E7EB",
  cardBg: "#FFFFFF",
};

interface LocationPermissionPromptProps {
  /** Called when user dismisses the prompt (either by accepting or declining) */
  onDismiss?: () => void;
  /** Called when user taps "Go to Settings" */
  onGoToSettings?: () => void;
  /** Optional style overrides */
  className?: string;
}

/**
 * LocationPermissionPrompt - A non-intrusive prompt to enable location.
 *
 * Features:
 * - Auto-checks if prompt should be shown (respects weekly rate limit)
 * - Explains the value of location data
 * - Provides "Go to Settings" and "Not now" buttons
 * - Records when shown to enforce weekly limit
 */
export const LocationPermissionPrompt = ({
  onDismiss,
  onGoToSettings,
  className = "",
}: LocationPermissionPromptProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShow, setShouldShow] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  // Check if we should show the prompt on mount
  useEffect(() => {
    const checkPrompt = async () => {
      const result = await shouldShowLocationPrompt();
      setShouldShow(result.shouldShow);
      setPermissionStatus(result.permissionStatus);
      setIsLoading(false);

      if (__DEV__) {
        console.log(
          "[LocationPermissionPrompt] Check result:",
          result.reason,
          result.shouldShow
        );
      }
    };

    checkPrompt();
  }, []);

  // Handle dismissing the prompt
  const handleDismiss = useCallback(async () => {
    // Record that we showed the prompt (enforces weekly limit)
    await recordLocationPromptShown();
    setIsHidden(true);
    onDismiss?.();
  }, [onDismiss]);

  // Handle going to settings
  const handleGoToSettings = useCallback(async () => {
    // Record that we showed the prompt
    await recordLocationPromptShown();
    openLocationSettings();
    setIsHidden(true);
    onGoToSettings?.();
    onDismiss?.();
  }, [onGoToSettings, onDismiss]);

  // Don't render while loading or if shouldn't show
  if (isLoading || !shouldShow || isHidden) {
    return null;
  }

  // Customize message based on permission state
  const isServiceDisabled =
    permissionStatus && !permissionStatus.servicesEnabled;
  const canAskAgain = permissionStatus?.canAskAgain ?? true;

  const title = isServiceDisabled
    ? "Location Services Disabled"
    : "Enable Location for Better Insights";

  const description = isServiceDisabled
    ? "Turn on Location Services to see where you spent your time and get better daily summaries."
    : "Enable location to see where you spent your time each day. This helps track transitions between places like home, office, and gym.";

  const settingsButtonText =
    Platform.OS === "ios" ? "Open Settings" : "Go to Settings";

  return (
    <View
      className={`mx-4 my-3 overflow-hidden rounded-xl bg-white shadow-sm ${className}`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-start">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: COLORS.primaryBg }}
          >
            <Icon icon={MapPin} size={20} color={COLORS.primary} />
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-semibold text-[#111827] mb-1">
              {title}
            </Text>
            <Text className="text-[13px] text-[#64748B] leading-5">
              {description}
            </Text>
          </View>

          {/* Close button */}
          <Pressable
            onPress={handleDismiss}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            className="ml-2 -mt-1 -mr-1 p-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Icon icon={X} size={18} color={COLORS.textMuted} />
          </Pressable>
        </View>

        {/* Benefits list */}
        <View className="mt-3 ml-13">
          <View className="flex-row items-center mb-1">
            <View className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mr-2" />
            <Text className="text-[12px] text-[#475569]">
              See where you spent your time
            </Text>
          </View>
          <View className="flex-row items-center mb-1">
            <View className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mr-2" />
            <Text className="text-[12px] text-[#475569]">
              Automatic place recognition
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mr-2" />
            <Text className="text-[12px] text-[#475569]">
              Better daily session blocks
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3 mt-4">
          <Pressable
            onPress={handleDismiss}
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg border border-[#E5E7EB]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-[14px] font-medium text-[#64748B]">
              Not now
            </Text>
          </Pressable>

          <Pressable
            onPress={handleGoToSettings}
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg bg-[#2563EB]"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Icon icon={Settings} size={16} color="#FFFFFF" />
            <Text className="ml-2 text-[14px] font-semibold text-white">
              {settingsButtonText}
            </Text>
          </Pressable>
        </View>

        {/* Weekly limit note */}
        <Text className="text-[11px] text-[#94A3B8] text-center mt-3">
          We'll only ask once per week
        </Text>
      </View>
    </View>
  );
};

/**
 * Hook to use the location permission prompt state.
 * Returns whether the prompt should be shown without rendering it.
 */
export function useLocationPermissionPrompt() {
  const [state, setState] = useState<{
    isLoading: boolean;
    shouldShow: boolean;
    permissionStatus: LocationPermissionStatus | null;
    reason: string;
  }>({
    isLoading: true,
    shouldShow: false,
    permissionStatus: null,
    reason: "",
  });

  useEffect(() => {
    const check = async () => {
      const result = await shouldShowLocationPrompt();
      setState({
        isLoading: false,
        shouldShow: result.shouldShow,
        permissionStatus: result.permissionStatus,
        reason: result.reason,
      });
    };

    check();
  }, []);

  const dismiss = useCallback(async () => {
    await recordLocationPromptShown();
    setState((prev) => ({ ...prev, shouldShow: false }));
  }, []);

  return {
    ...state,
    dismiss,
    openSettings: openLocationSettings,
  };
}
