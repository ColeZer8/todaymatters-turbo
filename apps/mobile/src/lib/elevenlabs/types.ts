/**
 * ElevenLabs Voice Coach Types
 */

export interface VoiceCoachCallbacks {
  /** Called when successfully connected to the voice agent */
  onConnect?: () => void;
  /** Called when disconnected from the voice agent */
  onDisconnect?: () => void;
  /** Called when a message is received from the agent */
  onMessage?: (message: ConversationMessage) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Called when the agent starts/stops speaking */
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

export interface ConversationMessage {
  role: 'agent' | 'user';
  message: string;
  timestamp?: number;
}

export interface VoiceCoachDynamicVariables {
  /** User's display name */
  user_name?: string;
  /** User's unique ID for backend lookups */
  user_id?: string;
  /** Current time formatted for context */
  current_time?: string;
  /** Time of day (morning, afternoon, evening) */
  time_of_day?: string;
  /** Current routine progress status */
  routine_status?: string;
  /** Number of tasks completed today */
  tasks_completed?: number;
  /** Number of tasks remaining today */
  tasks_remaining?: number;
  /** User's primary goal/focus for today */
  todays_priority?: string;
  /** Current screen/context in the app */
  current_screen?: string;
  /** Any additional custom variables */
  [key: string]: string | number | boolean | undefined;
}

export interface ClientToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export type ClientToolHandler<TParams = Record<string, unknown>> = (
  params: TParams
) => string | ClientToolResult | Promise<string | ClientToolResult>;

export interface VoiceCoachClientTools {
  /** Navigate to a specific screen in the app */
  navigate_to_screen?: ClientToolHandler<{ screen: string }>;
  /** Mark a routine item as complete */
  mark_task_complete?: ClientToolHandler<{ task_id: string }>;
  /** Show details for a specific routine item */
  show_routine_item?: ClientToolHandler<{ item_id: string }>;
  /** Update the current UI state */
  update_ui_state?: ClientToolHandler<{ state: string; value: unknown }>;
  /** Play a celebration/completion sound */
  play_celebration?: ClientToolHandler<Record<string, never>>;
  /** Open a specific feature in the app */
  open_feature?: ClientToolHandler<{ feature: string }>;
  /** Any additional custom tools */
  [key: string]: ClientToolHandler | undefined;
}

export interface StartConversationOptions {
  /** Dynamic variables to personalize the conversation */
  dynamicVariables?: VoiceCoachDynamicVariables;
  /** Client-side tools the agent can invoke */
  clientTools?: VoiceCoachClientTools;
  /** Override the default agent ID (for testing) */
  agentIdOverride?: string;
}

export type ConversationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface VoiceCoachState {
  /** Current connection status */
  status: ConversationStatus;
  /** Whether the agent is currently speaking */
  isSpeaking: boolean;
  /** Whether feedback can be sent for the last response */
  canSendFeedback: boolean;
  /** Current conversation ID (if connected) */
  conversationId: string | null;
  /** Whether the microphone is muted */
  isMicMuted: boolean;
  /** Error message if status is 'error' */
  errorMessage: string | null;
}



