import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

let didRegister = false;

export async function registerIosLocationBackgroundTaskAsync(): Promise<void> {
  if (didRegister) return;
  didRegister = true;

  if (Platform.OS !== 'ios') return;

  // Expo Go is not a supported target for background task behavior; avoid registering.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  // If the dev client is stale, these native modules won't exist and imports would crash.
  const hasExpoLocation = !!requireOptionalNativeModule('ExpoLocation');
  const hasExpoTaskManager = !!requireOptionalNativeModule('ExpoTaskManager');
  if (!hasExpoLocation || !hasExpoTaskManager) return;

  // Side-effect import that defines the task at module scope.
  await import('./location-task');
}


