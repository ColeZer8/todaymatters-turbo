/**
 * VoiceCoachOverlay (Page-level feature)
 *
 * Lives outside `src/app/**` so Expo Router does NOT treat it as a route file.
 * Owns session start/stop + auth-derived variables; UI is in organisms.
 */

import Constants from 'expo-constants';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { VoiceCoachButton, VoiceCoachModal } from '@/components/organisms';
import type { VoiceCoachDynamicVariables } from '@/lib/elevenlabs';
import { useAuthStore } from '@/stores';

const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically load the voice hook only in dev builds (Expo Go cannot run WebRTC)
// String concatenation avoids Metro static analysis in Expo Go.
let useVoiceCoach: typeof import('@/hooks/use-voice-coach').useVoiceCoach | null = null;
if (!isExpoGo) {
  try {
    const hookPath = '../../hooks' + '/use-voice-coach';
    useVoiceCoach = require(hookPath).useVoiceCoach;
  } catch {
    useVoiceCoach = null;
  }
}

export interface VoiceCoachOverlayProps {
  enabled: boolean;
}

export function VoiceCoachOverlay({ enabled }: VoiceCoachOverlayProps) {
  const user = useAuthStore((s) => s.user);
  const [isOpen, setIsOpen] = useState(false);

  const baseDynamicVariables = useMemo<Partial<VoiceCoachDynamicVariables>>(() => {
    return {
      user_name: user?.email?.split('@')[0] || 'there',
      user_id: user?.id,
      current_screen: 'global',
    };
  }, [user?.email, user?.id]);

  if (!enabled || !useVoiceCoach) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const voice = useVoiceCoach({
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error('[VoiceCoachOverlay] Error:', error.message);
    },
  });

  const {
    status,
    isSpeaking,
    isMicMuted,
    canSendFeedback,
    messages,
    errorMessage,
    startConversation,
    endConversation,
    toggleMute,
    sendFeedback,
  } = voice;

  // Start conversation when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (status !== 'disconnected') return;

    startConversation({ dynamicVariables: baseDynamicVariables }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[VoiceCoachOverlay] Failed to start conversation:', error);
    });
  }, [baseDynamicVariables, isOpen, startConversation, status]);

  const handleMainPress = useCallback(() => {
    if (status === 'connecting') return;

    if (status === 'connected') {
      void endConversation().finally(() => setIsOpen(false));
      return;
    }

    if (status === 'disconnected' || status === 'error') {
      setIsOpen(true);
    }
  }, [endConversation, status]);

  const handleClose = useCallback(() => {
    if (status === 'connected' || status === 'connecting') {
      void endConversation().finally(() => setIsOpen(false));
      return;
    }
    setIsOpen(false);
  }, [endConversation, status]);

  return (
    <>
      <VoiceCoachButton
        status={status}
        isSpeaking={isSpeaking}
        isMicMuted={isMicMuted}
        onPressMain={handleMainPress}
        onPressMute={toggleMute}
        position="bottom-right"
      />

      <VoiceCoachModal
        visible={isOpen}
        status={status}
        isSpeaking={isSpeaking}
        isMicMuted={isMicMuted}
        canSendFeedback={canSendFeedback}
        messages={messages}
        errorMessage={errorMessage}
        onClose={handleClose}
        onToggleMute={toggleMute}
        onSendFeedback={sendFeedback}
      />
    </>
  );
}


