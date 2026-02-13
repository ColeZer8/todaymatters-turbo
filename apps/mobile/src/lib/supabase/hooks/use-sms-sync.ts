/**
 * React hook to sync incoming SMS messages to Supabase tm.events table
 * Android only - uses @maniac-tech/react-native-expo-read-sms
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '@/stores';
import { startSMSListener, checkSMSPermissions } from '@/lib/android/sms-service';
import { supabase } from '../client';

/**
 * Automatically starts SMS listening when:
 * - User is authenticated
 * - Platform is Android
 * - SMS permissions are granted
 */
export function useSMSSync() {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    // Only run on Android
    if (Platform.OS !== 'android') {
      console.log('[SMS Sync] Skipping - not Android platform');
      return;
    }

    // Only run if user is authenticated
    if (!userId) {
      console.log('[SMS Sync] Skipping - user not authenticated');
      return;
    }

    console.log('[SMS Sync] Initializing SMS sync for user:', userId);

    // Check permissions and start listener
    (async () => {
      const hasPermissions = await checkSMSPermissions();
      
      if (!hasPermissions) {
        console.log('[SMS Sync] SMS permissions not granted - listener not started');
        console.log('[SMS Sync] User must grant permissions from settings screen');
        return;
      }

      console.log('[SMS Sync] SMS permissions granted - starting listener');

      // Start listening for incoming SMS
      startSMSListener(
        async (phoneNumber, body) => {
          console.log('[SMS Sync] New SMS received from:', phoneNumber);
          
          await insertSMSEvent({
            userId,
            phoneNumber,
            body,
            timestamp: new Date().toISOString(),
          });
        },
        (error) => {
          console.error('[SMS Sync] SMS listener error:', error);
        }
      );

      console.log('[SMS Sync] SMS listener started successfully');
    })();
  }, [userId]);
}

/**
 * Insert SMS event into tm.events table
 */
async function insertSMSEvent(data: {
  userId: string;
  phoneNumber: string;
  body: string;
  timestamp: string;
}) {
  console.log('[SMS Sync] Inserting SMS event:', {
    phone: data.phoneNumber,
    bodyLength: data.body.length,
    timestamp: data.timestamp,
  });

  const { error } = await supabase
    .schema('tm')
    .from('events')
    .insert({
      user_id: data.userId,
      type: 'sms',
      title: `SMS from ${data.phoneNumber}`,
      received_at: data.timestamp,
      meta: {
        direction: 'inbound',
        phone_number: data.phoneNumber,
        message_body: data.body,
        raw: {
          date: Date.now(),
        },
      },
    });

  if (error) {
    console.error('[SMS Sync] Failed to insert SMS event:', error);
  } else {
    console.log('[SMS Sync] ✅ SMS event inserted successfully:', data.phoneNumber);
  }
}
