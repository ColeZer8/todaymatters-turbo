import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, InteractionManager, Platform, View } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { ConnectGoogleServicesTemplate } from "@/components/templates/ConnectGoogleServicesTemplate";
import {
  startGoogleServicesOAuth,
  checkGoogleConnectionFromSupabase,
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
  const userId = useAuthStore((state) => state.session?.user?.id ?? null);

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
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);

  // Combine OAuth result (from deep link callback) with fetched services (from Supabase)
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

  // Check for existing Google connection on mount
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let cancelled = false;
    (async () => {
      try {
        const connection = await checkGoogleConnectionFromSupabase(userId);
        if (!cancelled && connection?.connected && connection.services.length > 0) {
          setFetchedConnectedServices(connection.services);
          setHasAttemptedConnection(true);
        }
      } catch (error) {
        if (__DEV__ && !cancelled) {
          console.warn("⚠️ Could not check Google connection:", error);
        }
        // Don't show error - graceful degradation
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

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
    if (!userId) {
      setErrorMessage("User not authenticated. Please sign in again.");
      return;
    }
    
    setHasAttemptedConnection(true);
    setErrorMessage(null);
    setIsConnecting(true);
    
    try {
      if (!accessToken) {
        throw new Error(
          "Missing access token. Please sign in again and retry.",
        );
      }
      
      // Open browser for OAuth (uses openBrowserAsync per Michael's recommendation)
      const result = await startGoogleServicesOAuth(selectedServices, accessToken);

      if (__DEV__) {
        console.log("🔗 OAuth browser closed, checking connection status...", {
          result,
          platform: Platform.OS,
        });
      }

      // Browser was dismissed - check if OAuth actually completed
      // Per Michael: query Supabase source_accounts table directly
      if (result.type === "dismiss" || result.type === "cancel" || result.type === "opened") {
        // Give backend a moment to process the OAuth callback
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check Supabase for connection status
        const connection = await checkGoogleConnectionFromSupabase(userId);
        
        if (connection?.connected && connection.services.length > 0) {
          if (__DEV__) {
            console.log("🔗 Google connection verified:", connection);
          }
          setFetchedConnectedServices(connection.services);
          setErrorMessage(null);
        } else {
          // User closed browser before completing OAuth
          if (__DEV__) {
            console.log("🔗 No Google connection found after browser dismiss");
          }
          // Don't show error - user might have intentionally cancelled
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
  }, [selectedServices, accessToken, userId]);

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
      key={`connect-google-${connectedServicesKey}`}
    />
  );
}
