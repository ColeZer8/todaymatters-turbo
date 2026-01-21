import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { ResetPasswordTemplate } from '@/components/templates';
import { updatePassword } from '@/lib/supabase';
import { useAuthStore } from '@/stores';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [isConfirmPasswordHidden, setIsConfirmPasswordHidden] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirect if already authenticated (user shouldn't be here if logged in)
  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }
    if (isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/home');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      setErrorMessage('Please enter and confirm your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please try again.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await updatePassword(password);
      // Password updated successfully - redirect to sign in
      router.replace('/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResetPasswordTemplate
      password={password}
      confirmPassword={confirmPassword}
      isPasswordHidden={isPasswordHidden}
      isConfirmPasswordHidden={isConfirmPasswordHidden}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onPasswordChange={setPassword}
      onConfirmPasswordChange={setConfirmPassword}
      onTogglePasswordVisibility={() => setIsPasswordHidden((prev) => !prev)}
      onToggleConfirmPasswordVisibility={() => setIsConfirmPasswordHidden((prev) => !prev)}
      onSubmit={handleSubmit}
    />
  );
}
