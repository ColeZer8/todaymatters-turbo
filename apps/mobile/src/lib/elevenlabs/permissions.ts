/**
 * Microphone Permission Handling
 *
 * Handles requesting microphone permissions for both iOS and Android.
 */

import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Request microphone permission from the user.
 * On iOS, microphone permission is driven by the underlying audio stack (LiveKit/AVAudioSession)
 * and the `NSMicrophoneUsageDescription` entry in `app.json` / Info.plist.
 * On Android, uses PermissionsAndroid to request at runtime.
 */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  if (Platform.OS === 'ios') {
    // iOS will prompt automatically the first time the mic is actually used.
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
      console.error('Error requesting Android microphone permission:', error);
      return { granted: false, canAskAgain: true };
    }
  }

  // Web or other platforms
  return { granted: true, canAskAgain: true };
}

/**
 * Check if microphone permission is already granted
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // We don't pre-check on iOS here; allow session start to trigger the system prompt if needed.
    return true;
  }

  if (Platform.OS === 'android') {
    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return result;
    } catch (error) {
      console.error('Error checking Android microphone permission:', error);
      return false;
    }
  }

  // Web or other platforms - assume granted
  return true;
}

/**
 * Show an alert directing user to settings when permission is denied
 */
export async function showPermissionDeniedAlert(): Promise<void> {
  Alert.alert(
    'Microphone Permission Required',
    'To use voice conversations with your AI coach, please enable microphone access in your device settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: async () => {
          try {
            if (Platform.OS === 'ios') {
              await Linking.openURL('app-settings:');
            } else {
              await Linking.openSettings();
            }
          } catch (error) {
            console.error('Error opening settings:', error);
            Alert.alert(
              'Open Settings',
              Platform.OS === 'ios'
                ? 'Please go to Settings > TodayMatters > Microphone and enable it.'
                : 'Please go to Settings > Apps > TodayMatters > Permissions > Microphone and enable it.'
            );
          }
        },
      },
    ]
  );
}








