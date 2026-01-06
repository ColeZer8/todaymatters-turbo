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

export const startGoogleServicesOAuth = async (
  services: GoogleService[]
): Promise<void> => {
  const oauthUrl = buildGoogleServicesOAuthUrl(services);

  const canOpen = await Linking.canOpenURL(oauthUrl);
  if (!canOpen) {
    throw new Error(
      'Cannot open OAuth URL. Please check your network connection.'
    );
  }

  await Linking.openURL(oauthUrl);
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
