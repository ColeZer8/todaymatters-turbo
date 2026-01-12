import * as Linking from 'expo-linking';
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

  const baseUrl = appConfig.oauth.apiBaseUrl;
  if (!baseUrl) {
    throw new Error(
      'Missing OAuth API base URL. Set EXPO_PUBLIC_OAUTH_API_BASE_URL in your environment.'
    );
  }

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

const getRedirectUrlFromOAuthStartResponse = (response: Response): string | null => {
  // Prefer explicit redirect location (what the backend should return).
  const location = response.headers.get('location') ?? response.headers.get('Location');
  if (location) return location;

  // Some runtimes follow redirects and hide Location. If so, only accept URLs that look like Google OAuth.
  const url = typeof response.url === 'string' ? response.url : '';
  if (url && looksLikeGoogleOAuthUrl(url)) return url;

  return null;
};

export const startGoogleServicesOAuth = async (
  services: GoogleService[],
  accessToken: string
): Promise<void> => {
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
    console.log('🔗 Google Services OAuth start response:', {
      status: response.status,
      url: response.url,
      location,
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

  const canOpen = await Linking.canOpenURL(redirectUrl);
  if (!canOpen) {
    throw new Error(
      'Cannot open OAuth URL. Please check your network connection.'
    );
  }

  await Linking.openURL(redirectUrl);
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
