/**
 * Session Management Utilities
 *
 * Provides functions for manual token refresh and session validation.
 * Use these utilities when you need to ensure a valid session before API calls.
 */

import { supabase } from "./client";
import type { Session } from "@supabase/supabase-js";

/**
 * Error constants for refresh failures
 */
export const REFRESH_ERRORS = {
  refresh_token_not_found: "Re-login required",
  invalid_refresh_token: "Re-login required",
  refresh_token_already_used: "Session expired",
} as const;

/**
 * Checks if a session's token is expiring soon
 * @param session - The session to check
 * @param thresholdMinutes - Minutes before expiry to consider "soon" (default: 5)
 * @returns true if token expires within threshold
 */
export function isTokenExpiringSoon(
  session: Session,
  thresholdMinutes: number = 5,
): boolean {
  const expiresAt = session.expires_at;
  if (!expiresAt) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const threshold = thresholdMinutes * 60;
  return expiresAt - now < threshold;
}

/**
 * Handles refresh errors and signs out user if necessary
 * @param error - The error from refresh attempt
 */
async function handleRefreshError(error: Error): Promise<void> {
  const message = error.message;

  for (const [errorKey, action] of Object.entries(REFRESH_ERRORS)) {
    if (message.includes(errorKey)) {
      if (__DEV__) {
        console.error(`🔄 Refresh failed: ${action}`, error);
      }
      // Clear local session and sign out
      await supabase.auth.signOut();
      return;
    }
  }

  // Unknown error - log and don't sign out (might be network issue)
  if (__DEV__) {
    console.error("🔄 Unknown refresh error:", message, error);
  }
}

/**
 * Manually refreshes the current session
 * @returns The refreshed session, or null if refresh failed
 */
export async function refreshSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      await handleRefreshError(error);
      return null;
    }

    if (__DEV__) {
      console.log(
        "🔄 Session refreshed successfully, new expiry:",
        data.session?.expires_at,
      );
    }

    return data.session;
  } catch (error) {
    await handleRefreshError(
      error instanceof Error ? error : new Error(String(error)),
    );
    return null;
  }
}

/**
 * Gets a valid session, refreshing if token is about to expire
 * Checks if token expires within 5 minutes and refreshes if needed
 * @returns A valid session, or null if no session exists
 */
export async function getValidSession(): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    if (__DEV__) {
      console.log("🔍 No valid session found");
    }
    return null;
  }

  // Check if token is about to expire (within 5 minutes)
  if (isTokenExpiringSoon(session, 5)) {
    if (__DEV__) {
      console.log("🔄 Token expiring soon, refreshing...");
    }
    const refreshedSession = await refreshSession();
    return refreshedSession || session; // Return original session if refresh failed
  }

  return session;
}
