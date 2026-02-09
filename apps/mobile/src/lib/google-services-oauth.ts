import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import appConfig, { readBooleanEnv } from "@/lib/config";
import { supabase } from "@/lib/supabase/client";

export type GoogleService = "google-calendar" | "google-gmail";

export interface GoogleOAuthResult {
  success: boolean;
  services?: GoogleService[];
  error?: string;
}

interface GoogleServicesOAuthHandlers {
  onStart?: () => void;
  onResult?: (result: GoogleOAuthResult) => void;
}

const SERVICE_LOOKUP: Record<string, GoogleService> = {
  "google-calendar": "google-calendar",
  "google-gmail": "google-gmail",
  calendar: "google-calendar",
  gmail: "google-gmail",
};

const GOOGLE_OAUTH_HOST = "oauth";
const GOOGLE_OAUTH_PATH_PREFIX = "google/";
const ALLOW_ANY_GOOGLE_ACCOUNT = readBooleanEnv(
  "EXPO_PUBLIC_GOOGLE_OAUTH_ALLOW_ANY_ACCOUNT",
);

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normalizeLocalhostUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return value;
    }

    const hostUri = Constants.expoConfig?.hostUri;
    if (!hostUri) return value;

    const hostUrl = hostUri.includes("://") ? hostUri : `http://${hostUri}`;
    const hostParsed = new URL(hostUrl);
    if (!hostParsed.hostname) return value;

    parsed.hostname = hostParsed.hostname;
    return trimTrailingSlash(parsed.toString());
  } catch {
    return value;
  }
};

const resolveOAuthBaseUrl = (): string => {
  const baseUrl = appConfig.oauth.apiBaseUrl;
  if (!baseUrl) {
    throw new Error(
      "Missing OAuth API base URL. Set EXPO_PUBLIC_OAUTH_API_BASE_URL in your environment.",
    );
  }

  const normalized = normalizeLocalhostUrl(baseUrl);
  if (__DEV__ && normalized !== baseUrl) {
    // eslint-disable-next-line no-console
    console.log("🔗 OAuth base URL normalized for device:", normalized);
  }

  return normalized;
};

const parseServicesParam = (
  servicesParam?: string | string[] | null,
): GoogleService[] => {
  if (!servicesParam) return [];

  const raw = Array.isArray(servicesParam)
    ? servicesParam.join(",")
    : servicesParam;
  return raw
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean)
    .map((service) => SERVICE_LOOKUP[service])
    .filter((service): service is GoogleService => Boolean(service));
};

export const buildGoogleServicesOAuthUrl = (
  services: GoogleService[],
): string => {
  if (services.length === 0) {
    throw new Error("At least one service must be selected");
  }

  const baseUrl = resolveOAuthBaseUrl();

  const servicesParam = services.join(",");
  return `${trimTrailingSlash(baseUrl)}/oauth2/google/start?services=${encodeURIComponent(
    servicesParam,
  )}`;
};

const looksLikeGoogleOAuthUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "counts.google.com") return false;
    if (host.endsWith(".google.com") || host === "accounts.google.com") {
      return (
        parsed.pathname.includes("/o/oauth2") ||
        parsed.pathname.includes("/oauth2") ||
        parsed.pathname.includes("/signin")
      );
    }
    return false;
  } catch {
    return false;
  }
};

const toCanonicalGoogleOAuthAuthUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== "accounts.google.com") return url;

    if (
      parsed.pathname.startsWith("/o/oauth2") ||
      parsed.pathname.startsWith("/oauth2")
    ) {
      return url;
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    const allowedKeys = [
      "client_id",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
      "code_challenge",
      "code_challenge_method",
      "access_type",
      "prompt",
      "hd",
      "include_granted_scopes",
      "login_hint",
    ] as const;

    for (const key of allowedKeys) {
      const value = parsed.searchParams.get(key);
      if (value) authUrl.searchParams.set(key, value);
    }

    if (
      !authUrl.searchParams.get("client_id") ||
      !authUrl.searchParams.get("redirect_uri") ||
      !authUrl.searchParams.get("response_type") ||
      !authUrl.searchParams.get("scope") ||
      !authUrl.searchParams.get("state")
    ) {
      return url;
    }

    return authUrl.toString();
  } catch {
    return url;
  }
};

