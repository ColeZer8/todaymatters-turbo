import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { SignInTemplate } from '@/components/templates';
import { performOAuth } from '@/lib/supabase';
import { useAuthStore } from '@/stores';

type OAuthProvider = 'apple' | 'google';

export default function SignInScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const signIn = useAuthStore((state) => state.signIn);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthBypassed = process.env.EXPO_PUBLIC_BYPASS_AUTH === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }
    if (isAuthenticated && !isAuthBypassed) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/permissions');
      });
    }
  }, [isAuthenticated, isNavigationReady, isAuthBypassed, router]);

  const handleEmailPasswordSignIn = async () => {
    if (!email || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Navigation will happen automatically via useEffect when isAuthenticated becomes true
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in. Please check your credentials.');
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
      setAuthError(error instanceof Error ? error.message : 'Unable to continue with that provider right now.');
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
      onApplePress={() => handleOAuthSignIn('apple')}
      onGooglePress={() => handleOAuthSignIn('google')}
      onNavigateToSignUp={() => router.push('/signup')}
    />
  );
}
