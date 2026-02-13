import { GradientButton } from "@/components/atoms";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Calendar,
  Bell,
  Mail,
  MapPin,
  Users,
  Globe,
  Smartphone,
  MessageSquare,
  LucideIcon,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";

export type PermissionKey =
  | "calendar"
  | "notifications"
  | "email"
  | "location"
  | "contacts"
  | "browsing"
  | "appUsage"
  | "sms";

export interface IndividualPermissions {
  calendar: boolean;
  notifications: boolean;
  email: boolean;
  location: boolean;
  contacts: boolean;
  browsing: boolean;
  appUsage: boolean;
  sms: boolean;
}

interface PermissionRowConfig {
  key: PermissionKey;
  title: string;
  description: string;
  icon: LucideIcon;
  bgColor: string;
}

const PERMISSION_ROWS: PermissionRowConfig[] = [
  {
    key: "calendar",
    title: "Calendar & Reminders",
    description: "See your events and open time.",
    icon: Calendar,
    bgColor: "bg-blue-500",
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "Send gentle nudges and reminders.",
    icon: Bell,
    bgColor: "bg-amber-500",
  },
  {
    key: "email",
    title: "Email & Tasks",
    description: "Pull important follow-ups and deadlines.",
    icon: Mail,
    bgColor: "bg-violet-500",
  },
  {
    key: "location",
    title: "Location",
    description: "Access your location for better scheduling.",
    icon: MapPin,
    bgColor: "bg-emerald-500",
  },
  {
    key: "contacts",
    title: "Contacts",
    description: "Access your contacts for better scheduling.",
    icon: Users,
    bgColor: "bg-pink-500",
  },
  {
    key: "browsing",
    title: "Browsing History",
    description: "Access your browsing history for better scheduling.",
    icon: Globe,
    bgColor: "bg-red-500",
  },
  {
    key: "appUsage",
    title: "Screen Time",
    description: "Read app usage to estimate screen time.",
    icon: Smartphone,
    bgColor: "bg-orange-500",
  },
  {
    key: "sms",
    title: "Text Messages",
    description: "Read incoming SMS for automatic event tracking.",
    icon: MessageSquare,
    bgColor: "bg-teal-500",
  },
];

interface PermissionsTemplateProps {
  allowAllEnabled: boolean;
  onToggleAllowAll: () => void;
  showIndividual: boolean;
  onToggleShowIndividual: () => void;
  permissions: IndividualPermissions;
  onTogglePermission: (key: PermissionKey) => void;
  onContinue: () => void;
  notificationSettingsAction?: {
    label: string;
    helperText?: string;
    onPress: () => void;
  };
  onBack?: () => void;
  step?: number;
  totalSteps?: number;
}

