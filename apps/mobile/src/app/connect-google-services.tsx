import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { ConnectGoogleServicesTemplate } from '@/components/templates/ConnectGoogleServicesTemplate';
import { startGoogleServicesOAuth, fetchConnectedGoogleServices, type GoogleService } from '@/lib/google-services-oauth';
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

  const [selectedServices, setSelectedServices] = useState<GoogleService[]>([]);
  const [expandedService, setExpandedService] = useState<GoogleService | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchedConnectedServices, setFetchedConnectedServices] = useState<GoogleService[]>([]);
  const [isLoadingConnected, setIsLoadingConnected] = useState(false);

  // Combine OAuth result (from recent connection) with fetched services (from backend)
  const connectedServices = useMemo(() => {
    const fromOAuth = oauthResult?.success ? oauthResult.services ?? [] : [];
    // Merge and deduplicate
    const all = [...new Set([...fromOAuth, ...fetchedConnectedServices])];
    return all;
  }, [oauthResult, fetchedConnectedServices]);
  const connectedServicesKey = connectedServices.join(',');

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
    if (!isAuthenticated || !accessToken) return;

    let cancelled = false;
    setIsLoadingConnected(true);
    (async () => {
      try {
        const services = await fetchConnectedGoogleServices(accessToken);
        if (!cancelled) {
          setFetchedConnectedServices(services);
        }
      } catch (error) {
        if (__DEV__ && !cancelled) {
          console.warn('⚠️ Could not fetch connected Google services:', error);
        }
        // Don't show error to user - graceful degradation
      } finally {
        if (!cancelled) {
          setIsLoadingConnected(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken, oauthResult?.success]);

  useEffect(() => {
    if (!oauthResult) return;

    if (oauthResult.success) {
      setErrorMessage(null);
      setIsConnecting(false);
      // If we just connected something, proceed in onboarding.
      if ((oauthResult.services?.length ?? 0) > 0) {
        const timeoutId = setTimeout(() => {
          clearOAuthResult();
          router.replace('/core-values');
        }, 350);
        return () => clearTimeout(timeoutId);
      }
      return;
    }

    setIsConnecting(false);
    setErrorMessage(oauthResult.error ?? 'Unable to complete Google connection.');
  }, [oauthResult, clearOAuthResult, router]);

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

  const handleConnect = useCallback(async () => {
    if (selectedServices.length === 0) return;
    setErrorMessage(null);
    setIsConnecting(true);
    try {
      if (!accessToken) {
        throw new Error('Missing access token. Please sign in again and retry.');
      }
      await startGoogleServicesOAuth(selectedServices, accessToken);
      // We intentionally do not navigate here; the deep-link callback will drive state updates.
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open Google connection.');
    } finally {
      setIsConnecting(false);
    }
  }, [selectedServices, accessToken]);

  const handleSkip = useCallback(() => {
    clearOAuthResult();
    router.replace('/core-values');
  }, [clearOAuthResult, router]);

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
      isConnecting={isConnecting || isProcessingOAuth}
      errorMessage={errorMessage}
      onToggleService={toggleService}
      onToggleExpanded={toggleExpanded}
      onConnect={handleConnect}
      onSkip={handleSkip}
      onBack={() => router.replace('/permissions')}
      // key to ensure updated "connected services" state fully refreshes selection UI if needed
      key={`connect-google-${connectedServicesKey}`}
    />
  );
}


