import { GradientButton, LogoBadge } from "@/components/atoms";
import { AuthInput } from "@/components/molecules";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Mail } from "lucide-react-native";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ForgotPasswordTemplateProps {
  email: string;
  isSending: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onEmailChange: (value: string) => void;
  onSendResetEmail: () => void;
  onBackToSignIn?: () => void;
}

const CARD_MAX_WIDTH = 440;

export const ForgotPasswordTemplate = ({
  email,
  isSending,
  statusMessage,
  errorMessage,
  onEmailChange,
  onSendResetEmail,
  onBackToSignIn,
}: ForgotPasswordTemplateProps) => {
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
          behavior={isIos ? "padding" : undefined}
          enabled={isIos}
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
                  Reset your password
                </Text>
                <Text className="mt-2 text-lg text-text-secondary text-center max-w-[320px]">
                  Enter your email and we'll send you a link to reset your
                  password.
                </Text>
              </View>

              <View
                className="w-full mt-8"
                style={{ maxWidth: CARD_MAX_WIDTH }}
              >
                <View style={[styles.card, styles.cardShadow]}>
                  <Text className="text-2xl font-extrabold text-text-primary">
                    Forgot password?
                  </Text>
                  <Text className="mt-2 text-base text-text-secondary">
                    No worries. We'll send you reset instructions.
                  </Text>

                  {statusMessage ? (
                    <Text className="mt-4 text-sm font-semibold text-green-600">
                      {statusMessage}
                    </Text>
                  ) : null}

                  {errorMessage ? (
                    <Text className="mt-4 text-sm font-semibold text-red-500">
                      {errorMessage}
                    </Text>
                  ) : null}

                  <View className="mt-6">
                    <AuthInput
                      label="Email"
                      icon={Mail}
                      value={email}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="name@email.com"
                      onChangeText={onEmailChange}
                      returnKeyType="done"
                      onSubmitEditing={onSendResetEmail}
                    />
                  </View>

                  <View className="mt-6">
                    <GradientButton
                      label="Send reset link"
                      onPress={onSendResetEmail}
                      loading={isSending}
                      disabled={isSending || !email.trim()}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.flexSpacer} />

              <View className="flex-row items-center justify-center">
                <Text className="text-base text-text-secondary">
                  Remember your password?
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onBackToSignIn}
                  hitSlop={6}
                >
                  <Text className="ml-2 text-base font-semibold text-text-primary">
                    Back to sign in
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
          {isSending ? (
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
    justifyContent: "space-between",
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
  flexSpacer: {
    flexGrow: 1,
    minHeight: 20,
  },
});
