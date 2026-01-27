import { Platform } from 'react-native';

/**
 * Android API level 34 corresponds to Android 14.
 * Android 14 introduced stricter foreground service type enforcement
 * and additional requirements for background location access.
 */
const ANDROID_14_API_LEVEL = 34;

/**
 * Returns true if running on Android 14 (API level 34) or higher.
 * Returns false on non-Android platforms or older Android versions.
 */
export function isAndroid14Plus(): boolean {
  if (Platform.OS !== 'android') return false;
  const version = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  return !isNaN(version) && version >= ANDROID_14_API_LEVEL;
}

/**
 * Returns the Android API level as a number, or null on non-Android platforms.
 */
export function getAndroidApiLevel(): number | null {
  if (Platform.OS !== 'android') return null;
  const version = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  return isNaN(version) ? null : version;
}
