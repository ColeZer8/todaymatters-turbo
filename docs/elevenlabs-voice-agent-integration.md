# ElevenLabs Voice Agent Integration Research

## Overview

This document details the research findings for integrating ElevenLabs Conversational AI voice agent into the TodayMatters mobile app. ElevenLabs provides a comprehensive SDK for building real-time voice conversations with AI agents.

## Key Packages & Dependencies

### Required NPM Packages

```bash
npx expo install @elevenlabs/react-native @livekit/react-native @livekit/react-native-webrtc @config-plugins/react-native-webrtc @livekit/react-native-expo-plugin livekit-client
```

**Package breakdown:**
- `@elevenlabs/react-native` - Official React Native SDK with `useConversation` hook
- `@livekit/react-native` - Real-time audio/video SDK (powers voice streaming)
- `@livekit/react-native-webrtc` - WebRTC implementation for React Native
- `@config-plugins/react-native-webrtc` - Expo config plugin for WebRTC native modules
- `@livekit/react-native-expo-plugin` - Expo plugin for LiveKit integration
- `livekit-client` - LiveKit client library

### Important Note on Expo

> ⚠️ **WebRTC requires a development build** - The ElevenLabs SDK with real-time voice features **cannot** run in Expo Go. You must use `expo prebuild` and run on a physical device or emulator with native code.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ElevenLabsProvider                                          │ │
│  │    └── useConversation() hook                                │ │
│  │         ├── startSession({ agentId | conversationToken })   │ │
│  │         ├── endSession()                                     │ │
│  │         ├── sendUserMessage()                                │ │
│  │         ├── sendContextualUpdate()                           │ │
│  │         └── clientTools: { ... }                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                    WebRTC (real-time audio)                       │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ELEVENLABS AGENTS PLATFORM                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Voice Agent                                                  │ │
│  │    ├── LLM (configurable: GPT-4, Claude, etc.)               │ │
│  │    ├── TTS (ElevenLabs voices)                               │ │
│  │    ├── STT (Speech-to-text)                                  │ │
│  │    └── Tools                                                  │ │
│  │         ├── Server Tools (webhooks to your backend)          │ │
│  │         ├── Client Tools (calls back to mobile app)          │ │
│  │         └── System Tools (end_call, transfer, etc.)          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼ (webhooks)
┌──────────────────────────────────────────────────────────────────┐
│                    YOUR BACKEND (Supabase)                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Edge Functions                                               │ │
│  │    ├── /conversation-token (generate session tokens)         │ │
│  │    ├── /webhook/agent-tools (handle agent tool calls)        │ │
│  │    └── /webhook/post-call (receive call transcripts)         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## App Configuration Changes

### `app.json` Modifications Required

Add to your existing `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "This app uses the microphone to have voice conversations with your AI coach.",
        "ITSAppUsesNonExemptEncryption": false
      },
      "bundleIdentifier": "com.todaymatters.mobile"
    },
    "android": {
      "permissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.INTERNET",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.WAKE_LOCK",
        "android.permission.BLUETOOTH"
      ],
      "package": "com.todaymatters.mobile"
    },
    "plugins": [
      "@livekit/react-native-expo-plugin",
      "@config-plugins/react-native-webrtc"
    ]
  }
}
```

## Tool Types Explained

ElevenLabs supports three types of tools that the agent can invoke:

### 1. Server Tools (Webhooks)

Server tools make HTTP requests to your backend. The agent triggers them, and ElevenLabs servers call your webhook endpoint.

**Use cases:**
- Fetch user data from your database
- Create/update records (e.g., log a completed routine)
- Query external APIs (weather, calendar, etc.)

**Configuration (in ElevenLabs dashboard):**
```json
{
  "type": "webhook",
  "name": "get_user_routine",
  "description": "Fetches the user's daily routine from the database",
  "api_schema": {
    "url": "https://your-project.supabase.co/functions/v1/agent-tools",
    "method": "POST",
    "request_headers": {
      "Authorization": "Bearer {{SUPABASE_ANON_KEY}}"
    },
    "request_body_schema": {
      "type": "object",
      "properties": {
        "user_id": { "type": "string" },
        "action": { "type": "string" }
      },
      "required": ["user_id", "action"]
    }
  }
}
```

### 2. Client Tools

Client tools call functions directly in your mobile app. The agent triggers them, and the SDK invokes your registered callback.

**Use cases:**
- Navigate to a specific screen
- Update local UI state
- Show notifications or modals
- Play sounds or haptic feedback

**Example implementation:**
```typescript
const conversation = useConversation({
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
});

await conversation.startSession({
  agentId: 'your-agent-id',
  clientTools: {
    navigate_to_screen: ({ screen }: { screen: string }) => {
      router.push(screen);
      return `Navigated to ${screen}`;
    },
    show_routine_item: ({ item_id }: { item_id: string }) => {
      setSelectedItemId(item_id);
      return `Showing item ${item_id}`;
    },
    mark_task_complete: async ({ task_id }: { task_id: string }) => {
      await markTaskComplete(task_id);
      return `Task ${task_id} marked complete`;
    },
  },
});
```

