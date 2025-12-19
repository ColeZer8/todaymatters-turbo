/**
 * Microphone Permission Handling
 *
 * Handles requesting microphone permissions for both iOS and Android.
 */

import { PermissionsAndroid, Platform, Alert } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Request microphone permission from the user.
 * On iOS, this is handled by the Info.plist configuration.
 * On Android, we need to request at runtime.
 */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  if (Platform.OS === 'ios') {
    // iOS permissions are handled by Info.plist
    // The system will prompt automatically when we try to use the mic
    return { granted: true, canAskAgain: true };
  }

  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message:
            'TodayMatters needs access to your microphone to have voice conversations with your AI coach.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return { granted: true, canAskAgain: true };
      } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        return { granted: false, canAskAgain: false };
      } else {
        return { granted: false, canAskAgain: true };
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return { granted: false, canAskAgain: true };
    }
  }

  // Web or other platforms
  return { granted: true, canAskAgain: true };
}

/**
 * Check if microphone permission is already granted (Android only)
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    return result;
  }

  // iOS and other platforms - assume granted (will prompt when used)
  return true;
}

/**
 * Show an alert directing user to settings when permission is denied
 */
export function showPermissionDeniedAlert(): void {
  Alert.alert(
    'Microphone Permission Required',
    'To use voice conversations with your AI coach, please enable microphone access in your device settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          // Note: Opening settings requires expo-linking or react-native Linking
          // The user will need to manually navigate to app settings
          Alert.alert(
            'Open Settings',
            'Please go to Settings > Apps > TodayMatters > Permissions > Microphone and enable it.'
          );
        },
      },
    ]
  );
}





