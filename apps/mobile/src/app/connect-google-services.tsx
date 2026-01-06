import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { ConnectGoogleServicesTemplate } from '@/components/templates/ConnectGoogleServicesTemplate';
import { startGoogleServicesOAuth, type GoogleService } from '@/lib/google-services-oauth';
import { useAuthStore, useGoogleServicesOAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export default function ConnectGoogleServicesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const isProcessingOAuth = useGoogleServicesOAuthStore((state) => state.isProcessing);
  const oauthResult = useGoogleServicesOAuthStore((state) => state.result);
  const clearOAuthResult = useGoogleServicesOAuthStore((state) => state.clearResult);

  const [selectedServices, setSelectedServices] = useState<GoogleService[]>([]);
  const [expandedService, setExpandedService] = useState<GoogleService | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectedServices = useMemo(() => oauthResult?.success ? oauthResult.services ?? [] : [], [oauthResult]);
  const connectedServicesKey = connectedServices.join(',');

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  useEffect(() => {
    if (!oauthResult) return;

    if (oauthResult.success) {
      setErrorMessage(null);
      setIsConnecting(false);
      // If we just connected something, proceed in onboarding.
      if ((oauthResult.services?.length ?? 0) > 0) {
        const timeoutId = setTimeout(() => {
          clearOAuthResult();
          router.replace('/setup-questions');
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
      await startGoogleServicesOAuth(selectedServices);
      // We intentionally do not navigate here; the deep-link callback will drive state updates.
    } catch (error) {
      setIsConnecting(false);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open Google connection.');
    }
  }, [selectedServices]);

  const handleSkip = useCallback(() => {
    clearOAuthResult();
    router.replace('/setup-questions');
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
      step={ONBOARDING_STEPS.connectGoogleServices}
      totalSteps={ONBOARDING_TOTAL_STEPS}
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


