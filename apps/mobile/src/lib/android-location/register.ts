import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

let didRegister = false;

export async function registerAndroidLocationBackgroundTaskAsync(): Promise<void> {
  if (didRegister) return;
  didRegister = true;

  if (Platform.OS !== 'android') return;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  const hasExpoLocation = !!requireOptionalNativeModule('ExpoLocation');
  const hasExpoTaskManager = !!requireOptionalNativeModule('ExpoTaskManager');
  if (!hasExpoLocation || !hasExpoTaskManager) return;

  await import('./location-task');
}


