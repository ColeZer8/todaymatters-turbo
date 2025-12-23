import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { SignUpTemplate } from '@/components/templates';
import { performOAuth } from '@/lib/supabase';
import { useAuthStore, useOnboardingStore } from '@/stores';

type OAuthProvider = 'apple' | 'google';

export default function SignUpScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const signUp = useAuthStore((state) => state.signUp);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const onboardingHydrated = useOnboardingStore((s) => s._hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        router.replace(hasCompletedOnboarding ? '/home' : '/permissions');
      });
    }
  }, [isAuthenticated, isNavigationReady, onboardingHydrated, hasCompletedOnboarding, router]);

  const handleEmailPasswordSignUp = async () => {
    if (!email || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    try {
      const { session, user } = await signUp(email.trim(), password);

      if (session?.user) {
        router.replace('/home');
        return;
      }

      // If email confirmation is required, direct to the confirm screen
      const targetEmail = user?.email || email.trim();
      router.replace({
        pathname: '/confirm-email',
        params: { email: targetEmail },
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to create your account right now.');
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
      setAuthError(error instanceof Error ? error.message : 'Unable to continue with that provider right now.');
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
      onApplePress={() => handleOAuthSignUp('apple')}
      onGooglePress={() => handleOAuthSignUp('google')}
      onNavigateToSignIn={() => router.replace('/')}
    />
  );
}
