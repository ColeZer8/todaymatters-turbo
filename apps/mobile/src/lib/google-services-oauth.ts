import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import appConfig from '@/lib/config';

export type GoogleService = 'google-calendar' | 'google-gmail';

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
  'google-calendar': 'google-calendar',
  'google-gmail': 'google-gmail',
  calendar: 'google-calendar',
  gmail: 'google-gmail',
};

const GOOGLE_OAUTH_HOST = 'oauth';
const GOOGLE_OAUTH_PATH_PREFIX = 'google/';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizeLocalhostUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return value;
    }

    const hostUri = Constants.expoConfig?.hostUri;
    if (!hostUri) return value;

    const hostUrl = hostUri.includes('://') ? hostUri : `http://${hostUri}`;
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
      'Missing OAuth API base URL. Set EXPO_PUBLIC_OAUTH_API_BASE_URL in your environment.'
    );
  }

  const normalized = normalizeLocalhostUrl(baseUrl);
  if (__DEV__ && normalized !== baseUrl) {
    // eslint-disable-next-line no-console
    console.log('🔗 OAuth base URL normalized for device:', normalized);
  }

  return normalized;
};

const parseServicesParam = (
  servicesParam?: string | string[] | null
): GoogleService[] => {
  if (!servicesParam) return [];

  const raw = Array.isArray(servicesParam) ? servicesParam.join(',') : servicesParam;
  return raw
    .split(',')
    .map((service) => service.trim())
    .filter(Boolean)
    .map((service) => SERVICE_LOOKUP[service])
    .filter((service): service is GoogleService => Boolean(service));
};

export const buildGoogleServicesOAuthUrl = (services: GoogleService[]): string => {
  if (services.length === 0) {
    throw new Error('At least one service must be selected');
  }

  const baseUrl = resolveOAuthBaseUrl();

  const servicesParam = services.join(',');
  return `${trimTrailingSlash(baseUrl)}/oauth2/google/start?services=${encodeURIComponent(
    servicesParam
  )}`;
};

const looksLikeGoogleOAuthUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    // The consent screen should be on accounts.google.com (or occasionally other google hosts).
    // counts.google.com is NOT a valid OAuth start target; opening it produces confusing errors.
    const host = parsed.hostname.toLowerCase();
    if (host === 'counts.google.com') return false;
    if (host.endsWith('.google.com') || host === 'accounts.google.com') {
      return parsed.pathname.includes('/o/oauth2') || parsed.pathname.includes('/oauth2') || parsed.pathname.includes('/signin');
    }
    return false;
  } catch {
    return false;
  }
};

const toCanonicalGoogleOAuthAuthUrl = (url: string): string => {
  /**
   * PRODUCTION-GRADE: Always prefer the canonical OAuth endpoint:
   *   https://accounts.google.com/o/oauth2/v2/auth
   *
   * Google sometimes returns an internal `/signin/identifier` URL that *contains*
   * all the real OAuth params. Opening internal pages (or legacy consent URLs) is
   * fragile on mobile and can lead to counts.google.com 400/500.
   */
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== 'accounts.google.com') return url;

    // If it's already the canonical endpoint, keep it.
    if (parsed.pathname.startsWith('/o/oauth2') || parsed.pathname.startsWith('/oauth2')) {
      return url;
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    const allowedKeys = [
      'client_id',
      'redirect_uri',
      'response_type',
      'scope',
      'state',
      'code_challenge',
      'code_challenge_method',
      'access_type',
      'prompt',
      'hd',
      'include_granted_scopes',
      'login_hint',
    ] as const;

    for (const key of allowedKeys) {
      const value = parsed.searchParams.get(key);
      if (value) authUrl.searchParams.set(key, value);
    }

    // If required params are missing, fall back to original.
    if (
      !authUrl.searchParams.get('client_id') ||
      !authUrl.searchParams.get('redirect_uri') ||
      !authUrl.searchParams.get('response_type') ||
      !authUrl.searchParams.get('scope') ||
      !authUrl.searchParams.get('state')
    ) {
      return url;
    }

    return authUrl.toString();
  } catch {
    return url;
  }
};

const getRedirectUrlFromOAuthStartResponse = (response: Response): string | null => {
  // Prefer explicit redirect location (what the backend should return).
  const location = response.headers.get('location') ?? response.headers.get('Location');
  if (location) {
    return toCanonicalGoogleOAuthAuthUrl(location);
  }

  // Some runtimes follow redirects and hide Location. If so, only accept URLs that look like Google OAuth.
  const url = typeof response.url === 'string' ? response.url : '';
  if (url && looksLikeGoogleOAuthUrl(url)) {
    return toCanonicalGoogleOAuthAuthUrl(url);
  }

  return null;
};

