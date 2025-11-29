import { GradientButton, LogoBadge } from '@/components/atoms';
import { AuthInput, SocialAuthButton } from '@/components/molecules';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SignUpTemplateProps {
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
  onNavigateToSignIn?: () => void;
}

const CARD_MAX_WIDTH = 440;

export const SignUpTemplate = ({
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
  onNavigateToSignIn,
}: SignUpTemplateProps) => {
  return (
    <LinearGradient
      colors={['#f5f9ff', '#eef5ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1"
      style={styles.gradient}
    >
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1" style={styles.safeArea}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 w-full items-center" style={styles.content}>
            <View className="items-center">
              <LogoBadge />
              <Text className="mt-6 text-3xl font-semibold text-text-primary">Today Matters</Text>
              <Text className="mt-2 text-lg text-text-secondary">Design your ideal day.</Text>
            </View>

            <View className="w-full mt-8" style={{ maxWidth: CARD_MAX_WIDTH }}>
              <View style={[styles.card, styles.cardShadow]}>
                <Text className="text-2xl font-extrabold text-text-primary">Create your account</Text>
                <Text className="mt-2 text-base text-text-secondary">Let’s get you set up</Text>

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
                    label="Create account"
                    onPress={onSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting || !email || !password}
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

            <View style={styles.flexSpacer} />

            <View className="flex-row items-center justify-center">
              <Text className="text-base text-text-secondary">Already have an account?</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onNavigateToSignIn}
                hitSlop={6}
              >
                <Text className="ml-2 text-base font-semibold text-text-primary">Sign in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        {showLoadingOverlay ? (
          <View className="absolute inset-0 items-center justify-center bg-white/60">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : null}
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
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
  flexSpacer: {
    flexGrow: 1,
    minHeight: 20,
  },
});
