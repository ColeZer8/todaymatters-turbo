import { useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import { ConfirmEmailTemplate } from '@/components/templates';
import { resendEmailConfirmation } from '@/lib/supabase';
import { useAuthStore, useOnboardingStore } from '@/stores';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const onboardingHydrated = useOnboardingStore((s) => s._hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);

  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (typeof emailParam === 'string') {
      setEmail(emailParam);
    }
  }, [emailParam]);

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

  const canResend = useMemo(() => email.trim().length > 0, [email]);

  const handleResend = async () => {
    if (!canResend) {
      setErrorMessage('Enter your email to resend the confirmation.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSending(true);

    try {
      await resendEmailConfirmation(email.trim());
      setStatusMessage('Confirmation email sent. Check your inbox.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to resend the email right now.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ConfirmEmailTemplate
      email={email}
      isSending={isSending}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      onEmailChange={setEmail}
      onResend={handleResend}
      onBackToSignIn={() => router.replace('/')}
    />
  );
}
