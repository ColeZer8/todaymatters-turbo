import { GradientButton } from '@/components/atoms';
import { AuthInput, SocialAuthButton } from '@/components/molecules';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';

interface SignInTemplateProps {
  email: string;
  password: string;
  isPasswordHidden: boolean;
  isSubmitting: boolean;
  authError?: string | null;
  showLoadingOverlay?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: () => void;
  onApplePress: () => void;
  onGooglePress: () => void;
  onNavigateToSignUp?: () => void;
  onNavigateToForgotPassword?: () => void;
}

const CARD_MAX_WIDTH = 480;

export const SignInTemplate = ({
  email,
  password,
  isPasswordHidden,
  isSubmitting,
  authError,
  showLoadingOverlay = false,
  onEmailChange,
  onPasswordChange,
  onTogglePasswordVisibility,
  onSubmit,
  onApplePress,
  onGooglePress,
  onNavigateToSignUp,
  onNavigateToForgotPassword,
}: SignInTemplateProps) => {
  const isIos = Platform.OS === 'ios';

  return (
    <View className="flex-1 bg-[#F7FAFF]">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={isIos ? 'padding' : undefined}
          enabled={isIos}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 items-center w-full">
              <View className="items-center w-full max-w-[640px]">
                <Text className="text-[34px] leading-[38px] font-extrabold text-center">
                  <Text className="text-[#2563EB]">Today</Text>
                  <Text className="text-[#111827]"> Matters</Text>
                </Text>
                <Text className="text-center max-w-[420px] mt-2 text-[15px] leading-[21px] text-[#4B5563]">
                  Align your faith, focus, and schedule before you start. Crafted to mirror the calm, confident feel of the home experience.
                </Text>
              </View>

              <View className="w-full mt-5" style={{ maxWidth: CARD_MAX_WIDTH }}>
                <View style={[styles.card, styles.cardShadow]}>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                        Welcome back
                      </Text>
                      <Text className="mt-1 text-2xl font-extrabold text-[#111827]">Sign in to get started</Text>
                    </View>
                    <View className="rounded-full px-3 py-1 bg-[#EFF6FF]">
                      <Text className="text-[12px] font-semibold text-[#2563EB]">Secure login</Text>
                    </View>
                  </View>

                  {authError ? (
                    <Text className="mt-4 text-sm font-semibold text-red-500">{authError}</Text>
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
                      returnKeyType="next"
                    />
                  </View>

                  <View className="mt-4">
                    <AuthInput
                      label="Password"
                      icon={Lock}
                      value={password}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="••••••••"
                      secureTextEntry={isPasswordHidden}
                      onChangeText={onPasswordChange}
                      rightIcon={isPasswordHidden ? Eye : EyeOff}
                      onToggleSecureEntry={onTogglePasswordVisibility}
                      returnKeyType="done"
                      onSubmitEditing={onSubmit}
                    />
                  </View>

                  <View className="mt-6">
                    <GradientButton
                      label="Continue"
                      onPress={onSubmit}
                      loading={isSubmitting}
                      disabled={isSubmitting}
                    />
                  </View>

                  <View className="flex-row items-center mt-6">
                    <View className="flex-1 border-b border-slate-200" />
                    <Text className="mx-3 text-sm font-semibold text-text-tertiary">OR</Text>
                    <View className="flex-1 border-b border-slate-200" />
                  </View>

                  <View className="mt-6">
                    <SocialAuthButton
                      variant="apple"
                      label="Continue with Apple"
                      onPress={onApplePress}
                      disabled={isSubmitting}
                    />
                    <View className="mt-3">
                      <SocialAuthButton
                        variant="google"
                        label="Continue with Google"
                        onPress={onGooglePress}
                        disabled={isSubmitting}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View className="flex-row items-center justify-center mt-4">
                <Text className="text-base text-text-secondary">New here?</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onNavigateToSignUp?.()}
                  hitSlop={6}
                >
                  <Text className="ml-2 text-base font-semibold text-text-primary">Create account</Text>
                </Pressable>
                <Text className="mx-2 text-text-tertiary">•</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onNavigateToForgotPassword?.()}
                  hitSlop={6}
                >
                  <Text className="text-base font-semibold text-text-primary">Forgot password?</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
          {showLoadingOverlay ? (
            <View className="absolute inset-0 items-center justify-center bg-white/60">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  cardShadow: {
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.07,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
});