const ensureSelectAccountPrompt = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== "accounts.google.com") {
      return url;
    }

    const existingPrompt = parsed.searchParams.get("prompt");
    const promptParts = existingPrompt
      ? existingPrompt.split(/\s+/).filter(Boolean)
      : [];
    const normalizedPrompt = [
      ...new Set(
        promptParts.filter((part) => part !== "login").concat("select_account"),
      ),
    ].join(" ");
    parsed.searchParams.set("prompt", normalizedPrompt);

    parsed.searchParams.delete("login_hint");

    if (ALLOW_ANY_GOOGLE_ACCOUNT) {
      parsed.searchParams.delete("hd");
    }

    return parsed.toString();
  } catch {
    return url;
  }
};

const getRedirectUrlFromOAuthStartResponse = (
  response: Response,
): string | null => {
  const location =
    response.headers.get("location") ?? response.headers.get("Location");
  if (location) {
    return toCanonicalGoogleOAuthAuthUrl(location);
  }

  const url = typeof response.url === "string" ? response.url : "";
  if (url && looksLikeGoogleOAuthUrl(url)) {
    return toCanonicalGoogleOAuthAuthUrl(url);
  }

  return null;
};

/**
 * Check if Google services are connected by querying the source_accounts table in Supabase.
 * This is the recommended approach per backend team until Universal Links are implemented.
 * 
 * Note: source_accounts table may not be in local TypeScript types yet, so we use
 * a generic query approach.
 */
export const checkGoogleConnectionFromSupabase = async (
  userId: string,
): Promise<{ connected: boolean; services: GoogleService[]; email?: string } | null> => {
  try {
    if (__DEV__) {
      console.log("🔗 Checking Google connection in Supabase for user:", userId);
    }

    // Use generic query since source_accounts may not be in local types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("source_accounts")
      .select("enabled_services, account_identifier")
      .eq("user_id", userId)
      .eq("provider", "google")
      .single();

    if (error || !data) {
      if (__DEV__) {
        console.log("🔗 No Google connection found in Supabase:", error?.message);
      }
      return null;
    }

    // Parse enabled_services - could be array or comma-separated string
    let services: GoogleService[] = [];
    const enabledServices = data.enabled_services;
    if (enabledServices) {
      if (Array.isArray(enabledServices)) {
        services = parseServicesParam(enabledServices.join(","));
      } else if (typeof enabledServices === "string") {
        services = parseServicesParam(enabledServices);
      }
    }

    if (__DEV__) {
      console.log("🔗 Google connection found:", {
        services,
        email: data.account_identifier,
      });
    }

    return {
      connected: true,
      services,
      email: data.account_identifier ?? undefined,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn("🔗 Error checking Google connection:", error);
    }
    return null;
  }
};

/**
 * Remove the user's Google connection from Supabase (source_accounts).
 * Used for testing the connect flow again (e.g. on Android). Only safe to call
 * when the backend allows this user to delete their own row (RLS).
 */
export const disconnectGoogleFromSupabase = async (
  userId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("source_accounts")
      .delete()
      .eq("user_id", userId)
      .eq("provider", "google");

    if (error) {
      if (__DEV__) {
        console.warn("🔗 Disconnect Google failed:", error.message);
      }
      return { ok: false, error: error.message };
    }
    if (__DEV__) {
      console.log("🔗 Google connection removed for user:", userId);
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (__DEV__) {
      console.warn("🔗 Disconnect Google error:", message);
    }
    return { ok: false, error: message };
  }
};

