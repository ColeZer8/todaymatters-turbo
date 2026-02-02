import { GradientButton, LogoBadge } from "@/components/atoms";
import { AuthInput } from "@/components/molecules";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Eye, EyeOff, Lock } from "lucide-react-native";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ResetPasswordTemplateProps {
  password: string;
  confirmPassword: string;
  isPasswordHidden: boolean;
  isConfirmPasswordHidden: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onToggleConfirmPasswordVisibility: () => void;
  onSubmit: () => void;
}

const CARD_MAX_WIDTH = 440;

export const ResetPasswordTemplate = ({
  password,
  confirmPassword,
  isPasswordHidden,
  isConfirmPasswordHidden,
  isSubmitting,
  errorMessage,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePasswordVisibility,
  onToggleConfirmPasswordVisibility,
  onSubmit,
}: ResetPasswordTemplateProps) => {
  const isIos = Platform.OS === "ios";

  return (
    <LinearGradient
      colors={["#f5f9ff", "#eef5ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1"
      style={styles.gradient}
    >
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1" style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={isIos ? "padding" : "height"}
          enabled
          keyboardVerticalOffset={0}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 w-full items-center" style={styles.content}>
              <View className="items-center">
                <LogoBadge />
                <Text className="mt-6 text-3xl font-semibold text-text-primary">
                  Set new password
                </Text>
                <Text className="mt-2 text-lg text-text-secondary text-center max-w-[320px]">
                  Choose a strong password for your account.
                </Text>
              </View>

              <View
                className="w-full mt-8"
                style={{ maxWidth: CARD_MAX_WIDTH }}
              >
                <View style={[styles.card, styles.cardShadow]}>
                  <Text className="text-2xl font-extrabold text-text-primary">
                    Reset password
                  </Text>
                  <Text className="mt-2 text-base text-text-secondary">
                    Enter your new password below.
                  </Text>

                  {errorMessage ? (
                    <Text className="mt-4 text-sm font-semibold text-red-500">
                      {errorMessage}
                    </Text>
                  ) : null}

                  <View className="mt-6">
                    <AuthInput
                      label="New Password"
                      icon={Lock}
                      value={password}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="••••••••"
                      secureTextEntry={isPasswordHidden}
                      onChangeText={onPasswordChange}
                      rightIcon={isPasswordHidden ? Eye : EyeOff}
                      onToggleSecureEntry={onTogglePasswordVisibility}
                      returnKeyType="next"
                    />
                  </View>

                  <View className="mt-4">
                    <AuthInput
                      label="Confirm Password"
                      icon={Lock}
                      value={confirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="••••••••"
                      secureTextEntry={isConfirmPasswordHidden}
                      onChangeText={onConfirmPasswordChange}
                      rightIcon={isConfirmPasswordHidden ? Eye : EyeOff}
                      onToggleSecureEntry={onToggleConfirmPasswordVisibility}
                      returnKeyType="done"
                      onSubmitEditing={onSubmit}
                    />
                  </View>

                  <View className="mt-6">
                    <GradientButton
                      label="Update password"
                      onPress={onSubmit}
                      loading={isSubmitting}
                      disabled={isSubmitting || !password || !confirmPassword}
                    />
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
          {isSubmitting ? (
            <View className="absolute inset-0 items-center justify-center bg-white/60">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
  },
  card: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderColor: "#E5E7EB",
    borderWidth: 1,
  },
  cardShadow: {
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.07,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
});
