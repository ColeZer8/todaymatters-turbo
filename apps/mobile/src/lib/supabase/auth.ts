import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './client';
import type { Session } from '@supabase/supabase-js';

// Required for web OAuth flows
WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

/**
 * Creates a session from a URL containing OAuth callback parameters or email confirmation tokens.
 * Used for handling OAuth redirects and email confirmation links.
 * 
 * Flow for email confirmation:
 * 1. User clicks link in email → goes to Supabase server
 * 2. Supabase verifies token server-side
 * 3. Supabase redirects to our app deep link with access_token & refresh_token
 * 4. This function processes those tokens and creates a session
 */
export const createSessionFromUrl = async (url: string): Promise<Session | null> => {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(`Auth error: ${errorCode}`);
  }

  // Handle OAuth callbacks and email confirmation redirects
  // Both use access_token and refresh_token after Supabase verifies server-side
  const { access_token, refresh_token } = params;
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      throw error;
    }

    return data.session;
  }

  // Handle token_hash format (alternative email confirmation format)
  const { token_hash, type } = params;
  if (token_hash && type === 'email') {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'email',
    });

    if (error) {
      throw error;
    }

    return data.session;
  }

  // No valid auth parameters found
  return null;
};

/**
 * Performs OAuth sign-in with a provider (Google, Apple, GitHub, etc.)
 */
export const performOAuth = async (provider: 'google' | 'apple' | 'github'): Promise<void> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('No OAuth URL returned from Supabase');
  }

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (res.type === 'success') {
    const { url } = res;
    await createSessionFromUrl(url);
  }
};

/**
 * Sends a magic link (OTP) to the specified email address.
 */
export const sendMagicLink = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    throw error;
  }
};

/**
 * Resends a sign-up confirmation email.
 */
export const resendEmailConfirmation = async (email: string): Promise<void> => {
  // Use the app's deep link scheme for email confirmation redirects
  const emailRedirectTo = 'todaymatters://auth/confirm';
  
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    throw error;
  }
};

/**
 * Handles deep linking for authentication callbacks.
 * Call this in your root component to handle auth redirects.
 * Returns a cleanup function to remove the event listener.
 */
export const handleAuthCallback = (): (() => void) => {
  // Handle initial URL if app was opened via deep link
  Linking.getInitialURL().then((url) => {
    if (url) {
      createSessionFromUrl(url).catch(console.error);
    }
  });

  // Listen for deep links while app is running
  const subscription = Linking.addEventListener('url', (event) => {
    createSessionFromUrl(event.url).catch(console.error);
  });

  // Return cleanup function
  return () => {
    subscription.remove();
  };
};