export const startGoogleServicesOAuth = async (
  services: GoogleService[],
  accessToken: string,
): Promise<WebBrowser.WebBrowserResult> => {
  if (!accessToken) {
    throw new Error("Missing access token. Please sign in again and retry.");
  }

  const oauthUrl = buildGoogleServicesOAuthUrl(services);

  if (__DEV__) {
    console.log("🔗 Google Services OAuth start:", {
      platform: Platform.OS,
      url: oauthUrl,
      services,
    });
  }

  // ============================================================
  // UNIFIED FLOW (iOS + Android):
  // 1. Call /start via fetch with JWT in Authorization header (not in browser)
  // 2. Intercept the 302 redirect to get Google's OAuth consent URL
  // 3. Open that Google URL in the browser (no auth header needed — it's Google's domain)
  // 4. After browser closes, caller checks Supabase for connection status
  //
  // This works on both platforms because the auth header is sent via fetch,
  // not the browser. Previously Android passed access_token as a query param
  // which required backend support. This approach needs no backend changes.
  // ============================================================
  let response: Response;
  try {
    response = await fetch(oauthUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "manual",
    } as RequestInit);
  } catch (error) {
    if (__DEV__) {
      console.error("🔗 OAuth fetch failed:", {
        error,
        platform: Platform.OS,
        url: oauthUrl,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }

  if (__DEV__) {
    const location =
      response.headers.get("location") ?? response.headers.get("Location");
    console.log("🔗 OAuth start response:", {
      platform: Platform.OS,
      status: response.status,
      location,
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Not authorized to connect Google services. Please sign in again and retry.",
    );
  }

  if (!response.ok && (response.status < 300 || response.status >= 400)) {
    throw new Error(
      `Failed to start Google connection (HTTP ${response.status}).`,
    );
  }

  let redirectUrl = getRedirectUrlFromOAuthStartResponse(response);
  if (!redirectUrl) {
    throw new Error(
      "Failed to start Google connection (missing redirect URL). The backend must return a 302 with a Google OAuth Location header.",
    );
  }

  if (!looksLikeGoogleOAuthUrl(redirectUrl)) {
    throw new Error(
      "Failed to start Google connection (unexpected redirect URL). Please contact the backend team to verify the Google OAuth URL generation.",
    );
  }

  // Ensure account picker shows (lets user pick which Google account)
  redirectUrl = ensureSelectAccountPrompt(redirectUrl);

  if (__DEV__) {
    console.log("🔗 Opening Google OAuth URL in browser:", {
      platform: Platform.OS,
      url: redirectUrl,
    });
  }

  const result = await WebBrowser.openBrowserAsync(redirectUrl, {
    dismissButtonStyle: "close",
    showTitle: true,
  });

  if (__DEV__) {
    console.log("🔗 Browser result:", { platform: Platform.OS, result });
  }

  return result;
};

export const isGoogleServicesOAuthCallback = (url: string): boolean => {
  const parsed = Linking.parse(url);
  const path = parsed.path?.replace(/^\/+/, "") ?? "";
  return (
    parsed.hostname === GOOGLE_OAUTH_HOST &&
    path.startsWith(GOOGLE_OAUTH_PATH_PREFIX)
  );
};

export const parseGoogleServicesOAuthCallback = (
  url: string,
): GoogleOAuthResult => {
  try {
    if (!isGoogleServicesOAuthCallback(url)) {
      return { success: false, error: "Invalid callback URL" };
    }

    const parsed = Linking.parse(url);
    const path = parsed.path?.replace(/^\/+/, "") ?? "";
    const [, status] = path.split("/");

    if (status === "success") {
      const services = parseServicesParam(
        parsed.queryParams?.services ?? undefined,
      );
      return { success: true, services };
    }

    if (status === "error") {
      const errorParam = parsed.queryParams?.error;
      const errorMessage = Array.isArray(errorParam)
        ? errorParam[0]
        : errorParam;
      return { success: false, error: errorMessage || "Unknown error" };
    }

    return { success: false, error: "Invalid callback URL" };
  } catch {
    return { success: false, error: "Failed to parse callback URL" };
  }
};

export const handleGoogleServicesOAuthCallback = (
  handlers: GoogleServicesOAuthHandlers,
): (() => void) => {
  const handleUrl = (url: string) => {
    if (!isGoogleServicesOAuthCallback(url)) return;
    handlers.onStart?.();
    const result = parseGoogleServicesOAuthCallback(url);
    handlers.onResult?.(result);
  };

  Linking.getInitialURL().then((url) => {
    if (url) {
      handleUrl(url);
    }
  });

  const subscription = Linking.addEventListener("url", (event) => {
    handleUrl(event.url);
  });

  return () => {
    subscription.remove();
  };
};
