import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Mail,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { GradientButton } from "@/components/atoms";
import { SetupStepLayout } from "@/components/organisms";
import type { GoogleService } from "@/lib/google-services-oauth";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";

interface ServiceOption {
  id: GoogleService;
  name: string;
  description: string;
  icon: LucideIcon;
  iconBgClassName: string;
  permissions: string[];
}

const GOOGLE_SERVICES: ServiceOption[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync calendar events to track time against your goals.",
    icon: Calendar,
    iconBgClassName: "bg-blue-500",
    permissions: ["View your calendars", "View events on your calendars"],
  },
  {
    id: "google-gmail",
    name: "Gmail",
    description: "Track email communications and response times.",
    icon: Mail,
    iconBgClassName: "bg-violet-500",
    permissions: [
      "View your email messages",
      "View email metadata (sender, subject, date)",
    ],
  },
];

interface ConnectGoogleServicesTemplateProps {
  step?: number;
  totalSteps?: number;
  selectedServices: GoogleService[];
  expandedService: GoogleService | null;
  connectedServices?: GoogleService[];
  isConnecting: boolean;
  errorMessage?: string | null;
  hasAttemptedConnection?: boolean;
  onToggleService: (serviceId: GoogleService) => void;
  onToggleExpanded: (serviceId: GoogleService) => void;
  onConnect: () => void;
  onContinue?: () => void;
  onRetryConnection?: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

export const ConnectGoogleServicesTemplate = ({
  step = ONBOARDING_STEPS.connectGoogleServices,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  selectedServices,
  expandedService,
  connectedServices,
  isConnecting,
  errorMessage,
  hasAttemptedConnection = false,
  onToggleService,
  onToggleExpanded,
  onConnect,
  onContinue,
  onRetryConnection,
  onSkip,
  onBack,
}: ConnectGoogleServicesTemplateProps) => {
  const selectedCount = selectedServices.length;
  const connectedSet = useMemo(
    () => new Set(connectedServices ?? []),
    [connectedServices],
  );
  const selectedSet = useMemo(
    () => new Set(selectedServices),
    [selectedServices],
  );
  const selectedUnconnectedCount = useMemo(
    () =>
      selectedServices.filter((service) => !connectedSet.has(service)).length,
    [connectedSet, selectedServices],
  );
  // UX: after the user returns from an attempted connection, don't trap them in a "connect again" loop.
  // Always allow continuing, and offer an explicit try-again action.
  const showPostConnectActions = hasAttemptedConnection;

  const showContinue =
    showPostConnectActions ||
    (connectedSet.size > 0 && selectedUnconnectedCount === 0);
  const primaryLabel = showContinue
    ? "Continue"
    : selectedCount > 0
      ? `Connect (${selectedCount})`
      : "Connect";

  return (
    <View style={styles.root}>
      <SetupStepLayout
        step={step}
        totalSteps={totalSteps}
        title="Connect Google services"
        subtitle="Choose what you'd like to connect. You can change this anytime in Settings."
        onBack={onBack}
        footer={
          <View className="gap-3">
            <GradientButton
              label={primaryLabel}
              onPress={
                showContinue ? (onContinue ?? onSkip ?? onConnect) : onConnect
              }
              disabled={
                showContinue
                  ? isConnecting
                  : selectedUnconnectedCount === 0 || isConnecting
              }
              rightIcon={showContinue ? ArrowRight : undefined}
            />
            {showPostConnectActions ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRetryConnection ?? onConnect}
                disabled={isConnecting}
                className="items-center justify-center py-2 active:opacity-70"
                style={({ pressed }) => [
                  { opacity: pressed && !isConnecting ? 0.8 : 1 },
                ]}
              >
                <Text className="text-sm font-semibold text-slate-600">
                  Try again
                </Text>
              </Pressable>
            ) : onSkip && !showContinue ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSkip}
                disabled={isConnecting}
                className="items-center justify-center py-2 active:opacity-70"
                style={({ pressed }) => [
                  { opacity: pressed && !isConnecting ? 0.8 : 1 },
                ]}
              >
                <Text className="text-sm font-semibold text-slate-600">
                  Skip for now
                </Text>
              </Pressable>
            ) : null}
            <Text className="text-center text-xs text-slate-400">
              Today Matters only accesses the data you explicitly allow.
            </Text>
          </View>
        }
      >
        <View className="mt-2 gap-4">
          {errorMessage ? (
            <View className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-sm font-semibold text-red-700">
                Couldn&apos;t start Google connection
              </Text>
              <Text className="text-sm text-red-700 mt-1">{errorMessage}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            {GOOGLE_SERVICES.map((service) => {
              const Icon = service.icon;
              const isConnected = connectedSet.has(service.id);
              const isSelected = selectedSet.has(service.id);
              const isExpanded = expandedService === service.id;
              const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;

              return (
                <View
                  key={service.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: isSelected,
                      disabled: isConnected,
                    }}
                    onPress={() => onToggleService(service.id)}
                    disabled={isConnected || isConnecting}
                    className="flex-row items-center px-4 py-4"
                    style={({ pressed }) => [
                      {
                        opacity:
                          pressed && !isConnected && !isConnecting ? 0.92 : 1,
                      },
                    ]}
                  >
                    <View
                      className={`mr-3 h-11 w-11 items-center justify-center rounded-xl ${service.iconBgClassName}`}
                    >
                      <Icon size={18} color="#fff" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base font-semibold text-slate-900">
                          {service.name}
                        </Text>
                        {isConnected ? (
                          <View className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5">
                            <Check size={14} color="#059669" />
                            <Text className="text-xs font-semibold text-emerald-700">
                              Connected
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-sm text-slate-600 mt-1">
                        {service.description}
                      </Text>
                    </View>
                    {!isConnected ? (
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-lg border ${
                          isSelected
                            ? "border-blue-600 bg-blue-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected ? <Check size={16} color="#fff" /> : null}
                      </View>
                    ) : null}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onToggleExpanded(service.id)}
                    disabled={isConnecting}
                    className="flex-row items-center justify-center gap-1 border-t border-slate-100 py-3 active:opacity-70"
                    style={({ pressed }) => [
                      { opacity: pressed && !isConnecting ? 0.8 : 1 },
                    ]}
                  >
                    <Text className="text-sm font-semibold text-blue-600">
                      {isExpanded ? "Hide permissions" : "View permissions"}
                    </Text>
                    <ChevronIcon size={16} color="#2563EB" />
                  </Pressable>

                  {isExpanded ? (
                    <View className="gap-2 px-4 pb-4 pt-3">
                      {service.permissions.map((permission) => (
                        <View
                          key={permission}
                          className="flex-row items-start gap-2"
                        >
                          <Check size={14} color="#64748b" />
                          <Text className="flex-1 text-sm text-slate-600">
                            {permission}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </SetupStepLayout>

      {isConnecting ? (
        <View
          className="absolute inset-0 items-center justify-center bg-slate-900/20"
          accessibilityRole="progressbar"
          accessibilityLabel="Connecting to Google"
        >
          <View
            className="items-center justify-center rounded-2xl bg-white px-5 py-4"
            style={styles.overlayCard}
          >
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-3 text-sm font-semibold text-slate-800">
              Opening Google…
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlayCard: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