### 3. System Tools

Built-in tools provided by ElevenLabs:

- `end_call` - End the conversation
- `transfer_call` - Transfer to a human (telephony only)
- `voicemail_detection` - Detect if reached voicemail (telephony only)

## Connection Methods

### Option A: Public Agent (Simple - for development)

```typescript
// Direct connection with just agentId (agent must be set to "public")
await conversation.startSession({
  agentId: 'your-agent-id',
});
```

### Option B: Private Agent with Conversation Token (Recommended for production)

Requires a backend endpoint to generate tokens:

**Backend (Supabase Edge Function):**
```typescript
// supabase/functions/conversation-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Verify user is authenticated
  const authHeader = req.headers.get('Authorization');
  // ... validate JWT with Supabase Auth ...

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${Deno.env.get('ELEVENLABS_AGENT_ID')}`,
    {
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!,
      },
    }
  );

  const { token } = await response.json();
  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Mobile app:**
```typescript
const startConversation = async () => {
  // Get token from your backend
  const response = await supabase.functions.invoke('conversation-token');
  const { token } = response.data;

  await conversation.startSession({
    conversationToken: token,
  });
};
```

## Webhooks for Post-Call Data

ElevenLabs can send webhooks after each conversation:

### Post-Call Transcription Webhook

Configure in ElevenLabs dashboard to receive conversation data:

```json
{
  "type": "post_call_transcription",
  "event_timestamp": 1739537297,
  "data": {
    "agent_id": "xyz",
    "conversation_id": "abc",
    "status": "done",
    "transcript": [
      {
        "role": "agent",
        "message": "Good morning! How did your morning routine go today?",
        "time_in_call_secs": 0
      },
      {
        "role": "user", 
        "message": "It went great! I completed my meditation.",
        "time_in_call_secs": 3
      }
    ],
    "metadata": {
      "call_duration_secs": 45,
      "cost": 150
    },
    "analysis": {
      "call_successful": "success",
      "transcript_summary": "User reported completing their morning meditation..."
    }
  }
}
```

**Webhook endpoint (Supabase Edge Function):**
```typescript
// supabase/functions/elevenlabs-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const payload = await req.json();
  
  if (payload.type === 'post_call_transcription') {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Store conversation data
    await supabase.from('coach_conversations').insert({
      conversation_id: payload.data.conversation_id,
      user_id: payload.data.conversation_initiation_client_data?.dynamic_variables?.user_id,
      transcript: payload.data.transcript,
      summary: payload.data.analysis?.transcript_summary,
      duration_secs: payload.data.metadata.call_duration_secs,
    });
  }

  return new Response('OK', { status: 200 });
});
```

## Dynamic Variables

Pass user-specific data to personalize conversations:

```typescript
await conversation.startSession({
  agentId: 'your-agent-id',
  dynamicVariables: {
    user_name: 'Cole',
    morning_routine_status: 'incomplete',
    current_time: new Date().toLocaleTimeString(),
    todays_priority: 'Complete the project proposal',
  },
});
```

In your agent prompt, reference these as `{{user_name}}`, `{{morning_routine_status}}`, etc.

## Conversation Initiation Data Webhook

For fetching user-specific data BEFORE the conversation starts:

Configure a webhook in ElevenLabs that gets called when a session starts:

```json
{
  "url": "https://your-project.supabase.co/functions/v1/init-conversation",
  "request_headers": {
    "Authorization": "Bearer {{secret}}"
  }
}
```

Your endpoint returns data that populates dynamic variables:

```typescript
// Response from your init endpoint
{
  "dynamic_variables": {
    "user_name": "Cole",
    "routine_progress": "3 of 5 items complete",
    "pending_tasks": ["Meditation", "Journaling"]
  }
}
```

## Best Practices

### 1. Permission Handling

Always request microphone permission before starting a conversation:

```typescript
import { PermissionsAndroid, Platform } from 'react-native';

const requestMicPermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'TodayMatters needs microphone access for voice conversations with your coach.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // iOS handled by Info.plist
};
```

### 2. iOS-Specific Considerations

```typescript
const conversation = useConversation({
  preferHeadphonesForIosDevices: true, // Better audio routing
  connectionDelay: {
    android: 3000, // Android needs time to switch audio modes
    ios: 0,
    default: 0,
  },
});
```

### 3. Wake Lock

Keep the screen on during conversations:

```typescript
const conversation = useConversation({
  useWakeLock: true, // Prevents device sleep during conversation
});
```

### 4. Error Handling

```typescript
const conversation = useConversation({
  onError: (error) => {
    console.error('Conversation error:', error);
    // Show user-friendly error message
    Alert.alert(
      'Connection Issue',
      'Unable to connect to your coach. Please check your internet connection.'
    );
  },
});
```

### 5. Contextual Updates

Keep the agent informed of app state changes:

