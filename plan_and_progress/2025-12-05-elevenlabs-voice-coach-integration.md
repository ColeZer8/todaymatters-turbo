# ElevenLabs Voice Coach Integration

**Status:** Disabled (TODO)  
**Date Started:** 2025-12-04  
**Date Completed:** 2025-12-05  
**Date Disabled:** 2025-12-05

---

> ⚠️ **TEMPORARILY DISABLED**
>
> Voice coach feature is temporarily disabled pending further development. All code structure has been preserved - search for `TODO: Re-enable ElevenLabs` to find all disabled sections.
>
> **To re-enable:**
>
> 1. `apps/mobile/src/app/_layout.tsx` - Uncomment `ElevenLabsProvider` loading
> 2. `apps/mobile/src/components/templates/HomeTemplate.tsx` - Uncomment `VoiceCoachButton`
> 3. `apps/mobile/src/components/organisms/index.ts` - Uncomment exports
> 4. `supabase/functions/*/index.ts` - Set `ELEVENLABS_DISABLED = false`

---

## Objective

Integrate ElevenLabs Conversational AI voice agent into the TodayMatters mobile app, enabling users to have real-time voice conversations with an AI coach.

## Scope

- Install and configure ElevenLabs React Native SDK
- Set up native permissions for microphone access (iOS/Android)
- Create voice coach hook (`useVoiceCoach`) with full conversation management
- Build UI components (VoiceCoachButton, VoiceCoachModal)
- Configure Supabase Edge Functions for secure token generation and webhooks
- Add database tables for storing conversation history and insights

## Done Criteria

- [x] ElevenLabs SDK installed and configured
- [x] Native permissions configured in `app.json`
- [x] `useVoiceCoach` hook with connection management
- [x] `VoiceCoachButton` floating action button component
- [x] `VoiceCoachModal` full-screen conversation interface
- [x] `ElevenLabsProvider` wrapping app in `_layout.tsx`
- [x] Voice button visible on Home screen
- [x] Supabase Edge Functions created (conversation-token, elevenlabs-webhook, agent-tools)
- [x] Database migration for coach_conversations table

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App (Expo)                        │
├─────────────────────────────────────────────────────────────┤
│  _layout.tsx                                                 │
│  └── ElevenLabsProvider (wraps entire app)                  │
│       └── App Screens                                        │
│            └── HomeTemplate                                  │
│                 └── VoiceCoachButton                        │
│                      └── useVoiceCoach hook                 │
│                           └── useConversation (ElevenLabs)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebRTC/LiveKit
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ElevenLabs Cloud                          │
│  - Voice Agent Processing                                    │
│  - Speech-to-Text / Text-to-Speech                          │
│  - Conversation Management                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Webhooks
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Edge Functions                     │
│  - conversation-token: Generate secure session tokens        │
│  - elevenlabs-webhook: Receive post-call data               │
│  - agent-tools: Handle server-side tool calls               │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files

### Mobile App

| File                                                        | Purpose                                     |
| ----------------------------------------------------------- | ------------------------------------------- |
| `apps/mobile/src/app/_layout.tsx`                           | Root layout with `ElevenLabsProvider`       |
| `apps/mobile/src/hooks/use-voice-coach.ts`                  | Main hook for voice conversation management |
| `apps/mobile/src/components/organisms/VoiceCoachButton.tsx` | Floating action button to start voice       |
| `apps/mobile/src/components/organisms/VoiceCoachModal.tsx`  | Full-screen voice conversation UI           |
| `apps/mobile/src/lib/elevenlabs/config.ts`                  | ElevenLabs configuration (agent ID, etc.)   |
| `apps/mobile/src/lib/elevenlabs/types.ts`                   | TypeScript types for voice coach            |
| `apps/mobile/src/lib/elevenlabs/permissions.ts`             | Microphone permission helpers               |
| `apps/mobile/app.json`                                      | Native permissions (iOS/Android)            |

### Supabase

| File                                                          | Purpose                            |
| ------------------------------------------------------------- | ---------------------------------- |
| `supabase/functions/conversation-token/index.ts`              | Generate ElevenLabs session tokens |
| `supabase/functions/elevenlabs-webhook/index.ts`              | Handle post-call webhooks          |
| `supabase/functions/agent-tools/index.ts`                     | Server-side tool execution         |
| `supabase/migrations/20241204_create_coach_conversations.sql` | Database tables                    |

---

## Environment Variables Required

Add to ElevenLabs dashboard and Supabase:

```bash
# ElevenLabs
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_AGENT_ID=your_agent_id

# In apps/mobile/src/lib/elevenlabs/config.ts
export const ELEVENLABS_CONFIG = {
  agentId: 'your_agent_id',
  isPrivateAgent: true, // Set based on your agent configuration
};
```

---

## Running the App

### Development Build (Required for Voice Features)

Voice features require native modules (LiveKit/WebRTC) that are **NOT available in Expo Go**.

```bash
# Build and run on iOS
cd apps/mobile
npx expo prebuild --clean
npx expo run:ios

# Or for Android
npx expo run:android
```

### Expo Go (Voice Disabled)

If running in Expo Go, the app will crash on import of ElevenLabs modules. To test other features without voice:

1. Comment out `ElevenLabsProvider` in `_layout.tsx`
2. Remove `VoiceCoachButton` from `HomeTemplate.tsx`

---

## Client Tools

The voice agent can trigger these actions on the mobile app:

| Tool                 | Description                                         |
| -------------------- | --------------------------------------------------- |
| `navigate_to_screen` | Navigate to a specific app screen                   |
| `open_feature`       | Open a specific feature (calendar, analytics, etc.) |
| `mark_task_complete` | Mark a routine item as complete                     |
| `show_routine_item`  | Display details of a routine item                   |
| `play_celebration`   | Trigger a celebration animation                     |

---

## Dynamic Variables

Context passed to the AI agent at conversation start:

| Variable         | Description                          |
| ---------------- | ------------------------------------ |
| `user_name`      | User's display name                  |
| `user_id`        | Supabase user ID                     |
| `current_time`   | Current time (HH:MM format)          |
| `time_of_day`    | "morning", "afternoon", or "evening" |
| `current_screen` | Which screen the user is on          |

---

## Troubleshooting

### "useConversation must be used within ElevenLabsProvider"

The `ElevenLabsProvider` is not wrapping your component. Ensure `_layout.tsx` has:

```tsx
import { ElevenLabsProvider } from "@elevenlabs/react-native";

// In the return:
<ElevenLabsProvider>{appContent}</ElevenLabsProvider>;
```

### "@livekit/react-native doesn't seem to be linked"

You're running in Expo Go. Voice features require a development build:

```bash
npx expo prebuild --clean
npx expo run:ios
```

### Microphone permission denied

Ensure `app.json` has the correct permissions:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "TodayMatters uses your microphone..."
      }
    },
    "android": {
      "permissions": ["android.permission.RECORD_AUDIO"]
    }
  }
}
```

---

## Future Enhancements

- [ ] Persist conversation history to Supabase
- [ ] Add voice activity visualization
- [ ] Implement conversation summaries via post-call webhook
- [ ] Add voice settings (speed, voice selection)
- [ ] Support for background audio mode
- [ ] Add haptic feedback during conversations

---

## References

- [ElevenLabs React Native SDK](https://www.npmjs.com/package/@elevenlabs/react-native)
- [ElevenLabs Conversational AI Docs](https://elevenlabs.io/docs/conversational-ai)
- [LiveKit React Native](https://docs.livekit.io/client-sdk-react-native/)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
