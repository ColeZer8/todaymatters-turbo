/**
 * VoiceCoachButton Component
 *
 * A floating action button that initiates voice conversations with the AI coach.
 * Shows connection status and provides visual feedback during conversations.
 *
 * NOTE: Requires development build - not available in Expo Go.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react-native';
import Constants from 'expo-constants';

import { useAuthStore } from '@/stores';
import type { VoiceCoachDynamicVariables } from '@/lib/elevenlabs';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Only load the voice hook in dev builds
// String concatenation tricks Metro's static analysis so it doesn't bundle in Expo Go
let useVoiceCoach: typeof import('@/hooks/use-voice-coach').useVoiceCoach | null = null;
if (!isExpoGo) {
  try {
    const hookPath = '../../hooks' + '/use-voice-coach';
    useVoiceCoach = require(hookPath).useVoiceCoach;
  } catch {
    console.log('[VoiceCoachButton] Voice hook not available');
  }
}

interface VoiceCoachButtonProps {
  /** Additional dynamic variables to pass to the conversation */
  dynamicVariables?: Partial<VoiceCoachDynamicVariables>;
  /** Current screen name for context */
  currentScreen?: string;
  /** Custom style classes */
  className?: string;
  /** Position on screen */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export function VoiceCoachButton({
  dynamicVariables = {},
  currentScreen,
  className = '',
  position = 'bottom-right',
}: VoiceCoachButtonProps) {
  const user = useAuthStore((state) => state.user);

  // Don't render in Expo Go - voice features require native modules
  if (!useVoiceCoach) {
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const {
    status,
    isSpeaking,
    isMicMuted,
    startConversation,
    endConversation,
    toggleMute,
    sendContextualUpdate,
  } = useVoiceCoach({
    onConnect: () => {
      console.log('[VoiceCoachButton] Connected to coach');
    },
    onDisconnect: () => {
      console.log('[VoiceCoachButton] Disconnected from coach');
    },
    onError: (error) => {
      console.error('[VoiceCoachButton] Error:', error.message);
    },
  });

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation when agent is speaking
  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSpeaking, pulseAnim]);

  // Loading animation when connecting
  useEffect(() => {
    if (status === 'connecting') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [status, rotateAnim]);

  // Send contextual update when screen changes
  useEffect(() => {
    if (status === 'connected' && currentScreen) {
      sendContextualUpdate(`User is now viewing the ${currentScreen} screen.`);
    }
  }, [currentScreen, status, sendContextualUpdate]);

  const handlePress = useCallback(async () => {
    if (status === 'connected') {
      await endConversation();
    } else if (status === 'disconnected') {
      await startConversation({
        dynamicVariables: {
          user_name: user?.email?.split('@')[0] || 'there',
          user_id: user?.id,
          current_screen: currentScreen,
          ...dynamicVariables,
        },
      });
    }
  }, [status, startConversation, endConversation, user, currentScreen, dynamicVariables]);

  const handleMutePress = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'right-4 bottom-24',
    'bottom-left': 'left-4 bottom-24',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-24',
  };

  // Status-based styling
  const getButtonStyle = () => {
    switch (status) {
      case 'connected':
        return isSpeaking
          ? 'bg-emerald-500 border-emerald-400'
          : 'bg-emerald-600 border-emerald-500';
      case 'connecting':
        return 'bg-amber-500 border-amber-400';
      case 'error':
        return 'bg-red-500 border-red-400';
      default:
        return 'bg-blue-600 border-blue-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return isSpeaking ? 'Coach is speaking...' : 'Listening...';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection error';
      default:
        return 'Talk to Coach';
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className={`absolute ${positionClasses[position]} ${className}`}>
      {/* Status label */}
      {status !== 'disconnected' && (
        <View className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <View className="bg-slate-900/90 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-medium">{getStatusText()}</Text>
          </View>
        </View>
      )}

      {/* Mute button (shown when connected) */}
      {status === 'connected' && (
        <TouchableOpacity
          onPress={handleMutePress}
          className={`absolute -left-14 bottom-0 w-10 h-10 rounded-full items-center justify-center ${
            isMicMuted ? 'bg-red-500' : 'bg-slate-700'
          }`}
          accessibilityLabel={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
          accessibilityRole="button"
        >
          {isMicMuted ? (
            <MicOff size={18} color="#fff" />
          ) : (
            <Mic size={18} color="#fff" />
          )}
        </TouchableOpacity>
      )}

      {/* Main button */}
      <Animated.View
        style={{
          transform: [
            { scale: pulseAnim },
            { rotate: status === 'connecting' ? rotateInterpolate : '0deg' },
          ],
        }}
      >
        <TouchableOpacity
          onPress={handlePress}
          disabled={status === 'connecting'}
          className={`w-16 h-16 rounded-full items-center justify-center border-2 shadow-lg ${getButtonStyle()}`}
          accessibilityLabel={status === 'connected' ? 'End conversation' : 'Start conversation with AI coach'}
          accessibilityRole="button"
          accessibilityState={{ disabled: status === 'connecting' }}
        >
          {status === 'connected' ? (
            isSpeaking ? (
              <Volume2 size={28} color="#fff" />
            ) : (
              <PhoneOff size={28} color="#fff" />
            )
          ) : (
            <Phone size={28} color="#fff" />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Speaking indicator ring */}
      {status === 'connected' && isSpeaking && (
        <Animated.View
          style={{
            position: 'absolute',
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 2,
            borderColor: '#10b981',
            opacity: 0.5,
            transform: [{ scale: pulseAnim }],
            top: -8,
            left: -8,
          }}
        />
      )}
    </View>
  );
}
