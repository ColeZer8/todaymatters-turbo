# ElevenLabs (Official) — React Native / Expo Realtime Agent Notes

## Official docs

- React Native SDK (Agents Platform): `https://elevenlabs.io/docs/agents-platform/libraries/react-native`
- Expo React Native cookbook: `https://elevenlabs.io/docs/cookbooks/agents-platform/expo-react-native`

## Key requirements (per ElevenLabs)

- Your component using `useConversation()` **must** be rendered under `<ElevenLabsProvider>`.
- Expo Go is **not supported** (LiveKit WebRTC dependency). Use a **development build**.
- `startSession()`:
  - **Public agent**: `startSession({ agentId })`
  - **Private agent**: `startSession({ conversationToken })` where token is generated server-side using your ElevenLabs API key.
- `getId()` returns the conversation ID after start.

## This repo (TodayMatters) specifics

- `apps/mobile/src/app/_layout.tsx` wraps the app in `ElevenLabsProvider` (dev builds only).
- Voice UI is mounted by `VoiceCoachOverlay` (feature-level, not a route) and uses the existing `use-voice-coach` hook.
- Supabase Edge Function `conversation-token` is used to generate private-agent tokens (keeps API key server-side).


