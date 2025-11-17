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
 * Creates a session from a URL containing OAuth callback parameters.
 * Used for handling OAuth redirects from providers like Google, Apple, etc.
 */
export const createSessionFromUrl = async (url: string): Promise<Session | null> => {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(`OAuth error: ${errorCode}`);
  }

  const { access_token, refresh_token } = params;

  if (!access_token) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    throw error;
  }

  return data.session;
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