export const PermissionsTemplate = ({
  allowAllEnabled,
  onToggleAllowAll,
  showIndividual,
  onToggleShowIndividual,
  permissions,
  onTogglePermission,
  onContinue,
  notificationSettingsAction,
  onBack,
  step = ONBOARDING_STEPS.permissions,
  totalSteps = ONBOARDING_TOTAL_STEPS,
}: PermissionsTemplateProps) => {
  const progressPercent = Math.min(100, Math.max(0, (step / totalSteps) * 100));
  const ChevronIcon = showIndividual ? ChevronUp : ChevronDown;

  return (
    <LinearGradient
      colors={["#f8fafc", "#eff6ff", "#f0f9ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-slate-500">
                <Text className="text-blue-600">Step {step}</Text> of{" "}
                {totalSteps}
              </Text>
              {onBack && (
                <Pressable
                  accessibilityRole="button"
                  onPress={onBack}
                  className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-white/80 active:opacity-70"
                >
                  <ArrowLeft size={14} color="#334155" />
                  <Text className="text-xs font-semibold text-slate-700">
                    Back
                  </Text>
                </Pressable>
              )}
            </View>
            <Text className="text-sm font-semibold text-slate-500">Setup</Text>
          </View>

          {/* Progress bar */}
          <View className="mt-4 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <View
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${progressPercent}%` }}
            />
          </View>

          {/* Title */}
          <View className="mt-8 gap-3">
            <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Sync your day in the background
            </Text>
            <Text className="text-base leading-6 text-slate-600">
              To build your ideal schedule, we&apos;ll read your existing events
              and habits while you answer a few quick questions.
            </Text>
          </View>

          {/* Permissions Section */}
          <View className="mt-8">
            <Text className="text-lg font-bold text-slate-900 mb-4">
              Permissions needed
            </Text>

            {/* Allow All Pill */}
            <Pressable
              accessibilityRole="button"
              onPress={onToggleAllowAll}
              className="overflow-hidden rounded-2xl active:opacity-95"
            >
              <LinearGradient
                colors={["#3b82f6", "#2563eb"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.allowPillGradient}
              >
                <View className="flex-row items-center px-5 py-5">
                  <View
                    className="w-11 h-11 rounded-xl items-center justify-center bg-white/20 mr-4"
                    style={styles.allowIconWrap}
                  >
                    <CheckSquare size={22} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-white">
                      Allow all permissions
                    </Text>
                    <Text className="text-sm text-white/80 mt-0.5">
                      Calendar, notifications, email &amp; more
                    </Text>
                  </View>
                  <View className="w-14 h-8 rounded-full bg-white/25 justify-center px-1">
                    <View
                      className={`w-6 h-6 rounded-full bg-white ${
                        allowAllEnabled ? "self-end" : "self-start"
                      }`}
                      style={styles.toggleKnob}
                    />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Toggle Individual */}
            <Pressable
              accessibilityRole="button"
              onPress={onToggleShowIndividual}
              className="flex-row items-center justify-center gap-1.5 py-4 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-blue-600">
                {showIndividual
                  ? "Hide individual permissions"
                  : "View individual permissions"}
              </Text>
              <ChevronIcon size={16} color="#2563eb" />
            </Pressable>

            {/* Individual Permissions */}
            {showIndividual && (
              <View className="mt-2">
                {PERMISSION_ROWS.filter((row) => {
                  // Filter out SMS on non-Android platforms
                  if (row.key === "sms" && Platform.OS !== "android") {
                    return false;
                  }
                  return true;
                }).map((row, index, filteredArray) => {
                  const showNotificationsAction =
                    row.key === "notifications" && !!notificationSettingsAction;
                  return (
                    <PermissionRow
                      key={row.key}
                      config={row}
                      enabled={permissions[row.key]}
                      onToggle={() => onTogglePermission(row.key)}
                      showDivider={index < filteredArray.length - 1}
                      helperText={
                        showNotificationsAction
                          ? notificationSettingsAction?.helperText
                          : undefined
                      }
                      actionLabel={
                        showNotificationsAction
                          ? notificationSettingsAction?.label
                          : undefined
                      }
                      onActionPress={
                        showNotificationsAction
                          ? notificationSettingsAction?.onPress
                          : undefined
                      }
                    />
                  );
                })}
              </View>
            )}
          </View>

          {/* Spacer */}
          <View className="flex-grow min-h-6" />

          {/* Continue Button */}
          <View className="mt-6">
            <GradientButton
              label="Allow & continue"
              onPress={onContinue}
              rightIcon={ArrowRight}
            />
          </View>

          {/* Footer text */}
          <Text className="text-center text-xs text-slate-400 mt-4">
            You can change permissions anytime in settings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

interface PermissionRowProps {
  config: PermissionRowConfig;
  enabled: boolean;
  onToggle: () => void;
  showDivider?: boolean;
  helperText?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

const PermissionRow = ({
  config,
  enabled,
  onToggle,
  showDivider = false,
  helperText,
  actionLabel,
  onActionPress,
}: PermissionRowProps) => {
  const Icon = config.icon;

  return (
    <View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        onPress={onToggle}
        className="flex-row items-center py-4 active:opacity-70"
      >
        <View
          className={`w-10 h-10 rounded-xl items-center justify-center mr-3.5 ${config.bgColor}`}
        >
          <Icon size={18} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-800">
            {config.title}
          </Text>
          <Text className="text-sm text-slate-500 mt-0.5">
            {config.description}
          </Text>
        </View>
        <View
          className={`w-12 h-7 rounded-full justify-center px-0.5 ${
            enabled ? "bg-blue-500" : "bg-slate-300"
          }`}
        >
          <View
            className={`w-6 h-6 rounded-full bg-white shadow ${enabled ? "self-end" : "self-start"}`}
          />
        </View>
      </Pressable>
      {helperText || actionLabel ? (
        <View className="pl-14 pr-2 pb-3">
          {helperText ? (
            <Text className="text-xs text-slate-500">{helperText}</Text>
          ) : null}
          {actionLabel && onActionPress ? (
            <Pressable
              accessibilityRole="button"
              onPress={onActionPress}
              className="mt-2 self-start rounded-full border border-slate-200 bg-white px-3 py-1.5"
            >
              <Text className="text-xs font-semibold text-slate-700">
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {showDivider && <View className="h-px bg-slate-200 ml-14" />}
    </View>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  allowPillGradient: {
    borderRadius: 16,
  },
  allowIconWrap: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  toggleKnob: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
