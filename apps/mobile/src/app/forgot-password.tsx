import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ForgotPasswordTemplate } from '@/components/templates';
import { sendPasswordResetEmail } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSending(true);

    try {
      await sendPasswordResetEmail(email.trim());
      setStatusMessage('Password reset email sent! Check your inbox and click the link to reset your password.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send reset email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ForgotPasswordTemplate
      email={email}
      isSending={isSending}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      onEmailChange={setEmail}
      onSendResetEmail={handleSendResetEmail}
      onBackToSignIn={() => router.replace('/')}
    />
  );
}
