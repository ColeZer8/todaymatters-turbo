import {
  startReadSMS,
  checkIfHasSMSPermission,
  requestReadSMSPermission,
} from "@maniac-tech/react-native-expo-read-sms";
import { Platform, Linking, Alert } from "react-native";

/**
 * Open Android Settings for TodayMatters app
 */
export function openAndroidSettings() {
  console.log('🔧 [SMS Service] Opening Android Settings...');
  if (Platform.OS === 'android') {
    Linking.openSettings();
  }
}

/**
 * Request SMS permissions (READ_SMS + RECEIVE_SMS)
 * 
 * Due to Expo dev build limitations, this shows an alert directing users to Settings
 * instead of using the broken PermissionsAndroid.request() which hangs.
 * 
 * @returns Promise<boolean> - true if permissions granted
 */
export async function requestSMSPermissions(): Promise<boolean> {
  console.log('🟢 [SMS Service] requestSMSPermissions called');
  
  if (Platform.OS !== 'android') {
    console.log('🔴 [SMS Service] Not Android, returning false');
    return false;
  }

  try {
    // First check if we already have permissions
    const hasPermission = await checkIfHasSMSPermission();
    console.log('🟢 [SMS Service] Current permission status:', hasPermission);
    
    if (hasPermission.hasReadSmsPermission && hasPermission.hasReceiveSmsPermission) {
      console.log('✅ [SMS Service] Permissions already granted');
      return true;
    }

    // First attempt native runtime permission prompt
    console.log('🔧 [SMS Service] Requesting native SMS runtime permission...');
    const grantedByPrompt = await requestReadSMSPermission();

    if (grantedByPrompt) {
      console.log('✅ [SMS Service] SMS permission granted via native prompt');
      return true;
    }

    // Fallback path: direct user to Settings
    console.log('🔧 [SMS Service] Native prompt denied/unavailable; showing Settings redirect alert...');
    return new Promise((resolve) => {
      Alert.alert(
        'Enable SMS Permissions',
        'To track text messages, please enable SMS permissions in Settings.\n\n1. Tap "Open Settings"\n2. Tap "Permissions"\n3. Enable "SMS"',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('🔴 [SMS Service] User cancelled');
              resolve(false);
            },
          },
          {
            text: 'Open Settings',
            onPress: () => {
              console.log('🔧 [SMS Service] Opening Settings...');
              openAndroidSettings();
              // User will grant manually; caller should re-check on return.
              resolve(false);
            },
          },
        ]
      );
    });
  } catch (error) {
    console.error('🔴 [SMS Service] Error requesting permissions:', error);
    return false;
  }
}

/**
 * Check if SMS permissions are already granted
 * @returns Promise<boolean> - true if both READ_SMS and RECEIVE_SMS are granted
 */
export async function checkSMSPermissions(): Promise<boolean> {
  const { hasReadSmsPermission, hasReceiveSmsPermission } = await checkIfHasSMSPermission();
  return hasReadSmsPermission && hasReceiveSmsPermission;
}

/**
 * Start listening for incoming SMS messages
 * @param onMessage - Callback fired when new SMS received
 * @param onError - Callback fired on error
 */
export function startSMSListener(
  onMessage: (phoneNumber: string, body: string) => void,
  onError: (error: any) => void
) {
  startReadSMS(
    (status, sms, error) => {
      if (status === "success") {
        const [phoneNumber, body] = sms;
        console.log('[SMS Service] Received SMS from:', phoneNumber);
        onMessage(phoneNumber, body);
      } else if (error) {
        console.error('[SMS Service] Error receiving SMS:', error);
        onError(error);
      }
    },
    onError
  );
}
