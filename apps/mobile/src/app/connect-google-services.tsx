import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { ConnectGoogleServicesTemplate } from '@/components/templates/ConnectGoogleServicesTemplate';
import {
  fetchConnectedGoogleServices,
  isGoogleServicesOAuthCallback,
  parseGoogleServicesOAuthCallback,
  startGoogleServicesOAuth,
  type GoogleService,
} from '@/lib/google-services-oauth';
import { useAuthStore, useGoogleServicesOAuthStore } from '@/stores';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';

export default function ConnectGoogleServicesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);

  const isProcessingOAuth = useGoogleServicesOAuthStore((state) => state.isProcessing);
  const oauthResult = useGoogleServicesOAuthStore((state) => state.result);
  const clearOAuthResult = useGoogleServicesOAuthStore((state) => state.clearResult);
  const setOAuthProcessing = useGoogleServicesOAuthStore((state) => state.setProcessing);
  const setOAuthResult = useGoogleServicesOAuthStore((state) => state.setResult);

  const [selectedServices, setSelectedServices] = useState<GoogleService[]>([]);
  const [expandedService, setExpandedService] = useState<GoogleService | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchedConnectedServices, setFetchedConnectedServices] = useState<GoogleService[]>([]);
  const [isLoadingConnected, setIsLoadingConnected] = useState(false);
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);

  const didAttemptConnectRef = useRef(false);
  const didAdvanceRef = useRef(false);
  const lastAttemptedServicesRef = useRef<GoogleService[]>([]);

  // Combine OAuth result (from recent connection) with fetched services (from backend)
  const connectedServices = useMemo(() => {
    const fromOAuth = oauthResult?.success ? oauthResult.services ?? [] : [];
    // Merge and deduplicate
    const all = [...new Set([...fromOAuth, ...fetchedConnectedServices])];
    return all;
  }, [oauthResult, fetchedConnectedServices]);
  const connectedServicesKey = connectedServices.join(',');

  // If services are now connected, prune them from selection so the primary CTA can become "Continue".
  useEffect(() => {
    setSelectedServices((prev) => prev.filter((service) => !connectedServices.includes(service)));
  }, [connectedServicesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshConnectedServices = useCallback(async (): Promise<GoogleService[]> => {
    if (!isAuthenticated || !accessToken) return [];
    setIsLoadingConnected(true);
    try {
      const services = await fetchConnectedGoogleServices(accessToken);
      setFetchedConnectedServices(services);
      return services;
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Could not fetch connected Google services:', error);
      }
      return [];
    } finally {
      setIsLoadingConnected(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  // Fetch currently connected services from backend on mount and after successful OAuth
  useEffect(() => {
    void refreshConnectedServices();
  }, [isAuthenticated, accessToken, oauthResult?.success]);

  useEffect(() => {
    if (!oauthResult) return;

    if (oauthResult.success) {
      setErrorMessage(null);
      setIsConnecting(false);
      // Don't require services in the callback on Android; we verify via status endpoint too.
      // Advancing is handled by the "attempt + connected services" effect below.
      return;
    }

    setIsConnecting(false);
    setErrorMessage(oauthResult.error ?? 'Unable to complete Google connection.');
  }, [oauthResult, clearOAuthResult, router]);

  // Android hardening: if the user completes OAuth in the browser but the app never receives the deep link,
  // verify connections when the app returns to foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      if (!didAttemptConnectRef.current) return;
      if (!isAuthenticated || !accessToken) return;
      if (didAdvanceRef.current) return;

      void (async () => {
        const services = await refreshConnectedServices();
        if (services.length > 0) {
          // Mark success locally to prevent looping.
          setOAuthResult({ success: true, services });
        } else {
          // If we still have no connected services, stop "processing" so the user can retry.
          setOAuthProcessing(false);
        }
      })();
    });

    return () => subscription.remove();
  }, [accessToken, isAuthenticated, refreshConnectedServices, setOAuthProcessing, setOAuthResult]);

  // UX: don't auto-advance on return from OAuth. Instead, show "Continue" + "Retry connection"
  // so the user never gets stuck in a connect loop if we can't confirm the connection immediately.
  useEffect(() => {
    const didAttemptOrCallback =
      didAttemptConnectRef.current || oauthResult != null || isProcessingOAuth;
    if (didAttemptOrCallback) {
      setHasAttemptedConnection(true);
    }
  }, [oauthResult, isProcessingOAuth]);

  const toggleService = useCallback((serviceId: GoogleService) => {
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((s) => s !== serviceId);
      }
      return [...prev, serviceId];
    });
  }, []);

  const toggleExpanded = useCallback((serviceId: GoogleService) => {
    setExpandedService((prev) => (prev === serviceId ? null : serviceId));
  }, []);

  const runConnect = useCallback(
    async (servicesToConnect: GoogleService[]) => {
      if (servicesToConnect.length === 0) return;
      lastAttemptedServicesRef.current = servicesToConnect;
      setHasAttemptedConnection(true);
      setErrorMessage(null);
      setIsConnecting(true);
      didAttemptConnectRef.current = true;
      didAdvanceRef.current = false;
      // Mark processing immediately so background/foreground session refresh doesn't interfere.
      setOAuthProcessing(true);
      try {
        if (!accessToken) {
          throw new Error('Missing access token. Please sign in again and retry.');
        }
        const result = await startGoogleServicesOAuth(servicesToConnect, accessToken);

        // If Android/iOS returns the redirect URL directly, parse it immediately (some devices don't emit Linking events reliably).
        if (result.type === 'success' && typeof result.url === 'string' && isGoogleServicesOAuthCallback(result.url)) {
          const parsed = parseGoogleServicesOAuthCallback(result.url);
          setOAuthResult(parsed);
        }

        // Otherwise, the deep-link handler (or the foreground verification) will update state.
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to open Google connection.');
        setOAuthProcessing(false);
      } finally {
        setIsConnecting(false);
      }
    },
    [accessToken, setOAuthProcessing, setOAuthResult]
  );

  const handleConnect = useCallback(async () => {
    await runConnect(selectedServices);
  }, [runConnect, selectedServices]);

  const handleRetryConnection = useCallback(async () => {
    const services = lastAttemptedServicesRef.current;
    if (services.length > 0) {
      setSelectedServices(services);
      await runConnect(services);
      return;
    }
    await runConnect(selectedServices);
  }, [runConnect, selectedServices]);

  const handleSkip = useCallback(() => {
    clearOAuthResult();
    setOAuthProcessing(false);
    router.replace('/core-values');
  }, [clearOAuthResult, router, setOAuthProcessing]);

  if (!isNavigationReady) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ConnectGoogleServicesTemplate
      step={SETUP_SCREENS_STEPS.connectGoogleServices}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
      selectedServices={selectedServices}
      expandedService={expandedService}
      connectedServices={connectedServices}
      hasAttemptedConnection={hasAttemptedConnection}
      isConnecting={isConnecting || isProcessingOAuth}
      errorMessage={errorMessage}
      onToggleService={toggleService}
      onToggleExpanded={toggleExpanded}
      onConnect={handleConnect}
      onRetryConnection={handleRetryConnection}
      onContinue={() => {
        clearOAuthResult();
        setOAuthProcessing(false);
        router.replace('/core-values');
      }}
      onSkip={handleSkip}
      onBack={() => router.replace('/permissions')}
      // key to ensure updated "connected services" state fully refreshes selection UI if needed
      key={`connect-google-${connectedServicesKey}`}
    />
  );
}


