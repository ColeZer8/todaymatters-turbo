/**
 * VoiceCoachModal Component
 *
 * A full-screen modal for voice conversations with the AI coach.
 * Shows conversation transcript, visual feedback, and controls.
 *
 * NOTE: Requires development build - not available in Expo Go.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import {
  Mic,
  MicOff,
  X,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  MessageCircle,
} from 'lucide-react-native';
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
    console.log('[VoiceCoachModal] Voice hook not available');
  }
}

interface VoiceCoachModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Additional dynamic variables to pass to the conversation */
  dynamicVariables?: Partial<VoiceCoachDynamicVariables>;
  /** Custom greeting from the coach */
  coachGreeting?: string;
}

export function VoiceCoachModal({
  visible,
  onClose,
  dynamicVariables = {},
  coachGreeting = "Hi! I'm your TodayMatters coach. How can I help you today?",
}: VoiceCoachModalProps) {
  const user = useAuthStore((state) => state.user);
  const scrollViewRef = useRef<ScrollView>(null);

  // Don't render in Expo Go - voice features require native modules
  if (!useVoiceCoach) {
    // Return empty modal that just closes
    return (
      <Modal visible={visible} onRequestClose={onClose}>
        <View className="flex-1 bg-slate-900 items-center justify-center p-6">
          <Text className="text-white text-xl font-semibold mb-4">
            Voice Features Unavailable
          </Text>
          <Text className="text-slate-400 text-center mb-6">
            Voice features require a development build.{'\n'}
            Run: npx expo run:ios
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="bg-blue-600 px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
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
  } = useVoiceCoach({
    onConnect: () => {
      console.log('[VoiceCoachModal] Connected');
    },
    onDisconnect: () => {
      console.log('[VoiceCoachModal] Disconnected');
    },
    onMessage: () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onError: (error) => {
      console.error('[VoiceCoachModal] Error:', error.message);
    },
  });

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [isSpeaking, pulseAnim, waveAnim]);

  // Start conversation when modal opens
  useEffect(() => {
    if (visible && status === 'disconnected') {
      startConversation({
        dynamicVariables: {
          user_name: user?.email?.split('@')[0] || 'there',
          user_id: user?.id,
          ...dynamicVariables,
        },
      });
    }
  }, [visible, status, startConversation, user, dynamicVariables]);

  const handleClose = useCallback(async () => {
    if (status === 'connected') {
      await endConversation();
    }
    onClose();
  }, [status, endConversation, onClose]);

  const handleFeedback = useCallback(
    (liked: boolean) => {
      sendFeedback(liked);
    },
    [sendFeedback]
  );

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#10b981';
      case 'connecting':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return isSpeaking ? 'Coach is speaking' : 'Listening to you';
      case 'connecting':
        return 'Connecting to your coach...';
      case 'error':
        return errorMessage || 'Connection error';
      default:
        return 'Not connected';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-slate-900">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-16 pb-4 border-b border-slate-800">
          <View className="flex-row items-center gap-3">
            <View
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor() }}
            />
            <Text className="text-white font-semibold text-lg">Voice Coach</Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-slate-800"
            accessibilityLabel="Close voice coach"
          >
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Status indicator */}
        <View className="items-center py-4 px-4">
          <Text className="text-slate-400 text-sm">{getStatusText()}</Text>
        </View>

        {/* Visual feedback area */}
        <View className="items-center justify-center py-8">
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
            }}
          >
            <View
              className={`w-32 h-32 rounded-full items-center justify-center ${
                status === 'connected'
                  ? isSpeaking
                    ? 'bg-emerald-500/20 border-2 border-emerald-500'
                    : 'bg-blue-500/20 border-2 border-blue-500'
                  : 'bg-slate-800 border-2 border-slate-700'
              }`}
            >
              {isSpeaking ? (
                <Volume2 size={48} color="#10b981" />
              ) : status === 'connected' ? (
                <Mic size={48} color="#3b82f6" />
              ) : (
                <MessageCircle size={48} color="#6b7280" />
              )}
            </View>
          </Animated.View>

          {/* Sound wave visualization */}
          {status === 'connected' && (
            <View className="flex-row items-center gap-1 mt-4 h-8">
              {[...Array(5)].map((_, i) => (
                <Animated.View
                  key={i}
                  className="w-1 bg-emerald-500 rounded-full"
                  style={{
                    height: isSpeaking ? 8 + Math.random() * 24 : 4,
                    opacity: isSpeaking ? 0.8 : 0.3,
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Transcript area */}
        <View className="flex-1 px-4">
          <Text className="text-slate-500 text-xs uppercase tracking-wide mb-2">
            Conversation
          </Text>
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 bg-slate-800/50 rounded-xl p-4"
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <Text className="text-slate-500 text-center italic">
                {status === 'connecting'
                  ? 'Connecting...'
                  : 'Start a conversation with your coach'}
              </Text>
            ) : (
              messages.map((msg, index) => (
                <View
                  key={index}
                  className={`mb-3 ${
                    msg.role === 'agent' ? 'items-start' : 'items-end'
                  }`}
                >
                  <View
                    className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                      msg.role === 'agent'
                        ? 'bg-slate-700 rounded-tl-none'
                        : 'bg-blue-600 rounded-tr-none'
                    }`}
                  >
                    <Text className="text-white text-sm leading-5">
                      {msg.message}
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-xs mt-1 px-1">
                    {msg.role === 'agent' ? 'Coach' : 'You'}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* Controls */}
        <View className="px-4 py-6 border-t border-slate-800">
          {/* Feedback buttons */}
          {canSendFeedback && (
            <View className="flex-row justify-center gap-4 mb-4">
              <TouchableOpacity
                onPress={() => handleFeedback(true)}
                className="flex-row items-center gap-2 px-4 py-2 bg-slate-800 rounded-full"
              >
                <ThumbsUp size={18} color="#10b981" />
                <Text className="text-slate-300 text-sm">Helpful</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleFeedback(false)}
                className="flex-row items-center gap-2 px-4 py-2 bg-slate-800 rounded-full"
              >
                <ThumbsDown size={18} color="#ef4444" />
                <Text className="text-slate-300 text-sm">Not helpful</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Main controls */}
          <View className="flex-row justify-center items-center gap-6">
            {/* Mute button */}
            <TouchableOpacity
              onPress={toggleMute}
              disabled={status !== 'connected'}
              className={`w-14 h-14 rounded-full items-center justify-center ${
                isMicMuted
                  ? 'bg-red-500'
                  : status === 'connected'
                    ? 'bg-slate-700'
                    : 'bg-slate-800'
              }`}
              accessibilityLabel={isMicMuted ? 'Unmute' : 'Mute'}
            >
              {isMicMuted ? (
                <MicOff size={24} color="#fff" />
              ) : (
                <Mic size={24} color={status === 'connected' ? '#fff' : '#6b7280'} />
              )}
            </TouchableOpacity>

            {/* End/Close button */}
            <TouchableOpacity
              onPress={handleClose}
              className="w-16 h-16 rounded-full items-center justify-center bg-red-500"
              accessibilityLabel="Close"
            >
              <X size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Status text */}
          {status === 'connected' && (
            <Text className="text-slate-500 text-xs text-center mt-3">
              {isMicMuted ? 'Microphone muted' : 'Tap mic to mute'}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
