import { useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import {
  useRouter,
  useRootNavigationState,
  useLocalSearchParams,
} from "expo-router";
import { SignInTemplate } from "@/components/templates";
import { performOAuth } from "@/lib/supabase";
import { useAuthStore, useOnboardingStore } from "@/stores";

type OAuthProvider = "apple" | "google";
const AUTH_NEXT_ROUTES = new Set(["connect-google-services"]);

const resolveNextRoute = (
  nextParam: string | string[] | undefined,
): string | null => {
  if (!nextParam || Array.isArray(nextParam)) return null;
  const normalized = nextParam.replace(/^\/+/, "");
  if (!AUTH_NEXT_ROUTES.has(normalized)) return null;
  return `/${normalized}`;
};

export default function SignInScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const signIn = useAuthStore((state) => state.signIn);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthBypassed = process.env.EXPO_PUBLIC_BYPASS_AUTH === "true";
  const onboardingHydrated = useOnboardingStore((s) => s._hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore(
    (s) => s.hasCompletedOnboarding,
  );
  const nextRoute = useMemo(() => resolveNextRoute(next), [next]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }
    if (!onboardingHydrated) {
      return;
    }
    if (isAuthenticated && !isAuthBypassed) {
      InteractionManager.runAfterInteractions(() => {
        if (nextRoute) {
          router.replace(nextRoute);
          return;
        }
        router.replace(hasCompletedOnboarding ? "/home" : "/explainer-video");
      });
    }
  }, [
    isAuthenticated,
    isNavigationReady,
    isAuthBypassed,
    onboardingHydrated,
    hasCompletedOnboarding,
    nextRoute,
    router,
  ]);

  const handleEmailPasswordSignIn = async () => {
    if (!email || !password) {
      setAuthError("Please enter your email and password.");
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Navigation will happen automatically via useEffect when isAuthenticated becomes true
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please check your credentials.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await performOAuth(provider);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Unable to continue with that provider right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SignInTemplate
      email={email}
      password={password}
      isPasswordHidden={isPasswordHidden}
      isSubmitting={isSubmitting || isLoading}
      showLoadingOverlay={isLoading}
      authError={authError}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onTogglePasswordVisibility={() => setIsPasswordHidden((prev) => !prev)}
      onSubmit={handleEmailPasswordSignIn}
      onApplePress={() => handleOAuthSignIn("apple")}
      onGooglePress={() => handleOAuthSignIn("google")}
      onNavigateToSignUp={() => router.push("/signup")}
      onNavigateToForgotPassword={() => router.push("/forgot-password")}
    />
  );
}
