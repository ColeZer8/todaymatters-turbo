import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, InteractionManager, Platform, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { ConnectGoogleServicesTemplate } from "@/components/templates/ConnectGoogleServicesTemplate";
import {
  startGoogleServicesOAuth,
  fetchConnectedGoogleServices,
  type GoogleService,
} from "@/lib/google-services-oauth";
import { useAuthStore, useGoogleServicesOAuthStore } from "@/stores";
import {
  SETUP_SCREENS_STEPS,
  SETUP_SCREENS_TOTAL_STEPS,
} from "@/constants/setup-screens";

export default function ConnectGoogleServicesScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady =
    navigationState?.key != null && navigationState?.routes?.length > 0;

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore(
    (state) => state.session?.access_token ?? null,
  );

  const isProcessingOAuth = useGoogleServicesOAuthStore(
    (state) => state.isProcessing,
  );
  const oauthResult = useGoogleServicesOAuthStore((state) => state.result);
  const clearOAuthResult = useGoogleServicesOAuthStore(
    (state) => state.clearResult,
  );

  const [selectedServices, setSelectedServices] = useState<GoogleService[]>([]);
  const [expandedService, setExpandedService] = useState<GoogleService | null>(
    null,
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchedConnectedServices, setFetchedConnectedServices] = useState<
    GoogleService[]
  >([]);
  const [isLoadingConnected, setIsLoadingConnected] = useState(false);
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);

  // Combine OAuth result (from recent connection) with fetched services (from backend)
  const connectedServices = useMemo(() => {
    const fromOAuth = oauthResult?.success ? (oauthResult.services ?? []) : [];
    // Merge and deduplicate
    const all = [...new Set([...fromOAuth, ...fetchedConnectedServices])];
    return all;
  }, [oauthResult, fetchedConnectedServices]);
  const connectedServicesKey = connectedServices.join(",");

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace({
          pathname: "/",
          params: { next: "connect-google-services" },
        });
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
          console.warn("⚠️ Could not fetch connected Google services:", error);
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
      setHasAttemptedConnection(true);
      setErrorMessage(null);
      setIsConnecting(false);
      return;
    }

    setHasAttemptedConnection(true);
    setIsConnecting(false);
    setErrorMessage(
      oauthResult.error ?? "Unable to complete Google connection.",
    );
  }, [oauthResult]);

  useEffect(() => {
    if (connectedServices.length > 0 && !hasAttemptedConnection) {
      setHasAttemptedConnection(true);
    }
  }, [connectedServicesKey, connectedServices.length, hasAttemptedConnection]);

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
    setHasAttemptedConnection(true);
    setErrorMessage(null);
    setIsConnecting(true);
    try {
      if (!accessToken) {
        throw new Error(
          "Missing access token. Please sign in again and retry.",
        );
      }
      const result = await startGoogleServicesOAuth(selectedServices, accessToken);
      
      // Android only: With openBrowserAsync, user sees success page in browser and manually closes it.
      // When browser is dismissed, check if connection actually succeeded.
      // iOS uses openAuthSessionAsync with deep link redirect, so this is handled by the OAuth callback.
      if (Platform.OS === "android" && (result.type === "cancel" || result.type === "dismiss")) {
        if (__DEV__) {
          console.log("🔗 [Android] Browser dismissed, checking connection status...");
        }
        // Give backend a moment to process the OAuth callback
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Check if services are now connected
        const nowConnected = await fetchConnectedGoogleServices(accessToken);
        if (nowConnected.length > 0) {
          setFetchedConnectedServices(nowConnected);
          if (__DEV__) {
            console.log("🔗 [Android] Services connected after browser dismiss:", nowConnected);
          }
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to open Google connection.",
      );
    } finally {
      setIsConnecting(false);
    }
  }, [selectedServices, accessToken]);

  const handleContinue = useCallback(() => {
    clearOAuthResult();
    router.replace("/core-values");
  }, [clearOAuthResult, router]);

  const handleRetryConnection = useCallback(() => {
    clearOAuthResult();
    setErrorMessage(null);
    void handleConnect();
  }, [clearOAuthResult, handleConnect]);

  const handleSkip = useCallback(() => {
    clearOAuthResult();
    router.replace("/core-values");
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
      hasAttemptedConnection={hasAttemptedConnection}
      onToggleService={toggleService}
      onToggleExpanded={toggleExpanded}
      onConnect={handleConnect}
      onContinue={handleContinue}
      onRetryConnection={handleRetryConnection}
      onSkip={handleSkip}
      onBack={() => router.replace("/permissions")}
      // key to ensure updated "connected services" state fully refreshes selection UI if needed
      key={`connect-google-${connectedServicesKey}`}
    />
  );
}
