/**
 * useVoiceCoach Hook
 *
 * A comprehensive hook for managing voice conversations with the ElevenLabs AI coach.
 * Handles connection management, permissions, client tools, and contextual updates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react-native';
import { useRouter } from 'expo-router';

import { ELEVENLABS_CONFIG } from '../lib/elevenlabs/config';
import {
  requestMicrophonePermission,
  checkMicrophonePermission,
  showPermissionDeniedAlert,
} from '../lib/elevenlabs/permissions';
import type {
  VoiceCoachCallbacks,
  VoiceCoachDynamicVariables,
  VoiceCoachClientTools,
  StartConversationOptions,
  ConversationStatus,
  VoiceCoachState,
  ConversationMessage,
} from '../lib/elevenlabs/types';
import { supabase } from '../lib/supabase';

interface UseVoiceCoachOptions extends VoiceCoachCallbacks {
  /** Custom server URL (optional) */
  serverUrl?: string;
  /** Client tools that the agent can invoke */
  clientTools?: Record<string, (parameters: unknown) => Promise<string | number | undefined> | string | number | undefined>;
}

interface UseVoiceCoachReturn extends VoiceCoachState {
  /** Start a conversation with the AI coach */
  startConversation: (options?: StartConversationOptions) => Promise<void>;
  /** End the current conversation */
  endConversation: () => Promise<void>;
  /** Send a text message to the agent */
  sendMessage: (message: string) => Promise<void>;
  /** Send a contextual update (non-interrupting) */
  sendContextualUpdate: (update: string) => void;
  /** Send feedback for the last agent response */
  sendFeedback: (liked: boolean) => void;
  /** Toggle microphone mute */
  toggleMute: () => void;
  /** Set microphone mute state */
  setMuted: (muted: boolean) => void;
  /** Check if microphone permission is granted */
  checkPermission: () => Promise<boolean>;
  /** Request microphone permission */
  requestPermission: () => Promise<boolean>;
  /** Conversation history for the current session */
  messages: ConversationMessage[];
}

/**
 * Get the current time of day for context
 */
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Get formatted current time
 */
function getCurrentTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function useVoiceCoach(options: UseVoiceCoachOptions = {}): UseVoiceCoachReturn {
  const {
    onConnect,
    onDisconnect,
    onMessage,
    onError,
    onSpeakingChange,
    serverUrl,
    clientTools: customClientTools,
  } = options;

  const router = useRouter();

  // Local state
  const [status, setStatus] = useState<ConversationStatus>('disconnected');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Refs for callbacks
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onSpeakingChangeRef = useRef(onSpeakingChange);

  // Update refs when callbacks change
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onSpeakingChangeRef.current = onSpeakingChange;
  }, [onConnect, onDisconnect, onMessage, onError, onSpeakingChange]);

  // Build client tools including defaults
  const builtClientTools = useMemo(() => {
    const defaultTools: Record<string, (params: unknown) => string | Promise<string>> = {
      // Navigate to a specific screen
      navigate_to_screen: (params) => {
        const { screen } = params as { screen: string };
        try {
          router.push(screen as never);
          return `Navigated to ${screen}`;
        } catch {
          return `Failed to navigate to ${screen}`;
        }
      },

      // Open a specific feature/section
      open_feature: (params) => {
        const { feature } = params as { feature: string };
        const featureRoutes: Record<string, string> = {
          routine: '/build-routine',
          calendar: '/calendar',
          analytics: '/analytics',
          profile: '/profile',
          goals: '/goals',
          home: '/home',
        };
        const route = featureRoutes[feature.toLowerCase()];
        if (route) {
          router.push(route as never);
          return `Opened ${feature}`;
        }
        return `Unknown feature: ${feature}`;
      },

      // Placeholder for task completion
      mark_task_complete: async (params) => {
        const { task_id } = params as { task_id: string };
        console.log('[VoiceCoach] Mark task complete:', task_id);
        return `Task ${task_id} marked as complete`;
      },

      // Placeholder for showing routine item details
      show_routine_item: (params) => {
        const { item_id } = params as { item_id: string };
        console.log('[VoiceCoach] Show routine item:', item_id);
        router.push(`/routine-item/${item_id}` as never);
        return `Showing details for item ${item_id}`;
      },

      // Play celebration
      play_celebration: () => {
        console.log('[VoiceCoach] Playing celebration');
        return 'Celebration played';
      },
    };

    return { ...defaultTools, ...customClientTools };
  }, [router, customClientTools]);

  // Initialize the ElevenLabs conversation hook
  const conversation = useConversation({
    serverUrl,
    clientTools: builtClientTools,
    onConnect: () => {
      console.log('[VoiceCoach] Connected to conversation');
      setStatus('connected');
      setErrorMessage(null);
      onConnectRef.current?.();
    },
    onDisconnect: () => {
      console.log('[VoiceCoach] Disconnected from conversation');
      setStatus('disconnected');
      setConversationId(null);
      onDisconnectRef.current?.();
    },
    onMessage: (message) => {
      console.log('[VoiceCoach] Message received:', message);
      // The message type from ElevenLabs can vary, handle it safely
      const msgText = typeof message === 'string' ? message : (message as { message?: string })?.message ?? '';
      const msgSource = (message as { source?: string })?.source;
      const conversationMessage: ConversationMessage = {
        role: msgSource === 'ai' ? 'agent' : 'user',
        message: msgText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, conversationMessage]);
      onMessageRef.current?.(conversationMessage);
    },
    onError: (error: unknown) => {
      console.error('[VoiceCoach] Error:', error);
      setStatus('error');
      const errorMsg = typeof error === 'object' && error !== null && 'message' in error 
        ? (error as { message: string }).message 
        : String(error ?? 'Unknown error');
      setErrorMessage(errorMsg || 'An error occurred');
      const errorObj = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
      onErrorRef.current?.(errorObj);
    },
  });

  // Track speaking state changes
  const prevIsSpeakingRef = useRef(conversation.isSpeaking);
  useEffect(() => {
    if (prevIsSpeakingRef.current !== conversation.isSpeaking) {
      prevIsSpeakingRef.current = conversation.isSpeaking;
      onSpeakingChangeRef.current?.(conversation.isSpeaking);
    }
  }, [conversation.isSpeaking]);

  /**
   * Fetch a conversation token from the backend (for private agents)
   */
  const fetchConversationToken = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('conversation-token');

    if (error) {
      throw new Error(`Failed to get conversation token: ${error.message}`);
    }

    if (!data?.token) {
      throw new Error('No token returned from server');
    }

    return data.token;
  }, []);

  /**
   * Start a conversation with the AI coach
   */
  const startConversation = useCallback(
    async (startOptions: StartConversationOptions = {}) => {
      const { dynamicVariables, agentIdOverride } = startOptions;

      try {
        setStatus('connecting');
        setErrorMessage(null);
        setMessages([]);

        // Check/request microphone permission
        const hasPermission = await checkMicrophonePermission();
        if (!hasPermission) {
          const result = await requestMicrophonePermission();
          if (!result.granted) {
            if (!result.canAskAgain) {
              showPermissionDeniedAlert();
            }
            throw new Error('Microphone permission denied');
          }
        }

        // Prepare dynamic variables with defaults
        const variables: VoiceCoachDynamicVariables = {
          current_time: getCurrentTime(),
          time_of_day: getTimeOfDay(),
          ...dynamicVariables,
        };

        // Determine if we need to use a token (private agent) or agentId (public)
        const agentId = agentIdOverride || ELEVENLABS_CONFIG.agentId;

        if (ELEVENLABS_CONFIG.isPrivateAgent) {
          // Private agent - fetch token from backend
          const token = await fetchConversationToken();
          await conversation.startSession({
            conversationToken: token,
            dynamicVariables: variables,
          });
        } else {
          // Public agent - use agentId directly
          if (!agentId) {
            throw new Error('Agent ID not configured');
          }
          await conversation.startSession({
            agentId,
            dynamicVariables: variables,
          });
        }

        // Store conversation ID
        const id = conversation.getId();
        if (id) {
          setConversationId(id);
        }
      } catch (error) {
        console.error('[VoiceCoach] Failed to start conversation:', error);
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to start conversation'
        );
        throw error;
      }
    },
    [conversation, fetchConversationToken]
  );

  /**
   * End the current conversation
   */
  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      setStatus('disconnected');
      setConversationId(null);
    } catch (error) {
      console.error('[VoiceCoach] Failed to end conversation:', error);
    }
  }, [conversation]);

  /**
   * Send a text message to the agent
   */
  const sendMessage = useCallback(
    async (message: string) => {
      if (status !== 'connected') {
        console.warn('[VoiceCoach] Cannot send message - not connected');
        return;
      }
      await conversation.sendUserMessage(message);
    },
    [conversation, status]
  );

  /**
   * Send a contextual update (non-interrupting)
   */
  const sendContextualUpdate = useCallback(
    (update: string) => {
      if (status !== 'connected') {
        console.warn('[VoiceCoach] Cannot send contextual update - not connected');
        return;
      }
      conversation.sendContextualUpdate(update);
    },
    [conversation, status]
  );

  /**
   * Send feedback for the last agent response
   */
  const sendFeedback = useCallback(
    (liked: boolean) => {
      if (!conversation.canSendFeedback) {
        console.warn('[VoiceCoach] Cannot send feedback at this time');
        return;
      }
      conversation.sendFeedback(liked);
    },
    [conversation]
  );

  /**
   * Toggle microphone mute
   */
  const toggleMute = useCallback(() => {
    const newMuted = !isMicMuted;
    setIsMicMuted(newMuted);
    conversation.setMicMuted(newMuted);
  }, [conversation, isMicMuted]);

  /**
   * Set microphone mute state
   */
  const setMuted = useCallback(
    (muted: boolean) => {
      setIsMicMuted(muted);
      conversation.setMicMuted(muted);
    },
    [conversation]
  );

  /**
   * Check microphone permission
   */
  const checkPermission = useCallback(async () => {
    return checkMicrophonePermission();
  }, []);

  /**
   * Request microphone permission
   */
  const requestPermission = useCallback(async () => {
    const result = await requestMicrophonePermission();
    return result.granted;
  }, []);

  return {
    // State
    status,
    isSpeaking: conversation.isSpeaking,
    canSendFeedback: conversation.canSendFeedback,
    conversationId,
    isMicMuted,
    errorMessage,
    messages,

    // Actions
    startConversation,
    endConversation,
    sendMessage,
    sendContextualUpdate,
    sendFeedback,
    toggleMute,
    setMuted,
    checkPermission,
    requestPermission,
  };
}