export const startGoogleServicesOAuth = async (
  services: GoogleService[],
  accessToken: string
): Promise<WebBrowser.WebBrowserAuthSessionResult> => {
  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again and retry.');
  }

  const oauthUrl = buildGoogleServicesOAuthUrl(services);

  // Backend requires Authorization header; we must request the redirect URL first.
  const response = await fetch(oauthUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    // In RN this may still follow redirects; we handle both cases.
    redirect: 'manual',
  } as RequestInit);

  if (__DEV__) {
    const location = response.headers.get('location') ?? response.headers.get('Location');
    const finalUrl = location || response.url || '';
    
    // Parse and log OAuth parameters for debugging
    let oauthParams: Record<string, string> = {};
    try {
      const urlObj = new URL(finalUrl);
      urlObj.searchParams.forEach((value, key) => {
        oauthParams[key] = value;
      });
    } catch {
      // URL parsing failed, skip param extraction
    }
    
    console.log('🔗 Google Services OAuth start response:', {
      status: response.status,
      url: response.url,
      location,
      oauthParams: Object.keys(oauthParams).length > 0 ? {
        prompt: oauthParams.prompt,
        hd: oauthParams.hd,
        client_id: oauthParams.client_id?.substring(0, 20) + '...',
        redirect_uri: oauthParams.redirect_uri,
        scope: oauthParams.scope,
        response_type: oauthParams.response_type,
      } : null,
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Not authorized to connect Google services. Please sign in again and retry.');
  }

  if (!response.ok && (response.status < 300 || response.status >= 400)) {
    throw new Error(`Failed to start Google connection (HTTP ${response.status}).`);
  }

  const redirectUrl = getRedirectUrlFromOAuthStartResponse(response);
  if (!redirectUrl) {
    throw new Error(
      'Failed to start Google connection (missing redirect URL). The backend must return a 302 with a Google OAuth Location header.'
    );
  }

  if (!looksLikeGoogleOAuthUrl(redirectUrl)) {
    throw new Error(
      'Failed to start Google connection (unexpected redirect URL). Please contact the backend team to verify the Google OAuth URL generation.'
    );
  }

  if (__DEV__) {
    console.log('🔗 Opening Google OAuth URL:', redirectUrl);
  }

  // Use Expo's auth session (official guidance) so iOS/Android handle redirects back to the app reliably.
  const returnUrl = Linking.createURL('oauth/google');
  const result = await WebBrowser.openAuthSessionAsync(redirectUrl, returnUrl);

  if (__DEV__) {
    console.log('🔗 Google OAuth web session result:', result);
  }

  /**
   * IMPORTANT (iOS): ASWebAuthenticationSession can return `cancel` (error 1) even when the user
   * completes the flow, because the system dismisses the session when our app is foregrounded.
   *
   * The true source of truth for completion is our deep-link handler (`todaymatters://oauth/google/...`),
   * which updates `useGoogleServicesOAuthStore`.
   *
   * So we do NOT treat cancel/dismiss as an error here.
   */
  return result;
};

export const isGoogleServicesOAuthCallback = (url: string): boolean => {
  const parsed = Linking.parse(url);
  const path = parsed.path?.replace(/^\/+/, '') ?? '';
  return parsed.hostname === GOOGLE_OAUTH_HOST && path.startsWith(GOOGLE_OAUTH_PATH_PREFIX);
};

export const parseGoogleServicesOAuthCallback = (url: string): GoogleOAuthResult => {
  try {
    if (!isGoogleServicesOAuthCallback(url)) {
      return { success: false, error: 'Invalid callback URL' };
    }

    const parsed = Linking.parse(url);
    const path = parsed.path?.replace(/^\/+/, '') ?? '';
    const [, status] = path.split('/');

    if (status === 'success') {
      const services = parseServicesParam(parsed.queryParams?.services ?? undefined);
      return { success: true, services };
    }

    if (status === 'error') {
      const errorParam = parsed.queryParams?.error;
      const errorMessage = Array.isArray(errorParam) ? errorParam[0] : errorParam;
      return { success: false, error: errorMessage || 'Unknown error' };
    }

    return { success: false, error: 'Invalid callback URL' };
  } catch {
    return { success: false, error: 'Failed to parse callback URL' };
  }
};

export const handleGoogleServicesOAuthCallback = (
  handlers: GoogleServicesOAuthHandlers
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

  const subscription = Linking.addEventListener('url', (event) => {
    handleUrl(event.url);
  });

  return () => {
    subscription.remove();
  };
};

/**
 * Fetches the list of currently connected Google services from the backend.
 * @param accessToken Supabase access token for authentication
 * @returns Array of connected Google services, or empty array if none are connected
 */
export const fetchConnectedGoogleServices = async (
  accessToken: string
): Promise<GoogleService[]> => {
  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again and retry.');
  }

  const baseUrl = resolveOAuthBaseUrl();

  try {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/oauth2/google/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Not authorized to check Google services status. Please sign in again and retry.');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch connected services (HTTP ${response.status}).`);
    }

    const data = await response.json();
    const servicesParam = data.services ?? data.connected_services ?? null;
    const services = parseServicesParam(servicesParam);

    if (__DEV__) {
      console.log('🔗 Connected Google services:', services);
    }

    return services;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not authorized')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('HTTP')) {
      throw error;
    }
    // If the endpoint doesn't exist yet, return empty array (graceful degradation)
    if (__DEV__) {
      console.warn('⚠️ Could not fetch connected Google services:', error);
    }
    return [];
  }
};
