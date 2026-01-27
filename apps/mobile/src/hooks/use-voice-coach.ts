/**
 * useVoiceCoach Hook
 *
 * A comprehensive hook for managing voice conversations with the ElevenLabs AI coach.
 * Handles connection management, permissions, client tools, and contextual updates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as ElevenLabsReactNative from "@elevenlabs/react-native";
import { useRouter } from "expo-router";

import { ELEVENLABS_CONFIG } from "../lib/elevenlabs/config";
import {
  requestMicrophonePermission,
  checkMicrophonePermission,
  showPermissionDeniedAlert,
} from "../lib/elevenlabs/permissions";
import type {
  VoiceCoachCallbacks,
  VoiceCoachDynamicVariables,
  VoiceCoachClientTools,
  StartConversationOptions,
  ConversationStatus,
  VoiceCoachState,
  ConversationMessage,
} from "../lib/elevenlabs/types";

// Use `require` so we always resolve the same module instance as the dynamically-loaded
// `ElevenLabsProvider` in `src/app/_layout.tsx` (prevents context mismatch in monorepos).
const { useConversation } =
  require("@elevenlabs/react-native") as typeof ElevenLabsReactNative;

interface UseVoiceCoachOptions extends VoiceCoachCallbacks {
  /** Custom server URL (optional) */
  serverUrl?: string;
  /** Client tools that the agent can invoke */
  clientTools?: Record<
    string,
    (
      parameters: unknown,
    ) => Promise<string | number | undefined> | string | number | undefined
  >;
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
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Get formatted current time
 */
function getCurrentTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function fetchPublicConversationTokenDiagnostics(
  agentId: string,
): Promise<{
  ok: boolean;
  status: number;
  bodyText: string;
}> {
  // Mirror the SDK’s unauthenticated token exchange for public agents.
  // This is purely for diagnostics when the agentId flow fails.
  // NOTE: Some ElevenLabs deployments validate `source` against a fixed allowlist.
  // Use a known-good value so our diagnostics don’t create false negatives.
  const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}&source=react_native_sdk`;

  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  const bodyText = await response.text();
  return { ok: response.ok, status: response.status, bodyText };
}

async function fetchPublicConversationToken(agentId: string): Promise<{
  token: string | null;
  ok: boolean;
  status: number;
  bodyText: string;
}> {
  const diag = await fetchPublicConversationTokenDiagnostics(agentId);
  if (!diag.ok) return { token: null, ...diag };

  try {
    const parsed = JSON.parse(diag.bodyText) as { token?: unknown };
    const token =
      typeof parsed.token === "string" && parsed.token.length > 0
        ? parsed.token
        : null;
    return { token, ...diag };
  } catch {
    return { token: null, ...diag };
  }
}

export function useVoiceCoach(
  options: UseVoiceCoachOptions = {},
): UseVoiceCoachReturn {
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

  // Local state - only for things SDK doesn't track
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Prevent overlapping start/end calls (can cause LiveKit "PC manager is closed" races)
  const startInFlightRef = useRef(false);
  const endInFlightRef = useRef(false);

  // Refs for callbacks (stable references to avoid re-renders)
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
    const defaultTools: Record<
      string,
      (params: unknown) => string | Promise<string>
    > = {
      // NOTE: Navigation-related tools are intentionally disabled for now.
      // We want the agent to be "invisible" and not move the user around the app.
      // We'll re-enable this later once we add explicit UI for agent actions.
      navigate_to_screen: () => "Navigation is currently disabled.",
      open_feature: () => "Navigation is currently disabled.",

      // Placeholder for task completion
      mark_task_complete: async (params) => {
        const { task_id } = params as { task_id: string };
        console.log("[VoiceCoach] Mark task complete:", task_id);
        return `Task ${task_id} marked as complete`;
      },

      // Placeholder for showing routine item details
      show_routine_item: (params) => {
        const { item_id } = params as { item_id: string };
        console.log("[VoiceCoach] Show routine item:", item_id);
        return `Requested routine item ${item_id} (UI navigation currently disabled).`;
      },

      // Play celebration
      play_celebration: () => {
        console.log("[VoiceCoach] Playing celebration");
        return "Celebration played";
      },
    };

    return { ...defaultTools, ...customClientTools };
  }, [router, customClientTools]);

  // Initialize the ElevenLabs conversation hook
  // The SDK tracks status internally - we use conversation.status directly
  const conversation = useConversation({
    serverUrl,
    clientTools: builtClientTools,
    onStatusChange: (event: { status: string }) => {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[VoiceCoach] Status:", event.status);
      }
    },
    onConnect: () => {
      if (__DEV__) console.log("[VoiceCoach] Connected");
      setErrorMessage(null);
      startInFlightRef.current = false;
      onConnectRef.current?.();
    },
    onDisconnect: () => {
      if (__DEV__) console.log("[VoiceCoach] Disconnected");
      setConversationId(null);
      startInFlightRef.current = false;
      endInFlightRef.current = false;
      onDisconnectRef.current?.();
    },
    onMessage: (message) => {
      const msgText =
        typeof message === "string"
          ? message
          : ((message as { message?: string })?.message ?? "");
      const msgSource = (message as { source?: string })?.source;
      const conversationMessage: ConversationMessage = {
        role: msgSource === "ai" ? "agent" : "user",
        message: msgText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, conversationMessage]);
      onMessageRef.current?.(conversationMessage);
    },
    onError: (error: unknown) => {
      if (__DEV__) console.error("[VoiceCoach] Error:", error);
      const errorMsg =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : String(error ?? "Unknown error");
      setErrorMessage(errorMsg || "An error occurred");
      startInFlightRef.current = false;
      endInFlightRef.current = false;
      const errorObj =
        error instanceof Error
          ? error
          : new Error(String(error ?? "Unknown error"));
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
   * Start a conversation with the AI coach
   */
  const startConversation = useCallback(
    async (startOptions: StartConversationOptions = {}) => {
      const { dynamicVariables, agentIdOverride } = startOptions;

      // Use SDK's status directly to avoid race conditions
      const currentStatus = conversation.status;
      if (startInFlightRef.current) return;
      // Only start from fully disconnected/error states
      // NOTE: SDK status does not include 'error'. We represent errors via `errorMessage`.
      if (currentStatus !== "disconnected") return;
      startInFlightRef.current = true;

      try {
        setErrorMessage(null);
        setMessages([]);

        // Check/request microphone permission
        const hasPermission = await checkMicrophonePermission();
        if (!hasPermission) {
          const result = await requestMicrophonePermission();
          if (!result.granted) {
            if (!result.canAskAgain) {
              await showPermissionDeniedAlert();
            }
            throw new Error("Microphone permission denied");
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

        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[VoiceCoach] Starting session...", {
            status: conversation.status,
            agentId: !!agentId,
            isPrivateAgent: ELEVENLABS_CONFIG.isPrivateAgent,
          });
        }

        // Option A (NO SUPABASE): Public agent flow.
        // The RN SDK can exchange agentId -> conversationToken internally.
        // However, if that internal exchange becomes flaky, we can fetch the public token
        // ourselves (still unauthenticated for public agents) and pass it explicitly.
        if (!agentId) {
          throw new Error("Agent ID not configured");
        }

        // Try to fetch the public conversation token first and pass it explicitly.
        // This avoids relying on the SDK’s internal token exchange (which can fail silently).
        const tokenResult = await fetchPublicConversationToken(agentId);
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[VoiceCoach] Public token fetch", {
            ok: tokenResult.ok,
            status: tokenResult.status,
            hasToken: !!tokenResult.token,
            body: tokenResult.ok ? "(ok)" : tokenResult.bodyText,
          });
        }

        if (tokenResult.token) {
          await conversation.startSession({
            conversationToken: tokenResult.token,
            dynamicVariables: variables,
          });
        } else {
          await conversation.startSession({
            agentId,
            dynamicVariables: variables,
          });
        }

        // Store conversation ID (SDK-specific)
        const id = conversation.getId();
        if (id) {
          setConversationId(id);
        }

        // Ensure microphone is unmuted when starting conversation
        setIsMicMuted(false);
        conversation.setMicMuted(false);
      } catch (error) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error("[VoiceCoach] Failed to start conversation:", error);
        }
        const msg =
          error instanceof Error
            ? error.message
            : "Failed to start conversation";
        const help = !ELEVENLABS_CONFIG.isPrivateAgent
          ? " (Option A requires a PUBLIC ElevenLabs agent. If the agent is private, token exchange will fail and the session will disconnect.)"
          : "";
        setErrorMessage(`${msg}${help}`);
        throw error;
      } finally {
        startInFlightRef.current = false;
      }
    },
    [conversation],
  );

  /**
   * End the current conversation
   */
  const endConversation = useCallback(async () => {
    // Use SDK's status directly
    const currentStatus = conversation.status;
    // Allow ending even if already in-flight (force stop)
    // Only skip if we're truly disconnected
    if (currentStatus === "disconnected" && !startInFlightRef.current) return;

    try {
      endInFlightRef.current = true;
      await conversation.endSession("user");
    } catch (error) {
      // LiveKit can throw if end is called during teardown; treat as non-fatal.
      const message =
        error instanceof Error ? error.message : String(error ?? "");
      const isBenignShutdown =
        message.includes("PC manager is closed") ||
        message.includes("UnexpectedConnectionState") ||
        message.includes("already disconnected");

      if (!isBenignShutdown && __DEV__) {
        console.warn("[VoiceCoach] endSession error (non-fatal):", message);
      }
    } finally {
      // Reset in-flight flags
      setConversationId(null);
      startInFlightRef.current = false;
      endInFlightRef.current = false;
    }
  }, [conversation]);

  /**
   * Send a text message to the agent
   */
  const sendMessage = useCallback(
    async (message: string) => {
      if (conversation.status !== "connected") {
        console.warn("[VoiceCoach] Cannot send message - not connected");
        return;
      }
      await conversation.sendUserMessage(message);
    },
    [conversation],
  );

  /**
   * Send a contextual update (non-interrupting)
   */
  const sendContextualUpdate = useCallback(
    (update: string) => {
      if (conversation.status !== "connected") {
        console.warn(
          "[VoiceCoach] Cannot send contextual update - not connected",
        );
        return;
      }
      conversation.sendContextualUpdate(update);
    },
    [conversation],
  );

  /**
   * Send feedback for the last agent response
   */
  const sendFeedback = useCallback(
    (liked: boolean) => {
      if (!conversation.canSendFeedback) {
        console.warn("[VoiceCoach] Cannot send feedback at this time");
        return;
      }
      conversation.sendFeedback(liked);
    },
    [conversation],
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
    [conversation],
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

  // Memoize return object to prevent cascading re-renders in consumers
  return useMemo(
    () => ({
      // State - use SDK's status directly for consistency
      status: errorMessage ? "error" : conversation.status,
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
    }),
    [
      conversation.status,
      conversation.isSpeaking,
      conversation.canSendFeedback,
      conversationId,
      isMicMuted,
      errorMessage,
      messages,
      startConversation,
      endConversation,
      sendMessage,
      sendContextualUpdate,
      sendFeedback,
      toggleMute,
      setMuted,
      checkPermission,
      requestPermission,
    ],
  );
}
