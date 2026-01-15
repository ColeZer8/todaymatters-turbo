import { useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PermissionsTemplate } from '@/components/templates';
import { SETUP_SCREENS_STEPS, SETUP_SCREENS_TOTAL_STEPS } from '@/constants/setup-screens';
import { useOnboardingStore, type PermissionKey } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';
import { requestIosLocationPermissionsAsync } from '@/lib/ios-location';
import { requestAndroidLocationPermissionsAsync } from '@/lib/android-location';

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
      }
    })();
  }, [allEnabled, ensureLocationPermissionIfNeeded, setAllPermissions, togglePermission]);

  const handleTogglePermission = useCallback(
    (key: PermissionKey) => {
      void (async () => {
        const currentlyEnabled = permissions[key];
        const nextEnabled = !currentlyEnabled;

        if (key === 'location' && nextEnabled) {
          const ok = await ensureLocationPermissionIfNeeded();
          if (!ok) return;
        }

        togglePermission(key);
      })();
    },
    [ensureLocationPermissionIfNeeded, permissions, togglePermission]
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

      await savePermissions(permissions);
      router.replace('/core-values');
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
