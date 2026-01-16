import { useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PermissionsTemplate } from '@/components/templates';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';
import { useOnboardingStore, type PermissionKey } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';
import { requestIosLocationPermissionsAsync } from '@/lib/ios-location';
import { requestAndroidLocationPermissionsAsync } from '@/lib/android-location';
import {
  getAndroidInsightsSupportStatus,
  getHealthAuthorizationStatusSafeAsync as getAndroidHealthAuthorizationStatusSafeAsync,
  getUsageAccessAuthorizationStatusSafeAsync,
  openUsageAccessSettingsSafeAsync,
  requestHealthConnectAuthorizationSafeAsync,
} from '@/lib/android-insights';

export default function PermissionsScreen() {
  const router = useRouter();
  const [showIndividual, setShowIndividual] = useState(false);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const permissions = useOnboardingStore((state) => state.permissions);
  const togglePermission = useOnboardingStore((state) => state.togglePermission);
  const setAllPermissions = useOnboardingStore((state) => state.setAllPermissions);

  const { savePermissions } = useOnboardingSync({ autoLoad: false, autoSave: false });

  const ensureLocationPermissionIfNeeded = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return true;

    const result =
      Platform.OS === 'ios' ? await requestIosLocationPermissionsAsync() : await requestAndroidLocationPermissionsAsync();

    if (result.foreground === 'granted' && result.background === 'granted') return true;

    if (!result.hasNativeModule) {
      Alert.alert(
        'Location not available in this build',
        Platform.OS === 'android'
          ? 'This Android build is missing the native location module.\n\nThis usually means you only restarted Metro (expo start) and did not reinstall the native app.\n\nFix:\n- Delete the app from your device/emulator\n- Run: pnpm --filter mobile android:dev\n- Then run: pnpm dev -- --filter=mobile'
          : 'This iOS dev build is missing the native location module.\n\nThis usually means you only restarted Metro (expo start) and did not reinstall the native app.\n\nFix:\n- Delete the app from your device/simulator\n- Run: pnpm --filter mobile ios:dev\n- Then run: pnpm dev -- --filter=mobile'
      );
      return false;
    }

    const canAskAgain = result.canAskAgainForeground || result.canAskAgainBackground;

    Alert.alert(
      'Location permission needed',
      Platform.OS === 'android'
        ? 'To compare your planned day to your actual day, please allow Location (including background). On some Android versions you may need to enable background location in Settings after granting while-in-use.'
        : 'To compare your planned day to your actual day, please allow Location (Always). If iOS won’t re-prompt, open Settings and set Location to “Always”.',
      canAskAgain
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
    );
    return false;
  }, []);

  const ensureAndroidHealthPermissionIfNeeded = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const support = getAndroidInsightsSupportStatus();
    if (support !== 'available') {
      Alert.alert(
        'Health data not available in this build',
        'Health Connect requires the custom Android dev client. Rebuild the app, then try again.'
      );
      return false;
    }

    const status = await getAndroidHealthAuthorizationStatusSafeAsync();
    if (status === 'authorized') return true;

    const ok = await requestHealthConnectAuthorizationSafeAsync();
    if (ok) return true;

    Alert.alert(
      'Health Connect permission needed',
      'Please enable TodayMatters in Health Connect, then return and try again.'
    );
    return false;
  }, []);

  const ensureAndroidUsageAccessIfNeeded = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const support = getAndroidInsightsSupportStatus();
    if (support !== 'available') {
      Alert.alert(
        'App usage not available in this build',
        'Usage access requires the custom Android dev client. Rebuild the app, then try again.'
      );
      return false;
    }

    const status = await getUsageAccessAuthorizationStatusSafeAsync();
    if (status === 'authorized') return true;

    await openUsageAccessSettingsSafeAsync();
    Alert.alert(
      'Usage access required',
      'Enable TodayMatters in Usage Access settings, then return and try again.'
    );
    return false;
  }, []);

  // Derived: all permissions enabled = allowAll is on
  const allEnabled = useMemo(
    () => Object.values(permissions).every(Boolean),
    [permissions]
  );

  const handleAllowAllToggle = useCallback(() => {
    void (async () => {
      const nextValue = !allEnabled;
      setAllPermissions(nextValue);

      // If enabling all, ensure iOS location permission is actually granted.
      if (nextValue) {
        const ok = await ensureLocationPermissionIfNeeded();
        if (!ok) {
          // Revert just the location toggle (others can remain enabled).
          togglePermission('location');
        }

        if (Platform.OS === 'android') {
          const healthOk = await ensureAndroidHealthPermissionIfNeeded();
          if (!healthOk) {
            togglePermission('health');
          }

          const usageOk = await ensureAndroidUsageAccessIfNeeded();
          if (!usageOk) {
            togglePermission('appUsage');
          }
        }
      }
    })();
  }, [
    allEnabled,
    ensureAndroidHealthPermissionIfNeeded,
    ensureAndroidUsageAccessIfNeeded,
    ensureLocationPermissionIfNeeded,
    setAllPermissions,
    togglePermission,
  ]);

  const handleTogglePermission = useCallback(
    (key: PermissionKey) => {
      void (async () => {
        const currentlyEnabled = permissions[key];
        const nextEnabled = !currentlyEnabled;

        if (key === 'location' && nextEnabled) {
          const ok = await ensureLocationPermissionIfNeeded();
          if (!ok) return;
        }

        if (key === 'health' && nextEnabled) {
          const ok = await ensureAndroidHealthPermissionIfNeeded();
          if (!ok) return;
        }

        if (key === 'appUsage' && nextEnabled) {
          const ok = await ensureAndroidUsageAccessIfNeeded();
          if (!ok) return;
        }

        togglePermission(key);
      })();
    },
    [
      ensureAndroidHealthPermissionIfNeeded,
      ensureAndroidUsageAccessIfNeeded,
      ensureLocationPermissionIfNeeded,
      permissions,
      togglePermission,
    ]
  );

  const handleToggleShowIndividual = useCallback(() => {
    setShowIndividual((prev) => !prev);
  }, []);

  const handleContinue = () => {
    void (async () => {
      // If user kept Location enabled, make sure we actually have system permissions before proceeding.
      if (permissions.location) {
        const ok = await ensureLocationPermissionIfNeeded();
        if (!ok) {
          // Keep the UI consistent: flip off the toggle if we couldn't obtain permission.
          togglePermission('location');
          return;
        }
      }

      if (Platform.OS === 'android' && permissions.health) {
        const ok = await ensureAndroidHealthPermissionIfNeeded();
        if (!ok) {
          togglePermission('health');
          return;
        }
      }

      if (Platform.OS === 'android' && permissions.appUsage) {
        const ok = await ensureAndroidUsageAccessIfNeeded();
        if (!ok) {
          togglePermission('appUsage');
          return;
        }
      }

      await savePermissions(permissions);
      router.replace('/connect-google-services');
    })();
  };

  if (!hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <PermissionsTemplate
      allowAllEnabled={allEnabled}
      onToggleAllowAll={handleAllowAllToggle}
      showIndividual={showIndividual}
      onToggleShowIndividual={handleToggleShowIndividual}
      permissions={permissions}
      onTogglePermission={handleTogglePermission}
      onContinue={handleContinue}
      onBack={() => router.replace('/explainer-video')}
      step={SETUP_SCREENS_STEPS.permissions}
      totalSteps={SETUP_SCREENS_TOTAL_STEPS}
    />
  );
}
