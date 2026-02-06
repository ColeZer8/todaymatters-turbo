import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as Linking from "expo-linking";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./client";
import type { Session } from "@supabase/supabase-js";

// Required for web OAuth flows
WebBrowser.maybeCompleteAuthSession();

/**
 * Generate OAuth redirect URI.
 * 
 * IMPORTANT: We use an explicit scheme-based redirect to avoid platform differences.
 * makeRedirectUri() can return different formats on iOS vs Android (e.g., package name
 * on Android), which may not be in Supabase's allowed redirect URLs list.
 * 
 * Using the explicit scheme ensures consistency and avoids "invalid redirect" errors.
 */
const getOAuthRedirectUri = (): string => {
  // Always use the app scheme for consistency across platforms
  // This MUST be added to Supabase Dashboard → Authentication → Redirect URLs
  const schemeRedirect = "todaymatters://auth/callback";
  
  if (__DEV__) {
    // In development, makeRedirectUri may be more appropriate for Expo Go
    // But for dev client builds, use scheme redirect
    const devRedirect = makeRedirectUri();
    console.log("🔗 OAuth Redirect URIs:", {
      scheme: schemeRedirect,
      makeRedirectUri: devRedirect,
      platform: Platform.OS,
      usingScheme: true, // Always use scheme for production builds
    });
  }
  
  return schemeRedirect;
};

const redirectTo = getOAuthRedirectUri();

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
export const createSessionFromUrl = async (
  url: string,
): Promise<Session | null> => {
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
  if (token_hash && type === "email") {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "email",
    });

    if (error) {
      throw error;
    }

    return data.session;
  }

  // Handle password reset tokens (type=recovery)
  if (token_hash && type === "recovery") {
    // Password reset tokens don't create a session immediately
    // They need to be verified, then user updates password
    // Return null here - the reset password screen will handle verification
    return null;
  }

  // No valid auth parameters found
  return null;
};

/**
 * Performs OAuth sign-in with a provider (Google, Apple, GitHub, etc.)
 */
export const performOAuth = async (
  provider: "google" | "apple" | "github",
): Promise<void> => {
  if (__DEV__) {
    console.log("🔐 Starting OAuth flow:", {
      provider,
      redirectTo,
      platform: Platform.OS,
    });
  }

  let data;
  let error;
  
  try {
    const result = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    data = result.data;
    error = result.error;
  } catch (networkError) {
    if (__DEV__) {
      console.error("🔐 Network error during OAuth initiation:", {
        error: networkError,
        message: networkError instanceof Error ? networkError.message : String(networkError),
      });
    }
    throw new Error("Unable to connect. Please check your internet connection and try again.");
  }

  if (error) {
    if (__DEV__) {
      console.error("🔐 Supabase OAuth error:", {
        message: error.message,
        status: (error as { status?: number })?.status,
        code: (error as { code?: string })?.code,
        provider,
        redirectTo,
      });
    }
    // Improve error messages for OAuth provider issues
    if (error.message.includes("provider is not enabled")) {
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
      throw new Error(
        `${providerName} sign-in is not enabled. Please use email/password or contact support.`,
      );
    }
    // Handle redirect URL errors specifically
    if (error.message.includes("redirect") || error.message.includes("callback")) {
      throw new Error(
        `OAuth configuration error. The redirect URL may not be configured properly. Please contact support.`,
      );
    }
    throw error;
  }

  if (!data?.url) {
    if (__DEV__) {
      console.error("🔐 No OAuth URL returned:", { data });
    }
    throw new Error("No OAuth URL returned from Supabase");
  }

  if (__DEV__) {
    console.log("🔐 Opening OAuth browser:", {
      urlHost: new URL(data.url).host,
      redirectTo,
    });
  }

  let res;
  try {
    res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  } catch (browserError) {
    if (__DEV__) {
      console.error("🔐 Browser session error:", {
        error: browserError,
        message: browserError instanceof Error ? browserError.message : String(browserError),
        platform: Platform.OS,
      });
    }
    throw new Error(
      `Failed to open sign-in browser. ${Platform.OS === "android" ? "Please ensure Chrome is installed and updated." : "Please try again."}`
    );
  }

  if (__DEV__) {
    console.log("🔐 OAuth browser result:", {
      type: res.type,
      hasUrl: "url" in res && !!res.url,
    });
  }

  if (res.type === "success") {
    const { url } = res;
    await createSessionFromUrl(url);
  } else if (res.type === "cancel") {
    throw new Error("Sign-in was cancelled");
  } else {
    throw new Error("Failed to complete sign-in. Please try again.");
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
  const emailRedirectTo = "todaymatters://auth/confirm";

  const { error } = await supabase.auth.resend({
    type: "signup",
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
 * Sends a password reset email to the specified email address.
 */
export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  // Use the app's deep link scheme for password reset redirects
  // This URL will be used when user clicks the reset link in their email
  const emailRedirectTo = "todaymatters://reset-password";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: emailRedirectTo,
  });

  if (error) {
    // Improve error messages
    if (error.message.includes("provider is not enabled")) {
      throw new Error(
        "Email authentication is not enabled. Please contact support.",
      );
    }
    throw error;
  }
};

/**
 * Updates the user's password using a password reset token.
 */
export const updatePassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    if (error.message.includes("Password")) {
      throw new Error("Password is too weak. Please use a stronger password.");
    }
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
      handleAuthUrl(url).catch(console.error);
    }
  });

  // Listen for deep links while app is running
  const subscription = Linking.addEventListener("url", (event) => {
    handleAuthUrl(event.url).catch(console.error);
  });

  // Return cleanup function
  return () => {
    subscription.remove();
  };
};

/**
 * Handles authentication URLs, routing to appropriate screens.
 */
const handleAuthUrl = async (url: string): Promise<void> => {
  const { params } = QueryParams.getQueryParams(url);

  // Check if this is a password reset link
  // Password reset links from Supabase contain access_token/refresh_token
  // after Supabase verifies the token server-side
  const isPasswordReset = url.includes("reset-password");

  if (isPasswordReset) {
    // For password reset, Supabase verifies the token server-side and redirects
    // with access_token/refresh_token. Create a session first (this allows updatePassword to work).
    // The session will be temporary and used only for password reset.
    try {
      await createSessionFromUrl(url);
      // Session created successfully - the reset-password screen will be shown
      // via the deep link routing, and updatePassword will work
    } catch (error) {
      // If session creation fails, still allow navigation
      // The reset-password screen will show an error if updatePassword fails
      console.error("Failed to create session from reset link:", error);
    }
    // The deep link will automatically navigate to /reset-password route
    return;
  }

  // Otherwise, try to create a session (for OAuth, email confirmation, etc.)
  await createSessionFromUrl(url);
};
