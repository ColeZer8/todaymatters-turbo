import { useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import {
  useRouter,
  useRootNavigationState,
  useLocalSearchParams,
} from "expo-router";
import { SignUpTemplate } from "@/components/templates";
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

export default function SignUpScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;
  const signUp = useAuthStore((state) => state.signUp);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
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
    if (isAuthenticated) {
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
    onboardingHydrated,
    hasCompletedOnboarding,
    nextRoute,
    router,
  ]);

  const handleEmailPasswordSignUp = async () => {
    if (!email || !password) {
      setAuthError("Please enter your email and password.");
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    try {
      const { session, user } = await signUp(email.trim(), password);

      if (session?.user) {
        if (nextRoute) {
          router.replace(nextRoute);
          return;
        }
        router.replace("/home");
        return;
      }

      // If email confirmation is required, direct to the confirm screen
      const targetEmail = user?.email || email.trim();
      router.replace({
        pathname: "/confirm-email",
        params: { email: targetEmail },
      });
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Unable to create your account right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthSignUp = async (provider: OAuthProvider) => {
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
    <SignUpTemplate
      email={email}
      password={password}
      isPasswordHidden={isPasswordHidden}
      isSubmitting={isSubmitting || isLoading}
      showLoadingOverlay={isLoading}
      authError={authError}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onTogglePasswordVisibility={() => setIsPasswordHidden((prev) => !prev)}
      onSubmit={handleEmailPasswordSignUp}
      onApplePress={() => handleOAuthSignUp("apple")}
      onGooglePress={() => handleOAuthSignUp("google")}
      onNavigateToSignIn={() => router.replace("/")}
    />
  );
}