```typescript
// When user navigates to a different screen
useEffect(() => {
  if (conversation.status === 'connected') {
    conversation.sendContextualUpdate(
      `User navigated to ${currentScreen}. Adjust conversation if relevant.`
    );
  }
}, [currentScreen]);
```

## Environment Variables Required

```bash
# .env (mobile app - only non-sensitive values)
EXPO_PUBLIC_ELEVENLABS_AGENT_ID=your-public-agent-id

# Supabase Edge Functions secrets
ELEVENLABS_API_KEY=xi_xxxxxxxxxxxxxx
ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxxx
ELEVENLABS_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxx
```

## Cost Considerations

ElevenLabs Conversational AI pricing (as of late 2024):
- Per-minute pricing based on usage
- Includes STT + LLM + TTS costs
- Development discount available
- Check current pricing at elevenlabs.io/pricing

## ✅ Implementation Complete

The following has been implemented in this codebase:

### Installed Dependencies
- `@elevenlabs/react-native` - Official React Native SDK
- `@livekit/react-native` - Real-time audio streaming
- `@livekit/react-native-webrtc` - WebRTC for React Native
- `@config-plugins/react-native-webrtc` - Expo config plugin
- `@livekit/react-native-expo-plugin` - LiveKit Expo plugin
- `livekit-client` - LiveKit client library

### Created Files

**Mobile App:**
- `src/lib/elevenlabs/` - Configuration, types, and permission utilities
- `src/hooks/use-voice-coach.ts` - Comprehensive hook for voice conversations
- `src/components/organisms/VoiceCoachButton.tsx` - Floating action button
- `src/components/organisms/VoiceCoachModal.tsx` - Full-screen modal UI
- Updated `app.json` with microphone permissions and plugins
- Updated `_layout.tsx` with ElevenLabsProvider

**Supabase Edge Functions:**
- `supabase/functions/conversation-token/` - Token generation for private agents
- `supabase/functions/elevenlabs-webhook/` - Post-call data handling
- `supabase/functions/agent-tools/` - Server-side tool execution
- `supabase/migrations/` - Database schema for storing conversations

## Next Steps to Complete Setup

### 1. Set Up Environment Variables

**In your mobile `.env` file, add:**
```bash
# ElevenLabs Agent ID (from ElevenLabs dashboard)
EXPO_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id_here

# Set to 'true' if your agent is private
EXPO_PUBLIC_ELEVENLABS_PRIVATE_AGENT=false
```

**In Supabase Edge Function secrets, add:**
```bash
supabase secrets set ELEVENLABS_API_KEY=xi_your_api_key_here
supabase secrets set ELEVENLABS_AGENT_ID=your_agent_id_here
supabase secrets set ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here
```

### 2. Create an ElevenLabs Agent

1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Create a new agent with your coaching persona
3. Configure the agent prompt (see `docs/elevenlabs-voice-agent-integration.md` for prompt guidance)
4. Copy the Agent ID to your environment variables

### 3. Run Expo Prebuild

Since WebRTC requires native code:
```bash
cd apps/mobile
npx expo prebuild
```

### 4. Deploy Supabase Edge Functions

```bash
# From project root
supabase functions deploy conversation-token
supabase functions deploy elevenlabs-webhook
supabase functions deploy agent-tools
```

### 5. Configure Webhooks in ElevenLabs

In your ElevenLabs agent settings:
1. Go to "Webhooks" section
2. Add your webhook URL: `https://your-project.supabase.co/functions/v1/elevenlabs-webhook`
3. Enable "Post-call transcription" events

### 6. Run the Database Migration

```bash
supabase db push
# or apply the migration manually in Supabase dashboard
```

### 7. Test on Physical Device

```bash
pnpm --filter mobile ios
# or
pnpm --filter mobile android
```

## Usage Example

```tsx
import { VoiceCoachButton, VoiceCoachModal } from '@/components/organisms';
import { useState } from 'react';

export function HomeScreen() {
  const [showModal, setShowModal] = useState(false);

  return (
    <View className="flex-1">
      {/* Your screen content */}
      
      {/* Option 1: Floating button */}
      <VoiceCoachButton 
        currentScreen="home"
        dynamicVariables={{ todays_priority: 'Complete morning routine' }}
      />
      
      {/* Option 2: Modal (trigger with your own button) */}
      <Button onPress={() => setShowModal(true)}>
        Talk to Coach
      </Button>
      
      <VoiceCoachModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        dynamicVariables={{ routine_status: '3 of 5 complete' }}
      />
    </View>
  );
}
```

## Reference Links

- [ElevenLabs React Native SDK Docs](https://elevenlabs.io/docs/agents-platform/libraries/react-native)
- [Expo React Native Cookbook](https://elevenlabs.io/docs/cookbooks/agents-platform/expo-react-native)
- [Agent Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)
- [Tools Configuration](https://elevenlabs.io/docs/agents-platform/customization/tools)
- [Webhooks Documentation](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks)

